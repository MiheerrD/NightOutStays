-- NightOutStays V7A
-- A property-specific active FREE subscription discount must make the property
-- subscription active immediately. This prevents "First Month Free" from only
-- creating a discount row while the property remains hidden from the public site.

create or replace function public.apply_free_property_subscription_discount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_id uuid;
  v_base_price numeric := 0;
  v_start timestamptz;
  v_end timestamptz;
begin
  if new.is_active is distinct from true
     or new.property_id is null
     or lower(coalesce(new.discount_type,'')) <> 'free'
     or new.valid_from is null
     or new.valid_until is null then
    return new;
  end if;

  v_start := new.valid_from;
  v_end := new.valid_until;

  select coalesce(base_price,0)
    into v_base_price
  from public.properties
  where id = new.property_id;

  select id
    into v_sub_id
  from public.property_subscriptions
  where property_id = new.property_id
    and status in ('pending','active')
  order by case when status='active' then 0 else 1 end, created_at desc
  limit 1;

  if v_sub_id is not null then
    update public.property_subscriptions
       set host_id = new.host_id,
           plan_months = 1,
           nightly_rate_snapshot = v_base_price,
           fee_before_gst = 0,
           gst_rate = 18,
           gst_amount = 0,
           total_amount = 0,
           status = 'active',
           starts_at = v_start,
           expires_at = v_end,
           paid_at = coalesce(paid_at, now()),
           discount_id = new.id,
           discount_name_snapshot = new.discount_name,
           discount_type_snapshot = new.discount_type,
           discount_value_snapshot = coalesce(new.discount_value,0),
           discount_amount_snapshot = coalesce(standard_monthly_fee_snapshot, fee_before_gst, 0),
           final_fee_before_gst_snapshot = 0,
           pricing_quoted_at = coalesce(pricing_quoted_at, now()),
           updated_at = now()
     where id = v_sub_id;
  else
    insert into public.property_subscriptions (
      property_id, host_id, plan_months, nightly_rate_snapshot,
      fee_before_gst, gst_rate, gst_amount, total_amount,
      status, starts_at, expires_at, paid_at,
      discount_id, discount_name_snapshot, discount_type_snapshot,
      discount_value_snapshot, discount_amount_snapshot,
      final_fee_before_gst_snapshot, pricing_quoted_at
    ) values (
      new.property_id, new.host_id, 1, v_base_price,
      0, 18, 0, 0,
      'active', v_start, v_end, now(),
      new.id, new.discount_name, new.discount_type,
      coalesce(new.discount_value,0), 0,
      0, now()
    );
  end if;

  if coalesce(new.used_count,0) = 0 then
    update public.host_subscription_discounts
       set used_count = 1,
           updated_at = now()
     where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_free_property_subscription_discount
  on public.host_subscription_discounts;

create trigger trg_apply_free_property_subscription_discount
after insert or update of is_active, property_id, discount_type, valid_from, valid_until
on public.host_subscription_discounts
for each row
execute function public.apply_free_property_subscription_discount();
