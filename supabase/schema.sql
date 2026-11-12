-- Stufenkalender: Datenbank einrichten
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und auf "Run" klicken.

-- Ein Eintrag pro Konto mit dem kompletten Kalender (Termine, Kategorien, Orte, Schlafzeiten …)
create table if not exists public.calendar_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

-- Zugriffsschutz: Jede Person sieht und ändert nur ihren eigenen Kalender
alter table public.calendar_state enable row level security;

drop policy if exists "eigene Daten lesen" on public.calendar_state;
create policy "eigene Daten lesen" on public.calendar_state
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "eigene Daten anlegen" on public.calendar_state;
create policy "eigene Daten anlegen" on public.calendar_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "eigene Daten ändern" on public.calendar_state;
create policy "eigene Daten ändern" on public.calendar_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "eigene Daten löschen" on public.calendar_state;
create policy "eigene Daten löschen" on public.calendar_state
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Live-Abgleich: Änderungen sofort an andere geöffnete Geräte schicken
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calendar_state'
  ) then
    alter publication supabase_realtime add table public.calendar_state;
  end if;
end $$;
