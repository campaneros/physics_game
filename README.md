# physics_game

**Acceleratore / Accelerator**: gioco di gestione di un esperimento di fisica delle particelle per Android (italiano e inglese).
Costruisci il detector in base a ciò che vuoi scoprire o misurare, regoli trigger e analisi, e cerchi di pubblicare prima dei concorrenti.

## Come funziona (modello stilizzato)

- **Sito**: parti da un campo vuoto. Costruisci l'acceleratore (adronico o leptonico) e lo vedi comparire sotto terra con i suoi magneti; tocca il punto di collisione per aprire la **sezione del detector** con i suoi strati (tracciatore, ECAL, HCAL, muoni) e il DAQ. Tutto con popup a icone.
- **Budget annuale**: ogni anno ricevi un budget base fisso (1000), diviso con cursori tra tre fondi: *Operazioni* (corse di dati), *Analisi*, *Sviluppo* (progetti). Ogni pubblicazione lo alza **solo per qualche anno** (più grande la scoperta, più dura), poi torna alla base. Sfide e minigioco aggiungono fondi extra. Si può spostare metà di un fondo in un altro (10% di commissione).
- **Più misure insieme**: il collisore adronico (più caro da costruire e far girare) prende dati per più bersagli con una sola corsa, ognuno con il suo trigger ma sulla stessa banda; il leptonico (più economico) ne fa una alla volta. I posti salgono con il livello DAQ.
- **Upgrade collegati**: ogni livello di tracciatore, calorimetri, muoni migliora efficienza e risoluzione delle misure che li usano, e i popup mostrano cosa sblocca o migliora; più energia sopra soglia = più eventi.
- **Prima costruzione immediata**: acceleratore e primi livelli dei sottosistemi (anche più insieme) si costruiscono subito, senza fermo; dal 2° livello servono progetti e un Long Shutdown. In alto vedi il *fondo Sviluppo* (tocca per aprire il Budget e cambiare l'allocazione).
- **Corsa a pagamento**: i dati entrano solo durante una corsa di 1, 2 o 5 anni, pagata dal fondo Operazioni (più energia e luminosità = più costosa).
- **Progetti pluriennali**: energia, luminosità, detector e collider sono progetti da più anni (max 3 insieme), a rischio *sicuro* o *audace*, con opzione *accelera*. Ogni anno possono capitare eventi: costi extra, ritardi (paga per rispettare i tempi o aspetta), sconti o idee che accelerano. I nuovi pezzi di detector si installano nel Long Shutdown.
- **Long Shutdown / cantiere**: il detector si modifica solo durante una chiusura: la durata dipende dai lavori (un calorimetro richiede anni) e intanto non entrano dati.
- **Fisica**: 56 risultati in famiglie: mesoni leggeri e quarkonia, elettrodebole e sapore, top, Higgs, processi rari e 10 ricerche di nuova fisica (che possono non trovare nulla: in quel caso si migliora un pezzo del detector, indicato nel messaggio, o si pone un limite, che non conta come risultato). I bersagli hanno dipendenze a ondate: dopo una scoperta se ne aprono molte insieme, e il collisore adronico le può misurare in parallelo. Ritmo: ~7-9 ore in tutto, un risultato ogni 5-10 minuti, più radi all'inizio e più fitti alla fine (regolato con `tools/calibrate.js`). Servono energia e sottosistemi adeguati; trigger (soglia e banda) e selezione vanno regolati.
- **Analisi**: la strategia (conta, picco, multivariata, fit) conta: quella sbagliata costa tempo o sensibilità, la revisione può chiedere ricontrolli e un esperimento rivale può pubblicare prima.
- **La forma nascosta**: minigioco di conferma delle scoperte e sfida del giorno (con fondi).
- **Budget** (dopo il primo Long Shutdown): ottimizza una misura distribuendo 100 unità; il punteggio dà reputazione e fondi.

Tutto offline: nessun permesso di rete, nessun backend. Le cifre fisiche sono ordini di grandezza e stanno in `www/processes.js`: correggile lì.

## Test

- `npm run check`: controlli veloci sulla logica (fisica, economia, budget, traduzioni), senza browser.
- `npm run e2e`: suite nel browser (Playwright, Chromium, viewport telefono): costruzione, fisica, analisi con tagli, minigioco, progetti, budget, eventi, salvataggi ostili, offline/service worker, CSP, layout a 360/411/768 px, accessibilità, lingue. Gli screenshot vanno in `e2e/screens/`.
- `npm run balance`: criteri di bilanciamento misurabili (durata, ritmo, scenari di giocatori deboli, fondi contro costi massimi); `node tools/rivals.js [fattore]` rigenera i tempi dei rivali.
- `node tools/audit.js`: rapporto con scenari, fuzz di 120 partite casuali e fattibilità dei collisori.
- `node tools/profile.js`: mostra il ritmo dei risultati del bot; `node tools/calibrate.js N`: regola le luminosità richieste (`L5`) per avvicinarsi al ritmo voluto.
- `npm run e2e:long`: una partita completa giocata da un bot attraverso la UI (lenta, minuti).
- Prima volta: `npx playwright install chromium`.

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
