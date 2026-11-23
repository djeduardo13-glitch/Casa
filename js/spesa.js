import { html, useState, useRef } from '../vendor/preact-htm.js';
import { Icona, Vuoto, Persona } from './ui.js';

// "2 latte" oppure "latte x2" → { nome: 'latte', quantita: '2' }
function interpreta(testo) {
  const t = testo.trim().replace(/\s+/g, ' ');
  let m = t.match(/^(\d+(?:[.,]\d+)?\s?(?:kg|g|gr|l|lt|ml|pz|conf)?)\s+(.+)$/i);
  if (m) return { nome: m[2], quantita: m[1] };
  m = t.match(/^(.+?)\s+x\s?(\d+)$/i);
  if (m) return { nome: m[1], quantita: m[2] };
  return { nome: t, quantita: null };
}

export function Spesa({ ctx }) {
  const [testo, setTesto] = useState('');
  const input = useRef();
  const voci = ctx.data.spesa;
  const daPrendere = voci.filter((v) => !v.fatto).sort((a, b) => a.creato_il.localeCompare(b.creato_il));
  const presi = voci.filter((v) => v.fatto).sort((a, b) => a.nome.localeCompare(b.nome));

  const aggiungi = async (e) => {
    e.preventDefault();
    if (!testo.trim()) return;
    const righe = testo.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    setTesto('');
    await ctx.esegui(async () => {
      for (const r of righe) await ctx.be.insert('spesa', interpreta(r));
    });
    input.current?.focus();
  };

  const alterna = (v) =>
    ctx.esegui(() => ctx.be.update('spesa', v.id, v.fatto ? { fatto: false, fatto_da: null } : { fatto: true, fatto_da: ctx.user.id }));

  const svuota = async () => {
    if (!confirm(`Togliere dalla lista i ${presi.length} articoli già presi?`)) return;
    await ctx.esegui(async () => {
      for (const v of presi) await ctx.be.remove('spesa', v.id);
    }, 'Lista ripulita.');
  };

  const voce = (v) => html`<li key=${v.id} class=${'spesa-voce' + (v.fatto ? ' fatta' : '')}>
    <button class="spunta" onClick=${() => alterna(v)} aria-label=${v.fatto ? 'Togli spunta' : 'Spunta'}>
      ${v.fatto && html`<${Icona} n="check" size=${16} />`}
    </button>
    <button class="spesa-testo" onClick=${() => alterna(v)}>
      <span class="spesa-nome">${v.nome}</span>
      ${v.quantita && html`<span class="quantita">${v.quantita}</span>`}
    </button>
    <span class="spesa-chi" title=${v.fatto ? 'Preso da ' + (ctx.profili[v.fatto_da]?.nome || '') : 'Aggiunto da ' + (ctx.profili[v.creato_da]?.nome || '')}>
      <${Persona} profili=${ctx.profili} id=${v.fatto ? v.fatto_da : v.creato_da} piccolo />
    </span>
    <button class="btn-icona tenue" onClick=${() => ctx.esegui(() => ctx.be.remove('spesa', v.id))} aria-label="Elimina">
      <${Icona} n="x" size=${16} />
    </button>
  </li>`;

  return html`<section>
    <form class="aggiungi-veloce" onSubmit=${aggiungi}>
      <input ref=${input} value=${testo} onInput=${(e) => setTesto(e.target.value)}
        placeholder="Aggiungi… (es. 2 latte, pane, uova)" enterkeyhint="done" aria-label="Nuovo articolo" />
      <button class="btn primario" type="submit" aria-label="Aggiungi"><${Icona} n="piu" /></button>
    </form>
    <p class="suggerimento">Puoi scriverne tanti insieme separati da virgola. Tocca un articolo per spuntarlo.</p>

    ${!voci.length && html`<${Vuoto} icona="carrello" testo="La lista è vuota." />`}
    ${daPrendere.length > 0 && html`<ul class="lista-spesa">${daPrendere.map(voce)}</ul>`}
    ${presi.length > 0 && html`
      <div class="sezione-testa">
        <h3>Nel carrello (${presi.length})</h3>
        <button class="btn piccolo" onClick=${svuota}><${Icona} n="cestino" size=${16} /> Togli i presi</button>
      </div>
      <ul class="lista-spesa">${presi.map(voce)}</ul>`}
  </section>`;
}
