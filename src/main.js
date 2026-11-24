import { config } from './config.js';
import { initAccount } from './account.js';
import { initLocale, redirectToSavedLanguage } from './i18n.js';
import { initMedia } from './media.js';
import { createTracker, observePage } from './analytics.js';
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const analyticsConsentKey='soft999.analytics.consent.v1';
const tracker=createTracker(config,{local,rejected:()=>{try{return localStorage.getItem(analyticsConsentKey)==='rejected';}catch{return false;}}});
// Stop here while the browser leaves: sign-in parameters must be handled once, on the final page.
if (redirectToSavedLanguage()) { tracker.view(false); await new Promise(() => {}); }
initLocale();
tracker.view();
initMedia(config);
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const analyticsId=/^G-[A-Z0-9]+$/.test(config.googleAnalyticsId||'')?config.googleAnalyticsId:'';
function startAnalytics(){if(!analyticsId||local)return;window['ga-disable-'+analyticsId]=false;if(window.gtag)return;window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config',analyticsId,{anonymize_ip:true});const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(analyticsId);document.head.append(script);}
function initVercelAnalytics(){if(local)return;window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};const script=document.createElement('script');script.defer=true;script.src='/_vercel/insights/script.js';document.head.append(script);}
initVercelAnalytics();
function analyticsEvent(name,params={}){tracker.track(name,params);try{if(window.gtag&&!local&&localStorage.getItem(analyticsConsentKey)==='accepted')window.gtag('event',name,params);}catch{}}
window.softAnalytics=analyticsEvent;
observePage((name,params)=>analyticsEvent(name,params));
const consentPanel=$('#analytics-consent');
function saveAnalyticsConsent(accepted){if(!accepted)tracker.optOut();localStorage.setItem(analyticsConsentKey,accepted?'accepted':'rejected');consentPanel.hidden=true;if(accepted)startAnalytics();else if(analyticsId)window['ga-disable-'+analyticsId]=true;}
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
if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('js-motion');
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');observer.unobserve(e.target);}}),{threshold:.08});
  $$('.reveal').forEach(el=>observer.observe(el));
}
async function download(event) {
  const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  analyticsEvent(mobile?'download_mobile':'download_click',{placement:event?.currentTarget?.dataset?.download||'button'});
  const publicUrl=safeLink(config.downloadUrl);
  if(publicUrl){
    if(mobile){
      info('Установка на Windows',['Этот установщик предназначен для Windows 10 / 11 x64. Открой страницу на компьютере, чтобы скачать EXE.','Установщик сам распакует клиент и создаст ярлыки. Вручную работать с ZIP не нужно.'],{url:'https://soft999.app/',label:'Открыть сайт на компьютере'});return;
    }
    location.assign(publicUrl);return;
  }
  if(local){try {const r=await fetch('/api/release',{cache:'no-store'});const release=await r.json();if(r.ok&&release.available){info('Windows-сборка', ['Скачай архив, распакуй его в отдельную папку и следуй инструкции внутри. Это дополнительная portable-сборка для локальной проверки.','В этом локальном предпросмотре архив берётся из отдельной папки релизов. В репозиторий лендинга он не входит.'],{url:config.previewDownloadPath,label:'Скачать ZIP · Windows x64'});return;}}catch{}}
  info('Сборка готовится к публикации', ['Публичная загрузка Windows-клиента пока не открыта. После публикации релиза здесь появится прямая ссылка на скачивание.','Free будет доступен без ограничения по времени: один аккаунт Telegram и один X.']);
}
$$('[data-download]').forEach(b=>b.addEventListener('click',download));
const purchase=safeLink(config.purchaseUrl);
if(purchase){$('#pro-label').textContent='PRO';$('#pro-caption').textContent='Подписка через Telegram / Tribute.';$$('[data-pro]').forEach(b=>b.firstChild.textContent='Подключить Pro ');}
$$('[data-pro]').forEach(b=>b.addEventListener('click',()=>document.querySelector('[data-account]').click()));
$$('[data-info]').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.info==='privacy')info('Твои данные', ['Для учётной записи используются email и пароль. Supabase хранит тариф и привязку устройства.', 'Сайт не получает сессии Telegram, cookies X и содержимое локальных профилей.', 'Vercel Web Analytics считает обезличенные просмотры страниц без cookies. Google Analytics включается только после твоего согласия. Email и пароль в аналитику не передаются.','Для анонимной статистики сайт считает просмотры, источник перехода, прокрутку до разделов, просмотр видео, нажатия кнопок и ошибки входа: без cookies, без сохранения IP и содержимого форм. События одного дня объединяются кодом, который меняется каждые сутки. Срок хранения — до 180 дней. Кнопка «Отклонить» в настройках аналитики отключает и эту статистику.','Начиная со следующей версии программа отмечает первый запуск, первое подключение аккаунта и первую отправку. Имена аккаунтов, каналы и тексты не передаются.']);
  else info('О текущей версии',[`Soft 99.9 · ${config.version} · ${config.releaseLabel}.`,'Запусти установщик Soft 99.9 и следуй шагам. Он создаст ярлыки для запуска и остановки; Python, Node.js и Chromium включены. Если WebView2 отсутствует, он установится при первом запуске; для этого нужен интернет.','На странице доступно интерактивное демо с тестовыми данными. Подключение аккаунтов и отправка выполняются в установленном клиенте.']);
}));
initAccount(config);

// Public contact destinations only. Social links appear when configured.
for(const anchor of $$('[data-support]')){
 const url=safeLink(config.supportUrl);if(url)anchor.href=url;
 anchor.addEventListener('click',()=>analyticsEvent('support_click',{placement:'support'}));
}
const socials=$('#social-links');
for(const item of (config.socialLinks||[])){
 const href=safeLink(item.url);if(!href||typeof item.label!=='string')continue;
 const a=document.createElement('a');a.href=href;a.textContent=item.label;a.target='_blank';a.rel='noopener noreferrer';socials.append(a);
}
socials.hidden=!socials.children.length;
$$('[data-copy-site]').forEach(button=>button.addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText('https://soft999.app/');$('.copy-status').textContent='Ссылка скопирована';analyticsEvent('copy_desktop_link');}
 catch{info('Ссылка для компьютера',['Скопируй этот адрес и открой его на Windows-компьютере:','https://soft999.app/']);}
}));
$$('.faq-list details').forEach((item,index)=>item.addEventListener('toggle',()=>{if(item.open)analyticsEvent('faq_open',{item:index+1});}));
$$('[data-pro]').forEach(button=>button.addEventListener('click',()=>analyticsEvent('pro_interest',{placement:'pricing'})));
