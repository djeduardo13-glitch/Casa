// Strato dati: Supabase (reale, condiviso) oppure "demo" (solo su questo browser).
// L'interfaccia è la stessa, così l'app non sa quale dei due sta usando.

export const TABELLE = ['profili', 'spesa', 'pagamenti', 'eventi', 'cassaforte', 'documenti', 'piani', 'piani_voci'];

const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

// ---------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------
function supabaseBackend(url, key) {
  const sb = window.supabase.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const ok = ({ data, error }) => {
    if (error) throw new Error(traduciErrore(error.message));
    return data;
  };

  return {
    demo: false,
    auth: {
      async user() {
        const { data } = await sb.auth.getSession();
        return data.session?.user ?? null;
      },
      async signIn(email, password) {
        ok(await sb.auth.signInWithPassword({ email, password }));
      },
      async signUp(email, password) {
        const data = ok(await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin + location.pathname },
        }));
        return { needsConfirm: !data.session };
      },
      async signOut() {
        await sb.auth.signOut();
      },
      onChange(cb) {
        sb.auth.onAuthStateChange((_ev, session) => cb(session?.user ?? null));
      },
    },
    async isMember() {
      return !!ok(await sb.rpc('is_member'));
    },
    async list(table) {
      return ok(await sb.from(table).select('*'));
    },
    async insert(table, row) {
      return ok(await sb.from(table).insert(row).select().single());
    },
    async update(table, id, patch) {
      ok(await sb.from(table).update(patch).eq('id', id));
    },
    async upsert(table, row) {
      ok(await sb.from(table).upsert(row));
    },
    async remove(table, id) {
      ok(await sb.from(table).delete().eq('id', id));
    },
    // --- file allegati (bucket privato "allegati") ---
    async caricaFile(percorso, file) {
      ok(await sb.storage.from('allegati').upload(percorso, file, { contentType: file.type || 'application/octet-stream' }));
    },
    async urlFile(percorsi) {
      if (!percorsi.length) return {};
      const data = ok(await sb.storage.from('allegati').createSignedUrls(percorsi, 3600));
      return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
    },
    async eliminaFile(percorsi) {
      if (percorsi.length) ok(await sb.storage.from('allegati').remove(percorsi));
    },
    subscribe(cb) {
      let ch = sb.channel('casa');
      for (const t of TABELLE) {
        ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => cb(t));
      }
      ch.subscribe();
      return () => sb.removeChannel(ch);
    },
  };
}

function traduciErrore(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email o password non corretti.';
  if (m.includes('email not confirmed')) return "Devi prima confermare l'email (controlla la posta).";
  if (m.includes('user already registered')) return 'Questo account esiste già: usa "Accedi".';
  if (m.includes('password should be at least')) return 'La password deve avere almeno 6 caratteri.';
  if (m.includes('row-level security')) return 'Il tuo account non è autorizzato a usare questa app.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Nessuna connessione. Riprova tra poco.';
  if (m.includes('exceeded the maximum') || m.includes('payload too large')) return 'File troppo grande (massimo 20 MB).';
  if (m.includes('bucket not found')) return 'Archivio file non ancora attivato su Supabase.';
  return msg;
}

// ---------------------------------------------------------------------
// Demo (localStorage) – per provare l'app senza configurare nulla.
// Ogni scheda del browser può essere un utente diverso.
// ---------------------------------------------------------------------
function demoBackend() {
  const DB = 'casa-demo-db';
  const USERS = 'casa-demo-users';
  const SESS = 'casa-demo-session';
  const FILES = 'casa-demo-files';
  const listeners = new Set();
  const authListeners = new Set();

  const read = (k, def) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; }
  };
  const db = () => ({ ...Object.fromEntries(TABELLE.map((t) => [t, []])), ...read(DB, {}) });
  const save = (data, table) => {
    localStorage.setItem(DB, JSON.stringify(data));
    listeners.forEach((cb) => cb(table));
  };
  const current = () => {
    try { return JSON.parse(sessionStorage.getItem(SESS) || 'null'); } catch { return null; }
  };
  const setCurrent = (u) => {
    if (u) sessionStorage.setItem(SESS, JSON.stringify(u));
    else sessionStorage.removeItem(SESS);
    authListeners.forEach((cb) => cb(u));
  };

  window.addEventListener('storage', (e) => {
    if (e.key === DB) listeners.forEach((cb) => cb('*'));
  });

  return {
    demo: true,
    auth: {
      async user() { return current(); },
      async signIn(email, password) {
        const users = read(USERS, {});
        const u = users[email.toLowerCase()];
        if (!u || u.password !== password) throw new Error('Email o password non corretti.');
        setCurrent({ id: u.id, email: email.toLowerCase() });
      },
      async signUp(email, password) {
        if (password.length < 6) throw new Error('La password deve avere almeno 6 caratteri.');
        const users = read(USERS, {});
        const k = email.toLowerCase();
        if (users[k]) throw new Error('Questo account esiste già: usa "Accedi".');
        users[k] = { id: uuid(), password };
        localStorage.setItem(USERS, JSON.stringify(users));
        setCurrent({ id: users[k].id, email: k });
        return { needsConfirm: false };
      },
      async signOut() { setCurrent(null); },
      onChange(cb) { authListeners.add(cb); },
    },
    async isMember() { return true; },
    async list(table) { return db()[table] || []; },
    async insert(table, row) {
      const data = db();
      const u = current();
      const r = { id: uuid(), ...row, creato_da: u?.id ?? null, creato_il: new Date().toISOString() };
      if (table === 'cassaforte') r.id = 1;
      data[table] = [...(data[table] || []), r];
      save(data, table);
      return r;
    },
    async update(table, id, patch) {
      const data = db();
      data[table] = data[table].map((r) => (r.id === id ? { ...r, ...patch } : r));
      save(data, table);
    },
    async upsert(table, row) {
      const data = db();
      const exists = data[table].some((r) => r.id === row.id);
      data[table] = exists
        ? data[table].map((r) => (r.id === row.id ? { ...r, ...row } : r))
        : [...data[table], { creato_il: new Date().toISOString(), ...row }];
      save(data, table);
    },
    async remove(table, id) {
      const data = db();
      data[table] = data[table].filter((r) => r.id !== id);
      save(data, table);
    },
    async caricaFile(percorso, file) {
      if (file.size > 2e6) throw new Error('In modalità prova i file possono essere al massimo 2 MB.');
      const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      const f = read(FILES, {}); f[percorso] = url;
      localStorage.setItem(FILES, JSON.stringify(f));
    },
    async urlFile(percorsi) {
      const f = read(FILES, {});
      const out = {};
      for (const p of percorsi) if (f[p]) out[p] = URL.createObjectURL(await (await fetch(f[p])).blob());
      return out;
    },
    async eliminaFile(percorsi) {
      const f = read(FILES, {}); percorsi.forEach((p) => delete f[p]);
      localStorage.setItem(FILES, JSON.stringify(f));
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

export function creaBackend(config) {
  if (config?.SUPABASE_URL && config?.SUPABASE_ANON_KEY) {
    if (!window.supabase) throw new Error('Impossibile caricare l’app: controlla la connessione e riprova.');
    return supabaseBackend(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }
  return demoBackend();
}
