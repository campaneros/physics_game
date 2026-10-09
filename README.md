# physics_game

**Acceleratore**: idle game di fisica delle particelle per Android, con due minigiochi.

- **Macchina / Scoperte**: potenzia l'acceleratore, raccogli segnale e conferma le scoperte (ρ, J/ψ, Υ, W, Z, Higgs, top).
- **La forma nascosta** (Sfida): lancia particelle da un bordo, osserva dove escono e indovina il poligono nascosto. Meno lanci = più punti. Serve anche per confermare le scoperte.
- **Budget** (dopo il primo Long Shutdown): distribuisci 100 unità tra luminosità, trigger, risoluzione, calibrazione e calcolo per misurare una massa con la minima incertezza.

Tutto offline: nessun permesso di rete, nessun backend.

## Struttura

- `www/` — app web (JS vanilla, nessuna dipendenza): `core.js` (fisica), `idle.js` (economia), `budget.js` (modello budget), UI.
- `android/` — progetto Capacitor che impacchetta `www/` in un APK.
- `check*.js` — test: `npm run check` e `node check-budget.js`.

## Build dell'APK

Servono JDK 21 e Android SDK (piattaforma 36).

```bash
npm install --ignore-scripts
npx cap sync android
cd android && ./gradlew assembleDebug      # APK di debug
```

La release firmata legge la chiave da `~/.android-keys/acceleratore.properties`
(`storeFile`, `storePassword`, `keyAlias`, `keyPassword`), fuori dal repo.
Senza quel file `assembleRelease` produce un APK non firmato.
