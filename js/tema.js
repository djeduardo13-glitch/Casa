// Tema dell'app: "giorno" (chiaro), "notte" (scuro) o "auto" (segue il telefono).
// La scelta è salvata su questo dispositivo.
const KEY = 'casa-tema';
const COLORI_BARRA = { giorno: '#f5f3ef', notte: '#0c0f14' };
const scuro = window.matchMedia('(prefers-color-scheme: dark)');

export function temaScelto() {
  try { return localStorage.getItem(KEY) || 'giorno'; } catch { return 'giorno'; }
}

function applica(scelta) {
  const tema = scelta === 'auto' ? (scuro.matches ? 'notte' : 'giorno') : scelta;
  document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORI_BARRA[tema]);
}

export function impostaTema(scelta) {
  try { localStorage.setItem(KEY, scelta); } catch {}
  applica(scelta);
}

applica(temaScelto());
scuro.addEventListener?.('change', () => temaScelto() === 'auto' && applica('auto'));
