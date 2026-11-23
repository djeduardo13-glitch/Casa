// Pezzi di interfaccia per Google Calendar
import { html, useState } from '../vendor/preact-htm.js';
import { Icona } from './ui.js';
import { google } from './google.js';
import { tempoFa, relativo } from './date.js';

// Barra di stato in Agenda / Home
export function BarraGoogle({ ctx, compatta }) {
  if (!google.attivo) return null;
  const azione = (consenso) => {
    const p = google.token(consenso); // subito, dentro il clic
    ctx.esegui(async () => {
      await p;
      if (!google.calendari.length) await google.caricaCalendari();
      await google.caricaEventi();
    }, 'Google Calendar aggiornato.');
  };
  if (!google.collegato)
    return compatta ? null : html`<div class="barra-google">
      <span class="g-logo">G</span>
      <span class="testo">Vedi qui anche i tuoi appuntamenti di Google Calendar.</span>
      <button class="btn piccolo primario" onClick=${() => {
        const p = google.token(true);
        ctx.esegui(async () => { await p; await google.caricaCalendari(); await google.caricaEventi(); }, 'Google Calendar collegato!');
      }}>Collega</button>
    </div>`;
  if (compatta)
    return html`<div class="barra-google compatta">
      <span class="g-logo">G</span>
      <button class="btn piccolo" onClick=${() => azione(false)} title=${google.aggiornatoIl ? 'Aggiornato ' + tempoFa(google.aggiornatoIl) : ''}><${Icona} n="ripeti" size=${13} /> Aggiorna</button>
    </div>`;
  return html`<div class=${'barra-google' + (google.tokenValido ? ' ok' : '')}>
    <span class="g-logo">G</span>
    <span class="testo">${google.aggiornatoIl ? `Google aggiornato ${tempoFa(google.aggiornatoIl)}` : 'Google Calendar'}</span>
    <button class="btn piccolo" onClick=${() => azione(false)}><${Icona} n="ripeti" size=${14} /> Aggiorna</button>
  </div>`;
}

// Appuntamento che arriva da Google (solo lettura: si apre in Google Calendar)
export function VoceGoogle({ e, conData }) {
  return html`<li class="voce voce-google">
    <a class="voce-corpo" href=${e.link} target="_blank" rel="noopener">
      <span class="ev-ora">${e.ora ? html`<b>${e.ora}</b>` : html`<small>tutto il</small><small>giorno</small>`}</span>
      <span class="ev-barra" style=${{ '--c': e.colore }}></span>
      <span class="voce-testo">
        <span class="voce-titolo">${e.titolo}</span>
        <span class="voce-sotto">
          ${conData && html`<span>${relativo(e.data)}</span>`}
          <span>${e.calNome}</span>
          ${e.fine && html`<span>fino a ${relativo(e.fine)}</span>`}
          ${e.luogo && html`<span class="meta"><${Icona} n="luogo" size=${13} /> ${e.luogo}</span>`}
        </span>
      </span>
      <span class="g-logo">G</span>
    </a>
  </li>`;
}

// Sezione nelle impostazioni del profilo
export function PannelloGoogle({ ctx }) {
  const [, forza] = useState(0);
  if (!google.attivo)
    return html`<div class="pannello-google"><h3><span class="g-logo">G</span> Google Calendar</h3>
      <p class="tenue piccolo">Non ancora configurato (manca il Client ID in config.js).</p></div>`;

  if (!google.collegato)
    return html`<div class="pannello-google"><h3><span class="g-logo">G</span> Google Calendar</h3>
      <p class="tenue piccolo">Collega il tuo account Google per vedere i tuoi calendari nell'app e aggiungere appuntamenti direttamente su Google.</p>
      <button class="btn primario" onClick=${() => {
        const p = google.token(true);
        ctx.esegui(async () => { await p; await google.caricaCalendari(); await google.caricaEventi(); forza((n) => n + 1); }, 'Google Calendar collegato!');
      }}>Collega Google Calendar</button></div>`;

  const scelti = new Set(google.scelti);
  const alterna = (id) => {
    const nuovi = scelti.has(id) ? google.scelti.filter((x) => x !== id) : [...google.scelti, id];
    google.scegli(nuovi);
    forza((n) => n + 1);
    if (google.tokenValido) google.caricaEventi().catch(() => {});
  };
  return html`<div class="pannello-google">
    <h3><span class="g-logo">G</span> Google Calendar</h3>
    <p class="tenue piccolo">Collegato${google.calendari.find((c) => c.primario) ? ' come ' + google.calendari.find((c) => c.primario).id : ''}. Calendari da mostrare:</p>
    <ul class="lista-calendari">
      ${google.calendari.map((c) => html`<li key=${c.id}>
        <label><input type="checkbox" checked=${scelti.has(c.id)} onChange=${() => alterna(c.id)} />
          <span class="pallino mini" style=${{ background: c.colore }}></span> ${c.nome}</label>
      </li>`)}
    </ul>
    <label class="campo"><span>I nuovi appuntamenti vanno nel calendario</span>
      <select value=${google.predefinito} onChange=${(e) => { google.impostaPredefinito(e.target.value); forza((n) => n + 1); }}>
        ${google.calendari.filter((c) => c.scrivibile).map((c) => html`<option value=${c.id}>${c.nome}</option>`)}
      </select>
    </label>
    <p class="suggerimento">Consiglio: create su Google un calendario "Famiglia" condiviso tra voi due e sceglietelo qui.</p>
    <button class="btn" onClick=${() => { google.scollega(); forza((n) => n + 1); ctx.toast('Google scollegato.'); }}>Scollega Google</button>
  </div>`;
}
