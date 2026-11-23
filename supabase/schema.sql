-- =====================================================================
--  CASA – schema del database (Supabase / PostgreSQL)
--  Da incollare in Supabase → SQL Editor → New query → Run
--
--  PRIMA DI ESEGUIRE: sostituisci le due email qui sotto (sezione 1)
--  con quelle che tu e tua moglie userete per accedere all'app.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Chi può usare l'app (solo queste email vedono e modificano i dati)
-- ---------------------------------------------------------------------
create table if not exists public.membri_autorizzati (
  email text primary key
);

insert into public.membri_autorizzati (email) values
  ('tua.email@esempio.it'),
  ('email.moglie@esempio.it')
on conflict do nothing;

alter table public.membri_autorizzati enable row level security;
-- nessuna policy: la tabella non è leggibile dall'app, solo dalla funzione qui sotto

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.membri_autorizzati
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_member() to authenticated;

-- Imposta sempre l'autore = utente collegato (nessuno può "firmare" per l'altro)
create or replace function public.imposta_autore()
returns trigger
language plpgsql
as $$
begin
  new.creato_da := auth.uid();
  new.creato_il := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Profili (nome e colore di ciascuno)
-- ---------------------------------------------------------------------
create table if not exists public.profili (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text not null check (char_length(nome) between 1 and 40),
  colore     text not null default '#4f46e5',
  creato_il  timestamptz not null default now()
);

alter table public.profili enable row level security;

drop policy if exists "profili_lettura" on public.profili;
create policy "profili_lettura" on public.profili
  for select to authenticated using (public.is_member());

drop policy if exists "profili_scrittura_propria" on public.profili;
create policy "profili_scrittura_propria" on public.profili
  for insert to authenticated with check (public.is_member() and id = auth.uid());

drop policy if exists "profili_modifica_propria" on public.profili;
create policy "profili_modifica_propria" on public.profili
  for update to authenticated
  using (public.is_member() and id = auth.uid())
  with check (public.is_member() and id = auth.uid());

-- ---------------------------------------------------------------------
-- 3. Lista della spesa
-- ---------------------------------------------------------------------
create table if not exists public.spesa (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 1 and 120),
  quantita   text,
  fatto      boolean not null default false,
  fatto_da   uuid references auth.users (id) on delete set null,
  creato_da  uuid references auth.users (id) on delete set null,
  creato_il  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Da pagare (bollette, rate, tasse…), con ricorrenza
-- ---------------------------------------------------------------------
create table if not exists public.pagamenti (
  id         uuid primary key default gen_random_uuid(),
  titolo     text not null check (char_length(titolo) between 1 and 120),
  importo    numeric(12, 2),
  scadenza   date,
  ricorrenza text not null default 'nessuna'
             check (ricorrenza in ('nessuna','mensile','bimestrale','trimestrale','semestrale','annuale')),
  note       text,
  pagato_il  timestamptz,
  pagato_da  uuid references auth.users (id) on delete set null,
  creato_da  uuid references auth.users (id) on delete set null,
  creato_il  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. Agenda (appuntamenti dell'app; Google Calendar arriverà nella fase 2)
-- ---------------------------------------------------------------------
create table if not exists public.eventi (
  id         uuid primary key default gen_random_uuid(),
  titolo     text not null check (char_length(titolo) between 1 and 120),
  data       date not null,
  ora        time,
  luogo      text,
  note       text,
  creato_da  uuid references auth.users (id) on delete set null,
  creato_il  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. Scadenze documenti – CIFRATE
--    Il contenuto (tipo, intestatario, numero, note) viene cifrato sul
--    telefono con la password della cassaforte: qui arriva solo testo
--    illeggibile. In chiaro resta soltanto la data di scadenza, così la
--    Home può avvisare anche a cassaforte chiusa.
-- ---------------------------------------------------------------------
create table if not exists public.cassaforte (
  id         int primary key default 1 check (id = 1),
  salt       text not null,
  verifica   text not null,
  iv         text not null,
  creato_da  uuid references auth.users (id) on delete set null,
  creato_il  timestamptz not null default now()
);

create table if not exists public.documenti (
  id            uuid primary key default gen_random_uuid(),
  scadenza      date,
  dati_cifrati  text not null,
  iv            text not null,
  creato_da     uuid references auth.users (id) on delete set null,
  creato_il     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Sicurezza: solo i membri autorizzati possono leggere/scrivere
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['spesa','pagamenti','eventi','cassaforte','documenti'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo_membri" on public.%I', t);
    execute format(
      'create policy "solo_membri" on public.%I for all to authenticated
         using (public.is_member()) with check (public.is_member())', t);
    execute format('drop trigger if exists autore on public.%I', t);
    execute format(
      'create trigger autore before insert on public.%I
         for each row execute function public.imposta_autore()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Aggiornamenti in tempo reale (se lei spunta "latte", lo vedi subito)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profili','spesa','pagamenti','eventi','cassaforte','documenti'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 9. Permessi API per gli utenti collegati (i nuovi progetti Supabase
--    non li danno più in automatico; le regole RLS sopra decidono chi vede cosa)
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profili, public.spesa, public.pagamenti, public.eventi, public.cassaforte, public.documenti
  to authenticated;

-- ---------------------------------------------------------------------
-- 10. Collegamento appuntamenti ↔ Google Calendar
-- ---------------------------------------------------------------------
alter table public.eventi add column if not exists google_id text;
alter table public.eventi add column if not exists google_cal text;
