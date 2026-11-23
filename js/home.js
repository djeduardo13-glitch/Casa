import { html } from '../vendor/preact-htm.js';
import { Icona, Persona } from './ui.js';
import { oggi, aggiungiGiorni, giornoLungo, relativo, euro, ora, dataNumerica, daStringa } from './date.js';
import { EventoForm, ordinaEventi } from './agenda.js';
import { PagamentoForm, segnaPagato, ordinaPerScadenza } from './pagamenti.js';
import { DocumentoForm, statoDocumento, nomeDocumento } from './documenti.js';
import { BarraGoogle } from './gcal.js';

const GIORNI = 7;
const GIORNI_SETT = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

// Menu del pulsante "+" in Home
export function MenuAggiungi({ ctx }) {
  const vai = (C) => ctx.apri(html`<${C} ctx=${ctx} />`);
  const voci = [
    { c: 'c-agenda', i: 'calendario', t: 'Appuntamento', s: 'Visita, cena, impegno…', f: () => vai(EventoForm) },
    { c: 'c-pagamenti', i: 'euro', t: 'Da pagare', s: 'Bolletta, rata, tassa…', f: () => vai(PagamentoForm) },
    { c: 'c-spesa', i: 'carrello', t: 'Lista della spesa', s: 'Aggiungi articoli', f: () => { ctx.chiudi(); ctx.vai('spesa'); } },
    { c: 'c-documenti', i: 'documento', t: 'Documento', s: 'Scadenza protetta', f: () => (ctx.chiave ? vai(DocumentoForm) : (ctx.chiudi(), ctx.vai('documenti'), ctx.toast('Apri prima la cassaforte.'))) },
  ];
  return html`<div class="velo" onClick=${(e) => e.target === e.currentTarget && ctx.chiudi()}>
    <div class="foglio" role="dialog" aria-modal="true" aria-label="Aggiungi">
      <div class="foglio-testa"><h2>Aggiungi</h2>
        <button class="btn-icona" onClick=${ctx.chiudi} aria-label="Chiudi"><${Icona} n="x" /></button></div>
      <ul class="menu-aggiungi">${voci.map((v) => html`<li key=${v.t}>
        <button onClick=${v.f}><span class=${'ico ' + v.c}><${Icona} n=${v.i} /></span>
          <span><b>${v.t}</b><small>${v.s}</small></span></button></li>`)}</ul>
    </div>
  </div>`;
}

