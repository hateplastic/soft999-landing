import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createHandler,hmac,parseEvent } from './handler.mjs';
test('Dashboard setup accepts only the server default secret key',async()=>{
 const h=createHandler(k=>k==='SUPABASE_SECRET_KEYS'?JSON.stringify({default:'sb_secret_test_only',other:'sb_secret_other'}):'',()=>{throw Error('No network expected');});
 for(const key of ['', 'sb_publishable_test','sb_secret_other']){
  assert.equal((await h(new Request('https://test/soft-billing',{method:'POST',headers:{apikey:key},body:'{}'}))).status,401);
 }
 assert.equal((await h(new Request('https://test/soft-billing',{method:'POST',headers:{apikey:'sb_secret_test_only'},body:'{}'}))).status,400);
 const malformed=createHandler(k=>k==='SUPABASE_SECRET_KEYS'?'bad-json':'');
 assert.equal((await malformed(new Request('https://test/setup',{method:'POST',body:'{}'}))).status,401);
});
const now=Date.parse('2026-10-19T12:00:00Z');
const event={name:'new_subscription',created_at:'2026-10-19T10:00:00Z',sent_at:'2026-10-19T10:00:01Z',payload:{subscription_id:321,period_id:12,telegram_user_id:123456,expires_at:'2026-11-19T10:00:00Z',currency:'eur',price:400,period:'monthly',type:'regular'}};
test('catalog preserves subscriptionId, currency and major-unit prices',async()=>{
  const h=createHandler(k=>({SUPABASE_SERVICE_ROLE_KEY:'test-role',TRIBUTE_API_KEY:'test-tribute'}[k]),async()=>new Response(JSON.stringify({result:[{subscriptionId:321,name:'Soft 999 Pro',currency:'eur',periods:[{periodId:12,period:'monthly',price:4}]}]})));
  const r=await h(new Request('https://test/setup',{method:'POST',headers:{Authorization:'Bearer test-role'},body:'{"action":"subscriptions"}'}));
  assert.deepEqual(await r.json(),{subscriptions:[{id:321,name:'Soft 999 Pro',currency:'eur',periods:[{periodId:12,period:'monthly',price:4}]}]});
});
test('checkout requires explicit enablement; Telegram linking remains available',async()=>{
  const env={TELEGRAM_BOT_TOKEN:'test-token',TELEGRAM_WEBHOOK_SECRET:'test-secret',TRIBUTE_API_KEY:'test-api',TRIBUTE_SUBSCRIPTION_ID:'321'};
  const h=createHandler(k=>env[k]);
  assert.deepEqual(await (await h(new Request('https://test/health'))).json(),{service:'soft-billing',telegram:true,tribute:false,version:'0.2.0'});
  env.BILLING_CHECKOUT_ENABLED='true';assert.equal((await (await h(new Request('https://test/health'))).json()).tribute,true);
});
test('operator accepts only the default modern secret or legacy service role',async()=>{
  let calls=0;
  const env={SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_test',other:'sb_secret_other'}),TRIBUTE_API_KEY:'fake'};
  const h=createHandler(k=>env[k],async()=>{calls++;return new Response('{"result":[]}');});
  for(const key of ['sb_secret_other','sb_publishable_test',''])assert.equal((await h(new Request('https://test/soft-billing',{method:'POST',headers:{apikey:key},body:'{"action":"subscriptions"}'}))).status,401);
  assert.equal(calls,0);
  assert.equal((await h(new Request('https://test/soft-billing',{method:'POST',headers:{apikey:'sb_secret_test'},body:'{"action":"subscriptions"}'}))).status,200);
  env.SUPABASE_SECRET_KEYS='broken';assert.equal((await h(new Request('https://test/soft-billing',{method:'POST',headers:{apikey:'sb_secret_test'},body:'{}'}))).status,401);
});
test('HMAC matches Node; event is accepted only for exact subscription, monthly EUR 400',async()=>{assert.equal(await hmac('secret','raw'),createHmac('sha256','secret').update('raw').digest('hex'));assert.equal((await parseEvent(event,'321',now)).p_review,false);for(const change of [{subscription_id:322},{telegram_user_id:0},{price:399},{currency:'usd'},{period:'yearly'},{type:'trial'},{expires_at:'invalid'}])assert.equal((await parseEvent({...event,payload:{...event.payload,...change}},'321',now)).p_review,true);});
test('retries with different sent_at deduplicate; different renewal does not',async()=>{const a=await parseEvent(event,'321',now),b=await parseEvent({...event,sent_at:'2026-10-20T00:00:00Z'},'321',now);assert.equal(a.p_key,b.p_key);assert.notEqual(a.p_key,(await parseEvent({...event,name:'renewed_subscription'},'321',now)).p_key);});
test('unsigned webhook and setup rejected without database call',async()=>{let calls=0;const handle=createHandler(k=>({TRIBUTE_API_KEY:'fake-secret',TRIBUTE_SUBSCRIPTION_ID:'321',SUPABASE_SERVICE_ROLE_KEY:'fake-role'}[k]),async()=>{calls++;throw Error();});assert.equal((await handle(new Request('https://test/tribute',{method:'POST',body:JSON.stringify(event)}))).status,401);assert.equal((await handle(new Request('https://test/setup',{method:'POST',body:'{}'}))).status,401);assert.equal(calls,0);});
test('valid signature uses trusted RPC; cancellation is passed as cancellation',async()=>{const body=JSON.stringify({...event,name:'cancelled_subscription',created_at:new Date(Date.now()-1000).toISOString(),payload:{...event.payload,expires_at:new Date(Date.now()+30*86400000).toISOString()}}),calls=[];const handle=createHandler(k=>({TRIBUTE_API_KEY:'fake-secret',TRIBUTE_SUBSCRIPTION_ID:'321',SUPABASE_SERVICE_ROLE_KEY:'fake-role',SUPABASE_URL:'https://db.test'}[k]),async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return new Response('{"ok":true}');});const res=await handle(new Request('https://test/tribute',{method:'POST',body,headers:{'trbt-signature':await hmac('fake-secret',body)}}));assert.equal(res.status,200);assert.equal(calls[0].body.p_name,'cancelled_subscription');assert.equal(calls[0].body.p_review,false);});
test('Telegram webhook rejects missing secret and ignores group messages',async()=>{let calls=0;const h=createHandler(k=>({TELEGRAM_BOT_TOKEN:'fake-token',TELEGRAM_WEBHOOK_SECRET:'fake-secret'}[k]),async()=>{calls++;throw Error();});assert.equal((await h(new Request('https://test/telegram',{method:'POST',body:'{}'}))).status,401);assert.equal((await h(new Request('https://test/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'fake-secret'},body:JSON.stringify({message:{chat:{type:'group',id:1},from:{id:1},text:'/start s_abc'}})}))).status,200);assert.equal(calls,0);});

