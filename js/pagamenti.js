import { html, useState } from '../vendor/preact-htm.js';
import { Icona, Autore, Modale, Vuoto, Campo, BottoneAsync, Persona } from './ui.js';
import { oggi, relativo, giorniTra, euro, aggiungiMesi, MESI_RICORRENZA, dataNumerica, tempoFa } from './date.js';

const RICORRENZE = [
  ['nessuna', 'Una volta sola'],
  ['mensile', 'Ogni mese'],
  ['bimestrale', 'Ogni 2 mesi'],
  ['trimestrale', 'Ogni 3 mesi'],
  ['semestrale', 'Ogni 6 mesi'],
  ['annuale', 'Ogni anno'],
];
const etichettaRicorrenza = (r) => RICORRENZE.find(([k]) => k === r)?.[1] || '';

export function statoScadenza(scadenza) {
  if (!scadenza) return '';
  const g = giorniTra(oggi(), scadenza);
  if (g < 0) return 'scaduto';
  if (g <= 3) return 'urgente';
  if (g <= 7) return 'vicino';
  return '';
}

export async function segnaPagato(ctx, p) {
  await ctx.esegui(async () => {
    await ctx.be.update('pagamenti', p.id, { pagato_il: new Date().toISOString(), pagato_da: ctx.user.id });
    const mesi = MESI_RICORRENZA[p.ricorrenza];
    if (mesi && p.scadenza) {
      await ctx.be.insert('pagamenti', {
        titolo: p.titolo,
        importo: p.importo,
        note: p.note,
        ricorrenza: p.ricorrenza,
        scadenza: aggiungiMesi(p.scadenza, mesi),
      });
    }
  }, mesiMsg(p));
}
const mesiMsg = (p) =>
  MESI_RICORRENZA[p.ricorrenza] && p.scadenza
    ? `Pagato! Il prossimo è già in lista (${dataNumerica(aggiungiMesi(p.scadenza, MESI_RICORRENZA[p.ricorrenza]))}).`
    : 'Segnato come pagato.';

