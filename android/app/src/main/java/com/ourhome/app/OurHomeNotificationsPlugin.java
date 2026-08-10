package com.ourhome.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONException;
import org.json.JSONObject;

import java.lang.ref.WeakReference;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(
        name = "OurHomeNotifications",
        permissions = {
                @Permission(
                        alias = "notifications",
                        strings = { Manifest.permission.POST_NOTIFICATIONS }
                )
        }
)
public class OurHomeNotificationsPlugin extends Plugin {
    static final String PREFS = "ourhome_notification_reminders";
    private static final String PREF_IDS = "scheduled_ids";
    private static final String PREF_REMOTE_ENABLED = "remote_push_enabled";
    private static final String PREF_REMOTE_TOKEN = "remote_push_token";
    static final String EXTRA_PUSH_ROUTE = "ourhome_push_route";
    static final String EXTRA_PUSH_TYPE = "ourhome_push_type";

    private static WeakReference<OurHomeNotificationsPlugin> activePlugin = new WeakReference<>(null);
    private static JSObject pendingRemoteRoute = null;

    @Override
    public void load() {
        super.load();
        activePlugin = new WeakReference<>(this);
        OurHomeReminderReceiver.createChannel(getContext());
        if (isRemoteEnabled(getContext()) && ensureFirebaseApp(getContext())) {
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> rememberRemoteToken(getContext(), token));
        }
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        resolvePermission(call);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            resolvePermission(call);
            return;
        }
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            resolvePermission(call);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        resolvePermission(call);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getRemotePushStatus(PluginCall call) {
        JSObject result = new JSObject();
        boolean configured = ensureFirebaseApp(getContext());
        result.put("configured", configured);
        result.put("enabled", configured && isRemoteEnabled(getContext()));
        result.put("token", configured ? readRemoteToken(getContext()) : "");
        call.resolve(result);
    }

    @PluginMethod
    public void registerRemotePush(PluginCall call) {
        if (!ensureFirebaseApp(getContext())) {
            JSObject result = new JSObject();
            result.put("configured", false);
            result.put("enabled", false);
            result.put("token", "");
            result.put("reason", "firebase-config-missing");
            call.resolve(result);
            return;
        }
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            JSObject result = new JSObject();
            result.put("configured", true);
            if (task.isSuccessful() && task.getResult() != null && !task.getResult().isBlank()) {
                String token = task.getResult();
                getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit()
                        .putBoolean(PREF_REMOTE_ENABLED, true)
                        .putString(PREF_REMOTE_TOKEN, token)
                        .apply();
                result.put("enabled", true);
                result.put("token", token);
                call.resolve(result);
            } else {
                result.put("enabled", false);
                result.put("token", "");
                result.put("reason", task.getException() == null ? "token-unavailable" : task.getException().getMessage());
                call.resolve(result);
            }
        });
    }

    @PluginMethod
    public void unregisterRemotePush(PluginCall call) {
        String token = readRemoteToken(getContext());
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(PREF_REMOTE_ENABLED, false)
                .apply();
        JSObject result = new JSObject();
        result.put("configured", ensureFirebaseApp(getContext()));
        result.put("enabled", false);
        result.put("token", token);
        call.resolve(result);
    }

    @PluginMethod
    public void consumeRemotePushRoute(PluginCall call) {
        JSObject result;
        synchronized (OurHomeNotificationsPlugin.class) {
            result = pendingRemoteRoute == null ? new JSObject() : pendingRemoteRoute;
            pendingRemoteRoute = null;
        }
        call.resolve(result);
    }

    @PluginMethod
    public void syncReminders(PluginCall call) {
        JSArray reminders = call.getArray("reminders", new JSArray());
        Set<String> nextIds = new HashSet<>();
        long now = System.currentTimeMillis();

        for (int i = 0; i < reminders.length(); i++) {
            try {
                JSONObject reminder = reminders.getJSONObject(i);
                String id = reminder.optString("id", "");
                long at = reminder.optLong("at", 0L);
                if (id.isBlank() || at <= now) continue;
                nextIds.add(id);
                scheduleReminder(
                        id,
                        reminder.optString("title", "OurHome 提醒"),
                        reminder.optString("body", "别忘了我们约好的事呀。"),
                        at
                );
            } catch (JSONException ignored) {
                // Skip malformed reminder entries instead of breaking all reminders.
            }
        }

        Set<String> previousIds = getContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getStringSet(PREF_IDS, new HashSet<>());
        for (String id : new HashSet<>(previousIds)) {
            if (!nextIds.contains(id)) cancelReminderInternal(id);
        }
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putStringSet(PREF_IDS, nextIds)
                .apply();

        JSObject result = new JSObject();
        result.put("scheduled", nextIds.size());
        call.resolve(result);
    }

    @PluginMethod
    public void cancelReminder(PluginCall call) {
        String id = call.getString("id", "");
        if (!id.isBlank()) {
            cancelReminderInternal(id);
            Set<String> ids = new HashSet<>(getContext()
                    .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .getStringSet(PREF_IDS, new HashSet<>()));
            ids.remove(id);
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putStringSet(PREF_IDS, ids)
                    .apply();
        }
        call.resolve();
    }

    private void resolvePermission(PluginCall call) {
        String status;
        boolean notificationsEnabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            PermissionState state = getPermissionState("notifications");
            if (state == PermissionState.PROMPT) {
                status = "default";
            } else if (state == PermissionState.PROMPT_WITH_RATIONALE) {
                status = "prompt-with-rationale";
            } else {
                status = state == PermissionState.GRANTED && notificationsEnabled ? "granted" : "denied";
            }
        } else {
            status = notificationsEnabled ? "granted" : "denied";
        }
        JSObject result = new JSObject();
        result.put("status", status);
        call.resolve(result);
    }

    private void scheduleReminder(String id, String title, String body, long at) {
        AlarmManager manager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        PendingIntent pendingIntent = reminderPendingIntent(id, title, body);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pendingIntent);
        } else {
            manager.set(AlarmManager.RTC_WAKEUP, at, pendingIntent);
        }
    }

    private void cancelReminderInternal(String id) {
        AlarmManager manager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        PendingIntent pendingIntent = reminderPendingIntent(id, "", "");
        manager.cancel(pendingIntent);
        pendingIntent.cancel();
    }

    private PendingIntent reminderPendingIntent(String id, String title, String body) {
        Intent intent = new Intent(getContext(), OurHomeReminderReceiver.class);
        intent.setAction("com.ourhome.app.REMINDER." + id);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        return PendingIntent.getBroadcast(
                getContext(),
                requestCodeFor(id),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    static boolean isRemoteEnabled(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getBoolean(PREF_REMOTE_ENABLED, false);
    }

    static String readRemoteToken(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(PREF_REMOTE_TOKEN, "");
    }

    static boolean ensureFirebaseApp(Context context) {
        try {
            if (!FirebaseApp.getApps(context).isEmpty()) return true;
            return FirebaseApp.initializeApp(context) != null;
        } catch (RuntimeException error) {
            return false;
        }
    }

    static void rememberRemoteToken(Context context, String token) {
        if (token == null || token.isBlank()) return;
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(PREF_REMOTE_TOKEN, token)
                .apply();
        OurHomeNotificationsPlugin plugin = activePlugin.get();
        if (plugin != null && isRemoteEnabled(context)) {
            JSObject payload = new JSObject();
            payload.put("token", token);
            plugin.notifyListeners("remotePushTokenChanged", payload, true);
        }
    }

    static void handleRemoteIntent(Intent intent) {
        if (intent == null) return;
        String route = intent.getStringExtra(EXTRA_PUSH_ROUTE);
        String type = intent.getStringExtra(EXTRA_PUSH_TYPE);
        if ((route == null || route.isBlank()) && (type == null || type.isBlank())) return;

        JSObject payload = new JSObject();
        payload.put("route", route == null || route.isBlank() ? "home" : route);
        payload.put("type", type == null ? "remote_push" : type);
        copyIntentExtra(intent, payload, "session_id");
        copyIntentExtra(intent, payload, "message_id");
        copyIntentExtra(intent, payload, "schedule_id");

        synchronized (OurHomeNotificationsPlugin.class) {
            pendingRemoteRoute = payload;
        }
        OurHomeNotificationsPlugin plugin = activePlugin.get();
        if (plugin != null) plugin.notifyListeners("remotePushAction", payload, true);

        intent.removeExtra(EXTRA_PUSH_ROUTE);
        intent.removeExtra(EXTRA_PUSH_TYPE);
    }

    private static void copyIntentExtra(Intent intent, JSObject payload, String key) {
        String value = intent.getStringExtra(key);
        if (value != null && !value.isBlank()) payload.put(key, value);
    }

    public static int requestCodeFor(String id) {
        if (id == null) return 1;
        int hash = id.hashCode() & 0x7fffffff;
        return hash == 0 ? 1 : hash;
    }
}
