// Google Calendar, direttamente dal browser (Google Identity Services).
// Ognuno collega il PROPRIO account Google sul proprio telefono: l'app legge
// i calendari scelti e può aggiungere appuntamenti. Nessun server, nessun segreto:
// serve solo il "Client ID" pubblico in config.js.
// Il permesso dura ~1 ora; poi basta un tocco su "Aggiorna" (niente password).

import { aStringa, oggi, aggiungiGiorni } from './date.js';

const CLIENT_ID = window.CASA_CONFIG?.GOOGLE_CLIENT_ID || '';
const SCOPE = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3';
const KEY = 'casa-google';
const GIORNI_AVANTI = 60;

const leggi = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const scrivi = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
let stato = leggi();
const listeners = new Set();
const notifica = () => listeners.forEach((cb) => cb());
const aggiorna = (patch) => { stato = { ...stato, ...patch }; scrivi(stato); notifica(); };

// --- Caricamento libreria Google -----------------------------------------
let tokenClient = null;
let inAttesa = null; // { resolve, reject }

function caricaLibreria() {
  if (!CLIENT_ID || tokenClient) return;
  if (window.google?.accounts?.oauth2) return init();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = init;
  document.head.appendChild(s);
}

function init() {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (r) => {
      const p = inAttesa; inAttesa = null;
      if (r.error) return p?.reject(new Error(traduci(r.error)));
      aggiorna({ token: r.access_token, scade: Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000, collegato: true });
      p?.resolve(r.access_token);
    },
    error_callback: (e) => {
      const p = inAttesa; inAttesa = null;
      p?.reject(new Error(e?.type === 'popup_closed' ? 'Finestra di Google chiusa.' : 'Impossibile aprire Google: controlla che i popup siano permessi.'));
    },
  });
  notifica();
}

const traduci = (e) => (e === 'access_denied' ? 'Permesso negato su Google.' : `Errore Google: ${e}`);

