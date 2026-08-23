# Fuel Track ⛽️

Fuel Track è un'applicazione moderna, completamente offline, per il monitoraggio dei rifornimenti, il calcolo dei consumi e della spesa per i tuoi veicoli. 

L'app non richiede alcuna registrazione, non possiede un backend, e memorizza tutti i dati in modo sicuro e privato direttamente all'interno della memoria locale del tuo dispositivo.

## ✨ Funzionalità
- 🚗 **Supporto multi-veicolo**: Tieni traccia di auto, moto o furgoni contemporaneamente.
- 📊 **Statistiche intelligenti**: Calcolo automatico di:
  - Consumo medio (km/l o mpg)
  - Costo per chilometro o miglio
  - Spesa e volume totali o per ciclo
- 🧮 **Modulo di inserimento avanzato**: Inserendo due valori tra litri, prezzo al litro o spesa totale, l'app calcola automaticamente il terzo.
- 📱 **100% Offline e Nativa**: Grazie a [Capacitor](https://capacitorjs.com/), l'app è compilata come un vero APK nativo per Android.

## 🛠 Tecnologie Utilizzate
- **Framework**: [Next.js](https://nextjs.org/) (Configurato per esportazione puramente statica)
- **UI & Stili**: [Tailwind CSS](https://tailwindcss.com/) + Componenti [Shadcn UI](https://ui.shadcn.com/)
- **Mobile**: Capacitor (Generazione automatica dell'APK)
- **CI/CD**: GitHub Actions

## 🚀 Come ottenere l'APK per Android
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
npm install
npm run dev
```
L'app sarà disponibile all'indirizzo [http://localhost:3000](http://localhost:3000).
