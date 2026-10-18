import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createAuthApi, authError } from '../src/auth-api.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const calls=[];
const fake=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({access_token:'test',plan:'free'}),{status:200});};
const api=createAuthApi({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'public-test'},fake);
await api.login('test@example.com','synthetic-password');
assert.match(calls[0].url,/grant_type=password$/);assert.equal(JSON.parse(calls[0].options.body).email,'test@example.com');
await api.account('test-session');
assert.match(calls[1].url,/\/rpc\/soft_account$/);assert.equal(calls[1].options.headers.Authorization,'Bearer test-session');assert.deepEqual(JSON.parse(calls[1].options.body),{});
await api.recover('test@example.com','https://example.com/');
assert.equal(new URL(calls[2].url).searchParams.get('redirect_to'),'https://example.com/');
await api.password('recovery','new-synthetic-password');assert.equal(calls[3].options.method,'PUT');
const denied=createAuthApi({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'public-test'},async()=>new Response(JSON.stringify({code:'invalid_credentials'}),{status:400}));
await assert.rejects(denied.login('fake@example.com','bad'),e=>e.code==='invalid_credentials'&&authError(e)==='Неверный email или пароль.');
const sql=await readFile(path.join(root,'supabase/20261018_website_account.sql'),'utf8');
assert.ok(!/\b(insert|update|delete)\b/i.test(sql));assert.match(sql,/where user_id = v_user/);assert.match(sql,/revoke all.*public, anon/);assert.match(sql,/auth\.uid\(\)/);
const html=await readFile(path.join(root,'src/index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate HTML IDs');
for(const m of html.matchAll(/(?:href|aria-controls)="#?([\w-]+)"/g)){if(m[0].includes('href="#')||m[0].startsWith('aria-controls'))assert.ok(ids.includes(m[1]),`Missing anchor ${m[1]}`);}
for(const name of await readdir(path.join(root,'src'))){if(!name.endsWith('.js'))continue;const file=path.join(root,'src',name);const code=await readFile(file,'utf8');assert.ok(!/soft_access|service_role|sb_secret_|localStorage|sessionStorage/.test(code),`Unexpected device binding or secret storage: ${name}`);const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);}
console.log('PASS: Auth requests/error handling; read-only account RPC; no browser device binding or persistent tokens; anchors; JavaScript syntax. No live accounts or emails used.');
