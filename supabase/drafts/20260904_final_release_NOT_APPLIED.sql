-- NightOutStays consolidated release migration
-- 2026-09-04

begin;

-- Property audience / discovery flags
alter table public.properties
  add column if not exists family_friendly boolean not null default true;

-- Allow structured Host <-> Guest booking conversation events.
alter table public.booking_messages
  drop constraint if exists booking_messages_message_type_check;
alter table public.booking_messages
  add constraint booking_messages_message_type_check check (
    message_type = any (array[
      'message'::text,
      'booking_request'::text,
      'approval'::text,
      'decline'::text,
      'special_offer'::text,
      'discount_request'::text,
      'offer_decision'::text,
      'payment'::text,
      'confirmation'::text,
      'system'::text
    ])
  );

-- Normal chat messages must stay in Messages, not Notifications.
drop trigger if exists nos_booking_message_notification on public.booking_messages;

-- Master cities/localities and Host requests to add new options.
create table if not exists public.locations_master (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  locality text,
  state text,
  destination_type text not null default 'city',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city, locality)
);

create table if not exists public.location_requests (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references public.host_profiles(id) on delete cascade,
  requested_city text not null,
  requested_locality text,
  requested_state text,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

-- Simple referral foundation for Guests and Hosts.
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('guest','host')),
  owner_user_id uuid not null,
  code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid references public.referral_codes(id) on delete set null,
  referrer_user_id uuid not null,
  referred_user_id uuid,
  referred_email text,
  referred_type text check (referred_type in ('guest','host')),
  status text not null default 'invited' check (status in ('invited','joined','qualified','rewarded','cancelled')),
  reward_amount numeric not null default 0,
  reward_note text,
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  rewarded_at timestamptz
);

-- Seed a useful India location catalogue. ON CONFLICT keeps this migration repeat-safe.
insert into public.locations_master (city,locality,state,destination_type,sort_order) values
('Pune',null,'Maharashtra','city',1),('Pune','Baner','Maharashtra','locality',2),('Pune','Balewadi','Maharashtra','locality',3),('Pune','Bavdhan','Maharashtra','locality',4),('Pune','Hinjewadi','Maharashtra','locality',5),('Pune','Wakad','Maharashtra','locality',6),('Pune','Kothrud','Maharashtra','locality',7),('Pune','Hadapsar','Maharashtra','locality',8),('Pune','Viman Nagar','Maharashtra','locality',9),('Pune','Kharadi','Maharashtra','locality',10),
('Mumbai',null,'Maharashtra','city',20),('Lonavala',null,'Maharashtra','tourist_destination',21),('Mahabaleshwar',null,'Maharashtra','tourist_destination',22),('Alibaug',null,'Maharashtra','tourist_destination',23),('Nashik',null,'Maharashtra','city',24),('Goa',null,'Goa','tourist_destination',30),('Jaipur',null,'Rajasthan','tourist_destination',31),('Udaipur',null,'Rajasthan','tourist_destination',32),('Manali',null,'Himachal Pradesh','tourist_destination',33),('Shimla',null,'Himachal Pradesh','tourist_destination',34),('Rishikesh',null,'Uttarakhand','tourist_destination',35),('Delhi',null,'Delhi','city',36),('Bengaluru',null,'Karnataka','city',37),('Hyderabad',null,'Telangana','city',38),('Chennai',null,'Tamil Nadu','city',39),('Kochi',null,'Kerala','city',40)
on conflict (city,locality) do nothing;

-- Keep platform Host role in sync when an Admin activates/suspends/blocks a Host.
create or replace function public.admin_update_host_status(p_host_id uuid, p_status text, p_reason text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin public.admin_profiles%rowtype;
  v_can_edit boolean := false;
  v_can_block boolean := false;
  v_host public.host_profiles%rowtype;
begin
  if p_status not in ('active','suspended','blocked') then raise exception 'INVALID_HOST_STATUS'; end if;
  select * into v_admin from public.admin_profiles where user_id=auth.uid() and is_active=true limit 1;
  if not found then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;
  if v_admin.role='super_admin' or coalesce(v_admin.full_access,false)=true then v_can_edit:=true; v_can_block:=true;
  else select coalesce(can_edit,false),coalesce(can_block,false) into v_can_edit,v_can_block from public.admin_permissions where admin_user_id=auth.uid() and module='hosts' limit 1; end if;
  if p_status='blocked' and not v_can_block then raise exception 'HOST_BLOCK_PERMISSION_REQUIRED'; end if;
  if p_status<>'blocked' and not v_can_edit then raise exception 'HOST_EDIT_PERMISSION_REQUIRED'; end if;
  select * into v_host from public.host_profiles where id=p_host_id limit 1;
  if not found then raise exception 'HOST_NOT_FOUND'; end if;
  update public.host_profiles set status=p_status,
    approved_at=case when p_status='active' and approved_at is null then now() else approved_at end,
    approved_by=case when p_status='active' and approved_by is null then auth.uid() else approved_by end,
    suspension_reason=case when p_status='suspended' then nullif(trim(p_reason),'') else null end,
    blocked_at=case when p_status='blocked' then now() else null end,
    blocked_by=case when p_status='blocked' then auth.uid() else null end,
    updated_at=now() where id=p_host_id;
  insert into public.user_roles(user_id,role,is_active)
    values(v_host.user_id,'host',p_status='active')
    on conflict (user_id,role) do update set is_active=excluded.is_active;
  return jsonb_build_object('success',true,'host_id',p_host_id,'status',p_status);
end;
$function$;

-- Notify Admins about new promotion / subscription / location requests.
create or replace function public.nos_notify_admin_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a record;
  v_type text;
  v_title text;
  v_body text;
  v_url text;
begin
  if tg_table_name='property_promotions' then
    v_type:='promotion_request'; v_title:='Promotion request'; v_body:=upper(coalesce(new.promotion_type,'promotion')) || ' request received.'; v_url:='/admin/promotions';
  elsif tg_table_name='property_subscriptions' then
    v_type:='subscription_request'; v_title:='Subscription request'; v_body:='A Host subscription request/payment has been created.'; v_url:='/admin/subscriptions';
  else
    v_type:='location_request'; v_title:='New city/locality request'; v_body:=coalesce(new.requested_city,'') || case when new.requested_locality is not null then ' · '||new.requested_locality else '' end; v_url:='/admin/settings';
  end if;
  for a in select user_id from public.admin_profiles where is_active=true loop
    insert into public.notifications(recipient_type,recipient_user_id,type,title,body,priority,action_url,email_status,property_id,promotion_id,host_id)
    values('admin',a.user_id,v_type,v_title,v_body,'important',v_url,'pending',
      case when tg_table_name='property_promotions' then new.property_id else null end,
      case when tg_table_name='property_promotions' then new.id else null end,
      case when tg_table_name in ('property_promotions','property_subscriptions') then new.host_id when tg_table_name='location_requests' then new.host_id else null end);
  end loop;
  return new;
end;
$function$;

drop trigger if exists nos_promotion_admin_notification on public.property_promotions;
create trigger nos_promotion_admin_notification after insert on public.property_promotions for each row execute function public.nos_notify_admin_request();
drop trigger if exists nos_subscription_admin_notification on public.property_subscriptions;
create trigger nos_subscription_admin_notification after insert on public.property_subscriptions for each row execute function public.nos_notify_admin_request();
drop trigger if exists nos_location_request_admin_notification on public.location_requests;
create trigger nos_location_request_admin_notification after insert on public.location_requests for each row execute function public.nos_notify_admin_request();

commit;
