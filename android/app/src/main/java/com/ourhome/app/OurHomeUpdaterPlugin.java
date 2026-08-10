package com.ourhome.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "OurHomeUpdater")
public class OurHomeUpdaterPlugin extends Plugin {
    private static final int MAX_DOWNLOAD_ATTEMPTS = 3;
    private static final long MIN_APK_BYTES = 100_000L;
    private static final long PROGRESS_EMIT_STEP_BYTES = 256 * 1024L;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        Long expectedBytesValue = call.getLong("expectedBytes");
        long expectedBytes = expectedBytesValue == null ? 0L : Math.max(0L, expectedBytesValue);
        String sha256 = normalizeSha256(call.getString("sha256"));
        if (!isTrustedInitialUrl(url)) {
            call.reject("Update URL is not trusted.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settingsIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName())
            );
            getActivity().startActivity(settingsIntent);
            JSObject result = new JSObject();
            result.put("status", "permission-required");
            call.resolve(result);
            return;
        }

        executor.execute(() -> {
            try {
                File updateDir = new File(getContext().getCacheDir(), "updates");
                if (!updateDir.exists() && !updateDir.mkdirs()) {
                    throw new IOException("Could not prepare update directory.");
                }
                File apkFile = new File(updateDir, "OurHome-latest.apk");
                File partialFile = new File(updateDir, "OurHome-latest.apk.part");
                emitProgress("preparing", partialFile.exists() ? partialFile.length() : 0L, expectedBytes);
                downloadApkWithRetry(url, partialFile, apkFile, expectedBytes, sha256);
                emitProgress("opening-installer", apkFile.length(), expectedBytes);

                Uri apkUri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        apkFile
                );
                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                getActivity().runOnUiThread(() -> {
                    try {
                        getActivity().startActivity(installIntent);
                        JSObject result = new JSObject();
                        result.put("status", "installer-opened");
                        call.resolve(result);
                    } catch (Exception error) {
                        call.reject("Could not open Android installer.", error);
                    }
                });
            } catch (Exception error) {
                getActivity().runOnUiThread(() -> call.reject("Update download failed after retries.", error));
            }
        });
    }

    private void downloadApkWithRetry(
            String sourceUrl,
            File partialFile,
            File destination,
            long expectedBytes,
            String sha256
    ) throws IOException {
        if (expectedBytes > 0 && partialFile.exists() && partialFile.length() > expectedBytes) {
            partialFile.delete();
        }

        IOException lastError = null;
        for (int attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
            try {
                downloadApkAttempt(sourceUrl, partialFile, expectedBytes);
                emitProgress("verifying", partialFile.length(), expectedBytes);
                validateApk(partialFile, expectedBytes, sha256);
                emitProgress("ready", partialFile.length(), expectedBytes);
                replaceDestination(partialFile, destination);
                return;
            } catch (IOException error) {
                lastError = error;
                if (isIntegrityFailure(error)) partialFile.delete();
                if (attempt >= MAX_DOWNLOAD_ATTEMPTS) break;
                emitProgress("retrying", partialFile.exists() ? partialFile.length() : 0L, expectedBytes);
                try {
                    Thread.sleep(900L * attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IOException("Update download interrupted.", interrupted);
                }
            }
        }
        throw lastError == null ? new IOException("Update download failed.") : lastError;
    }

    private void downloadApkAttempt(String sourceUrl, File destination, long expectedBytes) throws IOException {
        long existingBytes = destination.exists() ? destination.length() : 0L;
        if (expectedBytes > 0 && existingBytes == expectedBytes) return;

        HttpURLConnection connection = openTrustedConnection(sourceUrl, existingBytes);
        boolean append = existingBytes > 0 && connection.getResponseCode() == HttpURLConnection.HTTP_PARTIAL;
        long downloadedBytes = append ? existingBytes : 0L;
        long lastEmittedBytes = downloadedBytes;
        emitProgress("downloading", downloadedBytes, expectedBytes);
        try (InputStream input = connection.getInputStream();
             FileOutputStream output = new FileOutputStream(destination, append)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
                downloadedBytes += read;
                if (downloadedBytes - lastEmittedBytes >= PROGRESS_EMIT_STEP_BYTES
                        || (expectedBytes > 0 && downloadedBytes >= expectedBytes)) {
                    emitProgress("downloading", downloadedBytes, expectedBytes);
                    lastEmittedBytes = downloadedBytes;
                }
            }
            output.flush();
        } finally {
            connection.disconnect();
        }
        if (downloadedBytes != lastEmittedBytes) emitProgress("downloading", downloadedBytes, expectedBytes);

        if (expectedBytes > 0 && destination.length() < expectedBytes) {
            throw new IOException("Update download incomplete; retry can resume.");
        }
    }

    private HttpURLConnection openTrustedConnection(String sourceUrl, long offset) throws IOException {
        URL current = new URL(sourceUrl);
        for (int redirect = 0; redirect < 6; redirect++) {
            if (!isTrustedRedirectUrl(current)) throw new IOException("Untrusted update redirect.");
            HttpURLConnection connection = (HttpURLConnection) current.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(60_000);
            connection.setRequestProperty("User-Agent", "OurHome-Android-Updater");
            connection.setRequestProperty("Accept-Encoding", "identity");
            if (offset > 0) connection.setRequestProperty("Range", "bytes=" + offset + "-");
            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.trim().isEmpty()) throw new IOException("Missing update redirect.");
                current = new URL(current, location);
                continue;
            }
            if (status == 416 && offset > 0) {
                connection.disconnect();
                throw new IOException("Partial update range is stale; restarting safely.");
            }
            if (status != HttpURLConnection.HTTP_OK && status != HttpURLConnection.HTTP_PARTIAL) {
                connection.disconnect();
                throw new IOException("Update server returned " + status + ".");
            }
            return connection;
        }
        throw new IOException("Too many update redirects.");
    }

    private void validateApk(File file, long expectedBytes, String sha256) throws IOException {
        long size = file.length();
        if (size < MIN_APK_BYTES) {
            throw new IOException("Integrity failure: downloaded update is unexpectedly small.");
        }
        if (expectedBytes > 0 && size != expectedBytes) {
            throw new IOException("Integrity failure: update size does not match release metadata.");
        }
        if (!sha256.isEmpty() && !sha256.equalsIgnoreCase(fileSha256(file))) {
            throw new IOException("Integrity failure: update checksum does not match release metadata.");
        }
    }

    private String fileSha256(File file) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = new FileInputStream(file)) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
            }
            StringBuilder hex = new StringBuilder();
            for (byte value : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", value));
            return hex.toString();
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IOException("SHA-256 is unavailable.", error);
        }
    }

    private void replaceDestination(File source, File destination) throws IOException {
        if (destination.exists() && !destination.delete()) {
            throw new IOException("Could not replace previous update package.");
        }
        if (source.renameTo(destination)) return;
        try (InputStream input = new FileInputStream(source);
             FileOutputStream output = new FileOutputStream(destination, false)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            output.flush();
        }
        source.delete();
    }

    private boolean isIntegrityFailure(IOException error) {
        return String.valueOf(error.getMessage()).startsWith("Integrity failure:")
                || String.valueOf(error.getMessage()).contains("range is stale");
    }

    private void emitProgress(String phase, long downloadedBytes, long totalBytes) {
        final long safeDownloaded = Math.max(0L, downloadedBytes);
        final long safeTotal = Math.max(0L, totalBytes);
        final int percent = safeTotal > 0L
                ? (int) Math.max(0L, Math.min(100L, Math.round((safeDownloaded * 100.0d) / safeTotal)))
                : -1;
        JSObject data = new JSObject();
        data.put("phase", phase);
        data.put("downloadedBytes", safeDownloaded);
        data.put("totalBytes", safeTotal);
        data.put("percent", percent);
        getActivity().runOnUiThread(() -> notifyListeners("downloadProgress", data));
    }

    private String normalizeSha256(String value) {
        String normalized = String.valueOf(value == null ? "" : value).trim().toLowerCase(Locale.ROOT);
        return normalized.matches("[a-f0-9]{64}") ? normalized : "";
    }

    private boolean isTrustedInitialUrl(String value) {
        try {
            URL url = new URL(value);
            return "https".equalsIgnoreCase(url.getProtocol())
                    && "github.com".equalsIgnoreCase(url.getHost())
                    && url.getPath().startsWith("/suwu2004/ourhome-frontend/releases/download/")
                    && url.getPath().toLowerCase(Locale.ROOT).endsWith(".apk");
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isTrustedRedirectUrl(URL url) {
        if (!"https".equalsIgnoreCase(url.getProtocol())) return false;
        String host = String.valueOf(url.getHost()).toLowerCase(Locale.ROOT);
        return host.equals("github.com") || host.endsWith(".githubusercontent.com");
    }
}