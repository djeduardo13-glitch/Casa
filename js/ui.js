import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { tempoFa } from './date.js';

// --- Icone (stile Lucide, ISC) ---------------------------------------
const P = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  euro: '<path d="M4 10h12M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>',
  carrello: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  lucchetto: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  aperto: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  piu: '<path d="M5 12h14M12 5v14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  cestino: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  matita: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  documento: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/>',
  orologio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  luogo: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  ripeti: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  esci: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  allerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  chiave: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  annulla: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  graffetta: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  stella: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
};

export const Icona = ({ n, size = 20 }) =>
  html`<svg class="icona" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    dangerouslySetInnerHTML=${{ __html: P[n] || '' }}></svg>`;

// --- Chi l'ha aggiunto -----------------------------------------------
export function Persona({ profili, id, piccolo }) {
  const p = profili[id];
  const nome = p?.nome || '—';
  return html`<span class=${'persona' + (piccolo ? ' piccola' : '')}>
    <span class="pallino" style=${{ background: p?.colore || '#9ca3af' }}>${nome.charAt(0).toUpperCase()}</span>
    ${!piccolo && html`<span>${nome}</span>`}
  </span>`;
}

export function Autore({ profili, riga, verbo = 'Aggiunto' }) {
  const p = profili[riga.creato_da];
  return html`<span class="autore">
    <span class="pallino mini" style=${{ background: p?.colore || '#9ca3af' }}></span>
    ${verbo} da ${p?.nome || 'qualcuno'} · ${tempoFa(riga.creato_il)}
  </span>`;
}

// --- Modale (foglio dal basso su telefono) ----------------------------
export function Modale({ titolo, onChiudi, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onChiudi();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);
  return html`<div class="velo" onClick=${(e) => e.target === e.currentTarget && onChiudi()}>
    <div class="foglio" role="dialog" aria-modal="true" aria-label=${titolo}>
      <div class="foglio-testa">
        <h2>${titolo}</h2>
        <button class="btn-icona" onClick=${onChiudi} aria-label="Chiudi"><${Icona} n="x" /></button>
      </div>
      ${children}
    </div>
  </div>`;
}

export const Vuoto = ({ icona, testo, children }) =>
  html`<div class="vuoto"><${Icona} n=${icona} size=${36} /><p>${testo}</p>${children}</div>`;

export function Campo({ etichetta, children }) {
  return html`<label class="campo"><span>${etichetta}</span>${children}</label>`;
}

// Bottone che mostra "attendere" durante un'azione asincrona
export function BottoneAsync({ onClick, class: cls = 'btn primario', children, type = 'button', disabled }) {
  const [occupato, setOccupato] = useState(false);
  return html`<button type=${type} class=${cls} disabled=${occupato || disabled}
    onClick=${async (e) => {
      if (!onClick) return;
      setOccupato(true);
      try { await onClick(e); } finally { setOccupato(false); }
    }}>${occupato ? 'Attendere…' : children}</button>`;
}

export const COLORI = ['#4f46e5', '#db2777', '#059669', '#d97706', '#0891b2', '#7c3aed', '#dc2626', '#475569'];
