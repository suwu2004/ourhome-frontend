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
    static final String REMOTE_TOPIC = "ourhome-owner";
    static final String EXTRA_PUSH_ROUTE = "ourhome_push_route";
    static final String EXTRA_PUSH_TYPE = "ourhome_push_type";

    private static WeakReference<OurHomeNotificationsPlugin> activePlugin = new WeakReference<>(null);
    private static JSObject pendingRemoteRoute = null;

    @Override
    public void load() {
        super.load();
        activePlugin = new WeakReference<>(this);
        OurHomeReminderReceiver.createChannel(getContext());
        if (isRemoteEnabled(getContext())) restoreRemoteTopicSubscription(getContext());
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
        result.put("topic", REMOTE_TOPIC);
        call.resolve(result);
    }

    @PluginMethod
    public void registerRemotePush(PluginCall call) {
        if (!ensureFirebaseApp(getContext())) {
            JSObject result = new JSObject();
            result.put("configured", false);
            result.put("enabled", false);
            result.put("topic", REMOTE_TOPIC);
            result.put("reason", "firebase-config-missing");
            call.resolve(result);
            return;
        }
        FirebaseMessaging.getInstance().subscribeToTopic(REMOTE_TOPIC).addOnCompleteListener(task -> {
            JSObject result = new JSObject();
            result.put("configured", true);
            result.put("topic", REMOTE_TOPIC);
            if (task.isSuccessful()) {
                getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit()
                        .putBoolean(PREF_REMOTE_ENABLED, true)
                        .apply();
                result.put("enabled", true);
                call.resolve(result);
            } else {
                result.put("enabled", false);
                result.put("reason", task.getException() == null ? "subscribe-failed" : task.getException().getMessage());
                call.resolve(result);
            }
        });
    }

    @PluginMethod
    public void unregisterRemotePush(PluginCall call) {
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(PREF_REMOTE_ENABLED, false)
                .apply();
        if (!ensureFirebaseApp(getContext())) {
            JSObject result = new JSObject();
            result.put("configured", false);
            result.put("enabled", false);
            result.put("topic", REMOTE_TOPIC);
            call.resolve(result);
            return;
        }
        FirebaseMessaging.getInstance().unsubscribeFromTopic(REMOTE_TOPIC).addOnCompleteListener(task -> {
            JSObject result = new JSObject();
            result.put("configured", true);
            result.put("enabled", false);
            result.put("topic", REMOTE_TOPIC);
            if (!task.isSuccessful()) {
                result.put("reason", task.getException() == null ? "unsubscribe-failed" : task.getException().getMessage());
            }
            call.resolve(result);
        });
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

    static boolean ensureFirebaseApp(Context context) {
        try {
            if (!FirebaseApp.getApps(context).isEmpty()) return true;
            return FirebaseApp.initializeApp(context) != null;
        } catch (RuntimeException error) {
            return false;
        }
    }

    static void restoreRemoteTopicSubscription(Context context) {
        if (!isRemoteEnabled(context) || !ensureFirebaseApp(context)) return;
        FirebaseMessaging.getInstance().subscribeToTopic(REMOTE_TOPIC);
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
