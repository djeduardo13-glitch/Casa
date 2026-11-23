import { html, useState } from '../vendor/preact-htm.js';
import { Icona, Autore, Modale, Vuoto, Campo, BottoneAsync } from './ui.js';
import { oggi, giorniTra, relativo, dataNumerica } from './date.js';
import { cifra, creaCassaforte, apriCassaforte } from './crypto.js';

export const TIPI = [
  "Carta d'identità", 'Passaporto', 'Patente', 'Tessera sanitaria', 'Permesso di soggiorno',
  'Assicurazione auto', 'Revisione auto', 'Bollo auto', 'Tagliando', 'Abbonamento', 'Garanzia', 'Altro',
];

export function statoDocumento(scadenza) {
  if (!scadenza) return '';
  const g = giorniTra(oggi(), scadenza);
  if (g < 0) return 'scaduto';
  if (g <= 30) return 'urgente';
  if (g <= 90) return 'vicino';
  return 'ok';
}

export const nomeDocumento = (info) =>
  info ? [info.tipo === 'Altro' ? info.titolo || 'Documento' : info.tipo, info.intestatario].filter(Boolean).join(' – ') : 'Documento protetto';

// --- Creazione / apertura cassaforte ----------------------------------
function CreaCassaforte({ ctx }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const crea = async () => {
    if (p1.length < 6) return ctx.toast('Usa almeno 6 caratteri.', 'errore');
    if (p1 !== p2) return ctx.toast('Le due password non coincidono.', 'errore');
    const { riga, chiave } = await creaCassaforte(p1);
    if (await ctx.esegui(() => ctx.be.insert('cassaforte', riga), 'Cassaforte creata.')) ctx.setChiave(chiave);
  };
  return html`<div class="cassaforte">
    <div class="cassaforte-icona"><${Icona} n="lucchetto" size=${40} /></div>
    <h2>Crea la cassaforte dei documenti</h2>
    <p>Scegliete <b>una password comune</b> che userete entrambi. I dati dei documenti vengono cifrati sul telefono:
      senza questa password nessuno può leggerli, nemmeno chi gestisce il server.</p>
    <p class="avviso-forte"><${Icona} n="allerta" size=${18} /> Se la dimenticate non si può recuperare. Scrivetela in un posto sicuro.</p>
    <form class="modulo" onSubmit=${(e) => { e.preventDefault(); crea(); }}>
      <${Campo} etichetta="Password"><input type="password" value=${p1} onInput=${(e) => setP1(e.target.value)} autocomplete="new-password" /><//>
      <${Campo} etichetta="Ripeti password"><input type="password" value=${p2} onInput=${(e) => setP2(e.target.value)} autocomplete="new-password" /><//>
      <${BottoneAsync} type="submit" onClick=${crea}>Crea cassaforte<//>
    </form>
  </div>`;
}

function ApriCassaforte({ ctx, riga }) {
  const [p, setP] = useState('');
  const apri = async () => {
    const chiave = await apriCassaforte(riga, p);
    if (!chiave) return ctx.toast('Password errata.', 'errore');
    setP('');
    ctx.setChiave(chiave);
  };
  return html`<div class="cassaforte">
    <div class="cassaforte-icona"><${Icona} n="lucchetto" size=${40} /></div>
    <h2>Documenti protetti</h2>
    <p>Inserisci la password della cassaforte per vedere i documenti.</p>
    <form class="modulo" onSubmit=${(e) => { e.preventDefault(); apri(); }}>
      <${Campo} etichetta="Password"><input type="password" value=${p} onInput=${(e) => setP(e.target.value)} autocomplete="current-password" autofocus /><//>
      <${BottoneAsync} type="submit" onClick=${apri}>Apri<//>
    </form>
    <button class="link" onClick=${() => ctx.apri(html`<${Dimenticata} ctx=${ctx} />`)}>Ho dimenticato la password</button>
  </div>`;
}

