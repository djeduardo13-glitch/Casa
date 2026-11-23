// Cifratura della cassaforte documenti, tutta nel browser (Web Crypto).
// Password → chiave AES-GCM 256 bit (PBKDF2-SHA256, 310.000 iterazioni).
// La password non lascia mai il telefono e non viene salvata da nessuna parte.

const enc = new TextEncoder();
const dec = new TextDecoder();
const ITERAZIONI = 310000;
const CONTROLLO = 'casa-cassaforte-ok';

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n) => crypto.getRandomValues(new Uint8Array(n));

async function derivaChiave(password, saltB64) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations: ITERAZIONI, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function cifra(chiave, oggetto) {
  const iv = random(12);
  const dati = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chiave, enc.encode(JSON.stringify(oggetto)));
  return { dati_cifrati: toB64(dati), iv: toB64(iv) };
}

export async function decifra(chiave, datiB64, ivB64) {
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, chiave, fromB64(datiB64));
  return JSON.parse(dec.decode(buf));
}

// Crea una nuova cassaforte: restituisce la riga da salvare e la chiave
export async function creaCassaforte(password) {
  const salt = toB64(random(16));
  const chiave = await derivaChiave(password, salt);
  const { dati_cifrati, iv } = await cifra(chiave, CONTROLLO);
  return { riga: { salt, verifica: dati_cifrati, iv }, chiave };
}

// Apre la cassaforte: restituisce la chiave, oppure null se la password è sbagliata
export async function apriCassaforte(riga, password) {
  try {
    const chiave = await derivaChiave(password, riga.salt);
    const v = await decifra(chiave, riga.verifica, riga.iv);
    return v === CONTROLLO ? chiave : null;
  } catch {
    return null;
  }
}
