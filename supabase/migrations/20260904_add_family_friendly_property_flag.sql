alter table public.properties
  add column if not exists family_friendly boolean not null default true;
