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

import org.json.JSONException;
import org.json.JSONObject;

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
    private static final String PREFS = "ourhome_notification_reminders";
    private static final String PREF_IDS = "scheduled_ids";

    @Override
    public void load() {
        super.load();
        OurHomeReminderReceiver.createChannel(getContext());
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

    public static int requestCodeFor(String id) {
        if (id == null) return 1;
        int hash = id.hashCode() & 0x7fffffff;
        return hash == 0 ? 1 : hash;
    }
}
