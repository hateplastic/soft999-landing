import { config } from './config.js';
import { initAccount } from './account.js';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const analyticsConsentKey='soft999.analytics.consent.v1';
const analyticsId=/^G-[A-Z0-9]+$/.test(config.googleAnalyticsId||'')?config.googleAnalyticsId:'';
function startAnalytics(){if(!analyticsId||local)return;window['ga-disable-'+analyticsId]=false;if(window.gtag)return;window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config',analyticsId,{anonymize_ip:true});const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(analyticsId);document.head.append(script);}
function initVercelAnalytics(){if(local)return;window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};const script=document.createElement('script');script.defer=true;script.src='/_vercel/insights/script.js';document.head.append(script);}
initVercelAnalytics();
function analyticsEvent(name,params={}){try{if(window.gtag&&!local&&localStorage.getItem(analyticsConsentKey)==='accepted')window.gtag('event',name,params);}catch{}}
window.softAnalytics=analyticsEvent;
const consentPanel=$('#analytics-consent');
function saveAnalyticsConsent(accepted){localStorage.setItem(analyticsConsentKey,accepted?'accepted':'rejected');consentPanel.hidden=true;if(accepted)startAnalytics();else if(analyticsId)window['ga-disable-'+analyticsId]=true;}
$('#analytics-accept').addEventListener('click',()=>saveAnalyticsConsent(true));
$('#analytics-reject').addEventListener('click',()=>saveAnalyticsConsent(false));
$$('[data-analytics-settings]').forEach(button=>button.addEventListener('click',()=>{consentPanel.hidden=false;}));
try{const consent=localStorage.getItem(analyticsConsentKey);if(consent==='accepted')startAnalytics();else if(!consent)consentPanel.hidden=false;}catch{}
function safeLink(value) { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; } }
function info(title, paragraphs, link) {
  $('#info-title').textContent = title;
  const body = $('#info-content'); body.replaceChildren();
  for (const text of paragraphs) { const p = document.createElement('p'); p.textContent = text; body.append(p); }
  if (link) { const a = document.createElement('a'); a.className = 'btn full'; a.href = link.url; a.textContent = link.label; a.rel = 'noopener noreferrer'; body.append(a); }
  if (!$('#info-dialog').open) $('#info-dialog').showModal();
}
$$('[data-close]').forEach(b => b.addEventListener('click', () => document.getElementById(b.dataset.close).close()));
$$('dialog').forEach(d => d.addEventListener('click', e => { if(e.target !== d) return; const r=d.getBoundingClientRect(); if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) d.close(); }));
$('#menu-toggle').addEventListener('click', () => { const open=$('#nav-links').classList.toggle('open'); $('#menu-toggle').setAttribute('aria-expanded', String(open)); $('#menu-toggle').setAttribute('aria-label', open?'Закрыть меню':'Открыть меню'); });
$$('#nav-links a').forEach(a => a.addEventListener('click', () => { $('#nav-links').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded','false'); }));
const names = { overview:'Обзор', telegram:'Telegram', x:'X / Twitter' };
function preview(name, focus=false) {
  if (!names[name]) return;
  $$('.mock-panel').forEach(p => p.hidden = p.id !== `preview-${name}`);
  $$('[data-preview]').forEach(b => { const active=b.dataset.preview===name; b.classList.toggle('active',active); if(b.role==='tab'){b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;} });
  $('#preview-name').textContent=names[name]; if(focus) $(`#tab-${name}`).focus();
}
$$('[data-preview]').forEach(b => b.addEventListener('click', () => preview(b.dataset.preview)));
$('.product-tabs').addEventListener('keydown', e => { const keys=Object.keys(names);const at=keys.indexOf(e.target.dataset.preview);if(at<0)return;let next;if(e.key==='ArrowRight')next=(at+1)%3;else if(e.key==='ArrowLeft')next=(at+2)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;e.preventDefault();preview(keys[next],true); });
if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('js-motion');
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');observer.unobserve(e.target);}}),{threshold:.08});
  $$('.reveal').forEach(el=>observer.observe(el));
}
$('.hero').addEventListener('pointermove', e => { if(reduced.matches || innerWidth<1101 || e.pointerType!=='mouse')return;const r=e.currentTarget.getBoundingClientRect();$('#universe').style.setProperty('--px',`${(e.clientX-r.left-r.width/2)*.017}px`);$('#universe').style.setProperty('--py',`${(e.clientY-r.top-r.height/2)*.017}px`); });
$('.hero').addEventListener('pointerleave',()=>{$('#universe').style.setProperty('--px','0px');$('#universe').style.setProperty('--py','0px');});
const reply='Собрали аккаунты и задачи в одной панели. Стало проще видеть, что происходит, и держать фокус на разговоре.';
let elapsed=0, paused=reduced.matches, last=performance.now(), inView=false;
const statuses=['Новый пост получен · демо','Готовим комментарий · демо','Комментарий проверен · демо','Комментарий отправлен · демо'];
function drawDemo() {
  const t=elapsed%15000, stage=t<2200?0:t<7200?1:t<10500?2:3;
  $$('.flow-step').forEach((s,i)=>{s.classList.toggle('active',i===stage);s.classList.toggle('done',i<stage);});
  $('#track-progress').style.width=`${stage/3*100}%`;
  $('#event-reply').classList.toggle('visible',stage>0);
  $('#typed-reply').textContent=stage===0?'':reply.slice(0,Math.min(reply.length,Math.floor((t-2200)/38)));
  $('#typing').hidden=stage!==1;
  const status=$('#flow-status');if(status.dataset.stage!==String(stage)){status.replaceChildren();const dot=document.createElement('i');dot.className='dot';status.append(dot,document.createTextNode(' '+statuses[stage]));status.dataset.stage=String(stage);}
}
function pauseLabel(){ $('#demo-toggle').textContent=paused?'Продолжить ▷':'Приостановить Ⅱ';$('#demo-toggle').setAttribute('aria-pressed',String(paused)); }
$('#demo-toggle').addEventListener('click',()=>{paused=!paused;pauseLabel();});
reduced.addEventListener('change',()=>{paused=reduced.matches;if(paused)elapsed=11000;pauseLabel();drawDemo();});
if(reduced.matches)elapsed=11000;
new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;},{threshold:.1}).observe($('.flow-demo'));
setInterval(()=>{const now=performance.now();if(!paused&&!document.hidden&&inView)elapsed+=Math.min(now-last,150);last=now;drawDemo();},80);
pauseLabel();drawDemo();
async function download(event) {
  analyticsEvent('download_click',{placement:event?.currentTarget?.dataset?.download||'button'});
  const publicUrl=safeLink(config.downloadUrl);
  if(publicUrl){location.assign(publicUrl);return;}
  if(local){try {const r=await fetch('/api/release',{cache:'no-store'});const release=await r.json();if(r.ok&&release.available){info('Windows-сборка', ['Скачай архив, распакуй его в отдельную папку и следуй инструкции внутри. Это дополнительная portable-сборка для локальной проверки.','В этом локальном предпросмотре архив берётся из отдельной папки релизов. В репозиторий лендинга он не входит.'],{url:config.previewDownloadPath,label:'Скачать ZIP · Windows x64'});return;}}catch{}}
  info('Сборка готовится к публикации', ['Публичная загрузка Windows-клиента пока не открыта. После публикации релиза здесь появится прямая ссылка на скачивание.','Free будет доступен без ограничения по времени: один аккаунт Telegram и один X.']);
}
$$('[data-download]').forEach(b=>b.addEventListener('click',download));
const purchase=safeLink(config.purchaseUrl);
if(purchase){$('#pro-label').textContent='PRO';$('#pro-caption').textContent='Подписка через Telegram / Tribute.';$$('[data-pro]').forEach(b=>b.firstChild.textContent='Подключить Pro ');}
$$('[data-pro]').forEach(b=>b.addEventListener('click',()=>document.querySelector('[data-account]').click()));
$$('[data-info]').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.info==='privacy')info('\u0422\u0432\u043e\u0438 \u0434\u0430\u043d\u043d\u044b\u0435', ['\u0414\u043b\u044f \u0443\u0447\u0451\u0442\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u044e\u0442\u0441\u044f email \u0438 \u043f\u0430\u0440\u043e\u043b\u044c. Supabase \u0445\u0440\u0430\u043d\u0438\u0442 \u0442\u0430\u0440\u0438\u0444 \u0438 \u043f\u0440\u0438\u0432\u044f\u0437\u043a\u0443 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430.', '\u0421\u0430\u0439\u0442 \u043d\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0435\u0442 \u0441\u0435\u0441\u0441\u0438\u0438 Telegram, cookies X \u0438 \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u043c\u043e\u0435 \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0445 \u043f\u0440\u043e\u0444\u0438\u043b\u0435\u0439.', 'Vercel Web Analytics \u0441\u0447\u0438\u0442\u0430\u0435\u0442 \u043e\u0431\u0435\u0437\u043b\u0438\u0447\u0435\u043d\u043d\u044b\u0435 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u044b \u0441\u0442\u0440\u0430\u043d\u0438\u0446 \u0431\u0435\u0437 cookies. Google Analytics \u0438 \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u0441\u043a\u0430\u0447\u0438\u0432\u0430\u043d\u0438\u044f, \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0438 \u043f\u0435\u0440\u0435\u0445\u043e\u0434\u0430 \u043a \u043e\u043f\u043b\u0430\u0442\u0435 \u0432\u043a\u043b\u044e\u0447\u0430\u044e\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u043e\u0441\u043b\u0435 \u0442\u0432\u043e\u0435\u0433\u043e \u0441\u043e\u0433\u043b\u0430\u0441\u0438\u044f. Email \u0438 \u043f\u0430\u0440\u043e\u043b\u044c \u0432 \u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0443 \u043d\u0435 \u043f\u0435\u0440\u0435\u0434\u0430\u044e\u0442\u0441\u044f.']);
  else info('О текущей версии',[`Soft 99.9 · ${config.version} · ${config.releaseLabel}.`,'Установи приложение и открой ярлык Soft 99.9. Панель работает в браузере на твоём компьютере. Python, Node.js и Chromium входят в комплект.','На сайте показано интерактивное воспроизведение интерфейса. События и профили в демонстрации вымышлены; реальные сообщения не отправляются.']);
}));
initAccount(config);
