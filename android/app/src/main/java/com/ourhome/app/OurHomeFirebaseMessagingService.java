package com.ourhome.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class OurHomeFirebaseMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL_ID = "ourhome_remote";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        OurHomeNotificationsPlugin.rememberRemoteToken(this, token);
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        createChannel();

        Map<String, String> data = message.getData();
        String title = value(data, "title", "OurHome");
        String body = value(data, "body", "有一条新消息。晚点打开也还在。");
        String route = value(data, "route", "home");
        String type = value(data, "type", "remote_push");
        String messageKey = message.getMessageId() == null ? String.valueOf(System.currentTimeMillis()) : message.getMessageId();
        int notificationId = OurHomeNotificationsPlugin.requestCodeFor(messageKey);

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        openIntent.setAction("com.ourhome.app.REMOTE_PUSH." + notificationId);
        openIntent.putExtra(OurHomeNotificationsPlugin.EXTRA_PUSH_ROUTE, route);
        openIntent.putExtra(OurHomeNotificationsPlugin.EXTRA_PUSH_TYPE, type);
        copy(data, openIntent, "session_id");
        copy(data, openIntent, "message_id");
        copy(data, openIntent, "schedule_id");

        PendingIntent contentIntent = PendingIntent.getActivity(
                this,
                notificationId,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(contentIntent);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        try {
            NotificationManagerCompat.from(this).notify(notificationId, builder.build());
        } catch (SecurityException ignored) {
            // Notification permission can be revoked at any time.
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "OurHome 主动消息",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("陆泽主动消息、来信和远程提醒");
        manager.createNotificationChannel(channel);
    }

    private static String value(Map<String, String> data, String key, String fallback) {
        String value = data == null ? null : data.get(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    private static void copy(Map<String, String> data, Intent intent, String key) {
        String value = data == null ? null : data.get(key);
        if (value != null && !value.isBlank()) intent.putExtra(key, value);
    }
}
