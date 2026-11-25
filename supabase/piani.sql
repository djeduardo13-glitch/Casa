-- =====================================================================
--  CASA – Piani (cose da comprare o cambiare in futuro)
--  Da eseguire una volta in Supabase → SQL Editor (dopo schema.sql)
-- =====================================================================

create table if not exists public.piani (
  id             uuid primary key default gen_random_uuid(),
  titolo         text not null check (char_length(titolo) between 1 and 120),
  descrizione    text,
  stima          numeric(12, 2),
  priorita       text not null default 'media' check (priorita in ('bassa','media','alta')),
  stato          text not null default 'idea' check (stato in ('idea','preventivi','deciso','fatto')),
  entro          date,
  pagamento_id   uuid references public.pagamenti (id) on delete set null,
  aggiornato_il  timestamptz not null default now(),
  creato_da      uuid references auth.users (id) on delete set null,
  creato_il      timestamptz not null default now()
);

-- Aggiornamenti di un piano: note, link, preventivi, file allegati
create table if not exists public.piani_voci (
  id          uuid primary key default gen_random_uuid(),
  piano_id    uuid not null references public.piani (id) on delete cascade,
  tipo        text not null check (tipo in ('nota','link','preventivo','file')),
  testo       text,
  url         text,
  fornitore   text,
  importo     numeric(12, 2),
  scelto      boolean not null default false,
  file_path   text,
  file_nome   text,
  file_tipo   text,
  file_dim    integer,
  creato_da   uuid references auth.users (id) on delete set null,
  creato_il   timestamptz not null default now()
);
create index if not exists piani_voci_piano on public.piani_voci (piano_id);

do $$
declare t text;
begin
  foreach t in array array['piani','piani_voci'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo_membri" on public.%I', t);
    execute format('create policy "solo_membri" on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())', t);
    execute format('drop trigger if exists autore on public.%I', t);
    execute format('create trigger autore before insert on public.%I for each row execute function public.imposta_autore()', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Archivio file (preventivi in PDF, mail salvate, foto…): privato,
-- leggibile solo da voi due. Limite 20 MB per file.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('allegati', 'allegati', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "allegati_lettura" on storage.objects;
create policy "allegati_lettura" on storage.objects for select to authenticated
  using (bucket_id = 'allegati' and public.is_member());

drop policy if exists "allegati_caricamento" on storage.objects;
create policy "allegati_caricamento" on storage.objects for insert to authenticated
  with check (bucket_id = 'allegati' and public.is_member());

drop policy if exists "allegati_eliminazione" on storage.objects;
create policy "allegati_eliminazione" on storage.objects for delete to authenticated
  using (bucket_id = 'allegati' and public.is_member());
