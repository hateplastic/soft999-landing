-- Read-only website account lookup. Never binds a browser as a device.
-- Run once in the project's SQL Editor. Depends on existing soft_entitlements.
begin;
create or replace function public.soft_account()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_row public.soft_entitlements%rowtype;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_row from public.soft_entitlements where user_id = v_user;
  return jsonb_build_object(
    'plan', case when coalesce(v_row.disabled, false) then 'disabled'
                 when v_row.paid_until > now() then 'pro' else 'free' end,
    'entitledUntil', case when v_row.paid_until > now() then v_row.paid_until else null end,
    'deviceBound', v_row.device_hash is not null
  );
end;
$$;
revoke all on function public.soft_account() from public, anon;
grant execute on function public.soft_account() to authenticated;
commit;
