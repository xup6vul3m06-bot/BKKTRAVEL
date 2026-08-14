/**
 * 淨值來源探測腳本
 *
 * 目的：在 GitHub Actions 上實際打幾個候選來源，把「哪個能通、回傳長什麼樣」
 *      印進執行紀錄，再依實測結果決定正式抓取程式要用哪一個。
 *      本機開發環境的對外連線受限，只能在雲端跑。
 *
 * 用法：node scripts/probe-sources.mjs
 */

const CANDIDATES = [
  {
    name: 'TWSE OpenAPI — 個股/ETF 每日收盤',
    url: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
    covers: '0050 / 006208 / 0056 / 00981A'
  },
  {
    name: 'TWSE OpenAPI — ETF 淨值',
    url: 'https://openapi.twse.com.tw/v1/ETFReport/ETFNAV',
    covers: '台灣掛牌 ETF 的實際淨值（非市價）'
  },
  {
    name: 'TWSE OpenAPI — 上市證券基本資料',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L',
    covers: '代碼對名稱'
  },
  {
    name: 'Stooq CSV — 美股 ETF',
    url: 'https://stooq.com/q/l/?s=qqq.us&f=sd2t2ohlcv&h&e=csv',
    covers: 'QQQ / SPY / IVV'
  },
  {
    name: 'Yahoo Finance chart — 美股 ETF',
    url: 'https://query1.finance.yahoo.com/v8/finance/chart/QQQ?range=5d&interval=1d',
    covers: 'QQQ / SPY / IVV（備援）'
  },
  {
    name: '境外基金資訊觀測站 — 首頁可達性',
    url: 'https://announce.fundclear.com.tw/MOPSFundWeb/',
    covers: '境外基金淨值（安聯／聯博／貝萊德等）'
  },
  {
    name: '投信投顧公會 — 首頁可達性',
    url: 'https://www.sitca.org.tw/',
    covers: '境內基金淨值'
  }
];

const UA = 'Mozilla/5.0 (compatible; fund-report-nav-bot/1.0)';

async function probe(c) {
  const started = Date.now();
  try {
    const res = await fetch(c.url, {
      headers: { 'User-Agent': UA, Accept: '*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(25000)
    });
    const ct = res.headers.get('content-type') || '(none)';
    const cors = res.headers.get('access-control-allow-origin') || '(none)';
    const body = await res.text();
    const ms = Date.now() - started;

    console.log(`\n=== ${c.name}`);
    console.log(`    用途 : ${c.covers}`);
    console.log(`    URL  : ${c.url}`);
    console.log(`    狀態 : ${res.status} ${res.statusText}  (${ms}ms)`);
    console.log(`    型別 : ${ct}`);
    console.log(`    CORS : ${cors}`);
    console.log(`    大小 : ${body.length} bytes`);

    if (!res.ok) {
      console.log(`    ---- 前 300 字 ----\n${body.slice(0, 300)}`);
      return;
    }

    if (ct.includes('json')) {
      try {
        const data = JSON.parse(body);
        if (Array.isArray(data)) {
          console.log(`    陣列長度: ${data.length}`);
          console.log(`    第一筆   : ${JSON.stringify(data[0])}`);
          // 找出我們真正要的幾檔
          const want = ['0050', '006208', '0056', '00981A'];
          for (const w of want) {
            const hit = data.find((r) => String(r.Code ?? r.code ?? r.證券代號 ?? '').trim() === w);
            if (hit) console.log(`    命中 ${w}: ${JSON.stringify(hit)}`);
          }
        } else {
          console.log(`    物件鍵   : ${Object.keys(data).join(', ')}`);
          console.log(`    節錄     : ${JSON.stringify(data).slice(0, 400)}`);
        }
      } catch (e) {
        console.log(`    JSON 解析失敗: ${e.message}`);
        console.log(`    ---- 前 300 字 ----\n${body.slice(0, 300)}`);
      }
    } else {
      console.log(`    ---- 前 400 字 ----\n${body.slice(0, 400)}`);
    }
  } catch (e) {
    console.log(`\n=== ${c.name}`);
    console.log(`    URL  : ${c.url}`);
    console.log(`    失敗 : ${e.name} — ${e.message}`);
  }
}

console.log('淨值來源探測開始　' + new Date().toISOString());
console.log('Node ' + process.version);

for (const c of CANDIDATES) {
  await probe(c);
}

console.log('\n探測結束。');
