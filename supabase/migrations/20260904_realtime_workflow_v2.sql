-- NightOutStays realtime booking/property workflow v2

-- Pending hosts may manage photos for their own hidden listings.
drop policy if exists host_can_insert_own_property_photos on public.property_photos;
create policy host_can_insert_own_property_photos on public.property_photos
for insert to authenticated
with check (exists (
  select 1 from public.properties p
  join public.host_profiles hp on hp.id=p.host_id
  where p.id=property_photos.property_id
    and hp.user_id=auth.uid()
    and hp.status in ('pending','active')
));

drop policy if exists host_can_select_own_property_photos on public.property_photos;
create policy host_can_select_own_property_photos on public.property_photos
for select to authenticated
using (exists (
  select 1 from public.properties p
  join public.host_profiles hp on hp.id=p.host_id
  where p.id=property_photos.property_id
    and hp.user_id=auth.uid()
    and hp.status in ('pending','active','suspended')
));

drop policy if exists host_can_update_own_property_photos on public.property_photos;
create policy host_can_update_own_property_photos on public.property_photos
for update to authenticated
using (exists (
  select 1 from public.properties p
  join public.host_profiles hp on hp.id=p.host_id
  where p.id=property_photos.property_id
    and hp.user_id=auth.uid()
    and hp.status in ('pending','active')
))
with check (exists (
  select 1 from public.properties p
  join public.host_profiles hp on hp.id=p.host_id
  where p.id=property_photos.property_id
    and hp.user_id=auth.uid()
    and hp.status in ('pending','active')
));

drop policy if exists host_can_delete_own_property_photos on public.property_photos;
create policy host_can_delete_own_property_photos on public.property_photos
for delete to authenticated
using (exists (
  select 1 from public.properties p
  join public.host_profiles hp on hp.id=p.host_id
  where p.id=property_photos.property_id
    and hp.user_id=auth.uid()
    and hp.status in ('pending','active')
));

-- Authenticated recipients may receive their own notification rows over Realtime.
drop policy if exists notifications_read_own_realtime on public.notifications;
create policy notifications_read_own_realtime on public.notifications
for select to authenticated
using (recipient_user_id=auth.uid());