export function PagamentoForm({ ctx, pagamento }) {
  const [f, setF] = useState({
    titolo: pagamento?.titolo || '',
    importo: pagamento?.importo ?? '',
    scadenza: pagamento?.scadenza || '',
    ricorrenza: pagamento?.ricorrenza || 'nessuna',
    note: pagamento?.note || '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const salva = async () => {
    if (!f.titolo.trim()) return ctx.toast('Scrivi cosa c’è da pagare.', 'errore');
    const riga = {
      titolo: f.titolo.trim(),
      importo: f.importo === '' ? null : Number(String(f.importo).replace(',', '.')),
      scadenza: f.scadenza || null,
      ricorrenza: f.ricorrenza,
      note: f.note.trim() || null,
    };
    if (riga.importo != null && isNaN(riga.importo)) return ctx.toast('Importo non valido.', 'errore');
    const ok = await ctx.esegui(
      () => (pagamento ? ctx.be.update('pagamenti', pagamento.id, riga) : ctx.be.insert('pagamenti', riga)),
      pagamento ? 'Modificato.' : 'Aggiunto a "Da pagare".',
    );
    if (ok) ctx.chiudi();
  };

  const elimina = async () => {
    if (!confirm(`Eliminare "${pagamento.titolo}"?`)) return;
    if (await ctx.esegui(() => ctx.be.remove('pagamenti', pagamento.id), 'Eliminato.')) ctx.chiudi();
  };

  return html`<${Modale} titolo=${pagamento ? 'Modifica pagamento' : 'Nuovo da pagare'} onChiudi=${ctx.chiudi}>
    <form class="modulo" onSubmit=${(e) => { e.preventDefault(); salva(); }}>
      <${Campo} etichetta="Cosa">
        <input value=${f.titolo} onInput=${set('titolo')} placeholder="Es. Bolletta luce, rata auto, TARI…" autofocus />
      <//>
      <div class="riga2">
        <${Campo} etichetta="Importo (€)">
          <input value=${f.importo} onInput=${set('importo')} inputmode="decimal" placeholder="0,00" />
        <//>
        <${Campo} etichetta="Scadenza">
          <input type="date" value=${f.scadenza} onInput=${set('scadenza')} />
        <//>
      </div>
      <${Campo} etichetta="Si ripete">
        <select value=${f.ricorrenza} onChange=${set('ricorrenza')}>
          ${RICORRENZE.map(([k, v]) => html`<option value=${k}>${v}</option>`)}
        </select>
      <//>
      <${Campo} etichetta="Note">
        <textarea value=${f.note} onInput=${set('note')} rows="2" placeholder="Codice bollettino, IBAN, come pagare…"></textarea>
      <//>
      <div class="azioni-modulo">
        ${pagamento && html`<button type="button" class="btn pericolo" onClick=${elimina}><${Icona} n="cestino" size=${18} /> Elimina</button>`}
        <${BottoneAsync} type="submit" onClick=${salva}>Salva<//>
      </div>
    </form>
  <//>`;
}

function Pagamento({ ctx, p }) {
  const stato = p.pagato_il ? '' : statoScadenza(p.scadenza);
  return html`<li class=${'voce ' + stato}>
    <button class="voce-corpo" onClick=${() => ctx.apri(html`<${PagamentoForm} ctx=${ctx} pagamento=${p} />`)}>
      <div class="voce-titolo">
        <span>${p.titolo}</span>
        ${p.importo != null && html`<strong class="importo">${euro(p.importo)}</strong>`}
      </div>
      <div class="voce-meta">
        ${p.scadenza && html`<span class=${'chip ' + stato}>
          ${stato === 'scaduto' ? 'Scaduto ' : 'Scade '}${relativo(p.scadenza)}</span>`}
        ${p.ricorrenza !== 'nessuna' && html`<span class="chip"><${Icona} n="ripeti" size=${12} /> ${etichettaRicorrenza(p.ricorrenza)}</span>`}
      </div>
      ${p.note && html`<div class="voce-note">${p.note}</div>`}
      ${p.pagato_il
        ? html`<span class="autore"><${Persona} profili=${ctx.profili} id=${p.pagato_da} piccolo /> Pagato da ${ctx.profili[p.pagato_da]?.nome || 'qualcuno'} · ${tempoFa(p.pagato_il)}</span>`
        : html`<${Autore} profili=${ctx.profili} riga=${p} />`}
    </button>
    ${p.pagato_il
      ? html`<button class="btn-icona" title="Segna come da pagare" aria-label="Segna come da pagare"
          onClick=${() => ctx.esegui(() => ctx.be.update('pagamenti', p.id, { pagato_il: null, pagato_da: null }), 'Rimesso in "Da pagare".')}>
          <${Icona} n="annulla" /></button>`
      : html`<button class="btn-pagato" onClick=${() => segnaPagato(ctx, p)} aria-label="Segna come pagato">
          <${Icona} n="check" size=${18} /> Pagato</button>`}
  </li>`;
}

export const ordinaPerScadenza = (a, b) =>
  (a.scadenza || '9999-12-31').localeCompare(b.scadenza || '9999-12-31') || a.titolo.localeCompare(b.titolo);

export function Pagamenti({ ctx }) {
  const [vista, setVista] = useState('da');
  const tutti = ctx.data.pagamenti;
  const daPagare = tutti.filter((p) => !p.pagato_il).sort(ordinaPerScadenza);
  const pagati = tutti.filter((p) => p.pagato_il).sort((a, b) => b.pagato_il.localeCompare(a.pagato_il)).slice(0, 50);
  const totale = daPagare.reduce((s, p) => s + (Number(p.importo) || 0), 0);
  const scaduti = daPagare.filter((p) => statoScadenza(p.scadenza) === 'scaduto').length;

  return html`<section>
    <div class="riepilogo">
      <div><span class="etichetta">Totale da pagare</span><strong class="grande">${euro(totale)}</strong></div>
      <div><span class="etichetta">Voci</span><strong>${daPagare.length}</strong>
        ${scaduti > 0 && html`<span class="chip scaduto">${scaduti} scadut${scaduti === 1 ? 'o' : 'i'}</span>`}</div>
    </div>
    <div class="segmenti">
      <button class=${vista === 'da' ? 'attivo' : ''} onClick=${() => setVista('da')}>Da pagare (${daPagare.length})</button>
      <button class=${vista === 'pagati' ? 'attivo' : ''} onClick=${() => setVista('pagati')}>Pagati</button>
    </div>
    ${vista === 'da'
      ? daPagare.length
        ? html`<ul class="lista">${daPagare.map((p) => html`<${Pagamento} key=${p.id} ctx=${ctx} p=${p} />`)}</ul>`
        : html`<${Vuoto} icona="euro" testo="Niente da pagare. Bel lavoro!" />`
      : pagati.length
        ? html`<ul class="lista">${pagati.map((p) => html`<${Pagamento} key=${p.id} ctx=${ctx} p=${p} />`)}</ul>`
        : html`<${Vuoto} icona="euro" testo="Ancora nessun pagamento segnato come pagato." />`}
  </section>`;
}
