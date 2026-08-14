/**
 * 每日淨值／收盤價自動更新
 *
 * 在 GitHub Actions 上執行，把抓到的價格寫進 fund-report/data/nav.json，
 * 網站載入時會覆蓋內建的預設值。
 *
 * 為什麼不在瀏覽器裡直接抓：
 *   實測（見 probe-sources 的執行紀錄）證交所 OpenAPI 與 Yahoo Finance
 *   都沒有回傳 Access-Control-Allow-Origin，瀏覽器一定會擋。改由伺服器端
 *   每天抓好存成同網域的 JSON，網站讀自己的檔案就沒有跨網域問題。
 *
 * 涵蓋範圍：
 *   只有「公開掛牌」的 ETF 能自動更新（台股 4 檔 + 美股 3 檔）。
 *   境外基金（安聯／聯博／貝萊德等）沒有可穩定存取的公開來源——
 *   境外基金資訊觀測站在 runner 上連不上，投信投顧公會需要走查詢頁。
 *   這些標的仍需用網站的「貼上更新」維護。
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'data', 'nav.json');

const UA = 'Mozilla/5.0 (compatible; fund-report-nav-bot/1.0; +https://github.com)';

/* 基金 id → 來源。kind 會顯示在網站上，避免把收盤價誤稱為淨值。 */
const SOURCES = [
  { id: 'tw-0050',    via: 'twse',   symbol: '0050',   kind: '收盤價' },
  { id: 'tw-006208',  via: 'twse',   symbol: '006208', kind: '收盤價' },
  { id: 'tw-0056',    via: 'twse',   symbol: '0056',   kind: '收盤價' },
  { id: 'tw-00981a',  via: 'twse',   symbol: '00981A', kind: '收盤價' },
  { id: 'us-qqq',     via: 'yahoo',  symbol: 'QQQ',    kind: '收盤價' },
  { id: 'us-spy',     via: 'yahoo',  symbol: 'SPY',    kind: '收盤價' },
  { id: 'us-ivv',     via: 'yahoo',  symbol: 'IVV',    kind: '收盤價' }
];

function get(url) {
  return fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000)
  });
}

/** 民國日期 1150813 → 2026-08-13 */
function rocToISO(roc) {
  const s = String(roc).trim();
  if (!/^\d{7}$/.test(s)) return null;
  const year = Number(s.slice(0, 3)) + 1911;
  return `${year}-${s.slice(3, 5)}-${s.slice(5, 7)}`;
}

function toNumber(v) {
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

async function fetchTWSE(wanted) {
  const url = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
  const res = await get(url);
  if (!res.ok) throw new Error(`證交所回應 ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('證交所回傳的不是陣列');

  const byCode = new Map();
  for (const r of rows) byCode.set(String(r.Code).trim(), r);

  const out = {};
  for (const s of wanted) {
    const row = byCode.get(s.symbol);
    if (!row) { out[s.id] = { error: `證交所今日資料查無 ${s.symbol}` }; continue; }
    const price = toNumber(row.ClosingPrice);
    const date = rocToISO(row.Date);
    if (price === null || !date) { out[s.id] = { error: `${s.symbol} 價格或日期無法解析` }; continue; }
    out[s.id] = { price, date, currency: 'TWD', kind: s.kind, source: '臺灣證券交易所 OpenAPI', symbol: s.symbol };
  }
  return out;
}

async function fetchYahoo(s) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.symbol)}?range=5d&interval=1d`;
  const res = await get(url);
  if (!res.ok) throw new Error(`Yahoo 回應 ${res.status}`);
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error('Yahoo 回傳缺少 meta');

  const price = toNumber(meta.regularMarketPrice);
  if (price === null) throw new Error('Yahoo 缺少 regularMarketPrice');

  /* regularMarketTime 是該市場收盤的 epoch 秒，轉成當地交易日 */
  const date = meta.regularMarketTime
    ? new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return { price, date, currency: meta.currency || 'USD', kind: s.kind, source: 'Yahoo Finance', symbol: s.symbol };
}

async function main() {
  const quotes = {};
  const problems = [];

  const twse = SOURCES.filter((s) => s.via === 'twse');
  try {
    Object.assign(quotes, await fetchTWSE(twse));
  } catch (e) {
    for (const s of twse) problems.push(`${s.symbol}: ${e.message}`);
    console.error('證交所整批失敗：', e.message);
  }

  for (const s of SOURCES.filter((x) => x.via === 'yahoo')) {
    try {
      quotes[s.id] = await fetchYahoo(s);
    } catch (e) {
      problems.push(`${s.symbol}: ${e.message}`);
      console.error(`${s.symbol} 失敗：`, e.message);
    }
  }

  /* 把個別失敗的項目濾掉，只保留真的抓到價格的 */
  for (const [id, q] of Object.entries(quotes)) {
    if (q.error) { problems.push(`${id}: ${q.error}`); delete quotes[id]; }
  }

  const ok = Object.keys(quotes).length;
  if (ok === 0) {
    console.error('\n沒有任何一檔更新成功，不覆寫既有檔案。');
    process.exit(1);
  }

  /* 只在價格有變動時才改寫，避免每天產生無意義的 commit */
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* 首次執行 */ }

  const payload = {
    updatedAt: new Date().toISOString(),
    note: '僅涵蓋公開掛牌 ETF。境外基金無可穩定存取的公開來源，請用網站的「貼上更新」維護。',
    problems,
    quotes
  };

  const sameQuotes = previous && JSON.stringify(previous.quotes) === JSON.stringify(quotes);
  if (sameQuotes) {
    console.log(`價格與上次相同（${ok} 檔），維持原檔不變。`);
    return;
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log(`\n已更新 ${ok} 檔：`);
  for (const [id, q] of Object.entries(quotes)) {
    console.log(`  ${id.padEnd(12)} ${q.symbol.padEnd(8)} ${String(q.price).padStart(9)} ${q.currency}  ${q.date}  (${q.source})`);
  }
  if (problems.length) console.log(`\n未更新 ${problems.length} 項：\n  ` + problems.join('\n  '));
}

await main();
