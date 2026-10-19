-- Run in Supabase SQL Editor. All fixtures are rolled back; no mail/payment calls.
begin;
do $$
declare u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); t bigint:=899999999999999;
r jsonb; expiry timestamptz:=now()+interval '30 days';
begin
 if exists(select 1 from public.soft_telegram_links where telegram_id=t) or exists(select 1 from public.soft_billing_periods where telegram_id=t) then raise exception 'fixture collision'; end if;
 insert into auth.users(id) values(u),(v);
 perform set_config('request.jwt.claim.sub',u::text,true);
 r:=public.soft_access(repeat('1',64));
 if r->>'plan'<>'free' then raise exception 'initial free failed'; end if;
 r:=public.soft_link_start(repeat('a',64));
 if not (r->>'ok')::boolean then raise exception 'link start failed'; end if;
 r:=public.soft_link_challenge(repeat('a',64),t,repeat('c',64));
 if not (r->>'ok')::boolean then raise exception 'challenge failed'; end if;
 r:=public.soft_link_confirm(repeat('a',64),repeat('b',64));
 if r->>'error'<>'invalid_code' then raise exception 'wrong code accepted'; end if;
 perform public.soft_billing_apply(repeat('d',64),'new_subscription',t,999999999,expiry);
 if (public.soft_account()->>'plan')<>'free' then raise exception 'unlinked payment granted'; end if;
 r:=public.soft_link_confirm(repeat('a',64),repeat('c',64));
 if not (r->>'ok')::boolean then raise exception 'confirm failed'; end if;
 if (public.soft_account()->>'plan')<>'pro' then raise exception 'pending payment not applied'; end if;
 if not (public.soft_account()->>'telegramLinked')::boolean then raise exception 'link flag missing'; end if;
 if (select device_hash from public.soft_entitlements where user_id=u)<>repeat('1',64) then raise exception 'device changed'; end if;
 r:=public.soft_billing_apply(repeat('d',64),'new_subscription',t,999999999,expiry);
 if not (r->>'duplicate')::boolean then raise exception 'deduplication failed'; end if;
 perform public.soft_billing_apply(repeat('e',64),'cancelled_subscription',t,999999999,expiry);
 perform public.soft_billing_apply(repeat('f',64),'renewed_subscription',t,999999999,expiry-interval '1 day');
 if (select paid_until from public.soft_entitlements where user_id=u)<>expiry then raise exception 'paid days shortened'; end if;
 r:=public.soft_link_confirm(repeat('a',64),repeat('c',64));
 if r->>'error'<>'expired' then raise exception 'link reused'; end if;
 begin
  perform public.soft_access(repeat('2',64));
  raise exception 'second device accepted';
 exception when insufficient_privilege then null;
 end;
 update public.soft_entitlements set paid_until=now()-interval '1 second' where user_id=u;
 if (public.soft_access(repeat('1',64))->>'plan')<>'free' then raise exception 'expiry did not return free'; end if;
 perform set_config('request.jwt.claim.sub',v::text,true);
 perform public.soft_link_start(repeat('b',64));
 r:=public.soft_link_challenge(repeat('b',64),t,repeat('c',64));
 if r->>'error'<>'already_linked' then raise exception 'telegram reuse allowed'; end if;
 for i in 1..5 loop perform public.soft_link_confirm(repeat('b',64),repeat('c',64)); end loop;
 r:=public.soft_link_challenge(repeat('b',64),t-1,repeat('c',64));
 if r->>'error'<>'expired' then raise exception 'code attempt limit failed'; end if;
 if has_table_privilege('authenticated','public.soft_entitlements','UPDATE') or has_table_privilege('authenticated','public.soft_billing_events','INSERT') or has_function_privilege('authenticated','public.soft_billing_apply(text,text,bigint,bigint,timestamptz,boolean)','EXECUTE') or has_function_privilege('anon','public.soft_link_start(text)','EXECUTE') then raise exception 'unsafe privileges'; end if;
end; $$;
select 'PASS: linking, wrong code, replay, pending payment, duplicate event, cancellation, old renewal, expiry, device and permissions' as result;
rollback;