function Dimenticata({ ctx }) {
  const [conferma, setConferma] = useState('');
  const n = ctx.data.documenti.length;
  const azzera = async () => {
    const ok = await ctx.esegui(async () => {
      for (const d of ctx.data.documenti) await ctx.be.remove('documenti', d.id);
      await ctx.be.remove('cassaforte', 1);
    }, 'Cassaforte azzerata. Potete crearne una nuova.');
    if (ok) ctx.chiudi();
  };
  return html`<${Modale} titolo="Password dimenticata" onChiudi=${ctx.chiudi}>
    <div class="modulo">
      <p>Per sicurezza la password non può essere recuperata. L'unica strada è <b>azzerare la cassaforte</b>:
        verranno eliminati tutti i ${n} documenti salvati e potrete crearne una nuova.</p>
      <${Campo} etichetta='Scrivi CANCELLA per confermare'>
        <input value=${conferma} onInput=${(e) => setConferma(e.target.value)} />
      <//>
      <div class="azioni-modulo">
        <${BottoneAsync} class="btn pericolo pieno" disabled=${conferma.trim().toUpperCase() !== 'CANCELLA'} onClick=${azzera}>Azzera cassaforte<//>
      </div>
    </div>
  <//>`;
}

function CambiaPassword({ ctx }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const cambia = async () => {
    if (p1.length < 6) return ctx.toast('Usa almeno 6 caratteri.', 'errore');
    if (p1 !== p2) return ctx.toast('Le due password non coincidono.', 'errore');
    if (ctx.documenti.some((d) => !d.info)) return ctx.toast('Alcuni documenti non sono leggibili: impossibile cambiare password.', 'errore');
    const { riga, chiave } = await creaCassaforte(p1);
    // prima cifro tutto in memoria, poi salvo
    const nuovi = [];
    for (const d of ctx.documenti) nuovi.push({ id: d.id, ...(await cifra(chiave, d.info)) });
    const ok = await ctx.esegui(async () => {
      for (const d of nuovi) await ctx.be.update('documenti', d.id, { dati_cifrati: d.dati_cifrati, iv: d.iv });
      await ctx.be.update('cassaforte', 1, riga);
    }, 'Password cambiata. Comunicala anche all’altra persona!');
    if (ok) { ctx.setChiave(chiave); ctx.chiudi(); }
  };
  return html`<${Modale} titolo="Cambia password cassaforte" onChiudi=${ctx.chiudi}>
    <form class="modulo" onSubmit=${(e) => { e.preventDefault(); cambia(); }}>
      <${Campo} etichetta="Nuova password"><input type="password" value=${p1} onInput=${(e) => setP1(e.target.value)} autocomplete="new-password" /><//>
      <${Campo} etichetta="Ripeti nuova password"><input type="password" value=${p2} onInput=${(e) => setP2(e.target.value)} autocomplete="new-password" /><//>
      <div class="azioni-modulo"><${BottoneAsync} type="submit" onClick=${cambia}>Cambia password<//></div>
    </form>
  <//>`;
}

