// Anonymous first-party funnel. No cookies or identifiers are kept in the browser:
// the server groups one day's events and never stores the address they came from.
const NOTRACK = 'soft999.notrack';
const NAMES = new Set(['page_view', 'section', 'video', 'download_click', 'download_mobile', 'releases_click', 'faq_open', 'support_click', 'pro_interest', 'copy_desktop_link', 'account_open', 'auth_submit', 'auth_error', 'google_start', 'sign_up', 'login', 'telegram_link_start', 'telegram_linked', 'pro_checkout_click', 'opt_out']);
const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,60}$/.test(value) ? value.toLowerCase() : null;

// UTM wins; otherwise the referring site. Own pages and sign-in providers are not a source.
export function visitSource(url, referrer) {
  const params = url.searchParams, campaign = token(params.get('utm_campaign'));
  const named = token(params.get('utm_source') || params.get('ref'));
  if (named) return { source: named, campaign };
  let host = '';
  try { host = new URL(referrer).hostname.replace(/^www\./, ''); } catch {}
  if (!host || host === url.hostname.replace(/^www\./, '') || host === 'accounts.google.com' || host.endsWith('.supabase.co')) host = null;
  return { source: token(host), campaign };
}
// Returning from Google or an email link is the end of an earlier visit, not a new one.
export function isReturn(url) {
  const hash = new URLSearchParams(url.hash.slice(1));
  return ['code', 'error', 'error_code'].some(key => url.searchParams.has(key)) || ['access_token', 'error', 'error_description'].some(key => hash.has(key));
}
export function eventLabel(params = {}) {
  const value = params.label ?? params.placement ?? params.method ?? params.mode ?? params.code ?? params.item;
  const text = value === undefined || value === null ? '' : String(value);
  return /^[a-zA-Z0-9_.-]{1,40}$/.test(text) ? text.toLowerCase() : null;
}

export function createTracker(config, { local, rejected, win = window, fetcher = (...args) => fetch(...args) }) {
  const url = new URL(win.location.href), nav = win.navigator;
  const visit = visitSource(url, win.document.referrer);
  const device = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent) ? 'mobile' : 'desktop';
  let excluded = false;
  try {
    // The owner opens /?notrack=1 once per browser to keep their own visits out.
    const flag = url.searchParams.get('notrack');
    if (flag === '1') win.localStorage.setItem(NOTRACK, '1');
    if (flag === '0') win.localStorage.removeItem(NOTRACK);
    excluded = win.localStorage.getItem(NOTRACK) === '1';
  } catch {}
  const refused = () => excluded || nav.globalPrivacyControl === true || nav.doNotTrack === '1';
  function send(name, label, lang) {
    const body = { p_name: name, p_label: label, p_lang: lang, p_device: device, ...(name === 'page_view' ? { p_source: visit.source, p_campaign: visit.campaign } : {}) };
    if (local) { console.debug('[soft analytics]', JSON.stringify(body)); return; }
    try {
      fetcher(config.supabaseUrl + '/rest/v1/rpc/soft_track', { method: 'POST', keepalive: true, credentials: 'omit', headers: { apikey: config.supabasePublishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
    } catch {}
  }
  const lang = () => ['ru', 'uk', 'en'].includes(win.document.documentElement.lang) ? win.document.documentElement.lang : null;
  return {
    track(name, params) { if (NAMES.has(name) && name !== 'opt_out' && !refused() && !rejected()) send(name, eventLabel(params), lang()); },
    view(known = true) { if (!isReturn(url) && !refused() && !rejected()) send('page_view', null, known ? lang() : null); },
    // Removes today's events of this visit on the server.
    optOut() { if (!refused()) send('opt_out', null, null); }
  };
}

// Reading depth and video progress. Each step is reported once per page.
export function observePage(track, doc = document) {
  const once = new Set();
  const report = (name, label) => { const key = name + ':' + label; if (!once.has(key)) { once.add(key); track(name, { label }); } };
  if ('IntersectionObserver' in window) {
    const timers = new Map();
    const observer = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        clearTimeout(timers.get(target));
        // A section passed while jumping to an anchor was not read.
        if (isIntersecting) timers.set(target, setTimeout(() => { report('section', target.id); observer.unobserve(target); }, 900));
      }
    }, { rootMargin: '-40% 0px -40% 0px' });
    for (const section of doc.querySelectorAll('main section[id]')) if (section.id !== 'top') observer.observe(section);
  }
  const video = doc.querySelector('#explainer');
  video?.addEventListener('playing', () => report('video', 'play'));
  video?.addEventListener('timeupdate', () => { if (video.duration && video.currentTime / video.duration >= .5) report('video', 'half'); });
  video?.addEventListener('ended', () => report('video', 'end'));
  for (const link of doc.querySelectorAll('a[href*="/releases"]')) link.addEventListener('click', () => track('releases_click'));
}
