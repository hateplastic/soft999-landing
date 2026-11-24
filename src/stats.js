// Owner statistics, opened with /#stats after sign-in. The server decides who may read them.
const WANTED = 'soft999.stats';
const SECTIONS = { how: 'Как это работает', start: 'Как начать', features: 'Возможности', flow: 'Функции', local: 'Локальная работа', pricing: 'Тарифы', safety: 'Безопасность файла', faq: 'Вопросы', support: 'Поддержка' };
const EVENTS = { download_click: 'Скачать', download_mobile: 'Скачать с телефона', releases_click: 'История версий', faq_open: 'Открыл вопрос №', support_click: 'Поддержка', pro_interest: 'Интерес к Pro', copy_desktop_link: 'Скопировал ссылку', account_open: 'Открыл вход', auth_submit: 'Отправил форму', auth_error: 'Ошибка входа', google_start: 'Вход через Google', sign_up: 'Регистрация', login: 'Вошёл', telegram_link_start: 'Начал привязку Telegram', telegram_linked: 'Привязал Telegram', pro_checkout_click: 'К оплате Pro', video: 'Видео' };

// Each row is compared with the first one (reach) and, in the accounts funnel, with the previous one.
export function funnelRows(steps) {
  const first = steps[0]?.[1] || 0;
  return steps.map(([label, value], index) => {
    const previous = index ? steps[index - 1][1] : value;
    return { label, value, share: first ? Math.round(value / first * 100) : 0, lost: Math.max(0, previous - value) };
  });
}
const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
function funnel(title, note, steps, losses) {
  const box = node('section', undefined, 'stats-block'); box.append(node('h3', title), node('p', note, 'fine'));
  for (const row of funnelRows(steps)) {
    const line = node('div', undefined, 'stats-row'), bar = node('span', undefined, 'stats-bar');
    bar.style.width = Math.min(100, row.share) + '%';
    line.append(bar, node('span', row.label, 'stats-label'), node('strong', `${row.value} · ${row.share}%${losses && row.lost ? ` · −${row.lost}` : ''}`));
    box.append(line);
  }
  return box;
}
function table(title, head, rows) {
  const box = node('section', undefined, 'stats-block'); box.append(node('h3', title));
  if (!rows.length) { box.append(node('p', 'Пока нет данных.', 'fine')); return box; }
  const wrap = node('div', undefined, 'stats-scroll'), grid = node('table'), top = node('tr');
  for (const name of head) top.append(node('th', name));
  grid.append(top);
  for (const row of rows) { const line = node('tr'); for (const cell of row) line.append(node('td', String(cell ?? ''))); grid.append(line); }
  wrap.append(grid); box.append(wrap); return box;
}
export function renderStats(root, data) {
  const s = data.site, a = data.accounts;
  root.replaceChildren(
    funnel('Сайт', 'Доля от всех визитов. Один человек в течение суток (UTC) считается одним визитом.', [['Зашли на сайт', s.visits], ['Прокрутили ниже первого экрана', s.scrolled], ['Досмотрели видео до середины', s.watched], ['Нажали «Скачать» на компьютере', s.download], ['Нажали «Скачать» с телефона', s.mobileDownload], ['Открыли вход', s.account], ['Зарегистрировались на сайте', s.signUp], ['Нажали на Pro', s.pro], ['Перешли к оплате', s.checkout]], false),
    funnel('Аккаунты', `Кто зарегистрировался за период и докуда дошёл. Новых установок программы: ${data.app.firstOpen}.`, [['Зарегистрировались', a.registered], ['Подтвердили почту', a.confirmed], ['Вошли в программу', a.launched], ['Подключили Telegram или X', a.connected], ['Отправили первый комментарий Telegram', a.sent], ['Оплатили Pro', a.paid]], true),
    table('Откуда приходят', ['Источник', 'Кампания', 'Визиты', 'Скачать', 'Регистрации'], data.sources.map(x => [x.source, x.campaign || '—', x.visits, x.download, x.signUp])),
    table('Докуда дочитали', ['Раздел', 'Визиты', '%'], Object.keys(SECTIONS).map(id => [SECTIONS[id], data.sections[id] || 0, s.visits ? Math.round((data.sections[id] || 0) / s.visits * 100) + '%' : '—'])),
    table('Что нажимали', ['Действие', 'Где / что', 'Визиты'], data.clicks.map(x => [EVENTS[x.name] || x.name, x.label || '—', x.visits])),
    table('По дням', ['День', 'Визиты', 'Скачать', 'Регистрации'], [...data.daily].reverse().map(x => [x.day, x.visits, x.download, x.signUp])),
    table('Устройства и языки', ['Тип', 'Визиты'], [...Object.entries(data.devices), ...Object.entries(data.langs)])
  );
}
export function initStats(api, getToken) {
  try { if (location.hash === '#stats') sessionStorage.setItem(WANTED, '1'); } catch {}
  const wanted = () => { try { return sessionStorage.getItem(WANTED) === '1'; } catch { return false; } };
  let dialog;
  async function load(days) {
    const body = dialog.querySelector('.stats-body'); body.replaceChildren(node('p', 'Загружаем…'));
    try { renderStats(body, await api.stats(await getToken(), days)); }
    catch (e) { body.replaceChildren(node('p', e.status === 403 || e.code === '42501' ? 'У этого аккаунта нет доступа к статистике.' : e.code === 'PGRST202' ? 'Статистика ещё не установлена в базе.' : 'Не удалось загрузить статистику. Попробуй ещё раз.')); }
  }
  return {
    wanted,
    async show() {
      if (!wanted()) return;
      try { sessionStorage.removeItem(WANTED); } catch {}
      if (!dialog) {
        dialog = node('dialog', undefined, 'stats-dialog'); dialog.setAttribute('data-no-i18n', ''); dialog.setAttribute('aria-label', 'Статистика');
        const head = node('div', undefined, 'stats-head'), pick = node('select'), close = node('button', '×', 'stats-close');
        for (const [days, label] of [[2, '2 дня'], [7, '7 дней'], [30, '30 дней'], [90, '90 дней']]) { const option = node('option', label); option.value = days; pick.append(option); }
        pick.value = '7'; pick.setAttribute('aria-label', 'Период'); pick.addEventListener('change', () => load(Number(pick.value)));
        close.type = 'button'; close.setAttribute('aria-label', 'Закрыть'); close.addEventListener('click', () => dialog.close());
        head.append(node('h2', 'Статистика'), pick, close); dialog.append(head, node('div', undefined, 'stats-body')); document.body.append(dialog);
      }
      if (!dialog.open) dialog.showModal();
      await load(Number(dialog.querySelector('select').value));
    }
  };
}