// --- Modulo documento -------------------------------------------------
export function DocumentoForm({ ctx, doc }) {
  const nomi = Object.values(ctx.profili).map((p) => p.nome);
  const [f, setF] = useState({
    tipo: doc?.info?.tipo || TIPI[0],
    titolo: doc?.info?.titolo || '',
    intestatario: doc?.info?.intestatario || ctx.profili[ctx.user.id]?.nome || '',
    numero: doc?.info?.numero || '',
    scadenza: doc?.scadenza || '',
    note: doc?.info?.note || '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const salva = async () => {
    if (f.tipo === 'Altro' && !f.titolo.trim()) return ctx.toast('Scrivi di che documento si tratta.', 'errore');
    if (!f.scadenza) return ctx.toast('Inserisci la data di scadenza.', 'errore');
    const info = {
      tipo: f.tipo,
      titolo: f.tipo === 'Altro' ? f.titolo.trim() : '',
      intestatario: f.intestatario.trim(),
      numero: f.numero.trim(),
      note: f.note.trim(),
    };
    const cifrato = await cifra(ctx.chiave, info);
    const riga = { scadenza: f.scadenza, ...cifrato };
    const ok = await ctx.esegui(
      () => (doc ? ctx.be.update('documenti', doc.id, riga) : ctx.be.insert('documenti', riga)),
      doc ? 'Documento aggiornato.' : 'Documento salvato (cifrato).',
    );
    if (ok) ctx.chiudi();
  };

  const elimina = async () => {
    if (!confirm('Eliminare questo documento?')) return;
    if (await ctx.esegui(() => ctx.be.remove('documenti', doc.id), 'Eliminato.')) ctx.chiudi();
  };

  return html`<${Modale} titolo=${doc ? 'Modifica documento' : 'Nuovo documento'} onChiudi=${ctx.chiudi}>
    <form class="modulo" onSubmit=${(e) => { e.preventDefault(); salva(); }}>
      <${Campo} etichetta="Tipo">
        <select value=${f.tipo} onChange=${set('tipo')}>${TIPI.map((t) => html`<option value=${t}>${t}</option>`)}</select>
      <//>
      ${f.tipo === 'Altro' && html`<${Campo} etichetta="Nome documento"><input value=${f.titolo} onInput=${set('titolo')} /><//>`}
      <div class="riga2">
        <${Campo} etichetta="Di chi">
          <input value=${f.intestatario} onInput=${set('intestatario')} list="nomi-famiglia" placeholder="Nome" />
          <datalist id="nomi-famiglia">${nomi.map((n) => html`<option value=${n} />`)}</datalist>
        <//>
        <${Campo} etichetta="Scadenza"><input type="date" value=${f.scadenza} onInput=${set('scadenza')} /><//>
      </div>
      <${Campo} etichetta="Numero / targa"><input value=${f.numero} onInput=${set('numero')} autocomplete="off" /><//>
      <${Campo} etichetta="Note"><textarea value=${f.note} onInput=${set('note')} rows="2" placeholder="Dove si rinnova, cosa serve…"></textarea><//>
      <p class="suggerimento"><${Icona} n="lucchetto" size=${14} /> Tutto tranne la data di scadenza viene cifrato.</p>
      <div class="azioni-modulo">
        ${doc && html`<button type="button" class="btn pericolo" onClick=${elimina}><${Icona} n="cestino" size=${18} /> Elimina</button>`}
        <${BottoneAsync} type="submit" onClick=${salva}>Salva<//>
      </div>
    </form>
  <//>`;
}

const ETICHETTE_STATO = { scaduto: 'Scaduto', urgente: 'Entro 30 giorni', vicino: 'Entro 3 mesi', ok: 'In regola' };

export function Documenti({ ctx }) {
  const riga = ctx.data.cassaforte[0];
  if (!riga) return html`<${CreaCassaforte} ctx=${ctx} />`;
  if (!ctx.chiave) return html`<${ApriCassaforte} ctx=${ctx} riga=${riga} />`;

  const docs = [...ctx.documenti].sort((a, b) => (a.scadenza || '9999').localeCompare(b.scadenza || '9999'));

  return html`<section>
    <div class="barra-cassaforte">
      <span><${Icona} n="aperto" size=${18} /> Aperta</span>
      <div>
        <button class="btn piccolo" onClick=${() => ctx.apri(html`<${CambiaPassword} ctx=${ctx} />`)}><${Icona} n="chiave" size=${16} /> Password</button>
        <button class="btn piccolo" onClick=${() => ctx.setChiave(null)}><${Icona} n="lucchetto" size=${16} /> Chiudi</button>
      </div>
    </div>
    ${docs.length === 0 && html`<${Vuoto} icona="documento" testo="Nessun documento. Aggiungi carta d'identità, patente, assicurazione…" />`}
    <ul class="lista">
      ${docs.map((d) => {
        const st = statoDocumento(d.scadenza);
        return html`<li class=${'voce doc-' + st} key=${d.id}>
          <button class="voce-corpo" onClick=${() => d.info ? ctx.apri(html`<${DocumentoForm} ctx=${ctx} doc=${d} />`) : ctx.toast('Documento non leggibile con questa password.', 'errore')}>
            <div class="voce-titolo"><span>${nomeDocumento(d.info)}</span></div>
            <div class="voce-meta">
              <span class=${'chip ' + st}>${ETICHETTE_STATO[st]}</span>
              <span class="meta">Scade il ${dataNumerica(d.scadenza)} (${relativo(d.scadenza)})</span>
            </div>
            ${d.info?.numero && html`<div class="voce-note mono">${d.info.numero}</div>`}
            ${d.info?.note && html`<div class="voce-note">${d.info.note}</div>`}
            <${Autore} profili=${ctx.profili} riga=${d} />
          </button>
        </li>`;
      })}
    </ul>
  </section>`;
}
