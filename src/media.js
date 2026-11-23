// Locale-specific visuals: hero animation, explainer video and client screenshots.
export function initMedia({ version } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const video = document.querySelector('#explainer');
  const set = (element, name, value) => { if (element.getAttribute(name) !== value) element.setAttribute(name, value); };
  const apply = () => {
    const lang = ['ru', 'uk', 'en'].includes(document.documentElement.lang) ? document.documentElement.lang : 'ru';
    for (const image of document.querySelectorAll('img[data-media]')) {
      const name = image.dataset.media;
      set(image, 'src', `/assets/media/${name}-${lang}.${name === 'hero' ? (reduced.matches ? 'jpg' : 'svg') : 'png'}`);
    }
    for (const link of document.querySelectorAll('[data-media-link]')) set(link, 'href', `/assets/media/ui-${link.dataset.mediaLink}-${lang}.png`);
    if (video) { set(video, 'poster', `/assets/media/explainer-${lang}.jpg`); set(video, 'src', `/assets/media/explainer-${lang}.mp4`); }
  };
  apply();
  new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  reduced.addEventListener('change', apply);
  if (video && 'IntersectionObserver' in window) {
    // Plays once when it comes into view; a visitor's own pause is respected.
    let started = false;
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started && !reduced.matches && !navigator.connection?.saveData) { started = true; video.play().catch(() => {}); }
      else if (!entry.isIntersecting && !video.paused) video.pause();
    }, { threshold: .55 }).observe(video);
  }
  // A scan result belongs to one exact build: hide it as soon as the version moves on.
  for (const block of document.querySelectorAll('[data-check-version]')) block.hidden = block.dataset.checkVersion !== version;
  const button = document.querySelector('[data-copy-hash]');
  button?.addEventListener('click', async () => {
    const status = document.querySelector('#hash-status');
    try { await navigator.clipboard.writeText(document.querySelector('#file-hash').textContent); status.textContent = 'Скопировано'; }
    catch { status.textContent = 'Выдели и скопируй сумму вручную'; }
  });
}
