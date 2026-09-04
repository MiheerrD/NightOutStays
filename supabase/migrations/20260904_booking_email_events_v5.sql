create table if not exists public.booking_email_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_type text not null,
  recipient_type text,
  recipient_email text,
  provider_id text,
  status text not null default 'sent',
  created_at timestamptz not null default now(),
  unique(booking_id,event_type,recipient_type)
);
create index if not exists booking_email_events_booking_idx on public.booking_email_events(booking_id);
alter table public.booking_email_events enable row level security;
