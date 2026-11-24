import test from 'node:test';
import assert from 'node:assert/strict';
import { createTracker, eventLabel, isReturn, visitSource } from '../src/analytics.js';
import { funnelRows } from '../src/stats.js';
const at = href => new URL(href);
test('source: UTM, referrer, own pages and sign-in providers', () => {
  assert.deepEqual(visitSource(at('https://soft999.app/?utm_source=TG&utm_campaign=post1'), 'https://google.com/'), { source: 'tg', campaign: 'post1' });
  assert.deepEqual(visitSource(at('https://soft999.app/'), 'https://www.google.com/search?q=secret'), { source: 'google.com', campaign: null });
  for (const own of ['https://soft999.app/uk/', 'https://accounts.google.com/x', 'https://abc.supabase.co/', '', 'junk']) assert.equal(visitSource(at('https://soft999.app/'), own).source, null);
  assert.equal(visitSource(at('https://soft999.app/?utm_source=<script>'), '').source, null);
});
test('returns from sign-in are not new visits; labels never carry free text', () => {
  for (const url of ['?code=abc', '?error=denied', '#access_token=x', '#error=x']) assert.equal(isReturn(at('https://soft999.app/' + url)), true);
  for (const url of ['', '#pricing', '#account', '?utm_source=x']) assert.equal(isReturn(at('https://soft999.app/' + url)), false);
  assert.equal(eventLabel({ placement: 'hero' }), 'hero'); assert.equal(eventLabel({ item: 3 }), '3');
  assert.equal(eventLabel({ code: 'user@example.com' }), null); assert.equal(eventLabel(), null);
});
function setup({ href = 'https://soft999.app/', rejected = false, nav = {}, store = {} } = {}) {
  const calls = [];
  const win = { location: { href }, document: { referrer: 'https://t.me/', documentElement: { lang: 'uk' } }, navigator: { userAgent: 'Windows', ...nav }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } } };
  const tracker = createTracker({ supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'public' }, { local: false, rejected: () => rejected, win, fetcher: async (url, options) => { calls.push({ url, ...options, body: JSON.parse(options.body) }); } });
  return { tracker, calls, store };
}
test('events: public key, no credentials, whitelisted names, source only on page view', () => {
  const { tracker, calls } = setup();
  tracker.view(); tracker.track('download_click', { placement: 'hero' }); tracker.track('unknown'); tracker.track('opt_out');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, { p_name: 'page_view', p_label: null, p_lang: 'uk', p_device: 'desktop', p_source: 't.me', p_campaign: null });
  assert.deepEqual(calls[1].body, { p_name: 'download_click', p_label: 'hero', p_lang: 'uk', p_device: 'desktop' });
  assert.equal(calls[0].credentials, 'omit'); assert.equal(calls[0].headers.Authorization, undefined);
});
test('refusal, GPC, DNT and owner exclusion send nothing', () => {
  for (const options of [{ rejected: true }, { nav: { globalPrivacyControl: true } }, { nav: { doNotTrack: '1' } }, { href: 'https://soft999.app/?notrack=1' }, { store: { 'soft999.notrack': '1' } }]) {
    const { tracker, calls } = setup(options); tracker.view(); tracker.track('faq_open'); assert.equal(calls.length, 0);
  }
  const { tracker, calls } = setup({ rejected: true }); tracker.optOut(); assert.equal(calls[0].body.p_name, 'opt_out');
  const back = setup({ href: 'https://soft999.app/?notrack=0', store: { 'soft999.notrack': '1' } }); back.tracker.view(); assert.equal(back.calls.length, 1);
});
test('funnel rows: share of the first step, losses never negative, empty data', () => {
  assert.deepEqual(funnelRows([['a', 10], ['b', 4], ['c', 5]]), [{ label: 'a', value: 10, share: 100, lost: 0 }, { label: 'b', value: 4, share: 40, lost: 6 }, { label: 'c', value: 5, share: 50, lost: 0 }]);
  assert.equal(funnelRows([['a', 0], ['b', 0]])[1].share, 0);
});
