const enc=new TextEncoder();
export async function sha256(text){return hex(await crypto.subtle.digest('SHA-256',enc.encode(text)));}
function hex(buf){return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function hmac(key,text){const k=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,enc.encode(text)));}
export function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
const positive=x=>Number.isSafeInteger(x)&&x>0;
export async function parseEvent(data,subscriptionId,now=Date.now()){
  const p=data?.payload||{}, known=['new_subscription','renewed_subscription','cancelled_subscription'].includes(data?.name);
  const until=Date.parse(p.expires_at), created=Date.parse(data?.created_at);
  const review=!known||!positive(p.telegram_user_id)||String(p.subscription_id)!==subscriptionId||!positive(p.subscription_id)||!Number.isFinite(until)||!Number.isFinite(created)||created>now+300000||until>now+370*86400000||p.period!=='monthly'||String(p.currency).toLowerCase()!=='eur'||p.price!==400||(p.type&&p.type!=='regular');
  const key=await sha256(JSON.stringify([data?.name,data?.created_at,p.subscription_id,p.period_id,p.telegram_user_id,p.expires_at,p.price,p.currency]));
  return {p_key:key,p_name:typeof data?.name==='string'?data.name:'unknown',p_telegram_id:positive(p.telegram_user_id)?p.telegram_user_id:null,p_subscription_id:positive(p.subscription_id)?p.subscription_id:null,p_until:Number.isFinite(until)?new Date(until).toISOString():null,p_review:review};
}
async function readBody(request){const reader=request.body?.getReader();if(!reader)return '';let size=0;const parts=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new Error('body_too_large');}parts.push(value);}const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}return new TextDecoder().decode(bytes);}
export function createHandler(env,fetcher=fetch){
  const value=name=>env(name)||'';
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
  async function rpc(name,body){const res=await fetcher(value('SUPABASE_URL')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:value('SUPABASE_SERVICE_ROLE_KEY'),Authorization:'Bearer '+value('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!res.ok)throw new Error('database_error');return res.json();}
  async function telegram(method,body){const res=await fetcher('https://api.telegram.org/bot'+value('TELEGRAM_BOT_TOKEN')+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});const data=await res.json();if(!res.ok||!data.ok)throw new Error('telegram_error');return data.result;}
  return async request=>{
    const path=new URL(request.url).pathname.split('/').pop();
    try{
      if(path==='health'&&request.method==='GET')return json({service:'soft-billing',telegram:!!value('TELEGRAM_BOT_TOKEN')&&!!value('TELEGRAM_WEBHOOK_SECRET'),tribute:value('BILLING_CHECKOUT_ENABLED')==='true'&&!!value('TRIBUTE_API_KEY')&&/^[1-9]\d*$/.test(value('TRIBUTE_SUBSCRIPTION_ID')),version:'0.2.0'});
      if(request.method!=='POST')return json({error:'method_not_allowed'},405);
      if(path==='setup'||path==='soft-billing'){
        const admin=value('SUPABASE_SERVICE_ROLE_KEY');
        let defaultKey='';try{defaultKey=JSON.parse(value('SUPABASE_SECRET_KEYS')||'{}').default||'';}catch{}
        const legacy=!!admin&&equal(request.headers.get('Authorization')||'','Bearer '+admin);
        const modern=typeof defaultKey==='string'&&defaultKey.startsWith('sb_secret_')&&equal(request.headers.get('apikey')||'',defaultKey);
        if(!legacy&&!modern)return json({error:'unauthorized'},401);
        const body=JSON.parse(await readBody(request));
        if(body.action==='subscriptions'){
          if(!value('TRIBUTE_API_KEY'))return json({error:'tribute_key_missing'},503);
          const r=await fetcher('https://tribute.tg/api/v1/subscriptions',{headers:{'Api-Key':value('TRIBUTE_API_KEY')},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('tribute_error');
          const data=await r.json();return json({subscriptions:(data.result||[]).map(s=>({id:s.subscriptionId,name:s.name,currency:s.currency,periods:s.periods}))});
        }
        if(body.action!=='telegram')return json({error:'invalid_action'},400);
        if(!/^[A-Za-z0-9_-]{32,256}$/.test(value('TELEGRAM_WEBHOOK_SECRET')))return json({error:'webhook_secret_missing'},503);
        const me=await telegram('getMe',{});if(String(me.username).toLowerCase()!=='soft999acess_bot')return json({error:'wrong_bot'},409);
        const url=value('SUPABASE_URL')+'/functions/v1/soft-billing/telegram';
        const current=await telegram('getWebhookInfo',{});if(current.url&&current.url!==url)return json({error:'bot_has_another_webhook'},409);
        await telegram('setWebhook',{url,secret_token:value('TELEGRAM_WEBHOOK_SECRET'),allowed_updates:['message'],drop_pending_updates:false});
        const check=await telegram('getWebhookInfo',{});return json({ok:check.url===url,bot:me.username,url:check.url});
      }
      if(path==='tribute'){
        const secret=value('TRIBUTE_API_KEY'),sub=value('TRIBUTE_SUBSCRIPTION_ID');if(!secret||!/^\d+$/.test(sub))return json({error:'not_configured'},503);
        const raw=await readBody(request),sig=(request.headers.get('trbt-signature')||'').replace(/^sha256=/,'').toLowerCase();
        if(!/^[a-f0-9]{64}$/.test(sig)||!equal(await hmac(secret,raw),sig))return json({error:'invalid_signature'},401);
        const event=JSON.parse(raw);return json(await rpc('soft_billing_apply',await parseEvent(event,sub)));
      }
      if(path==='telegram'){
        const secret=value('TELEGRAM_WEBHOOK_SECRET');if(!secret||!value('TELEGRAM_BOT_TOKEN'))return json({error:'not_configured'},503);
        if(!equal(request.headers.get('X-Telegram-Bot-Api-Secret-Token')||'',secret))return json({error:'unauthorized'},401);
        const update=JSON.parse(await readBody(request)),m=update.message;
        if(!m||m.chat?.type!=='private'||!positive(m.from?.id)||m.from.is_bot||m.chat.id!==m.from.id)return json({ok:true});
        const match=/^\/start(?:@soft999acess_bot)? s_([A-Za-z0-9_-]{43})$/.exec(m.text||'');
        if(!match){return json({ok:true});}
        const token=match[1],tokenHash=await sha256(token);
        const digest=await hmac(secret,'soft999-link:'+token+':'+m.from.id);
        const code=String(parseInt(digest.slice(0,12),16)%1000000).padStart(6,'0');
        const result=await rpc('soft_link_challenge',{p_token_hash:tokenHash,p_telegram_id:m.from.id,p_code_hash:await sha256(token+':'+code)});
        if(!result.ok)return json({ok:true});
        await telegram('sendMessage',{chat_id:m.chat.id,text:'Soft 99.9: код привязки '+code+'\n\nВведи его только в своём кабинете на https://soft999.app/. Код действует 10 минут. Если ты не начинал привязку, никому не сообщай код.','protect_content':true});
        return json({ok:true});
      }
      return json({error:'not_found'},404);
    }catch(e){if(e instanceof SyntaxError)return json({error:'invalid_json'},400);if(e.message==='body_too_large')return json({error:'body_too_large'},413);return json({error:'temporarily_unavailable'},503);}
  };
}

Deno.serve(createHandler(name=>Deno.env.get(name)));
