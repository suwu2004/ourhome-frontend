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
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "OurHomeUpdater")
public class OurHomeUpdaterPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
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
                downloadApk(url, apkFile);

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
                getActivity().runOnUiThread(() -> call.reject("Update download failed.", error));
            }
        });
    }

    private void downloadApk(String sourceUrl, File destination) throws IOException {
        HttpURLConnection connection = openTrustedConnection(sourceUrl);
        long bytes = 0;
        try (InputStream input = connection.getInputStream();
             FileOutputStream output = new FileOutputStream(destination, false)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
                bytes += read;
            }
            output.flush();
        } finally {
            connection.disconnect();
        }
        if (bytes < 100_000) {
            destination.delete();
            throw new IOException("Downloaded update is unexpectedly small.");
        }
    }

    private HttpURLConnection openTrustedConnection(String sourceUrl) throws IOException {
        URL current = new URL(sourceUrl);
        for (int redirect = 0; redirect < 6; redirect++) {
            if (!isTrustedRedirectUrl(current)) throw new IOException("Untrusted update redirect.");
            HttpURLConnection connection = (HttpURLConnection) current.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(45_000);
            connection.setRequestProperty("User-Agent", "OurHome-Android-Updater");
            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.trim().isEmpty()) throw new IOException("Missing update redirect.");
                current = new URL(current, location);
                continue;
            }
            if (status != HttpURLConnection.HTTP_OK) {
                connection.disconnect();
                throw new IOException("Update server returned " + status + ".");
            }
            return connection;
        }
        throw new IOException("Too many update redirects.");
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
