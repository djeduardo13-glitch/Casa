import { html, useState } from '../vendor/preact-htm.js';
import { Icona, Autore, Modale, Vuoto, Campo, BottoneAsync } from './ui.js';
import { oggi, giornoLungo, relativo, ora } from './date.js';

export function EventoForm({ ctx, evento, dataIniziale }) {
  const [f, setF] = useState({
    titolo: evento?.titolo || '',
    data: evento?.data || dataIniziale || oggi(),
    ora: evento?.ora ? ora(evento.ora) : '',
    luogo: evento?.luogo || '',
    note: evento?.note || '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const salva = async () => {
    if (!f.titolo.trim()) return ctx.toast('Scrivi il titolo dell’appuntamento.', 'errore');
    if (!f.data) return ctx.toast('Scegli la data.', 'errore');
    const riga = {
      titolo: f.titolo.trim(),
      data: f.data,
      ora: f.ora || null,
      luogo: f.luogo.trim() || null,
      note: f.note.trim() || null,
    };
    const ok = await ctx.esegui(
      () => (evento ? ctx.be.update('eventi', evento.id, riga) : ctx.be.insert('eventi', riga)),
      evento ? 'Appuntamento modificato.' : 'Appuntamento aggiunto.',
    );
    if (ok) ctx.chiudi();
  };

  const elimina = async () => {
    if (!confirm(`Eliminare "${evento.titolo}"?`)) return;
    if (await ctx.esegui(() => ctx.be.remove('eventi', evento.id), 'Eliminato.')) ctx.chiudi();
  };

  return html`<${Modale} titolo=${evento ? 'Modifica appuntamento' : 'Nuovo appuntamento'} onChiudi=${ctx.chiudi}>
    <form class="modulo" onSubmit=${(e) => { e.preventDefault(); salva(); }}>
      <${Campo} etichetta="Cosa">
        <input value=${f.titolo} onInput=${set('titolo')} placeholder="Es. Dentista, cena dai suoceri…" autofocus />
      <//>
      <div class="riga2">
        <${Campo} etichetta="Giorno"><input type="date" value=${f.data} onInput=${set('data')} /><//>
        <${Campo} etichetta="Ora (facoltativa)"><input type="time" value=${f.ora} onInput=${set('ora')} /><//>
      </div>
      <${Campo} etichetta="Dove"><input value=${f.luogo} onInput=${set('luogo')} placeholder="Indirizzo o luogo" /><//>
      <${Campo} etichetta="Note"><textarea value=${f.note} onInput=${set('note')} rows="2"></textarea><//>
      <div class="azioni-modulo">
        ${evento && html`<button type="button" class="btn pericolo" onClick=${elimina}><${Icona} n="cestino" size=${18} /> Elimina</button>`}
        <${BottoneAsync} type="submit" onClick=${salva}>Salva<//>
      </div>
    </form>
  <//>`;
}

export const ordinaEventi = (a, b) => a.data.localeCompare(b.data) || (a.ora || '').localeCompare(b.ora || '');

export function VoceEvento({ ctx, e, conData }) {
  return html`<li class="voce">
    <button class="voce-corpo" onClick=${() => ctx.apri(html`<${EventoForm} ctx=${ctx} evento=${e} />`)}>
      <div class="voce-titolo">
        <span>${e.titolo}</span>
        <span class="ora">${e.ora ? ora(e.ora) : 'tutto il giorno'}</span>
      </div>
      <div class="voce-meta">
        ${conData && html`<span class="chip">${relativo(e.data)}</span>`}
        ${e.luogo && html`<span class="meta"><${Icona} n="luogo" size=${14} /> ${e.luogo}</span>`}
      </div>
      ${e.note && html`<div class="voce-note">${e.note}</div>`}
      <${Autore} profili=${ctx.profili} riga=${e} />
    </button>
  </li>`;
}

export function Agenda({ ctx }) {
  const [passati, setPassati] = useState(false);
  const t = oggi();
  const eventi = ctx.data.eventi
    .filter((e) => (passati ? e.data < t : e.data >= t))
    .sort(ordinaEventi);
  if (passati) eventi.reverse();

  const giorni = [];
  for (const e of eventi) {
    const g = giorni[giorni.length - 1];
    if (g && g.data === e.data) g.eventi.push(e);
    else giorni.push({ data: e.data, eventi: [e] });
  }

  return html`<section>
    <div class="segmenti">
      <button class=${!passati ? 'attivo' : ''} onClick=${() => setPassati(false)}>In arrivo</button>
      <button class=${passati ? 'attivo' : ''} onClick=${() => setPassati(true)}>Passati</button>
    </div>
    <div class="avviso-info">
      <${Icona} n="calendario" size=${18} />
      <span>Collegamento a Google Calendar: in arrivo nella prossima versione.</span>
    </div>
    ${giorni.length === 0 && html`<${Vuoto} icona="calendario" testo=${passati ? 'Nessun appuntamento passato.' : 'Nessun appuntamento in programma.'} />`}
    ${giorni.map((g) => html`<div class="giorno" key=${g.data}>
      <h3 class="giorno-titolo">${giornoLungo(g.data)} <span>${relativo(g.data)}</span></h3>
      <ul class="lista">${g.eventi.map((e) => html`<${VoceEvento} key=${e.id} ctx=${ctx} e=${e} />`)}</ul>
    </div>`)}
  </section>`;
}
