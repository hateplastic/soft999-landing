begin;

create table if not exists public.soft_telegram_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  telegram_id bigint not null unique check (telegram_id > 0),
  linked_at timestamptz not null default now()
);
create table if not exists public.soft_link_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  telegram_id bigint,
  code_hash text,
  attempts integer not null default 0,
  consumed boolean not null default false
);
create table if not exists public.soft_billing_events (
  event_key text primary key,
  event_name text not null,
  telegram_id bigint,
  subscription_id bigint,
  expires_at timestamptz,
  received_at timestamptz not null default now(),
  outcome text not null
);
create table if not exists public.soft_billing_periods (
  telegram_id bigint not null,
  subscription_id bigint not null,
  paid_until timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (telegram_id, subscription_id)
);
alter table public.soft_telegram_links enable row level security;
alter table public.soft_link_requests enable row level security;
alter table public.soft_billing_events enable row level security;
alter table public.soft_billing_periods enable row level security;
revoke all on public.soft_telegram_links, public.soft_link_requests, public.soft_billing_events, public.soft_billing_periods from public, anon, authenticated;
grant all on public.soft_telegram_links, public.soft_link_requests, public.soft_billing_events, public.soft_billing_periods to service_role;

create or replace function public.soft_link_start(p_token_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.soft_link_requests%rowtype;
begin
  if u is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_token'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text, 99));
  if exists(select 1 from public.soft_telegram_links where user_id=u) then return jsonb_build_object('ok',false,'error','already_linked'); end if;
  select * into r from public.soft_link_requests where user_id=u for update;
  if found and r.created_at > now()-interval '30 seconds' then return jsonb_build_object('ok',false,'error','rate_limit'); end if;
  insert into public.soft_link_requests(user_id,token_hash,expires_at)
  values(u,p_token_hash,now()+interval '10 minutes')
  on conflict(user_id) do update set token_hash=excluded.token_hash,created_at=now(),expires_at=excluded.expires_at,telegram_id=null,code_hash=null,attempts=0,consumed=false;
  return jsonb_build_object('ok',true);
end; $$;

-- Only the authenticated Telegram webhook may offer a confirmation code.
create or replace function public.soft_link_challenge(p_token_hash text,p_telegram_id bigint,p_code_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.soft_link_requests%rowtype;
begin
  if p_telegram_id is null or p_telegram_id<=0 or p_code_hash is null or p_code_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_input'; end if;
  select * into r from public.soft_link_requests where token_hash=p_token_hash for update;
  if not found or r.expires_at<=now() or r.consumed or r.attempts>=5 then return jsonb_build_object('ok',false,'error','expired'); end if;
  if r.telegram_id is not null and r.telegram_id<>p_telegram_id then return jsonb_build_object('ok',false,'error','different_telegram'); end if;
  if exists(select 1 from public.soft_telegram_links where telegram_id=p_telegram_id and user_id<>r.user_id) then return jsonb_build_object('ok',false,'error','already_linked'); end if;
  update public.soft_link_requests set telegram_id=p_telegram_id,code_hash=p_code_hash where user_id=r.user_id;
  return jsonb_build_object('ok',true);
end; $$;

create or replace function public.soft_link_confirm(p_token_hash text,p_code_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.soft_link_requests%rowtype; until_at timestamptz;
begin
  if u is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into r from public.soft_link_requests where user_id=u and token_hash=p_token_hash for update;
  if not found or r.expires_at<=now() or r.consumed or r.attempts>=5 then return jsonb_build_object('ok',false,'error','expired'); end if;
  if r.code_hash is null or p_code_hash is null or r.code_hash<>p_code_hash then
    update public.soft_link_requests set attempts=attempts+1 where user_id=u;
    return jsonb_build_object('ok',false,'error','invalid_code');
  end if;
  perform pg_advisory_xact_lock(r.telegram_id);
  if exists(select 1 from public.soft_telegram_links where telegram_id=r.telegram_id and user_id<>u) then return jsonb_build_object('ok',false,'error','already_linked'); end if;
  if exists(select 1 from public.soft_telegram_links where user_id=u and telegram_id<>r.telegram_id) then return jsonb_build_object('ok',false,'error','already_linked'); end if;
  insert into public.soft_telegram_links(user_id,telegram_id) values(u,r.telegram_id) on conflict(user_id) do nothing;
  update public.soft_link_requests set consumed=true,code_hash=null where user_id=u;
  select max(paid_until) into until_at from public.soft_billing_periods where telegram_id=r.telegram_id;
  if until_at is not null then
    insert into public.soft_entitlements(user_id,paid_until) values(u,until_at)
    on conflict(user_id) do update set paid_until=greatest(public.soft_entitlements.paid_until,excluded.paid_until);
  end if;
  return jsonb_build_object('ok',true);
end; $$;

-- Receipt is atomic with entitlement update. A cancellation never erases paid days.
create or replace function public.soft_billing_apply(p_key text,p_name text,p_telegram_id bigint,p_subscription_id bigint,p_until timestamptz,p_review boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; affected integer;
begin
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'invalid_key'; end if;
  if not p_review and (p_name not in ('new_subscription','renewed_subscription','cancelled_subscription') or p_telegram_id is null or p_telegram_id<=0 or p_subscription_id is null or p_subscription_id<=0 or p_until is null) then raise exception 'invalid_event'; end if;
  if p_telegram_id>0 then perform pg_advisory_xact_lock(p_telegram_id); end if;
  insert into public.soft_billing_events(event_key,event_name,telegram_id,subscription_id,expires_at,outcome)
  values(p_key,left(p_name,80),p_telegram_id,p_subscription_id,p_until,case when p_review then 'review' else 'processed' end)
  on conflict(event_key) do nothing;
  get diagnostics affected=row_count;
  if affected=0 then return jsonb_build_object('ok',true,'duplicate',true); end if;
  if p_review then return jsonb_build_object('ok',true,'review',true); end if;
  if p_name in ('new_subscription','renewed_subscription') then
    insert into public.soft_billing_periods(telegram_id,subscription_id,paid_until) values(p_telegram_id,p_subscription_id,p_until)
    on conflict(telegram_id,subscription_id) do update set paid_until=greatest(public.soft_billing_periods.paid_until,excluded.paid_until),updated_at=now();
    select user_id into u from public.soft_telegram_links where telegram_id=p_telegram_id;
    if u is not null then
      insert into public.soft_entitlements(user_id,paid_until) values(u,p_until)
      on conflict(user_id) do update set paid_until=greatest(public.soft_entitlements.paid_until,excluded.paid_until);
    end if;
  end if;
  return jsonb_build_object('ok',true);
end; $$;

create or replace function public.soft_account()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e public.soft_entitlements%rowtype; tg bigint;
begin
  if u is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into e from public.soft_entitlements where user_id=u;
  select telegram_id into tg from public.soft_telegram_links where user_id=u;
  return jsonb_build_object('plan',case when coalesce(e.disabled,false) then 'disabled' when e.paid_until>now() then 'pro' else 'free' end,
    'entitledUntil',case when e.paid_until>now() then e.paid_until else null end,'deviceBound',e.device_hash is not null,'telegramLinked',tg is not null);
end; $$;

revoke all on function public.soft_link_start(text), public.soft_link_confirm(text,text), public.soft_account() from public, anon;
grant execute on function public.soft_link_start(text), public.soft_link_confirm(text,text), public.soft_account() to authenticated;
revoke all on function public.soft_link_challenge(text,bigint,text), public.soft_billing_apply(text,text,bigint,bigint,timestamptz,boolean) from public, anon, authenticated;
grant execute on function public.soft_link_challenge(text,bigint,text), public.soft_billing_apply(text,text,bigint,bigint,timestamptz,boolean) to service_role;
notify pgrst,'reload schema';
commit;
