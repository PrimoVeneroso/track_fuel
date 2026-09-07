import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const versionCode = Number(process.env.ANDROID_VERSION_CODE);
if (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
  throw new Error('ANDROID_VERSION_CODE deve essere un intero crescente tra 1 e 2100000000.');
}
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)) throw new Error('Versione package non valida.');
const javaDirectory = 'android/app/src/main/java/com/fueltrack/app';
await mkdir(javaDirectory, { recursive: true });
for (const name of ['MainActivity.java', 'BackupExportPlugin.java']) {
  await copyFile(`native/android/${name}`, `${javaDirectory}/${name}`);
}
const path = 'android/app/build.gradle';
let gradle = await readFile(path, 'utf8');
if (!/versionCode \d+/.test(gradle) || !/versionName "[^"]*"/.test(gradle)) {
  throw new Error('Template Gradle non riconosciuto.');
}
gradle = gradle.replace(/versionCode \d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]*"/, `versionName "${version}.${versionCode}"`);
const marker = '// Fuel Track release signing';
gradle = gradle.split(marker)[0].trimEnd();
gradle += `

${marker}
android {
    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
`;
await writeFile(path, gradle);
console.log(`Android: com.fueltrack.app, versionCode ${versionCode}, versionName ${version}.${versionCode}`);
