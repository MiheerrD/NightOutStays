-- NightOutStays Guest/Host critical-flow fixes

-- Structured booking conversation message types used by the Guest/Host workflow.
alter table public.booking_messages drop constraint if exists booking_messages_message_type_check;
alter table public.booking_messages add constraint booking_messages_message_type_check
check (message_type = any (array[
  'message'::text,
  'booking_request'::text,
  'approval'::text,
  'decline'::text,
  'discount_request'::text,
  'special_offer'::text,
  'offer_decision'::text,
  'payment'::text,
  'confirmation'::text,
  'system'::text
]));

-- Ordinary chat stays in Messages; it must not create Notification-center items.
create or replace function public.nos_notify_booking_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  return new;
end;
$$;

-- A new Host application must be insertable as pending by its own authenticated user.
drop policy if exists host_profiles_insert_own on public.host_profiles;
create policy host_profiles_insert_own
on public.host_profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
  and status in ('pending','active')
);

-- Keep platform Host role synchronized with Host approval status.
create or replace function public.sync_host_platform_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role, is_active)
  values (new.user_id, 'host', new.status = 'active')
  on conflict (user_id, role)
  do update set is_active = excluded.is_active;
  return new;
end;
$$;

drop trigger if exists trg_sync_host_platform_role on public.host_profiles;
create trigger trg_sync_host_platform_role
after insert or update of status, user_id on public.host_profiles
for each row execute function public.sync_host_platform_role();

-- Repair existing Host role rows too.
insert into public.user_roles (user_id, role, is_active)
select hp.user_id, 'host', hp.status = 'active'
from public.host_profiles hp
on conflict (user_id, role)
do update set is_active = excluded.is_active;
