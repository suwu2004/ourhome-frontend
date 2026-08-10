package com.ourhome.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OurHomeUpdaterPlugin.class);
        registerPlugin(OurHomeNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
        OurHomeNotificationsPlugin.handleRemoteIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        OurHomeNotificationsPlugin.handleRemoteIntent(intent);
    }
}