export function Home({ ctx }) {
  const t = oggi();
  const fine = aggiungiGiorni(t, GIORNI - 1);
  const io = ctx.profili[ctx.user.id];
  const h = new Date().getHours();
  const saluto = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';

  const daPagare = ctx.data.pagamenti.filter((p) => !p.pagato_il);
  const scaduti = daPagare.filter((p) => p.scadenza && p.scadenza < t).sort(ordinaPerScadenza);
  const totale = daPagare.reduce((s, p) => s + (Number(p.importo) || 0), 0);
  const spesa = ctx.data.spesa.filter((v) => !v.fatto);
  const docInScadenza = ctx.data.documenti
    .filter((d) => d.scadenza && ['scaduto', 'urgente', 'vicino'].includes(statoDocumento(d.scadenza)) && d.scadenza <= aggiungiGiorni(t, 60))
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  const docInfo = Object.fromEntries(ctx.documenti.map((d) => [d.id, d.info]));

  // voci dei prossimi 7 giorni
  const giorni = [];
  for (let i = 0; i < GIORNI; i++) giorni.push({ data: aggiungiGiorni(t, i), voci: [] });
  const idx = (d) => giorni.findIndex((g) => g.data === d);
  ctx.data.eventi.filter((e) => e.data >= t && e.data <= fine).sort(ordinaEventi).forEach((e) => giorni[idx(e.data)].voci.push({ tipo: 'evento', r: e }));
  ctx.gEventi.filter((e) => e.data >= t && e.data <= fine).forEach((e) => giorni[idx(e.data)].voci.push({ tipo: 'google', r: e }));
  giorni.forEach((g) => g.voci.sort((a, b) => (a.r.ora || '').localeCompare(b.r.ora || '')));
  daPagare.filter((p) => p.scadenza && p.scadenza >= t && p.scadenza <= fine).forEach((p) => giorni[idx(p.scadenza)].voci.push({ tipo: 'pagamento', r: p }));
  ctx.data.documenti.filter((d) => d.scadenza >= t && d.scadenza <= fine).forEach((d) => giorni[idx(d.scadenza)].voci.push({ tipo: 'documento', r: d }));
  const oggiVoci = giorni[0].voci;
  const prossimi = giorni.slice(1).filter((g) => g.voci.length);

  const apri = (C, extra = {}) => ctx.apri(html`<${C} ctx=${ctx} ...${extra} />`);

  const riga = ({ tipo, r }) => {
    if (tipo === 'evento')
      return html`<li key=${r.id}><button class="riga-tl c-agenda" onClick=${() => apri(EventoForm, { evento: r })}>
        <span class=${'ora-tl' + (r.ora ? '' : ' tenue')}>${r.ora ? ora(r.ora) : 'giorno'}</span><span class="punto"></span>
        <span class="tl-testo"><b>${r.titolo}</b>${r.luogo && html`<small>${r.luogo}</small>`}</span>
        <${Persona} profili=${ctx.profili} id=${r.creato_da} piccolo /></button></li>`;
    if (tipo === 'google')
      return html`<li key=${'g' + r.gid}><a class="riga-tl" style=${{ '--c': r.colore }} href=${r.link} target="_blank" rel="noopener">
        <span class=${'ora-tl' + (r.ora ? '' : ' tenue')}>${r.ora || 'giorno'}</span><span class="punto"></span>
        <span class="tl-testo"><b>${r.titolo}</b><small>${r.calNome}${r.luogo ? ' · ' + r.luogo : ''}</small></span>
        <span class="g-logo">G</span></a></li>`;
    if (tipo === 'pagamento')
      return html`<li key=${r.id}><button class="riga-tl c-pagamenti" onClick=${() => apri(PagamentoForm, { pagamento: r })}>
        <span class="ora-tl tenue">scade</span><span class="punto"></span>
        <span class="tl-testo"><b>${r.titolo}</b><small>Da pagare${r.importo != null ? ' · ' + euro(r.importo) : ''}</small></span>
        </button></li>`;
    return html`<li key=${r.id}><button class="riga-tl c-documenti" onClick=${() => ctx.vai('documenti')}>
      <span class="ora-tl tenue">scade</span><span class="punto"></span>
      <span class="tl-testo"><b>${nomeDocumento(docInfo[r.id])}</b><small>Documento</small></span>
      ${!docInfo[r.id] && html`<${Icona} n="lucchetto" size=${16} />`}</button></li>`;
  };

  return html`<section class="home">
    <div class="saluto">
      <h2>${saluto}, <em>${io?.nome || ''}</em></h2>
      <p>${giornoLungo(t)}</p>
    </div>

    <div class="oggi">
      <div class="oggi-testa"><h3>Oggi</h3><span>${oggiVoci.length ? `${oggiVoci.length} ${oggiVoci.length === 1 ? 'impegno' : 'impegni'}` : ''}</span></div>
      ${oggiVoci.length ? html`<ul>${oggiVoci.map(riga)}</ul>` : html`<p class="oggi-vuoto">Niente in programma. Giornata libera.</p>`}
    </div>

    <div class="schede">
      <button class="scheda" onClick=${() => ctx.vai('pagamenti')}>
        <span class="ico piccola c-pagamenti"><${Icona} n="euro" size=${17} /></span>
        <span><strong>${euro(totale).replace(',00', '')}</strong>
          <small>${scaduti.length ? html`<span class="rosso">${scaduti.length} scadut${scaduti.length === 1 ? 'o' : 'i'}</span>` : `${daPagare.length} da pagare`}</small></span>
      </button>
      <button class="scheda" onClick=${() => ctx.vai('spesa')}>
        <span class="ico piccola c-spesa"><${Icona} n="carrello" size=${17} /></span>
        <span><strong>${spesa.length}</strong><small>da comprare</small></span>
      </button>
      <button class="scheda" onClick=${() => ctx.vai('documenti')}>
        <span class="ico piccola c-documenti"><${Icona} n="documento" size=${17} /></span>
        <span><strong>${docInScadenza.length}</strong><small>in scadenza</small></span>
      </button>
    </div>

    ${scaduti.length > 0 && html`<div class="blocco allarme">
      <h3><${Icona} n="allerta" size=${15} /> Pagamenti scaduti</h3>
      <ul class="lista-compatta">${scaduti.map((p) => html`<li key=${p.id}>
        <span><b>${p.titolo}</b><small>${p.importo != null ? euro(p.importo) + ' · ' : ''}scaduto ${relativo(p.scadenza)}</small></span>
        <button class="btn-pagato" onClick=${() => segnaPagato(ctx, p)}><${Icona} n="check" size=${16} /> Pagato</button>
      </li>`)}</ul>
    </div>`}

    <div class="blocco">
      <div class="blocco-testa"><h3>Prossimi giorni</h3><${BarraGoogle} ctx=${ctx} compatta /></div>
      ${prossimi.length === 0
        ? html`<p class="tenue-testo">Niente in programma per il resto della settimana.</p>`
        : prossimi.map((g) => html`<div class="giorno-tl" key=${g.data}>
            <div class="data-tl"><b>${daStringa(g.data).getDate()}</b><small>${relativo(g.data) === 'domani' ? 'domani' : GIORNI_SETT[daStringa(g.data).getDay()]}</small></div>
            <ul>${g.voci.map(riga)}</ul>
          </div>`)}
    </div>

    ${docInScadenza.length > 0 && html`<div class="blocco">
      <div class="blocco-testa"><h3>Documenti in scadenza</h3></div>
      <ul class="lista-compatta">${docInScadenza.map((d) => {
        const st = statoDocumento(d.scadenza);
        return html`<li key=${d.id} onClick=${() => ctx.vai('documenti')} class="cliccabile">
          <span><b>${nomeDocumento(docInfo[d.id])}</b><small>${dataNumerica(d.scadenza)}</small></span>
          <span class=${'chip ' + st}>${st === 'scaduto' ? 'Scaduto' : relativo(d.scadenza)}</span>
        </li>`;
      })}</ul>
      ${!ctx.chiave && html`<p class="suggerimento"><${Icona} n="lucchetto" size=${13} /> Apri la cassaforte per vedere i nomi.</p>`}
    </div>`}
  </section>`;
}
