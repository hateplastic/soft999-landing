import { config } from './config.js';
import { initAccount } from './account.js';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
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
async function download() {
  const publicUrl=safeLink(config.downloadUrl);
  if(publicUrl){location.assign(publicUrl);return;}
  if(local){try {const r=await fetch('/api/release',{cache:'no-store'});const release=await r.json();if(r.ok&&release.available){info('Windows-сборка', ['Скачай архив, распакуй его в отдельную папку и следуй инструкции внутри. Это portable-сборка: полноценный установщик ещё не выпущен.','В этом локальном предпросмотре архив берётся из отдельной папки релизов. В репозиторий лендинга он не входит.'],{url:config.previewDownloadPath,label:'Скачать ZIP · Windows x64'});return;}}catch{}}
  info('Сборка готовится к публикации', ['Публичная загрузка Windows-клиента пока не открыта. После публикации релиза здесь появится прямая ссылка на скачивание.','Free будет доступен без ограничения по времени: один аккаунт Telegram и один X.']);
}
$$('[data-download]').forEach(b=>b.addEventListener('click',download));
const purchase=safeLink(config.purchaseUrl);
if(purchase){$('#pro-label').textContent='PRO';$('#pro-caption').textContent='Подписка через Telegram / Tribute.';$$('[data-pro]').forEach(b=>b.firstChild.textContent='Подключить Pro ');}
$$('[data-pro]').forEach(b=>b.addEventListener('click',()=>info('Больше возможностей с Pro', ['Pro — $4 в месяц: несколько аккаунтов Telegram и X на одном устройстве. Free останется доступен после окончания оплаченного периода.', purchase?'Перед оплатой проверь, что твой Telegram связан с учётной записью Soft 99.9.':'Оплата пока не подключена. Мы не принимаем деньги и не активируем подписку из этой демонстрации.'],purchase?{url:purchase,label:'Перейти к оплате'}:null)));
$$('[data-info]').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.info==='privacy')info('Твои данные', ['Для учётной записи используются email и пароль. Авторизация выполняется через Supabase; тариф и привязка устройства хранятся отдельно от локальных аккаунтов Telegram и X.','Сайт не получает сессии Telegram, cookies X и содержимое локальных профилей. Вход на сайте не занимает дополнительный слот устройства.','Токены входа находятся только в памяти этой вкладки и удаляются при перезагрузке или выходе. На лендинге нет рекламных трекеров. Полная политика с контактами владельца будет опубликована перед публичным запуском.']);
  else info('О текущей версии',[`Soft 99.9 · ${config.version} · ${config.releaseLabel}.`,'В этой версии приложение запускается через START.cmd и открывает локальную панель в браузере. Для первого запуска потребуются шаги установки из инструкции в архиве.','На сайте показано интерактивное воспроизведение интерфейса. События и профили в демонстрации вымышлены; реальные сообщения не отправляются.']);
}));
initAccount(config);
