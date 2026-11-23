// Utilità per le date. Le date "solo giorno" sono stringhe 'AAAA-MM-GG' (ora locale).

const pad = (n) => String(n).padStart(2, '0');

export const aStringa = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const oggi = () => aStringa(new Date());

const parti = (s) => s.split('-').map(Number);
export const daStringa = (s) => {
  const [y, m, d] = parti(s);
  return new Date(y, m - 1, d);
};

// giorni da a → b (b - a), senza problemi di ora legale
export const giorniTra = (a, b) => {
  const [y1, m1, d1] = parti(a);
  const [y2, m2, d2] = parti(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

export const aggiungiGiorni = (s, n) => {
  const d = daStringa(s);
  d.setDate(d.getDate() + n);
  return aStringa(d);
};

// aggiunge mesi senza "sforare" (31 gen + 1 mese = 28/29 feb)
export const aggiungiMesi = (s, n) => {
  const [y, m, d] = parti(s);
  const tot = m - 1 + n;
  const ny = y + Math.floor(tot / 12);
  const nm = ((tot % 12) + 12) % 12;
  const ultimo = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, ultimo))}`;
};

export const MESI_RICORRENZA = { mensile: 1, bimestrale: 2, trimestrale: 3, semestrale: 6, annuale: 12 };

export const relativo = (s) => {
  const g = giorniTra(oggi(), s);
  if (g === 0) return 'oggi';
  if (g === 1) return 'domani';
  if (g === -1) return 'ieri';
  if (g > 1 && g < 60) return `tra ${g} giorni`;
  if (g < -1 && g > -60) return `${-g} giorni fa`;
  return giornoBreve(s, true);
};

const fmt = (opts) => new Intl.DateTimeFormat('it-IT', opts);
export const giornoBreve = (s, anno = false) =>
  fmt({ weekday: 'short', day: 'numeric', month: 'short', ...(anno ? { year: 'numeric' } : {}) }).format(daStringa(s));
export const giornoLungo = (s) => {
  const t = fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(daStringa(s));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const dataNumerica = (s) => fmt({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(daStringa(s));

export const ora = (t) => (t ? t.slice(0, 5) : '');

export const tempoFa = (iso) => {
  if (!iso) return '';
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return 'adesso';
  if (sec < 3600) return `${Math.floor(sec / 60)} min fa`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h fa`;
  const g = Math.floor(sec / 86400);
  if (g === 1) return 'ieri';
  if (g < 30) return `${g} giorni fa`;
  return fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
};

export const euro = (n) =>
  n == null || n === '' ? '' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n));
