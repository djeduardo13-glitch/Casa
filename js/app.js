import { html, render, useState, useEffect, useMemo, useRef, useCallback } from '../vendor/preact-htm.js';
import { creaBackend, TABELLE } from './backend.js';
import { decifra } from './crypto.js';
import { Icona, Modale, Campo, BottoneAsync, COLORI } from './ui.js';
import { Home } from './home.js';
import { Agenda, EventoForm } from './agenda.js';
import { Pagamenti, PagamentoForm } from './pagamenti.js';
import { Spesa } from './spesa.js';
import { Documenti, DocumentoForm } from './documenti.js';

let be;
try {
  be = creaBackend(window.CASA_CONFIG);
} catch (e) {
  document.getElementById('app').innerHTML = `<div class="accesso"><h1>Casa</h1><p>${e.message}</p>
    <button class="btn primario" onclick="location.reload()">Riprova</button></div>`;
  throw e;
}
const BLOCCO_AUTOMATICO_MS = 5 * 60 * 1000; // la cassaforte si chiude dopo 5 min in background

const SEZIONI = [
  { id: 'home', nome: 'Home', icona: 'home' },
  { id: 'agenda', nome: 'Agenda', icona: 'calendario' },
  { id: 'pagamenti', nome: 'Da pagare', icona: 'euro' },
  { id: 'spesa', nome: 'Spesa', icona: 'carrello' },
  { id: 'documenti', nome: 'Documenti', icona: 'lucchetto' },
];

// --- Accesso ----------------------------------------------------------
function Accesso({ toast }) {
  const [modo, setModo] = useState('accedi');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  const invia = async () => {
    setMsg('');
    try {
      if (modo === 'accedi') await be.auth.signIn(email.trim(), password);
      else {
        const { needsConfirm } = await be.auth.signUp(email.trim(), password);
        if (needsConfirm) setMsg("Ti abbiamo mandato un'email: apri il link per confermare, poi torna qui e accedi.");
      }
    } catch (e) {
      toast(e.message, 'errore');
    }
  };

  return html`<div class="accesso">
    <div class="logo"><img src="icons/icon-192.png" alt="" width="72" height="72" /></div>
    <h1>Casa</h1>
    <p class="tenue">La vostra agenda di famiglia, condivisa.</p>
    ${be.demo && html`<p class="avviso-info">Modalità prova: i dati restano solo su questo browser. Inventa un'email e una password.</p>`}
    <div class="segmenti">
      <button class=${modo === 'accedi' ? 'attivo' : ''} onClick=${() => setModo('accedi')}>Accedi</button>
      <button class=${modo === 'registrati' ? 'attivo' : ''} onClick=${() => setModo('registrati')}>Primo accesso</button>
    </div>
    <form class="modulo" onSubmit=${(e) => { e.preventDefault(); invia(); }}>
      <${Campo} etichetta="Email"><input type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} autocomplete="email" required /><//>
      <${Campo} etichetta="Password"><input type="password" value=${password} onInput=${(e) => setPassword(e.target.value)}
        autocomplete=${modo === 'accedi' ? 'current-password' : 'new-password'} required minlength="6" /><//>
      <${BottoneAsync} type="submit" onClick=${invia}>${modo === 'accedi' ? 'Accedi' : 'Crea il mio account'}<//>
    </form>
    ${msg && html`<p class="avviso-info">${msg}</p>`}
  </div>`;
}

// --- Profilo (nome + colore) -------------------------------------------
function Profilo({ user, profilo, onFatto, toast, dentroModale }) {
  const [nome, setNome] = useState(profilo?.nome || '');
  const [colore, setColore] = useState(profilo?.colore || COLORI[0]);
  const salva = async () => {
    if (!nome.trim()) return toast('Scrivi il tuo nome.', 'errore');
    try {
      await be.upsert('profili', { id: user.id, nome: nome.trim(), colore });
      onFatto();
    } catch (e) { toast(e.message, 'errore'); }
  };
  const corpo = html`<form class="modulo" onSubmit=${(e) => { e.preventDefault(); salva(); }}>
    <${Campo} etichetta="Il tuo nome"><input value=${nome} onInput=${(e) => setNome(e.target.value)} maxlength="40" placeholder="Es. Eduardo" autofocus /><//>
    <div class="campo"><span>Il tuo colore</span>
      <div class="colori">${COLORI.map((c) => html`<button type="button" class=${'colore' + (c === colore ? ' scelto' : '')}
        style=${{ background: c }} onClick=${() => setColore(c)} aria-label=${'Colore ' + c}></button>`)}</div>
    </div>
    <p class="suggerimento">Nome e colore servono a capire chi ha aggiunto cosa.</p>
    <${BottoneAsync} type="submit" onClick=${salva}>Salva<//>
  </form>`;
  if (dentroModale) return corpo;
  return html`<div class="accesso"><h1>Benvenuto!</h1><p class="tenue">Come ti chiami?</p>${corpo}</div>`;
}

function Impostazioni({ ctx }) {
  return html`<${Modale} titolo="Il tuo profilo" onChiudi=${ctx.chiudi}>
    <${Profilo} user=${ctx.user} profilo=${ctx.profili[ctx.user.id]} toast=${ctx.toast} dentroModale onFatto=${() => { ctx.toast('Profilo salvato.'); ctx.chiudi(); }} />
    <div class="modulo">
      <p class="tenue piccolo">Accesso come ${ctx.user.email}${be.demo ? ' · modalità prova' : ''}</p>
      <button class="btn" onClick=${() => { ctx.chiudi(); be.auth.signOut(); }}><${Icona} n="esci" size=${18} /> Esci</button>
    </div>
  <//>`;
}

