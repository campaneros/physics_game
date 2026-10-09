# physics_game

**Acceleratore / Accelerator**: gioco di gestione di un esperimento di fisica delle particelle per Android (italiano e inglese).
Costruisci il detector in base a ciò che vuoi scoprire o misurare, regoli trigger e analisi, e cerchi di pubblicare prima dei concorrenti.

## Come funziona (modello stilizzato)

- **Sito**: parti da un campo vuoto. Costruisci l'acceleratore (adronico o leptonico) e lo vedi comparire sotto terra con i suoi magneti; tocca il punto di collisione per aprire la **sezione del detector** con i suoi strati (tracciatore, ECAL, HCAL, muoni) e il DAQ. Tutto con popup a icone.
- **Budget annuale**: ogni anno ricevi un budget base fisso (1000), diviso con cursori tra tre fondi: *Operazioni* (corse di dati), *Analisi*, *Sviluppo* (progetti). Ogni pubblicazione lo alza **solo per qualche anno** (più grande la scoperta, più dura), poi torna alla base. Sfide e minigioco aggiungono fondi extra. Si può spostare metà di un fondo in un altro (10% di commissione).
- **Corsa a pagamento**: i dati entrano solo durante una corsa di 1, 2 o 5 anni, pagata dal fondo Operazioni (più energia e luminosità = più costosa).
- **Progetti pluriennali**: energia, luminosità, detector e collider sono progetti da più anni (max 3 insieme), a rischio *sicuro* o *audace*, con opzione *accelera*. Ogni anno possono capitare eventi: costi extra, ritardi (paga per rispettare i tempi o aspetta), sconti o idee che accelerano. I nuovi pezzi di detector si installano nel Long Shutdown.
- **Long Shutdown / cantiere**: il detector si modifica solo durante una chiusura: la durata dipende dai lavori (un calorimetro richiede anni) e intanto non entrano dati.
- **Fisica**: 12 bersagli, tra scoperte (ρ, J/ψ, Υ, W, Z, top, Higgs, doppio Higgs), misure di precisione (H→bb, H→μμ, ttH) e una ricerca che può dare esito nullo (Z′). Servono energia e sottosistemi adeguati; trigger (soglia e banda) e selezione vanno regolati.
- **Analisi**: la strategia (conta, picco, multivariata, fit) conta: quella sbagliata costa tempo o sensibilità, la revisione può chiedere ricontrolli e un esperimento rivale può pubblicare prima.
- **La forma nascosta**: minigioco di conferma delle scoperte e sfida del giorno (con fondi).
- **Budget** (dopo il primo Long Shutdown): ottimizza una misura distribuendo 100 unità; il punteggio dà reputazione e fondi.

Tutto offline: nessun permesso di rete, nessun backend. Le cifre fisiche sono ordini di grandezza e stanno in `www/processes.js`: correggile lì.

## Struttura

- `www/` — app web (JS vanilla, nessuna dipendenza). Modello puro: `core.js`, `processes.js`, `physics.js`, `game.js`, `budget.js`. UI: `scene.js` (sito e detector in SVG), `popups.js`, `svg.js`, `ui*.js`, `minigame.js`, `budget-ui.js`. Testi: `i18n*.js`.
- `android/` — progetto Capacitor che impacchetta `www/` in un APK.
- `check*.js` — test: `npm run check` (il bot di bilanciamento impiega un paio di minuti).

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
