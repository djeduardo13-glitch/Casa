# Casa – agenda di famiglia condivisa

Web app per due persone, da usare dal telefono come un'app vera:

- **Home**: i prossimi 7 giorni in un colpo d'occhio, pagamenti scaduti, documenti in scadenza
- **Agenda**: appuntamenti (il collegamento a Google Calendar arriva nella fase 2)
- **Da pagare**: importo, scadenza, ricorrenza (le bollette si ripropongono da sole), chi ha pagato
- **Spesa**: lista che si aggiorna in tempo reale su entrambi i telefoni
- **Documenti**: le scadenze in una cassaforte cifrata con una password comune
- Ogni voce mostra **chi l'ha aggiunta**, con il nome e il colore di ciascuno

Per provarla subito basta aprirla: senza configurazione parte in **modalità prova** e i dati restano solo su quel browser.

---

## Installazione (circa 20 minuti, una volta sola)

### 1. Crea il database su Supabase (gratis)

1. Vai su <https://supabase.com>, registrati e fai **New project**. Nome: `casa`, regione: *Central EU (Frankfurt)*, scegli una password per il database (non ti servirà nell'app).
2. Quando il progetto è pronto apri **SQL Editor → New query**.
3. Apri il file [`supabase/schema.sql`](supabase/schema.sql), copia tutto e incollalo.
4. **Importante:** nella sezione 1 sostituisci `tua.email@esempio.it` e `email.moglie@esempio.it` con le vostre email vere.
5. Premi **Run**. Deve comparire *Success. No rows returned*.

### 2. Collega l'app al database

1. Su Supabase apri **Project Settings → API** (o *Data API*).
2. Copia **Project URL** e la chiave **anon public**.
3. Inseriscili nel file `config.js`:

   ```js
   window.CASA_CONFIG = {
     SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
     SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   };
   ```

   La chiave *anon* può stare in un file pubblico: è fatta apposta. I dati sono protetti dalle regole del database e solo le due email autorizzate possono leggerli o scriverli.

### 3. Pubblica l'app con GitHub Pages (gratis)

1. Apri il repository su GitHub e scegli **Add file, poi Upload files**.
2. Trascina **tutto il contenuto** della cartella `Casa` (file e cartelle `js`, `vendor`, `icons`, `supabase`), poi premi **Commit changes**.
3. Apri **Settings → Pages**. In *Build and deployment* scegli **Deploy from a branch**, branch `main`, cartella `/ (root)`, poi **Save**.
4. Dopo un paio di minuti l'app è online su `https://djeduardo13-glitch.github.io/Casa/`.

Per aggiornare l'app in futuro basta ricaricare i file modificati nello stesso modo.

### 4. Ultimi ritocchi su Supabase

1. **Authentication → URL Configuration**: in *Site URL* metti l'indirizzo dell'app (quello del punto 3).
2. Facoltativo ma comodo, in **Authentication → Sign In / Providers → Email**:
   - disattiva *Confirm email* se non volete dover confermare l'email al primo accesso.
3. Quando vi siete registrati entrambi, in **Authentication → Sign In / Providers** disattiva **Allow new users to sign up**. Comunque nessun altro potrebbe vedere i vostri dati, ma così è ancora più pulito.

### 5. Installala sul telefono

- **iPhone (Safari):** apri l'indirizzo, tocca *Condividi*, poi **Aggiungi a schermata Home**.
- **Android (Chrome):** apri l'indirizzo, menu ⋮, poi **Installa app** (o *Aggiungi a schermata Home*).

Al primo accesso ognuno sceglie **Primo accesso**, crea la sua password e poi indica nome e colore.

---

## La cassaforte dei documenti

- La prima volta che aprite *Documenti* create una **password comune**.
- Tipo, intestatario, numero e note vengono **cifrati sul telefono** (AES-256-GCM, chiave ricavata dalla password con PBKDF2 a 310.000 iterazioni). Sul server arriva solo testo illeggibile.
- In chiaro resta solo la **data di scadenza**, così la Home può avvisarvi anche a cassaforte chiusa.
- La cassaforte si richiude da sola quando l'app resta in background per più di 5 minuti.
- **Se dimenticate la password non si può recuperare.** Potete solo azzerare la cassaforte, e i documenti salvati vanno persi.

## Prossimi passi

- **Fase 2: Google Calendar.** Accesso con Google, i vostri calendari che compaiono in Agenda e Home, nuovi appuntamenti creati direttamente su Google.
- Promemoria via notifica o email prima delle scadenze.
- Categorie per la spesa (frutta, latticini…).

## Struttura

```
index.html            pagina dell'app
config.js             indirizzo e chiave di Supabase
styles.css            grafica (chiara e scura automatica)
js/app.js             struttura, accesso, navigazione
js/home.js            schermata Home
js/agenda.js          appuntamenti
js/pagamenti.js       da pagare
js/spesa.js           lista della spesa
js/documenti.js       cassaforte documenti
js/crypto.js          cifratura
js/backend.js         Supabase / modalità prova
supabase/schema.sql   database e regole di sicurezza
sw.js, manifest       installazione come app
vendor/               Preact + htm, supabase-js (nessuna build necessaria)
```
