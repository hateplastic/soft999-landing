// Pre-renders one static page per language from src/index.html, with SEO metadata.
import { dictionaries } from '../src/i18n.js';

export const SITE = 'https://soft999.app';
export const LANGS = { ru: '/', uk: '/uk/', en: '/en/' };
const TAG = /<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1>|<(?:"[^"]*"|'[^']*'|[^>"'])+>/gi;
const decode = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, '\u00a0').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const escText = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\u00a0/g, '&nbsp;');
const escAttr = s => escText(s).replace(/"/g, '&quot;');

export function translateHtml(html, lang) {
  const dict = dictionaries[lang];
  const t = raw => {
    const text = decode(raw), source = text.trim(), value = dict?.[source];
    return value === undefined ? null : text.match(/^\s*/)[0] + value + text.match(/\s*$/)[0];
  };
  let out = '', last = 0;
  let frozen = false; // text directly inside a data-no-i18n element
  const pushText = raw => { const value = frozen ? null : t(raw); out += value === null ? raw : escText(value); };
  for (const m of html.matchAll(TAG)) {
    pushText(html.slice(last, m.index)); last = m.index + m[0].length;
    frozen = /\sdata-no-i18n\b/.test(m[0]);
    out += /^<(?:!|script\b|style\b)/i.test(m[0]) ? m[0] : m[0].replace(/\s(placeholder|aria-label|title|content|alt)="([^"]*)"/g, (all, name, raw) => {
      const value = t(raw); return value === null ? all : ` ${name}="${escAttr(value)}"`;
    });
  }
  pushText(html.slice(last));
  return out;
}
const strip = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export function renderPage(source, lang, config) {
  let html = lang === 'ru' ? source : translateHtml(source, lang);
  const url = SITE + LANGS[lang];
  const get = re => decode(html.match(re)?.[1] || '');
  const title = get(/<title>([^<]*)<\/title>/), description = get(/<meta name="description" content="([^"]*)"/);
  const og = lang === 'ru' ? 'og.jpg' : `og-${lang}.jpg`;
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
    .replace(/assets\/media\/([\w-]+)-ru\./g, `assets/media/$1-${lang}.`)
    .replace(/\b(href|src|poster)="(?!https?:|\/|#|mailto:|data:)([^"]+)"/g, '$1="/$2"')
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
    .replace(/(<meta property="og:image" content=")[^"]*/, `$1${SITE}/assets/media/${og}`);
  const faq = [...html.matchAll(/<details><summary>([\s\S]*?)<span>\+<\/span><\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map(([, q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } }));
  const videoName = strip(html.match(/id="how"[\s\S]*?<h2>([\s\S]*?)<\/h2>/)[1]), videoText = strip(html.match(/id="how"[\s\S]*?<\/h2><\/div><p>([\s\S]*?)<\/p>/)[1]);
  const graph = [
    { '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: 'Soft 99.9', inLanguage: Object.keys(LANGS) },
    { '@type': 'SoftwareApplication', '@id': SITE + '/#app', name: 'Soft 99.9', description, url, inLanguage: lang, applicationCategory: 'BusinessApplication', operatingSystem: 'Windows 10, Windows 11', softwareVersion: config.version, downloadUrl: config.downloadUrl, image: `${SITE}/assets/media/${og}`, screenshot: ['accounts', 'topics', 'channels', 'comments'].map(k => `${SITE}/assets/media/ui-${k}-${lang}.png`),
      offers: [{ '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'EUR', url: url + '#pricing' }, { '@type': 'Offer', name: 'Pro', price: '4', priceCurrency: 'EUR', url: url + '#pricing' }] },
    { '@type': 'VideoObject', name: 'Soft 99.9 — ' + videoName, description: videoText, thumbnailUrl: `${SITE}/assets/media/explainer-${lang}.jpg`, contentUrl: `${SITE}/assets/media/explainer-${lang}.mp4`, uploadDate: '2026-11-23T12:00:00+02:00', duration: 'PT26S', inLanguage: lang },
    { '@type': 'FAQPage', url, inLanguage: lang, mainEntity: faq },
  ];
  const head = [
    `<link rel="canonical" href="${url}">`,
    ...Object.entries(LANGS).map(([l, p]) => `<link rel="alternate" hreflang="${l}" href="${SITE + p}">`),
    `<link rel="alternate" hreflang="x-default" href="${SITE}/">`,
    `<meta property="og:locale" content="${{ ru: 'ru_RU', uk: 'uk_UA', en: 'en_US' }[lang]}"><meta property="og:site_name" content="Soft 99.9">`,
    `<meta name="twitter:title" content="${escAttr(title)}"><meta name="twitter:image" content="${SITE}/assets/media/${og}">`,
    `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`,
  ].join('');
  if (!html.includes('</head>') || !title || !description || faq.length < 5) throw new Error('Unexpected page structure: ' + lang);
  return html.replace('</head>', () => head + '</head>');
}

export const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
export const sitemap = today => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  Object.values(LANGS).map(p => `  <url>\n    <loc>${SITE + p}</loc>\n    <lastmod>${today}</lastmod>\n` + Object.entries(LANGS).map(([l, q]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE + q}"/>\n`).join('') + `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>\n  </url>\n`).join('') + '</urlset>\n';