// --- Stato ------------------------------------------------------------------
export const google = {
  get attivo() { return !!CLIENT_ID; },
  get pronto() { return !!tokenClient; },
  get collegato() { return !!stato.collegato; },
  get tokenValido() { return !!stato.token && Date.now() < (stato.scade || 0); },
  get calendari() { return stato.calendari || []; },        // [{id, nome, colore, primario}]
  get scelti() { return stato.scelti || []; },               // id calendari da mostrare
  get predefinito() { return stato.predefinito || 'primary'; },
  get eventi() { return stato.cache?.eventi || []; },
  get aggiornatoIl() { return stato.cache?.quando || null; },
  ascolta(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  avvia: caricaLibreria,

  // IMPORTANTE: va chiamata subito dentro un clic (prima di qualsiasi await),
  // altrimenti il browser blocca la finestra di Google.
  token(consenso = false) {
    if (!consenso && google.tokenValido) return Promise.resolve(stato.token);
    if (!tokenClient) return Promise.reject(new Error('Google non è ancora pronto, riprova tra un attimo.'));
    return new Promise((resolve, reject) => {
      inAttesa = { resolve, reject };
      tokenClient.requestAccessToken({ prompt: consenso ? 'consent' : '', hint: stato.email || undefined });
    });
  },

  async collega() {
    await google.token(!google.collegato);
    await google.caricaCalendari();
    await google.caricaEventi();
  },

  scollega() {
    if (stato.token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(stato.token, () => {});
    stato = {}; scrivi(stato); notifica();
  },

  async caricaCalendari() {
    const r = await chiama('GET', '/users/me/calendarList?minAccessRole=reader&maxResults=100');
    const calendari = (r.items || []).map((c) => ({
      id: c.id, nome: c.summaryOverride || c.summary, colore: c.backgroundColor || '#4285f4',
      primario: !!c.primary, scrivibile: ['owner', 'writer'].includes(c.accessRole),
    }));
    const prim = calendari.find((c) => c.primario);
    const scelti = stato.scelti?.length ? stato.scelti.filter((id) => calendari.some((c) => c.id === id)) : calendari.filter((c) => c.primario || /famiglia|casa|family/i.test(c.nome)).map((c) => c.id);
    aggiorna({ calendari, scelti, email: prim?.id || stato.email, predefinito: stato.predefinito || prim?.id || 'primary' });
  },

  scegli(ids) { aggiorna({ scelti: ids }); },
  impostaPredefinito(id) { aggiorna({ predefinito: id }); },

  async caricaEventi() {
    const da = oggi();
    const a = aggiungiGiorni(da, GIORNI_AVANTI);
    const timeMin = new Date(`${da}T00:00:00`).toISOString();
    const timeMax = new Date(`${a}T23:59:59`).toISOString();
    const eventi = [];
    for (const id of google.scelti) {
      const cal = google.calendari.find((c) => c.id === id);
      const q = `?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
      const r = await chiama('GET', `/calendars/${encodeURIComponent(id)}/events${q}`);
      for (const e of r.items || []) {
        if (e.status === 'cancelled') continue;
        eventi.push(normalizza(e, cal, da));
      }
    }
    aggiorna({ cache: { eventi, quando: new Date().toISOString() } });
    return eventi;
  },

  async creaEvento(calId, ev) {
    const r = await chiama('POST', `/calendars/${encodeURIComponent(calId)}/events`, corpoEvento(ev));
    google.caricaEventi().catch(() => {});
    return r.id;
  },
  async modificaEvento(calId, id, ev) {
    await chiama('PATCH', `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(id)}`, corpoEvento(ev));
    google.caricaEventi().catch(() => {});
  },
  async eliminaEvento(calId, id) {
    await chiama('DELETE', `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(id)}`);
    google.caricaEventi().catch(() => {});
  },
};

async function chiama(metodo, percorso, corpo) {
  if (!google.tokenValido) throw new Error('Collegamento a Google scaduto: tocca "Aggiorna".');
  const r = await fetch(API + percorso, {
    method: metodo,
    headers: { Authorization: `Bearer ${stato.token}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 401) { aggiorna({ token: null, scade: 0 }); throw new Error('Collegamento a Google scaduto: tocca "Aggiorna".'); }
  if (!r.ok) throw new Error(`Google Calendar ha risposto con un errore (${r.status}).`);
  return r.status === 204 ? {} : r.json();
}

const pad = (n) => String(n).padStart(2, '0');

function normalizza(e, cal, da) {
  const tuttoIlGiorno = !!e.start?.date;
  let data, ora = null;
  if (tuttoIlGiorno) data = e.start.date;
  else {
    const d = new Date(e.start.dateTime);
    data = aStringa(d);
    ora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  // eventi di più giorni già iniziati: li mostro da oggi
  const fine = tuttoIlGiorno ? aggiungiGiorni(e.end?.date || data, -1) : aStringa(new Date(e.end?.dateTime || e.start.dateTime));
  if (data < da && fine >= da) { data = da; ora = null; }
  return {
    gid: e.id, calId: cal?.id, calNome: cal?.nome || '', colore: cal?.colore || '#4285f4',
    titolo: e.summary || '(senza titolo)', data, ora, fine: fine !== data ? fine : null,
    luogo: e.location || '', link: e.htmlLink || '',
  };
}

function corpoEvento(ev) {
  const base = { summary: ev.titolo, location: ev.luogo || undefined, description: ev.note || undefined };
  if (!ev.ora) return { ...base, start: { date: ev.data }, end: { date: aggiungiGiorni(ev.data, 1) } };
  const inizio = new Date(`${ev.data}T${ev.ora.slice(0, 5)}:00`);
  const fine = new Date(inizio.getTime() + 60 * 60 * 1000);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return { ...base, start: { dateTime: inizio.toISOString(), timeZone: tz }, end: { dateTime: fine.toISOString(), timeZone: tz } };
}
