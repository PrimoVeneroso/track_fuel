# Guida alla compilazione dell'APK con Capacitor e GitHub Actions

Questo documento riassume tutte le operazioni, gli errori affrontati e le modifiche apportate per trasformare l'app Next.js in un'app Android nativa (APK) completamente offline tramite Capacitor, delegando la build a GitHub Actions.

## 1. Problemi Iniziali e Soluzioni
Durante i tentativi di compilazione su GitHub Actions, abbiamo affrontato e risolto diversi errori comuni nel mondo Android e Node.js:

- **Errore di deprecazione Node.js 20**: GitHub Actions stava avvisando che Node 20 è deprecato.
  - *Soluzione*: Abbiamo aggiornato la versione di Node.js alla `24` nel workflow.
- **Errore di compilazione Java (`invalid source release: 21`)**: Le ultime versioni di Capacitor richiedono Java 21 per compilare il codice Android, ma l'azione GitHub usava Java 17.
  - *Soluzione*: Aggiornato `actions/setup-java@v4` alla `v5` e impostato esplicitamente `java-version: '21'`.
- **Errore Classi Duplicate Kotlin**: Il temuto errore `Duplicate class kotlin.collections.jdk8...`. Questo accade perché le vecchie librerie Kotlin andavano in conflitto con la nuova libreria unificata `kotlin-stdlib`.
  - *Soluzione*: Abbiamo iniettato dinamicamente uno script in `android/app/build.gradle` durante la build per escludere i moduli vecchi (`kotlin-stdlib-jdk7` e `kotlin-stdlib-jdk8`).
- **Problema Icona Standard Capacitor**: Quando l'APK veniva installato, mostrava l'icona di default di Capacitor invece del logo dell'app.
  - *Soluzione*: È stato aggiunto uno step nel workflow che installa `@capacitor/assets`, prende l'immagine `icon-512.png` dalla cartella `public/icons`, e genera automaticamente tutte le risoluzioni native Android corrette appena prima della build.

## 2. Modifiche al Codice Apportate
1. **`next.config.ts`**:
   - Cambiato `output: "standalone"` in `output: "export"`. Questo dice a Next.js di generare solo file HTML/JS/CSS statici nella cartella `out`, che è il formato esatto richiesto da Capacitor (non potendo Capacitor eseguire un server Node.js sul telefono).
   - Aggiunto `images: { unoptimized: true }` perché il componente `<Image>` di Next.js richiede un server per ottimizzare le immagini, a meno che non venga disabilitato per l'export statico.
2. **`.github/workflows/android-apk.yml`**:
   - Creato da zero. Questo file gestisce l'intera pipeline di Continuous Integration (CI): installa Node, installa Capacitor, compila Next.js, inietta l'icona, risolve i conflitti Kotlin e sforna l'APK finale.

## 3. Come Inviare l'App a GitHub e Ottenere l'APK
Ogni volta che fai una modifica al tuo codice (ad esempio cambi un colore o aggiungi una funzione), segui questi 3 semplici passaggi nel terminale per ottenere un nuovo APK aggiornato:

```bash
# 1. Aggiungi tutte le modifiche
git add .

# 2. Crea un commit con un messaggio descrittivo
git commit -m "Descrizione delle modifiche apportate"

# 3. Invia a GitHub
git push
```

**Cosa succede dopo aver fatto `git push`?**
1. Vai sulla pagina del tuo repository su GitHub.
2. Clicca sulla tab **"Actions"** in alto.
3. Vedrai un processo chiamato **Build Android APK** in esecuzione.
4. Attendi circa 2-3 minuti finché non diventa verde (completato).
5. Clicca sul processo completato e scorri fino in fondo alla pagina.
6. Nella sezione **"Artifacts"**, troverai il file **`fuel-track-apk`**.
7. Scarica il `.zip`, estrailo, e invia il file `.apk` al tuo telefono per installarlo.
