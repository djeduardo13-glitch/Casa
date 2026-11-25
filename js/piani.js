// Piani: cose che vogliamo comprare o cambiare in futuro (caldaia, divano…),
// con un diario di aggiornamenti: note, link, preventivi, file allegati.
import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { Icona, Modale, Vuoto, Campo, BottoneAsync, Persona, Autore } from './ui.js';
import { euro, tempoFa, giornoBreve, dataNumerica } from './date.js';

export const STATI = [
  ['idea', 'Idea'],
  ['preventivi', 'Raccolta preventivi'],
  ['deciso', 'Deciso'],
  ['fatto', 'Fatto'],
];
const PRIORITA = [['alta', 'Alta'], ['media', 'Media'], ['bassa', 'Bassa']];
const ORDINE_PRIO = { alta: 0, media: 1, bassa: 2 };
const nomeStato = (s) => STATI.find(([k]) => k === s)?.[1] || s;
const numero = (v) => {
  if (v === '' || v == null) return null;
  let t = String(v).trim().replace(/[€\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return Number(t);
};
const nomeSicuro = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
const dimensione = (b) => (b == null ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const conHttp = (u) => (/^https?:\/\//i.test(u) ? u : 'https://' + u);

const vociDi = (ctx, id) => (ctx.data.piani_voci || []).filter((v) => v.piano_id === id);

export function riepilogoPiano(ctx, piano) {
  const voci = vociDi(ctx, piano.id);
  const prev = voci.filter((v) => v.tipo === 'preventivo');
  const importi = prev.map((v) => Number(v.importo)).filter((n) => !isNaN(n) && n > 0);
  const scelto = prev.find((v) => v.scelto);
  return {
    voci, prev, scelto,
    min: importi.length ? Math.min(...importi) : null,
    max: importi.length ? Math.max(...importi) : null,
  };
}

// --- Modulo nuovo / modifica piano ----------------------------------------
export function PianoForm({ ctx, piano }) {
  const [f, setF] = useState({
    titolo: piano?.titolo || '',
    descrizione: piano?.descrizione || '',
    stima: piano?.stima ?? '',
    priorita: piano?.priorita || 'media',
    stato: piano?.stato || 'idea',
    entro: piano?.entro || '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const salva = async () => {
    if (!f.titolo.trim()) return ctx.toast('Scrivi cosa volete fare.', 'errore');
    const riga = {
      titolo: f.titolo.trim(), descrizione: f.descrizione.trim() || null, stima: numero(f.stima),
      priorita: f.priorita, stato: f.stato, entro: f.entro || null, aggiornato_il: new Date().toISOString(),
    };
    if (riga.stima != null && isNaN(riga.stima)) return ctx.toast('Prezzo stimato non valido.', 'errore');
    let nuovo = null;
    const ok = await ctx.esegui(async () => {
      if (piano) await ctx.be.update('piani', piano.id, riga);
      else nuovo = await ctx.be.insert('piani', riga);
    }, piano ? 'Piano aggiornato.' : 'Piano creato. Ora aggiungi link, preventivi o file.');
    if (!ok) return;
    const id = piano?.id || nuovo?.id;
    ctx.apri((c) => html`<${PianoDettaglio} ctx=${c} id=${id} />`);
  };

  return html`<${Modale} titolo=${piano ? 'Modifica piano' : 'Nuovo piano'} onChiudi=${ctx.chiudi}>
    <form class="modulo" onSubmit=${(e) => { e.preventDefault(); salva(); }}>
      <${Campo} etichetta="Cosa">
        <input value=${f.titolo} onInput=${set('titolo')} placeholder="Es. Caldaia nuova, divano, tende camera…" autofocus />
      <//>
      <${Campo} etichetta="Dettagli">
        <textarea value=${f.descrizione} onInput=${set('descrizione')} rows="3" placeholder="Cosa vi serve, misure, idee…"></textarea>
      <//>
      <div class="riga2">
        <${Campo} etichetta="Prezzo stimato (€)"><input value=${f.stima} onInput=${set('stima')} inputmode="decimal" placeholder="0" /><//>
        <${Campo} etichetta="Entro quando"><input type="date" value=${f.entro} onInput=${set('entro')} /><//>
      </div>
      <div class="campo"><span>Priorità</span>
        <div class="segmenti stretto">${PRIORITA.map(([k, v]) => html`<button type="button" class=${f.priorita === k ? 'attivo' : ''} onClick=${() => setF({ ...f, priorita: k })}>${v}</button>`)}</div>
      </div>
      <${Campo} etichetta="A che punto siete">
        <select value=${f.stato} onChange=${set('stato')}>${STATI.map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select>
      <//>
      <div class="azioni-modulo"><${BottoneAsync} type="submit" onClick=${salva}>${piano ? 'Salva' : 'Crea piano'}<//></div>
    </form>
  <//>`;
}

// --- Nuovo aggiornamento (nota / link / preventivo / file) ----------------
function NuovaVoce({ ctx, piano, tipo, onFatto }) {
  const [f, setF] = useState({ testo: '', url: '', fornitore: '', importo: '' });
  const [file, setFile] = useState([]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const salva = async () => {
    if (tipo === 'nota' && !f.testo.trim()) return ctx.toast('Scrivi la nota.', 'errore');
    if (tipo === 'link' && !f.url.trim()) return ctx.toast('Incolla il link.', 'errore');
    if (tipo === 'preventivo' && !f.fornitore.trim() && !f.importo) return ctx.toast('Indica almeno il fornitore o l’importo.', 'errore');
    if (tipo === 'file' && !file.length) return ctx.toast('Scegli almeno un file.', 'errore');
    const importo = numero(f.importo);
    if (importo != null && isNaN(importo)) return ctx.toast('Importo non valido.', 'errore');
    for (const fl of file) if (fl.size > 20 * 1048576) return ctx.toast(`"${fl.name}" supera i 20 MB.`, 'errore');

    const ok = await ctx.esegui(async () => {
      const caricati = [];
      for (const fl of file) {
        const percorso = `piani/${piano.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${nomeSicuro(fl.name)}`;
        await ctx.be.caricaFile(percorso, fl);
        caricati.push({ file_path: percorso, file_nome: fl.name, file_tipo: fl.type || null, file_dim: fl.size });
      }
      const base = {
        piano_id: piano.id, tipo,
        testo: f.testo.trim() || null,
        url: f.url.trim() ? conHttp(f.url.trim()) : null,
        fornitore: f.fornitore.trim() || null,
        importo,
      };
      if (tipo === 'file') for (const c of caricati) await ctx.be.insert('piani_voci', { ...base, ...c });
      else await ctx.be.insert('piani_voci', { ...base, ...(caricati[0] || {}) });
      const patch = { aggiornato_il: new Date().toISOString() };
      if (tipo === 'preventivo' && piano.stato === 'idea') patch.stato = 'preventivi';
      await ctx.be.update('piani', piano.id, patch);
    }, 'Aggiunto al piano.');
    if (ok) onFatto();
  };

  const scegliFile = (multiplo) => html`<label class="scegli-file">
    <input type="file" multiple=${multiplo} onChange=${(e) => setFile([...e.target.files])} />
    <${Icona} n="graffetta" size=${18} />
    <span>${file.length ? file.map((x) => x.name).join(', ') : multiplo ? 'Scegli file (PDF, foto, mail salvate…)' : 'Allega il preventivo (facoltativo)'}</span>
  </label>`;

  return html`<form class="nuova-voce modulo" onSubmit=${(e) => { e.preventDefault(); salva(); }}>
    ${tipo === 'nota' && html`<textarea value=${f.testo} onInput=${set('testo')} rows="3" placeholder="Es. Il tecnico consiglia una caldaia a condensazione da 24 kW… (puoi incollare anche il testo di una mail)" autofocus></textarea>`}
    ${tipo === 'link' && html`
      <input value=${f.url} onInput=${set('url')} placeholder="Incolla il link (https://…)" inputmode="url" autofocus />
      <input value=${f.testo} onInput=${set('testo')} placeholder="Descrizione (facoltativa)" />`}
    ${tipo === 'preventivo' && html`
      <div class="riga2">
        <input value=${f.fornitore} onInput=${set('fornitore')} placeholder="Fornitore / ditta" autofocus />
        <input value=${f.importo} onInput=${set('importo')} placeholder="Importo €" inputmode="decimal" />
      </div>
      <input value=${f.url} onInput=${set('url')} placeholder="Link (facoltativo)" inputmode="url" />
      <textarea value=${f.testo} onInput=${set('testo')} rows="2" placeholder="Cosa comprende, tempi, garanzia…"></textarea>
      ${scegliFile(false)}`}
    ${tipo === 'file' && html`
      ${scegliFile(true)}
      <input value=${f.testo} onInput=${set('testo')} placeholder="Descrizione (facoltativa)" />`}
    <div class="azioni-modulo">
      <button type="button" class="btn" onClick=${onFatto}>Annulla</button>
      <${BottoneAsync} type="submit" onClick=${salva}>Aggiungi<//>
    </div>
  </form>`;
}

// --- Un aggiornamento nel diario ------------------------------------------
const ICONE_TIPO = { nota: 'matita', link: 'link', preventivo: 'euro', file: 'graffetta' };

function Voce({ ctx, v, piano, urls }) {
  const url = v.file_path ? urls[v.file_path] : null;
  const immagine = v.file_tipo?.startsWith('image/') && url;
  const elimina = async () => {
    if (!confirm('Eliminare questo aggiornamento?')) return;
    await ctx.esegui(async () => {
      if (v.file_path) await ctx.be.eliminaFile([v.file_path]).catch(() => {});
      await ctx.be.remove('piani_voci', v.id);
    }, 'Eliminato.');
  };
  const scegli = () => ctx.esegui(async () => {
    const altri = vociDi(ctx, piano.id).filter((x) => x.tipo === 'preventivo' && x.scelto && x.id !== v.id);
    for (const a of altri) await ctx.be.update('piani_voci', a.id, { scelto: false });
    await ctx.be.update('piani_voci', v.id, { scelto: !v.scelto });
    if (!v.scelto && piano.stato !== 'fatto') await ctx.be.update('piani', piano.id, { stato: 'deciso', aggiornato_il: new Date().toISOString() });
  }, v.scelto ? 'Scelta tolta.' : 'Preventivo scelto.');

  const allegato = v.file_path && html`<a class="allegato" href=${url || '#'} target="_blank" rel="noopener" onClick=${(e) => !url && (e.preventDefault(), ctx.toast('File in caricamento, riprova tra un attimo.'))}>
    ${immagine ? html`<img src=${url} alt="" />` : html`<${Icona} n="documento" size=${18} />`}
    <span><b>${v.file_nome}</b><small>${dimensione(v.file_dim)}</small></span>
  </a>`;

  return html`<li class=${'voce-piano tipo-' + v.tipo + (v.scelto ? ' scelto' : '')}>
    <span class="vp-ico"><${Icona} n=${v.scelto ? 'stella' : ICONE_TIPO[v.tipo]} size=${15} /></span>
    <div class="vp-corpo">
      ${v.tipo === 'preventivo' && html`<div class="vp-prev">
        <b>${v.fornitore || 'Preventivo'}</b>
        ${v.importo != null && html`<span class="importo">${euro(v.importo)}</span>`}
      </div>`}
      ${v.tipo === 'link' && html`<a class="vp-link" href=${v.url} target="_blank" rel="noopener">${v.testo || dominio(v.url)}<small>${dominio(v.url)}</small></a>`}
      ${v.tipo === 'preventivo' && v.url && html`<a class="vp-link piccolo" href=${v.url} target="_blank" rel="noopener"><${Icona} n="link" size=${13} /> ${dominio(v.url)}</a>`}
      ${v.testo && v.tipo !== 'link' && html`<p class="vp-testo">${v.testo}</p>`}
      ${allegato}
      <div class="vp-meta">
        <${Persona} profili=${ctx.profili} id=${v.creato_da} piccolo />
        <span>${ctx.profili[v.creato_da]?.nome || ''} · ${tempoFa(v.creato_il)}</span>
        ${v.tipo === 'preventivo' && html`<button class=${'btn piccolo' + (v.scelto ? ' scelto' : '')} onClick=${scegli}>
          <${Icona} n="stella" size=${13} /> ${v.scelto ? 'Scelto' : 'Scegli'}</button>`}
        <button class="btn-icona tenue" onClick=${elimina} aria-label="Elimina aggiornamento"><${Icona} n="x" size=${15} /></button>
      </div>
    </div>
  </li>`;
}

// --- Dettaglio di un piano -------------------------------------------------
export function PianoDettaglio({ ctx, id }) {
  const piano = (ctx.data.piani || []).find((p) => p.id === id);
  const [modo, setModo] = useState(null);
  const [urls, setUrls] = useState({});
  const r = piano ? riepilogoPiano(ctx, piano) : { voci: [], prev: [] };
  const percorsi = r.voci.filter((v) => v.file_path).map((v) => v.file_path);
  const chiave = percorsi.join('|');

  useEffect(() => {
    const mancanti = percorsi.filter((p) => !urls[p]);
    if (!mancanti.length) return;
    ctx.be.urlFile(mancanti).then((u) => setUrls((x) => ({ ...x, ...u }))).catch(() => {});
  }, [chiave]);

  if (!piano) return html`<${Modale} titolo="Piano" onChiudi=${ctx.chiudi}><p class="tenue">Questo piano non esiste più.</p><//>`;

  const voci = [...r.voci].sort((a, b) => (b.creato_il || '').localeCompare(a.creato_il || ''));
  const pagamento = piano.pagamento_id && ctx.data.pagamenti.find((p) => p.id === piano.pagamento_id);

  const inDaPagare = () => ctx.esegui(async () => {
    const p = await ctx.be.insert('pagamenti', {
      titolo: piano.titolo + (r.scelto?.fornitore ? ` – ${r.scelto.fornitore}` : ''),
      importo: r.scelto?.importo ?? piano.stima ?? null,
      scadenza: piano.entro || null,
      ricorrenza: 'nessuna',
      note: `Dal piano "${piano.titolo}"`,
    });
    await ctx.be.update('piani', piano.id, { pagamento_id: p.id, stato: piano.stato === 'fatto' ? 'fatto' : 'deciso', aggiornato_il: new Date().toISOString() });
  }, 'Aggiunto a "Da pagare".');

  const cambiaStato = (stato) => ctx.esegui(() => ctx.be.update('piani', piano.id, { stato, aggiornato_il: new Date().toISOString() }), stato === 'fatto' ? 'Fatto! Bel traguardo.' : 'Piano riaperto.');

  const eliminaPiano = async () => {
    if (!confirm(`Eliminare il piano "${piano.titolo}" con tutti i suoi aggiornamenti e file?`)) return;
    const ok = await ctx.esegui(async () => {
      if (percorsi.length) await ctx.be.eliminaFile(percorsi).catch(() => {});
      for (const v of r.voci) await ctx.be.remove('piani_voci', v.id);
      await ctx.be.remove('piani', piano.id);
    }, 'Piano eliminato.');
    if (ok) ctx.chiudi();
  };

  const TIPI = [['nota', 'Nota', 'matita'], ['link', 'Link', 'link'], ['preventivo', 'Preventivo', 'euro'], ['file', 'File', 'graffetta']];

  return html`<${Modale} titolo=${piano.titolo} onChiudi=${ctx.chiudi}>
    <div class="piano-dettaglio">
      <div class="piano-chips">
        <span class=${'chip stato-' + piano.stato}>${nomeStato(piano.stato)}</span>
        <span class=${'chip prio-' + piano.priorita}>Priorità ${piano.priorita}</span>
        ${piano.entro && html`<span class="chip neutro">Entro ${giornoBreve(piano.entro, true)}</span>`}
        <button class="btn piccolo" onClick=${() => ctx.apri(html`<${PianoForm} ctx=${ctx} piano=${piano} />`)}><${Icona} n="matita" size=${13} /> Modifica</button>
      </div>

      <div class="piano-numeri">
        <div><span class="etichetta">Stima</span><strong>${piano.stima != null ? euro(piano.stima) : '—'}</strong></div>
        <div><span class="etichetta">Preventivi</span><strong>${r.prev.length}</strong>
          ${r.min != null && html`<small>${r.min === r.max ? euro(r.min) : `${euro(r.min)} – ${euro(r.max)}`}</small>`}</div>
        <div><span class="etichetta">Scelto</span><strong>${r.scelto?.importo != null ? euro(r.scelto.importo) : '—'}</strong>
          ${r.scelto?.fornitore && html`<small>${r.scelto.fornitore}</small>`}</div>
      </div>

      ${piano.descrizione && html`<p class="piano-descr">${piano.descrizione}</p>`}

      <div class="aggiungi-tipo">
        ${TIPI.map(([k, nome, ic]) => html`<button class=${modo === k ? 'attivo' : ''} onClick=${() => setModo(modo === k ? null : k)}>
          <${Icona} n=${ic} size=${18} /><span>${nome}</span></button>`)}
      </div>
      ${modo && html`<${NuovaVoce} key=${modo} ctx=${ctx} piano=${piano} tipo=${modo} onFatto=${() => setModo(null)} />`}

      ${voci.length
        ? html`<ul class="voci-piano">${voci.map((v) => html`<${Voce} key=${v.id} ctx=${ctx} v=${v} piano=${piano} urls=${urls} />`)}</ul>`
        : !modo && html`<p class="tenue piccolo centrato">Ancora nessun aggiornamento. Aggiungi link, preventivi, foto o PDF con i pulsanti qui sopra.</p>`}

      <div class="piano-azioni">
        ${pagamento
          ? html`<span class="chip ok"><${Icona} n="check" size=${13} /> In "Da pagare"${pagamento.pagato_il ? ' · pagato' : ''}</span>`
          : html`<${BottoneAsync} class="btn primario" onClick=${inDaPagare}><${Icona} n="euro" size=${16} /> Sposta in Da pagare<//>`}
        ${piano.stato === 'fatto'
          ? html`<button class="btn" onClick=${() => cambiaStato('deciso')}>Riapri</button>`
          : html`<button class="btn" onClick=${() => cambiaStato('fatto')}><${Icona} n="check" size=${16} /> Fatto</button>`}
      </div>
      <div class="info-autore"><${Autore} profili=${ctx.profili} riga=${piano} verbo="Creato" /></div>
      <button class="link pericolo-testo" onClick=${eliminaPiano}>Elimina piano</button>
    </div>
  <//>`;
}

// --- Elenco piani (scheda dentro "Da pagare") ------------------------------
export function ListaPiani({ ctx }) {
  const piani = ctx.data.piani || [];
  const attivi = piani.filter((p) => p.stato !== 'fatto').sort((a, b) =>
    ORDINE_PRIO[a.priorita] - ORDINE_PRIO[b.priorita] || (b.aggiornato_il || '').localeCompare(a.aggiornato_il || ''));
  const fatti = piani.filter((p) => p.stato === 'fatto').sort((a, b) => (b.aggiornato_il || '').localeCompare(a.aggiornato_il || ''));
  const valore = (p) => { const r = riepilogoPiano(ctx, p); return r.scelto?.importo ?? p.stima ?? r.min; };
  const totale = attivi.reduce((s, p) => s + (Number(valore(p)) || 0), 0);
  const apri = (p) => ctx.apri((c) => html`<${PianoDettaglio} ctx=${c} id=${p.id} />`);

  const voce = (p) => {
    const r = riepilogoPiano(ctx, p);
    const v = valore(p);
    return html`<li class=${'voce piano prio-' + p.priorita} key=${p.id}>
      <button class="voce-corpo" onClick=${() => apri(p)}>
        <span class="ico c-piani"><${Icona} n=${p.stato === 'fatto' ? 'check' : 'home'} size=${18} /></span>
        <span class="voce-testo">
          <span class="voce-titolo">${p.titolo}${p.priorita === 'alta' && html`<span class="prio-punto" title="Priorità alta"></span>`}</span>
          <span class="voce-sotto">
            <span class=${'stato-testo stato-' + p.stato}>${nomeStato(p.stato)}</span>
            ${r.prev.length > 0 && html`<span>${r.prev.length} preventiv${r.prev.length === 1 ? 'o' : 'i'}</span>`}
            ${r.voci.length - r.prev.length > 0 && html`<span><${Icona} n="graffetta" size=${12} /> ${r.voci.length - r.prev.length}</span>`}
            ${p.entro && html`<span>entro ${giornoBreve(p.entro, true)}</span>`}
          </span>
        </span>
        ${v != null && html`<span class="importo">${r.scelto ? '' : '~'}${euro(v)}</span>`}
      </button>
    </li>`;
  };

  return html`<section>
    <div class="riepilogo piani-riepilogo">
      <div><span class="etichetta">Piani in corso</span><strong class="grande">${attivi.length}</strong></div>
      <div><span class="etichetta">Valore stimato</span><strong>${euro(totale)}</strong></div>
    </div>
    ${!piani.length && html`<${Vuoto} icona="home" testo="Nessun piano. Annotate qui le cose da comprare o cambiare in casa: caldaia, divano, infissi…">
      <button class="btn primario" onClick=${() => ctx.apri(html`<${PianoForm} ctx=${ctx} />`)}><${Icona} n="piu" size=${16} /> Nuovo piano</button>
    <//>`}
    ${attivi.length > 0 && html`<ul class="lista">${attivi.map(voce)}</ul>`}
    ${fatti.length > 0 && html`<div class="sezione-testa"><h3>Fatti (${fatti.length})</h3></div><ul class="lista fatti">${fatti.map(voce)}</ul>`}
  </section>`;
}
