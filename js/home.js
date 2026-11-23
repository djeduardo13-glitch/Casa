import { html } from '../vendor/preact-htm.js';
import { Icona, Persona } from './ui.js';
import { oggi, aggiungiGiorni, giornoLungo, relativo, euro, ora, dataNumerica } from './date.js';
import { EventoForm, ordinaEventi } from './agenda.js';
import { PagamentoForm, segnaPagato, ordinaPerScadenza } from './pagamenti.js';
import { DocumentoForm, statoDocumento, nomeDocumento } from './documenti.js';
import { BarraGoogle } from './gcal.js';

const GIORNI = 7;

export function Home({ ctx }) {
  const t = oggi();
  const fine = aggiungiGiorni(t, GIORNI - 1);
  const io = ctx.profili[ctx.user.id];

  const daPagare = ctx.data.pagamenti.filter((p) => !p.pagato_il);
  const scaduti = daPagare.filter((p) => p.scadenza && p.scadenza < t).sort(ordinaPerScadenza);
  const totale = daPagare.reduce((s, p) => s + (Number(p.importo) || 0), 0);
  const spesa = ctx.data.spesa.filter((v) => !v.fatto);
  const docInScadenza = ctx.data.documenti
    .filter((d) => d.scadenza && ['scaduto', 'urgente', 'vicino'].includes(statoDocumento(d.scadenza)) && d.scadenza <= aggiungiGiorni(t, 60))
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  const docInfo = Object.fromEntries(ctx.documenti.map((d) => [d.id, d.info]));

  // Linea del tempo dei prossimi 7 giorni
  const giorni = [];
  for (let i = 0; i < GIORNI; i++) giorni.push({ data: aggiungiGiorni(t, i), voci: [] });
  const idx = (d) => giorni.findIndex((g) => g.data === d);
  ctx.data.eventi.filter((e) => e.data >= t && e.data <= fine).sort(ordinaEventi).forEach((e) => {
    giorni[idx(e.data)].voci.push({ tipo: 'evento', r: e });
  });
  ctx.gEventi.filter((e) => e.data >= t && e.data <= fine).forEach((e) => {
    giorni[idx(e.data)].voci.push({ tipo: 'google', r: e });
  });
  giorni.forEach((g) => g.voci.sort((a, b) => (a.r.ora || '').localeCompare(b.r.ora || '')));
  daPagare.filter((p) => p.scadenza && p.scadenza >= t && p.scadenza <= fine).forEach((p) => {
    giorni[idx(p.scadenza)].voci.push({ tipo: 'pagamento', r: p });
  });
  ctx.data.documenti.filter((d) => d.scadenza >= t && d.scadenza <= fine).forEach((d) => {
    giorni[idx(d.scadenza)].voci.push({ tipo: 'documento', r: d });
  });
  const conVoci = giorni.filter((g) => g.voci.length);

  const nuovo = (C, extra = {}) => ctx.apri(html`<${C} ctx=${ctx} ...${extra} />`);
  const nuovoDocumento = () => (ctx.chiave ? nuovo(DocumentoForm) : (ctx.vai('documenti'), ctx.toast('Apri prima la cassaforte.')));

  const voce = ({ tipo, r }) => {
    if (tipo === 'evento')
      return html`<li class="tl-voce" key=${r.id}>
        <button onClick=${() => nuovo(EventoForm, { evento: r })}>
          <span class="tl-icona evento"><${Icona} n="calendario" size=${16} /></span>
          <span class="tl-testo"><b>${r.titolo}</b><small>${r.ora ? ora(r.ora) : 'Tutto il giorno'}${r.luogo ? ' · ' + r.luogo : ''}</small></span>
          <${Persona} profili=${ctx.profili} id=${r.creato_da} piccolo />
        </button></li>`;
    if (tipo === 'google')
      return html`<li class="tl-voce" key=${'g' + r.gid}>
        <a href=${r.link} target="_blank" rel="noopener">
          <span class="tl-icona google" style=${{ color: r.colore }}><${Icona} n="calendario" size=${16} /></span>
          <span class="tl-testo"><b>${r.titolo}</b><small>${r.ora || 'Tutto il giorno'}${r.luogo ? ' · ' + r.luogo : ''} · Google</small></span>
          <span class="g-logo">G</span>
        </a></li>`;
    if (tipo === 'pagamento')
      return html`<li class="tl-voce" key=${r.id}>
        <button onClick=${() => nuovo(PagamentoForm, { pagamento: r })}>
          <span class="tl-icona pagamento"><${Icona} n="euro" size=${16} /></span>
          <span class="tl-testo"><b>${r.titolo}</b><small>Da pagare${r.importo != null ? ' · ' + euro(r.importo) : ''}</small></span>
          <${Persona} profili=${ctx.profili} id=${r.creato_da} piccolo />
        </button></li>`;
    return html`<li class="tl-voce" key=${r.id}>
      <button onClick=${() => ctx.vai('documenti')}>
        <span class="tl-icona documento"><${Icona} n=${docInfo[r.id] ? 'documento' : 'lucchetto'} size=${16} /></span>
        <span class="tl-testo"><b>${nomeDocumento(docInfo[r.id])}</b><small>Documento in scadenza</small></span>
      </button></li>`;
  };

  return html`<section class="home">
    <div class="saluto">
      <h2>Ciao ${io?.nome || ''}</h2>
      <p>${giornoLungo(t)}</p>
    </div>

    <div class="rapide">
      <button onClick=${() => nuovo(EventoForm)}><${Icona} n="calendario" /><span>Appuntamento</span></button>
      <button onClick=${() => nuovo(PagamentoForm)}><${Icona} n="euro" /><span>Da pagare</span></button>
      <button onClick=${() => ctx.vai('spesa')}><${Icona} n="carrello" /><span>Spesa</span></button>
      <button onClick=${nuovoDocumento}><${Icona} n="documento" /><span>Documento</span></button>
    </div>

    <div class="schede">
      <button class="scheda" onClick=${() => ctx.vai('pagamenti')}>
        <span class="etichetta">Da pagare</span>
        <strong>${euro(totale)}</strong>
        <small>${daPagare.length} voc${daPagare.length === 1 ? 'e' : 'i'}${scaduti.length ? html` · <span class="rosso">${scaduti.length} scadut${scaduti.length === 1 ? 'o' : 'i'}</span>` : ''}</small>
      </button>
      <button class="scheda" onClick=${() => ctx.vai('spesa')}>
        <span class="etichetta">Lista spesa</span>
        <strong>${spesa.length}</strong>
        <small>articol${spesa.length === 1 ? 'o' : 'i'} da prendere</small>
      </button>
    </div>

    ${scaduti.length > 0 && html`<div class="blocco allarme">
      <h3><${Icona} n="allerta" size=${18} /> Pagamenti scaduti</h3>
      <ul class="lista-compatta">${scaduti.map((p) => html`<li key=${p.id}>
        <span><b>${p.titolo}</b> ${p.importo != null ? euro(p.importo) : ''}<small>scaduto ${relativo(p.scadenza)}</small></span>
        <button class="btn-pagato" onClick=${() => segnaPagato(ctx, p)}><${Icona} n="check" size=${16} /> Pagato</button>
      </li>`)}</ul>
    </div>`}

    <div class="blocco">
      <h3>Prossimi ${GIORNI} giorni</h3>
      <${BarraGoogle} ctx=${ctx} compatta />
      ${conVoci.length === 0
        ? html`<p class="tenue">Niente in programma. Settimana tranquilla!</p>`
        : conVoci.map((g) => html`<div class="tl-giorno" key=${g.data}>
            <div class="tl-data"><b>${relativo(g.data) === 'oggi' ? 'Oggi' : relativo(g.data) === 'domani' ? 'Domani' : giornoLungo(g.data)}</b></div>
            <ul>${g.voci.map(voce)}</ul>
          </div>`)}
    </div>

    ${docInScadenza.length > 0 && html`<div class="blocco">
      <h3>Documenti in scadenza</h3>
      <ul class="lista-compatta">${docInScadenza.map((d) => {
        const st = statoDocumento(d.scadenza);
        return html`<li key=${d.id} onClick=${() => ctx.vai('documenti')} class="cliccabile">
          <span><${Icona} n=${docInfo[d.id] ? 'documento' : 'lucchetto'} size=${16} /> <b>${nomeDocumento(docInfo[d.id])}</b>
            <small>${dataNumerica(d.scadenza)}</small></span>
          <span class=${'chip ' + st}>${st === 'scaduto' ? 'Scaduto' : relativo(d.scadenza)}</span>
        </li>`;
      })}</ul>
      ${!ctx.chiave && html`<p class="suggerimento">Apri la cassaforte per vedere di quali documenti si tratta.</p>`}
    </div>`}
  </section>`;
}
