-- NightOutStays V4: identity verification + profile photos
alter table public.guests add column if not exists profile_photo_url text;
alter table public.guests add column if not exists identity_verification_status text not null default 'not_submitted';
alter table public.guests drop constraint if exists guests_identity_verification_status_check;
alter table public.guests add constraint guests_identity_verification_status_check check (identity_verification_status in ('not_submitted','pending','verified','rejected'));

alter table public.host_profiles add column if not exists profile_photo_url text;
alter table public.host_profiles add column if not exists identity_verification_status text not null default 'not_submitted';
alter table public.host_profiles drop constraint if exists host_profiles_identity_verification_status_check;
alter table public.host_profiles add constraint host_profiles_identity_verification_status_check check (identity_verification_status in ('not_submitted','pending','verified','rejected'));

create table if not exists public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('guest','host')),
  guest_id uuid references public.guests(id) on delete cascade,
  host_id uuid references public.host_profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  document_type text not null check (document_type in ('pan','aadhaar','passport','driving_licence')),
  document_path text not null,
  document_name text,
  registered_name text,
  extracted_name text,
  name_match_score numeric,
  authenticity_status text not null default 'not_checked' check (authenticity_status in ('not_checked','passed','failed','needs_review')),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  provider text,
  provider_reference text,
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create index if not exists identity_verifications_user_idx on public.identity_verifications(user_id, submitted_at desc);
create index if not exists identity_verifications_booking_idx on public.identity_verifications(booking_id) where booking_id is not null;

alter table public.identity_verifications enable row level security;
drop policy if exists identity_verifications_read_own on public.identity_verifications;
create policy identity_verifications_read_own on public.identity_verifications for select using (user_id = auth.uid());
drop policy if exists identity_verifications_admin_manage on public.identity_verifications;
create policy identity_verifications_admin_manage on public.identity_verifications for all using (
  exists(select 1 from public.admin_profiles a where a.user_id=auth.uid() and a.is_active=true)
) with check (
  exists(select 1 from public.admin_profiles a where a.user_id=auth.uid() and a.is_active=true)
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-photos','profile-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('identity-documents','identity-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];