-- Publish workflow tables to Supabase Realtime (idempotent).
do $$
declare t text;
begin
  foreach t in array array['bookings','notifications','properties','property_photos','host_profiles'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;

-- Admin <-> Host property workflow notifications.
create or replace function public.nos_notify_property_workflow()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_host_user uuid;
  v_admin record;
  v_title text;
  v_body text;
begin
  select user_id into v_host_user from public.host_profiles where id=new.host_id;

  if tg_op='INSERT' then
    if coalesce(new.moderation_status,'draft')='pending_review' then
      for v_admin in select user_id from public.admin_profiles where is_active=true loop
        insert into public.notifications(recipient_type,recipient_user_id,host_id,property_id,type,title,body,priority,action_url,email_status)
        values('admin',v_admin.user_id,new.host_id,new.id,'property_submitted','New property submitted',coalesce(new.name,'Property')||' is waiting for review.','important','/admin/properties','pending');
      end loop;
    end if;
    return new;
  end if;

  -- Admin moderation change -> Host.
  if coalesce(new.moderation_status,'') is distinct from coalesce(old.moderation_status,'') then
    if new.moderation_status in ('approved','changes_requested','declined') and v_host_user is not null then
      v_title := case new.moderation_status
        when 'approved' then 'Property approved'
        when 'changes_requested' then 'Property changes requested'
        else 'Property declined' end;
      v_body := coalesce(new.name,'Property') || case new.moderation_status
        when 'approved' then ' has been approved by Admin.'
        when 'changes_requested' then ' needs changes before approval.'
        else ' was declined by Admin.' end;
      if coalesce(new.moderation_notes,'')<>'' then v_body:=v_body||' Note: '||new.moderation_notes; end if;
      insert into public.notifications(recipient_type,recipient_user_id,host_id,property_id,type,title,body,priority,action_url,email_status)
      values('host',v_host_user,new.host_id,new.id,'property_review',v_title,v_body,'important','/host/properties','pending');
    end if;
  end if;

  -- Host resubmission / update after requested changes -> Admin.
  if (old.moderation_status='changes_requested' and new.moderation_status='pending_review')
     or (new.moderation_status='pending_review' and new.submitted_for_review_at is distinct from old.submitted_for_review_at) then
    for v_admin in select user_id from public.admin_profiles where is_active=true loop
      insert into public.notifications(recipient_type,recipient_user_id,host_id,property_id,type,title,body,priority,action_url,email_status)
      values('admin',v_admin.user_id,new.host_id,new.id,'property_resubmitted','Property updated by Host',coalesce(new.name,'Property')||' was updated/resubmitted and is ready for review.','important','/admin/properties','pending');
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists nos_property_workflow_notification on public.properties;
create trigger nos_property_workflow_notification
after insert or update on public.properties
for each row execute function public.nos_notify_property_workflow();

-- Booking lifecycle notifications: Guest + Host, including payment received.
create or replace function public.nos_notify_booking_update()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_guest_user_id uuid;
  v_host_id uuid;
  v_host_user_id uuid;
  v_property_name text;
  v_title text;
  v_body text;
begin
  select g.user_id into v_guest_user_id from public.guests g where g.id=new.guest_id;
  select p.host_id,p.name into v_host_id,v_property_name from public.properties p where p.id=new.property_id;
  select hp.user_id into v_host_user_id from public.host_profiles hp where hp.id=v_host_id;

  if coalesce(new.host_decision,'') is distinct from coalesce(old.host_decision,'')
     or coalesce(new.payment_status,'') is distinct from coalesce(old.payment_status,'')
     or coalesce(new.booking_status,'') is distinct from coalesce(old.booking_status,'') then
    if v_guest_user_id is not null then
      if lower(coalesce(new.host_decision,''))='approved' and lower(coalesce(old.host_decision,''))<>'approved' then
        v_title:='Booking approved'; v_body:=coalesce(new.booking_code,'Booking')||' was approved by the host.';
      elsif lower(coalesce(new.host_decision,''))='declined' and lower(coalesce(old.host_decision,''))<>'declined' then
        v_title:='Booking declined'; v_body:=coalesce(new.booking_code,'Booking')||' was declined by the host.';
      elsif lower(coalesce(new.payment_status,''))='paid' and lower(coalesce(old.payment_status,''))<>'paid' then
        v_title:='Payment confirmed'; v_body:=coalesce(new.booking_code,'Booking')||' payment was received.';
      else
        v_title:='Booking updated'; v_body:=coalesce(new.booking_code,'Booking')||' status has been updated.';
      end if;
      insert into public.notifications(recipient_type,recipient_user_id,recipient_guest_id,booking_id,property_id,type,title,body,priority,action_url,email_status)
      values('guest',v_guest_user_id,new.guest_id,new.id,new.property_id,'booking_update',v_title,v_body,'normal','/account/bookings','pending');
    end if;
  end if;

  if lower(coalesce(new.payment_status,''))='paid' and lower(coalesce(old.payment_status,''))<>'paid' then
    if v_host_user_id is not null then
      insert into public.notifications(recipient_type,recipient_user_id,host_id,booking_id,property_id,type,title,body,priority,action_url,email_status)
      values('host',v_host_user_id,v_host_id,new.id,new.property_id,'payment_received','Payment received',coalesce(new.booking_code,'Booking')||' · '||coalesce(v_property_name,'Property')||' has been paid and booked.','important','/host/bookings?booking='||new.id::text,'pending');
    end if;
    insert into public.booking_messages(booking_id,sender_type,sender_name,message,message_type,is_read)
    values(new.id,'system','NightOutStays','Payment received. Booking is confirmed.','payment',false);
  end if;
  return new;
end;
$$;

-- Existing accepted/sent Host special offers imply Host approval.
update public.bookings
set host_decision='approved',
    host_decision_at=coalesce(host_decision_at,offer_created_at,now()),
    booking_status=case when booking_status='cancelled' then booking_status else 'confirmed' end,
    payment_due_at=coalesce(payment_due_at,now()+interval '24 hours'),
    updated_at=now()
where offer_status in ('host_offered','accepted')
  and coalesce(payment_status,'unpaid')<>'paid'
  and coalesce(host_decision,'')<>'approved';
