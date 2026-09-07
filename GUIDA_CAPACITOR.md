# APK Android: build, backup e aggiornamenti

Il progetto usa Node.js 24 (`.nvmrc`, `engines.node >=24`), Bun 1.4.0 e Capacitor 8 bloccato in `bun.lock`. Il workflow installa con `--frozen-lockfile`, esegue test/lint/build e compila con JDK 21. Le Actions checkout/setup-node/upload-artifact usano la serie v6; è impostato anche `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` per le altre Actions JavaScript.

## Perché il vecchio APK risultava incompatibile

Il workflow precedente generava `assembleDebug` su runner temporanei, senza conservare il keystore: la firma poteva cambiare a ogni build. Android richiede lo stesso application ID e certificato di firma per aggiornare un'app. Il nuovo workflow conserva `com.fueltrack.app`, usa una chiave permanente dai GitHub Secrets e assegna `github.run_number` come `versionCode` crescente. Un nuovo run incrementa il codice; rieseguire lo stesso run mantiene lo stesso codice. Non rinominare il workflow azzerandone il contatore senza adeguare il versionCode.

Riferimento: [regole Android per gli aggiornamenti](https://developer.android.com/google/play/app-updates).

## Configurazione una tantum della firma

Se possiedi il keystore che ha firmato l'APK attualmente installato, riutilizzalo. Una chiave privata non si può ricavare dall'APK. Se non è recuperabile, prepara una nuova chiave permanente:

```bash
keytool -genkeypair -v -keystore fueltrack-release.jks -alias fueltrack -keyalg RSA -keysize 2048 -validity 10000
base64 -w 0 fueltrack-release.jks > fueltrack-release.base64
```

Il primo comando chiede la password. Conserva keystore e password in un archivio sicuro fuori dal repository. Non committare né la chiave né il file base64 (base64 non è cifratura).

In GitHub → repository → Settings → Secrets and variables → Actions crea questi **Repository secrets**:

| Nome | Valore |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Contenuto del file `fueltrack-release.base64` |
| `ANDROID_KEYSTORE_PASSWORD` | Password del keystore |
| `ANDROID_KEY_ALIAS` | `fueltrack`, oppure alias della chiave preesistente |
| `ANDROID_KEY_PASSWORD` | Password della chiave; per il keystore PKCS12 generato sopra coincide con quella del keystore |

Il workflow si ferma con un messaggio esplicito se manca un secret; non produce altri APK con firme temporanee. I secrets non sono configurati automaticamente dalle modifiche al codice.

## Primo passaggio dalla vecchia firma

Se la chiave cambia, il nuovo APK non può sostituire direttamente quello vecchio. **Prima di disinstallare**, nella vecchia app usa **Dati → Copia JSON**, incolla il testo in un file `.json` e verifica di averne conservato una copia completa. Se la copia negli appunti non funziona, non disinstallare: occorre recuperare il backup o la vecchia chiave prima di procedere. La disinstallazione cancella lo storico locale.

Solo dopo aver verificato il backup, disinstalla la vecchia app, installa il nuovo APK e importa il JSON. Gli aggiornamenti successivi firmati con la stessa chiave si installano sopra l'app conservando i dati. Il dispositivo deve anche soddisfare i requisiti minimi della versione Capacitor Android utilizzata (attualmente Android 7/API 24).

## Ottenere un nuovo APK

Invia il codice su `main`, oppure avvia **Actions → Build Android APK → Run workflow**. Scarica l'artifact `fuel-track-apk`, estrai `app-release.apk` e installalo. Non viene pubblicato automaticamente in uno store.

La configurazione Capacitor è versionata in `capacitor.config.ts`. La cartella Android viene generata in CI; `scripts/prepare-android.mjs` copia le classi in `native/android`, imposta versione e firma. Evita modifiche manuali alla cartella generata: andrebbero perse nella build successiva.

## Backup JSON e CSV su Android

Il plugin locale `BackupExport` usa `ACTION_CREATE_DOCUMENT`: il pulsante di esportazione apre **Salva con nome**, permette di scegliere cartella e nome e scrive UTF-8 nell'URI selezionato. Non richiede accesso generale alla memoria. Il messaggio di successo arriva dopo la chiusura del file; annullare non registra un backup riuscito. Nel browser resta disponibile download/condivisione web, con messaggio di avvio perché il browser non conferma il salvataggio su disco.

Riferimenti: [Storage Access Framework Android](https://developer.android.com/training/data-storage/shared/documents-files), [plugin Android Capacitor](https://capacitorjs.com/docs/plugins/android).

Gli asset offline sono già inclusi nell'APK. In Capacitor non viene registrato il service worker web; eventuali registrazioni e cache FuelLog pregresse vengono eliminate senza toccare IndexedDB o localStorage.

## Media dei consumi

Dal secondo rifornimento, anche parziale: `(odometro ultimo − odometro primo) / somma dei litri dopo il primo`. Il primo fornisce solo il riferimento iniziale; la sua spesa resta nella spesa totale. Ogni registrazione successiva aggiorna media, costo per distanza e grafico. Il flag pieno è descrittivo e non azzera nulla. È una stima: aggiunto e consumato possono differire se cambia il livello nel serbatoio.

## Verifica sul telefono

1. Esporta JSON, scegli Download, apri il file e reimportalo verificando veicoli e rifornimenti. Ripeti con CSV e caratteri accentati.
2. Annulla il selettore: nessun messaggio di successo o aggiornamento del promemoria.
3. Registra due parziali, poi un altro parziale e un pieno: media e grafico si aggiornano senza reset.
4. Genera un secondo APK con la stessa chiave e installalo sopra il primo: verifica che lo storico resti disponibile e che la nuova versione si apra anche offline.
