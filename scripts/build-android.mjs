import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const windows = process.platform === 'win32';
const wrapper = resolve('android', windows ? 'gradlew.bat' : 'gradlew');
if (!existsSync(wrapper)) throw new Error('Android 工程还没有生成，请先运行 npm run android:sync');

const result = spawnSync(wrapper, ['assembleDebug'], {
  cwd: resolve('android'),
  stdio: 'inherit',
  shell: windows,
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log('APK: android/app/build/outputs/apk/debug/app-debug.apk');
