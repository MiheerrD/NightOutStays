-- NightOutStays V7A: reliability, immutable financial snapshots, audit and webhook inbox.
create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  provider_event_id text,
  event_type text not null,
  payment_id text,
  order_id text,
  booking_id uuid references public.bookings(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received' check (processing_status in ('received','processed','ignored','failed')),
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create unique index if not exists payment_webhook_events_provider_event_uidx on public.payment_webhook_events(provider, provider_event_id) where provider_event_id is not null;
create index if not exists payment_webhook_events_order_idx on public.payment_webhook_events(order_id);

create table if not exists public.booking_financial_ledger (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  booking_code text not null,
  property_id uuid references public.properties(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  nights integer not null default 1,
  accommodation_before_discount numeric not null default 0,
  automatic_discount numeric not null default 0,
  host_discount numeric not null default 0,
  referral_discount numeric not null default 0,
  accommodation_after_discount numeric not null default 0,
  accommodation_gst numeric not null default 0,
  portal_fee_gross numeric not null default 0,
  portal_fee_gst numeric not null default 0,
  portal_fee_net numeric not null default 0,
  security_deposit numeric not null default 0,
  guest_paid_amount numeric not null default 0,
  razorpay_payment_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.system_audit_log (
  id bigserial primary key,
  actor_user_id uuid,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists system_audit_log_entity_idx on public.system_audit_log(entity_type, entity_id, created_at desc);

create table if not exists public.email_delivery_log (
  id bigserial primary key,
  booking_id uuid references public.bookings(id) on delete set null,
  event_type text not null,
  recipient_email text,
  provider text not null default 'resend',
  provider_id text,
  status text not null check (status in ('sent','failed','skipped')),
  error_message text,
  attempt integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists email_delivery_log_booking_idx on public.email_delivery_log(booking_id, created_at desc);

alter table public.payment_webhook_events enable row level security;
alter table public.booking_financial_ledger enable row level security;
alter table public.system_audit_log enable row level security;
alter table public.email_delivery_log enable row level security;

-- Service-role server routes bypass RLS. Admin read access uses existing helper where available.
do $$ begin
  if exists(select 1 from pg_proc where proname='is_active_platform_admin') then
    execute 'drop policy if exists "admins read financial ledger" on public.booking_financial_ledger';
    execute 'create policy "admins read financial ledger" on public.booking_financial_ledger for select using (is_active_platform_admin())';
    execute 'drop policy if exists "admins read audit log" on public.system_audit_log';
    execute 'create policy "admins read audit log" on public.system_audit_log for select using (is_active_platform_admin())';
    execute 'drop policy if exists "admins read payment webhook events" on public.payment_webhook_events';
    execute 'create policy "admins read payment webhook events" on public.payment_webhook_events for select using (is_active_platform_admin())';
    execute 'drop policy if exists "admins read email delivery log" on public.email_delivery_log';
    execute 'create policy "admins read email delivery log" on public.email_delivery_log for select using (is_active_platform_admin())';
  end if;
end $$;

create or replace function public.nos_snapshot_paid_booking_financials()
returns trigger language plpgsql security definer set search_path=public as $$
declare fee numeric; fee_gst numeric; paid numeric; accommodation numeric;
begin
  if lower(coalesce(new.payment_status,''))='paid' and (tg_op='INSERT' or lower(coalesce(old.payment_status,''))<>'paid') then
    fee := greatest(coalesce(new.portal_fee,new.service_charge,0),0);
    fee_gst := round(fee * 18 / 118, 2);
    paid := greatest(coalesce(new.final_payable_amount,new.amount_including_gst,new.total_amount,0),0);
    accommodation := greatest(coalesce(new.taxable_amount,new.base_amount,0),0);
    insert into public.booking_financial_ledger(
      booking_id,booking_code,property_id,guest_id,nights,accommodation_before_discount,
      automatic_discount,host_discount,referral_discount,accommodation_after_discount,
      accommodation_gst,portal_fee_gross,portal_fee_gst,portal_fee_net,security_deposit,
      guest_paid_amount,razorpay_payment_id,paid_at
    ) values (
      new.id,new.booking_code,new.property_id,new.guest_id,greatest(coalesce(new.nights,1),1),
      greatest(coalesce(new.base_amount,new.total_amount,0),0),greatest(coalesce(new.auto_discount_amount,0),0),
      greatest(coalesce(new.host_discount_amount,0),0),greatest(coalesce(new.referral_discount_amount,0),0),
      accommodation,greatest(coalesce(new.accommodation_gst,new.gst_amount,0),0),fee,fee_gst,greatest(fee-fee_gst,0),
      greatest(coalesce(new.security_deposit,0),0),paid,new.razorpay_payment_id,coalesce(new.paid_at,now())
    ) on conflict (booking_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists nos_snapshot_paid_booking_financials on public.bookings;
create trigger nos_snapshot_paid_booking_financials after insert or update of payment_status on public.bookings
for each row execute function public.nos_snapshot_paid_booking_financials();

-- Backfill immutable snapshots for already-paid bookings that predate V7A.
insert into public.booking_financial_ledger(
  booking_id,booking_code,property_id,guest_id,nights,accommodation_before_discount,
  automatic_discount,host_discount,referral_discount,accommodation_after_discount,
  accommodation_gst,portal_fee_gross,portal_fee_gst,portal_fee_net,security_deposit,
  guest_paid_amount,razorpay_payment_id,paid_at
)
select b.id,b.booking_code,b.property_id,b.guest_id,greatest(coalesce(b.nights,1),1),
  greatest(coalesce(b.base_amount,b.total_amount,0),0),greatest(coalesce(b.auto_discount_amount,0),0),
  greatest(coalesce(b.host_discount_amount,0),0),greatest(coalesce(b.referral_discount_amount,0),0),
  greatest(coalesce(b.taxable_amount,b.base_amount,0),0),greatest(coalesce(b.accommodation_gst,b.gst_amount,0),0),
  greatest(coalesce(b.portal_fee,b.service_charge,0),0),round(greatest(coalesce(b.portal_fee,b.service_charge,0),0)*18/118,2),
  greatest(coalesce(b.portal_fee,b.service_charge,0),0)-round(greatest(coalesce(b.portal_fee,b.service_charge,0),0)*18/118,2),
  greatest(coalesce(b.security_deposit,0),0),greatest(coalesce(b.final_payable_amount,b.amount_including_gst,b.total_amount,0),0),
  b.razorpay_payment_id,b.paid_at
from public.bookings b where lower(coalesce(b.payment_status,''))='paid'
on conflict (booking_id) do nothing;
