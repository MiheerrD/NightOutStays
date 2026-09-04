-- Host signup notifications + pending-host property preparation.

create or replace function public.nos_notify_admin_host_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
begin
  if new.status = 'pending' then
    for a in select user_id from public.admin_profiles where is_active = true loop
      insert into public.notifications(
        recipient_type, recipient_user_id, host_id,
        type, title, body, priority, action_url,
        is_read, created_at, updated_at
      ) values (
        'admin', a.user_id, new.id,
        'host_request', 'New Host approval request',
        coalesce(nullif(new.business_name,''), nullif(new.full_name,''), 'A new Host') || ' is waiting for approval.',
        'important', '/admin/hosts/' || new.id::text,
        false, now(), now()
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists nos_host_request_admin_notification on public.host_profiles;
create trigger nos_host_request_admin_notification
after insert on public.host_profiles
for each row execute function public.nos_notify_admin_host_request();

-- Pending Hosts may create and manage their own non-live listings.
drop policy if exists host_can_insert_own_properties on public.properties;
create policy host_can_insert_own_properties on public.properties
for insert to authenticated
with check (
  exists (
    select 1 from public.host_profiles hp
    where hp.id = properties.host_id
      and hp.user_id = auth.uid()
      and hp.status in ('pending','active')
  )
  and coalesce(moderation_status,'draft') in ('draft','pending_review')
  and coalesce(is_active,false) = false
);

drop policy if exists host_can_select_own_properties on public.properties;
create policy host_can_select_own_properties on public.properties
for select to authenticated
using (
  exists (
    select 1 from public.host_profiles hp
    where hp.id = properties.host_id
      and hp.user_id = auth.uid()
      and hp.status in ('pending','active','suspended')
  )
);

drop policy if exists host_can_update_own_properties on public.properties;
create policy host_can_update_own_properties on public.properties
for update to authenticated
using (
  exists (
    select 1 from public.host_profiles hp
    where hp.id = properties.host_id
      and hp.user_id = auth.uid()
      and hp.status in ('pending','active')
  )
)
with check (
  exists (
    select 1 from public.host_profiles hp
    where hp.id = properties.host_id
      and hp.user_id = auth.uid()
      and hp.status in ('pending','active')
  )
  and coalesce(is_active,false) = false
  and coalesce(moderation_status,'draft') in ('draft','pending_review','changes_requested','declined')
);

-- A property can never be public while its Host is not active.
create or replace function public.nos_enforce_property_host_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_status text;
begin
  select status into v_host_status from public.host_profiles where id = new.host_id;
  if coalesce(v_host_status,'') <> 'active' then
    new.is_active := false;
  end if;
  return new;
end;
$$;

drop trigger if exists nos_property_host_activation_guard on public.properties;
create trigger nos_property_host_activation_guard
before insert or update of is_active,host_id on public.properties
for each row execute function public.nos_enforce_property_host_activation();

-- Host approval also activates any property that Admin had already approved while Host was pending.
create or replace function public.admin_update_host_status(p_host_id uuid, p_status text, p_reason text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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

  if p_status='active' then
    update public.properties
      set is_active=true, updated_at=now()
      where host_id=p_host_id and moderation_status='approved';
  else
    update public.properties
      set is_active=false, updated_at=now()
      where host_id=p_host_id and is_active=true;
  end if;

  return jsonb_build_object('success',true,'host_id',p_host_id,'status',p_status);
end;
$$;
