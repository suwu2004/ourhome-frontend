# OurHome Android

The Android shell is powered by Capacitor and uses the production OurHome backend.

## Build a debug APK

```bash
npm ci
npm run android:apk
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Target devices

- vivo Android phones: portrait layout, safe areas, native back navigation
- Huawei Android tablets: portrait and landscape responsive layouts

For distribution outside local testing, create a private release signing key and build a signed release APK or AAB. Never commit that key to this repository.