// --- App ---------------------------------------------------------------
function App() {
  const [user, setUser] = useState(undefined); // undefined = sto caricando
  const [membro, setMembro] = useState(null);
  const [data, setData] = useState(null);
  const [sezione, setSezione] = useState(() => location.hash.slice(1) || 'home');
  const [modale, setModale] = useState(null);
  const [avvisi, setAvvisi] = useState([]);
  const [chiave, setChiave] = useState(null);
  const [documenti, setDocumenti] = useState([]);
  const nascostoDa = useRef(null);

  const toast = useCallback((testo, tipo = 'ok') => {
    const id = Math.random();
    setAvvisi((a) => [...a.slice(-1), { id, testo, tipo }]);
    setTimeout(() => setAvvisi((a) => a.filter((x) => x.id !== id)), tipo === 'errore' ? 4500 : 2800);
  }, []);

  // Sessione
  useEffect(() => {
    be.auth.user().then(setUser);
    be.auth.onChange((u) => setUser((prev) => (prev?.id === u?.id ? prev : u)));
  }, []);

  // Dati + aggiornamenti in tempo reale
  const carica = useCallback(async (tabella) => {
    const tabelle = !tabella || tabella === '*' ? TABELLE : [tabella];
    const righe = await Promise.all(tabelle.map((t) => be.list(t)));
    setData((d) => ({ ...(d || {}), ...Object.fromEntries(tabelle.map((t, i) => [t, righe[i]])) }));
  }, []);

  useEffect(() => {
    setData(null); setMembro(null); setChiave(null);
    if (!user) return;
    let stop = () => {};
    (async () => {
      try {
        const ok = await be.isMember();
        setMembro(ok);
        if (!ok) return;
        await carica();
        stop = be.subscribe((t) => carica(t).catch(() => {}));
      } catch (e) { toast(e.message, 'errore'); }
    })();
    // quando si torna sull'app ricarico tutto (il telefono può aver perso aggiornamenti)
    const vis = () => {
      if (document.hidden) { nascostoDa.current = Date.now(); return; }
      if (nascostoDa.current && Date.now() - nascostoDa.current > BLOCCO_AUTOMATICO_MS) setChiave(null);
      nascostoDa.current = null;
      carica().catch(() => {});
    };
    document.addEventListener('visibilitychange', vis);
    return () => { stop(); document.removeEventListener('visibilitychange', vis); };
  }, [user?.id]);

  // Decifro i documenti quando la cassaforte è aperta
  useEffect(() => {
    let annullato = false;
    (async () => {
      if (!chiave || !data?.documenti) return setDocumenti([]);
      const out = await Promise.all(data.documenti.map(async (d) => {
        try { return { ...d, info: await decifra(chiave, d.dati_cifrati, d.iv) }; }
        catch { return { ...d, info: null }; }
      }));
      if (!annullato) setDocumenti(out);
    })();
    return () => { annullato = true; };
  }, [chiave, data?.documenti]);

  // Navigazione con #hash (funziona anche il tasto "indietro")
  useEffect(() => {
    const h = () => setSezione(location.hash.slice(1) || 'home');
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const vai = (s) => { location.hash = s === 'home' ? '' : s; setSezione(s); window.scrollTo(0, 0); };

  const profili = useMemo(() => Object.fromEntries((data?.profili || []).map((p) => [p.id, p])), [data?.profili]);

  const ctx = {
    be, user, data, profili, toast, vai, chiave, setChiave, documenti,
    apri: (v) => setModale(v),
    chiudi: () => setModale(null),
    async esegui(fn, msgOk) {
      try { await fn(); if (msgOk) toast(msgOk); return true; }
      catch (e) { toast(e.message || 'Qualcosa è andato storto.', 'errore'); return false; }
    },
  };

  const avvisiEl = html`<div class="avvisi" role="status" aria-live="polite">
    ${avvisi.map((a) => html`<div class=${'avviso ' + a.tipo} key=${a.id}>${a.testo}</div>`)}
  </div>`;

  if (user === undefined) return html`<div class="caricamento">Caricamento…</div>`;
  if (!user) return html`<${Accesso} toast=${toast} />${avvisiEl}`;
  if (membro === false)
    return html`<div class="accesso">
      <h1>Accesso non autorizzato</h1>
      <p>L'account <b>${user.email}</b> non è nella lista delle persone autorizzate.</p>
      <p class="tenue">Va aggiunto nella tabella <code>membri_autorizzati</code> su Supabase.</p>
      <button class="btn" onClick=${() => be.auth.signOut()}>Esci</button>
    </div>`;
  if (!data) return html`<div class="caricamento">Caricamento…</div>${avvisiEl}`;
  if (!profili[user.id])
    return html`<${Profilo} user=${user} toast=${toast} onFatto=${() => carica('profili')} />${avvisiEl}`;

  const S = { home: Home, agenda: Agenda, pagamenti: Pagamenti, spesa: Spesa, documenti: Documenti }[sezione] || Home;
  const titolo = SEZIONI.find((s) => s.id === sezione)?.nome || 'Home';
  const io = profili[user.id];

  const fab = {
    agenda: () => ctx.apri(html`<${EventoForm} ctx=${ctx} />`),
    pagamenti: () => ctx.apri(html`<${PagamentoForm} ctx=${ctx} />`),
    documenti: chiave ? () => ctx.apri(html`<${DocumentoForm} ctx=${ctx} />`) : null,
  }[sezione];

  return html`
    <header class="testata">
      <h1>${sezione === 'home' ? 'Casa' : titolo}</h1>
      ${be.demo && html`<span class="badge-demo">prova</span>`}
      <button class="avatar" style=${{ background: io.colore }} onClick=${() => ctx.apri(html`<${Impostazioni} ctx=${ctx} />`)}
        aria-label="Profilo">${io.nome.charAt(0).toUpperCase()}</button>
    </header>
    <main><${S} ctx=${ctx} /></main>
    ${fab && html`<button class="fab" onClick=${fab} aria-label="Aggiungi"><${Icona} n="piu" size=${26} /></button>`}
    <nav class="navbar">
      ${SEZIONI.map((s) => html`<button class=${s.id === sezione ? 'attivo' : ''} onClick=${() => vai(s.id)} aria-label=${s.nome}>
        <${Icona} n=${s.id === 'documenti' && chiave ? 'aperto' : s.icona} size=${22} /><span>${s.nome}</span>
      </button>`)}
    </nav>
    ${modale}
    ${avvisiEl}
  `;
}

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
