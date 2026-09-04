create table if not exists public.guest_favorites (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(guest_id,property_id)
);
alter table public.guest_favorites enable row level security;
drop policy if exists guest_favorites_read_own on public.guest_favorites;
create policy guest_favorites_read_own on public.guest_favorites for select using (exists(select 1 from public.guests g where g.id=guest_favorites.guest_id and g.user_id=auth.uid()));
drop policy if exists guest_favorites_insert_own on public.guest_favorites;
create policy guest_favorites_insert_own on public.guest_favorites for insert with check (exists(select 1 from public.guests g where g.id=guest_favorites.guest_id and g.user_id=auth.uid()));
drop policy if exists guest_favorites_delete_own on public.guest_favorites;
create policy guest_favorites_delete_own on public.guest_favorites for delete using (exists(select 1 from public.guests g where g.id=guest_favorites.guest_id and g.user_id=auth.uid()));
