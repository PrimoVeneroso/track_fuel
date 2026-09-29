# Fuel Track ⛽️

Fuel Track è un'applicazione moderna, completamente offline, per il monitoraggio dei rifornimenti, il calcolo dei consumi e della spesa per i tuoi veicoli. 

L'app non richiede alcuna registrazione, non possiede un backend, e memorizza tutti i dati in modo sicuro e privato direttamente all'interno della memoria locale del tuo dispositivo.

## ✨ Funzionalità
- 🚗 **Supporto multi-veicolo**: Tieni traccia di auto, moto o furgoni contemporaneamente.
- 📊 **Statistiche intelligenti**: Calcolo automatico di:
  - Consumo medio cumulativo stimato (km/l o mpg), aggiornato a ogni rifornimento senza reset ai pieni
  - Costo per chilometro o miglio
  - Spesa e percorrenza totali
- 🧮 **Modulo di inserimento avanzato**: Inserendo due valori tra litri, prezzo al litro o spesa totale, l'app calcola automaticamente il terzo.
- 📁 **Import/Export completo**:
  - Backup JSON completo (con anteprima e scelta tra "sovrascrivi" e "unisci") per il ripristino esatto dell'app
  - Storico esportabile in **CSV** (formato Excel italiano: separatore `;`, decimali con virgola, BOM) o **TSV** (tab, decimali con punto) con colonna prezzo per unità
  - **Import da CSV/TSV** (creati in Excel/LibreOffice o esportati dall'app): separatore automatico (`;`, `,`, tab, `|`), intestazioni in italiano o inglese, numeri con virgola o punto e migliaia, errori riportati riga per riga; l'unione avviene per nome veicolo
- 📈 **Grafico dei consumi**: media totale cumulativa e consumo dei singoli intervalli, aggiornato a ogni rifornimento
- 📱 **100% Offline e Nativa**: Grazie a [Capacitor](https://capacitorjs.com/), l'app è compilata come un vero APK nativo per Android.

## 🛠 Tecnologie Utilizzate
- **Framework**: [Next.js](https://nextjs.org/) (Configurato per esportazione puramente statica)
- **UI & Stili**: CSS puro mobile-first (tema dark), componenti custom senza librerie
- **Archiviazione**: IndexedDB locale (con migrazione automatica da localStorage e fallback)
- **Mobile**: Capacitor (Generazione automatica dell'APK)
- **CI/CD**: GitHub Actions

## 🚀 Come ottenere l'APK per Android
Prima della prima build configura i quattro secrets di firma descritti nella [guida Capacitor](./GUIDA_CAPACITOR.md). Servono per installare i successivi APK come aggiornamenti.

Questa repository è configurata per generare automaticamente il file d'installazione per Android (`.apk`) tramite GitHub Actions, ad ogni nuovo commit.

1. Apporta le tue modifiche al codice.
2. Invia le modifiche a GitHub:
   ```bash
   git add .
   git commit -m "Aggiornamento"
   git push
   ```
3. Vai nella sezione **Actions** di questa repository su GitHub.
4. Clicca sull'ultimo processo (chiamato `Build Android APK`).
5. Quando il processo si conclude (luce verde), scorri in basso fino alla sezione **Artifacts**.
6. Scarica il file `fuel-track-apk`, estrai lo `.zip` e installa l'APK sul tuo dispositivo Android.

## 📁 Documentazione Aggiuntiva
Per i dettagli su come è stata configurata l'integrazione di Capacitor e risolti alcuni errori noti di build (es. dipendenze Kotlin o versioni Java/Node), consulta il file [GUIDA_CAPACITOR.md](./GUIDA_CAPACITOR.md).

## 💻 Sviluppo Locale
Se vuoi eseguire l'applicazione in locale (nel tuo browser) per testarla:
```bash
nvm use
bun install --frozen-lockfile
bun run dev
```
L'app sarà disponibile all'indirizzo [http://localhost:3000](http://localhost:3000).
