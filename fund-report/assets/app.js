/* =============================================================================
   基金配置建議書產生器 — 主程式
   ========================================================================== */

(function () {
  'use strict';

  var STORE_KEY = 'fundAdvisor.v2';
  var HORIZONS = [1, 3, 5, 7, 10];
  var SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
                'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];

  /* ---------------------------------------------------------------- 工具 -- */

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function h(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function num(v)  { return Math.round(v).toLocaleString('en-US'); }
  function nt(v)   { return 'NT$ ' + num(v); }
  function pct(v, d) { return (v === null || v === undefined || isNaN(v)) ? '—' : v.toFixed(d === undefined ? 2 : d) + '%'; }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function fmtDate(iso) {
    if (!iso) return '—';
    var p = String(iso).split('-');
    return p.length === 3 ? (p[1].replace(/^0/, '') + '/' + p[2].replace(/^0/, '')) : iso;
  }
  function fmtDateFull(iso) {
    if (!iso) return '—';
    var p = String(iso).split('-');
    return p.length === 3 ? (p[0] + '/' + p[1] + '/' + p[2]) : iso;
  }

  /* --------------------------------------------------------------- 狀態 -- */

  var state = {
    meta: null,
    funds: null,
    plan: {
      client: '', advisor: '', planName: '平衡型策略',
      amount: 10000000, fx: 29.5, mode: 'total',
      items: []
    },
    ui: { cat: 'all', q: '', rr: 'all', payout: 'all', sortKey: 'cat', sortDir: 1, tab: 'compare' }
  };

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  function loadState() {
    state.meta  = deepCopy(window.DEFAULT_META);
    state.funds = deepCopy(window.DEFAULT_FUNDS);
    var raw;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
    if (!raw) return;
    try {
      var s = JSON.parse(raw);
      if (s.meta)  Object.assign(state.meta, s.meta);
      if (s.plan)  Object.assign(state.plan, s.plan);
      if (s.funds && s.funds.length) mergeFunds(s.funds);
    } catch (e) {
      console.warn('儲存的資料無法解析，已改用預設值', e);
    }
  }

  /* 只覆寫使用者改過的欄位，新版預設資料庫新增的基金仍會出現 */
  function mergeFunds(saved) {
    var byId = {};
    state.funds.forEach(function (f) { byId[f.id] = f; });
    saved.forEach(function (s) {
      if (byId[s.id]) Object.assign(byId[s.id], s);
      else state.funds.push(s);
    });
  }

  var saveTimer = null;
  function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
          meta: state.meta, plan: state.plan, funds: state.funds
        }));
      } catch (e) { /* 隱私模式或容量已滿時忽略，功能不受影響 */ }
    }, 250);
  }

  /* ==========================================================================
     自動更新的價格
     -----------------------------------------------------------------------
     由 GitHub Actions 每日抓取後寫入 data/nav.json（同網域，沒有跨網域問題）。
     單一檔案版本則由打包程式把同一份資料塞成 window.NAV_SNAPSHOT。
     兩者都拿不到時就沿用 funds.js 的內建值，功能不受影響。
     ====================================================================== */

  /* 手動改過的值就不再是自動抓來的，標記必須拿掉，否則畫面會說謊。
     （下一次自動更新仍會覆蓋這幾檔掛牌 ETF，這是每日更新的預期行為。）*/
  function clearAutoTag(f) {
    delete f.navSource;
    delete f.navKind;
  }

  function applyNavSnapshot(snap) {
    if (!snap || !snap.quotes) return 0;
    var n = 0;
    Object.keys(snap.quotes).forEach(function (id) {
      var q = snap.quotes[id];
      var f = fundById(id);
      if (!f || typeof q.price !== 'number') return;
      f.nav = q.price;
      f.navDate = q.date;
      f.navKind = q.kind || '收盤價';
      f.navSource = q.source || '自動更新';
      n++;
    });
    state.meta.navAuto = { updatedAt: snap.updatedAt, count: n, problems: snap.problems || [] };
    /* 自動更新的日期比手動填的可靠，讓文件基準日跟著走 */
    var dates = Object.keys(snap.quotes)
      .map(function (k) { return snap.quotes[k].date; })
      .filter(Boolean).sort();
    if (dates.length) state.meta.navAsOf = dates[dates.length - 1];
    return n;
  }

  function loadNavSnapshot() {
    if (window.NAV_SNAPSHOT) {
      applyNavSnapshot(window.NAV_SNAPSHOT);
      return Promise.resolve(true);
    }
    /* file:// 沒有同網域可言，直接跳過，不要在主控台留下嚇人的錯誤 */
    if (location.protocol === 'file:') return Promise.resolve(false);

    return fetch('data/nav.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (snap) { return applyNavSnapshot(snap) > 0; })
      ['catch'](function () { return false; });
  }

  function renderNavStatus() {
    var host = $('#navStatus');
    if (!host) return;
    host.textContent = '';
    var auto = state.meta.navAuto;
    if (!auto || !auto.count) {
      host.appendChild(h('span', { class: 'dot dot--idle' }));
      host.appendChild(h('span', { text: '目前使用內建淨值。放上 GitHub Pages 後，每日自動更新才會生效。' }));
      return;
    }
    var when = new Date(auto.updatedAt);
    host.appendChild(h('span', { class: 'dot' }));
    host.appendChild(h('span', {
      text: '已自動更新 ' + auto.count + ' 檔掛牌 ETF 的收盤價　·　最後更新 ' +
            when.getFullYear() + '/' + (when.getMonth() + 1) + '/' + when.getDate() + ' ' +
            String(when.getHours()).padStart(2, '0') + ':' + String(when.getMinutes()).padStart(2, '0')
    }));
    if (auto.problems && auto.problems.length) {
      host.appendChild(h('span', { class: 'muted', text: '（' + auto.problems.length + ' 項未更新）' }));
    }
  }

  function fundById(id) {
    for (var i = 0; i < state.funds.length; i++) if (state.funds[i].id === id) return state.funds[i];
    return null;
  }
  function catName(id) {
    var c = window.CATEGORIES.filter(function (x) { return x.id === id; })[0];
    return c ? c.name : id;
  }

  /* ==========================================================================
     計算模型
     ====================================================================== */

  /* 取某年期的年化報酬率；缺該年期時沿用最接近的可得年期並回報是否為替代值 */
  function returnFor(f, n) {
    var r = f.returns || {};
    if (r[n] !== undefined && r[n] !== null) return { value: r[n], exact: true };
    var keys = Object.keys(r).map(Number).filter(function (k) { return !isNaN(k) && r[k] !== null; }).sort(function (a, b) { return a - b; });
    if (!keys.length) return { value: 0, exact: false };
    var pick = keys[0];
    keys.forEach(function (k) { if (k <= n) pick = k; });
    return { value: r[pick], exact: false, from: pick };
  }

  function planItems() {
    return state.plan.items
      .map(function (it) {
        var f = fundById(it.id);
        return f ? { id: it.id, weight: Number(it.weight) || 0, fund: f } : null;
      })
      .filter(Boolean);
  }

  function compute() {
    var items = planItems();
    var amount = Number(state.plan.amount) || 0;
    var wsum = items.reduce(function (s, it) { return s + it.weight; }, 0);
    var res = {
      items: [], amount: amount, weightSum: wsum,
      annualIncome: 0, monthlyIncome: 0, weightedYield: 0, weightedRR: 0,
      projections: [], approxUsed: false, mode: state.plan.mode
    };
    if (!items.length || wsum <= 0) return res;

    items.forEach(function (it, i) {
      var amt = amount * (it.weight / wsum);
      var f = it.fund;
      var y = Number(f.yield) || 0;
      var income = amt * y / 100;
      res.annualIncome += income;
      res.weightedYield += (it.weight / wsum) * y;
      res.weightedRR += (it.weight / wsum) * (Number(f.rr) || 0);
      res.items.push({
        id: it.id, fund: f, weight: it.weight,
        share: it.weight / wsum, amount: amt,
        annualIncome: income, monthlyIncome: income / 12,
        color: i < SERIES.length ? SERIES[i] : 'var(--c-ink-3)'
      });
    });
    res.monthlyIncome = res.annualIncome / 12;

    HORIZONS.forEach(function (n) {
      var capital = 0, cumIncome = 0;
      res.items.forEach(function (row) {
        var r = returnFor(row.fund, n);
        if (!r.exact) res.approxUsed = true;
        var total = r.value / 100;
        if (state.plan.mode === 'total') {
          capital += row.amount * Math.pow(1 + total, n);
        } else {
          var g = total - (Number(row.fund.yield) || 0) / 100;
          capital += row.amount * Math.pow(1 + g, n);
          cumIncome += row.annualIncome * n;
        }
      });
      res.projections.push({
        years: n, capital: capital, cumIncome: cumIncome,
        total: capital + cumIncome,
        gain: capital + cumIncome - amount,
        cagr: amount > 0 ? (Math.pow((capital + cumIncome) / amount, 1 / n) - 1) * 100 : 0
      });
    });
    return res;
  }

  function projAt(res, years) {
    for (var i = 0; i < res.projections.length; i++) if (res.projections[i].years === years) return res.projections[i];
    return null;
  }

  /* 依欄位彙總（資產類別 / 投資區域 / 幣別） */
  function groupBy(res, key) {
    var map = {}, order = [];
    res.items.forEach(function (row) {
      var k = row.fund[key] || '其他';
      if (!(k in map)) { map[k] = 0; order.push(k); }
      map[k] += row.amount;
    });
    return order
      .map(function (k) { return { label: k, value: map[k] }; })
      .sort(function (a, b) { return b.value - a.value; })
      .map(function (s, i) { s.color = i < SERIES.length ? SERIES[i] : 'var(--c-ink-3)'; return s; });
  }

  /* ==========================================================================
     基金比較
     ====================================================================== */

  function filteredFunds() {
    var u = state.ui;
    var q = u.q.trim().toLowerCase();
    var list = state.funds.filter(function (f) {
      if (u.cat !== 'all' && f.cat !== u.cat) return false;
      if (u.rr !== 'all' && String(f.rr) !== u.rr) return false;
      if (u.payout === 'income' && f.payout === '累積') return false;
      if (u.payout === 'accum' && f.payout !== '累積') return false;
      if (!q) return true;
      var hay = (f.name + ' ' + f.short + ' ' + f.direction + ' ' +
        (f.holdings || []).map(function (x) { return x.name; }).join(' ')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });

    var key = u.sortKey, dir = u.sortDir;
    var catOrder = {};
    window.CATEGORIES.forEach(function (c, i) { catOrder[c.id] = i; });

    list.sort(function (a, b) {
      var av, bv;
      switch (key) {
        case 'name':  return a.name.localeCompare(b.name, 'zh-Hant') * dir;
        case 'nav':   av = a.nav === null ? -1 : a.nav; bv = b.nav === null ? -1 : b.nav; break;
        case 'rr':    av = a.rr; bv = b.rr; break;
        case 'yield': av = a.yield || 0; bv = b.yield || 0; break;
        case 'r1':    av = returnFor(a, 1).value; bv = returnFor(b, 1).value; break;
        case 'r5':    av = returnFor(a, 5).value; bv = returnFor(b, 5).value; break;
        default:      av = catOrder[a.cat]; bv = catOrder[b.cat];
          if (av === bv) return a.name.localeCompare(b.name, 'zh-Hant');
      }
      return (av - bv) * dir;
    });
    return list;
  }

  function holdingsHTML(f) {
    if (!f.holdings || !f.holdings.length) return '<span class="muted">—</span>';
    var s = f.holdings.map(function (x, i) {
      return (i + 1) + ' ' + esc(x.name) + ' <b>' + x.weight.toFixed(2) + '%</b>';
    }).join('｜');
    return s + ' <span class="as-of">（' + fmtDate(f.holdingsDate) + '）</span>';
  }

  function navHTML(f) {
    if (f.nav === null || f.nav === undefined) return '<span class="muted">待平台核對</span>';
    var tag = f.navSource ? '<br><span class="src-tag">自動・' + esc(f.navKind || '收盤價') + '</span>' : '';
    return '<b>' + f.nav.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) +
           '</b> ' + f.currency + '<br><span class="muted">' + fmtDate(f.navDate) + '</span>' + tag;
  }

  function renderCompare() {
    var host = $('#compareTable');
    var list = filteredFunds();
    host.textContent = '';

    $('#compareCount').textContent = '符合條件 ' + list.length + ' 檔／全部 ' + state.funds.length + ' 檔';

    if (!list.length) {
      host.appendChild(h('div', { class: 'empty', text: '沒有符合條件的基金，請放寬篩選條件。' }));
      return;
    }

    var cols = [
      { key: 'name',  label: '基金／ETF', sortable: true },
      { key: 'nav',   label: '最新淨值・日期', sortable: true, num: true },
      { key: 'rr',    label: 'RR', sortable: true },
      { key: 'yield', label: '年化配息率', sortable: true, num: true },
      { key: 'r1',    label: '近1年', sortable: true, num: true },
      { key: 'r5',    label: '近5年', sortable: true, num: true },
      { key: 'hold',  label: '前五大標的與占比（持股日）' },
      { key: 'act',   label: '' }
    ];

    var thead = h('thead', {}, [h('tr', {}, cols.map(function (c) {
      var th = h('th', { class: c.num ? 'num' : '' }, [c.label]);
      if (c.sortable) {
        th.classList.add('sortable');
        th.setAttribute('role', 'button');
        th.setAttribute('tabindex', '0');
        var active = state.ui.sortKey === c.key;
        if (active) th.textContent = c.label + (state.ui.sortDir > 0 ? ' ▲' : ' ▼');
        var doSort = function () {
          if (state.ui.sortKey === c.key) state.ui.sortDir *= -1;
          else { state.ui.sortKey = c.key; state.ui.sortDir = c.key === 'name' ? 1 : -1; }
          renderCompare();
        };
        th.addEventListener('click', doSort);
        th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doSort(); } });
      }
      return th;
    }))]);

    var picked = {};
    state.plan.items.forEach(function (it) { picked[it.id] = true; });

    var tbody = h('tbody', {}, list.map(function (f) {
      var r1 = returnFor(f, 1), r5 = returnFor(f, 5);
      var tr = h('tr', { class: picked[f.id] ? 'is-picked' : '' }, [
        h('td', {}, [
          h('div', { class: 'fund-name', text: f.name }),
          h('div', { class: 'fund-meta', text: catName(f.cat) + '｜' + f.assetClass + '｜' + f.region + '｜' + f.payout + '｜' + f.direction })
        ]),
        h('td', { class: 'num', html: navHTML(f) }),
        h('td', {}, [h('span', { class: 'pill pill--rr' + f.rr, text: 'RR' + f.rr })]),
        h('td', { class: 'num', html: f.yield ? '<span class="assumed" title="假設值，請於資料維護分頁核對">' + f.yield.toFixed(2) + '%</span>' : '<span class="muted">累積</span>' }),
        h('td', { class: 'num ' + (r1.value >= 0 ? 'val-up' : 'val-down'), text: pct(r1.value, 1) + (r1.exact ? '' : '*') }),
        h('td', { class: 'num ' + (r5.value >= 0 ? 'val-up' : 'val-down'), text: pct(r5.value, 1) + (r5.exact ? '' : '*') }),
        h('td', { class: 'holdings-inline', html: holdingsHTML(f) }),
        h('td', {}, [
          h('button', {
            class: 'btn btn--sm' + (picked[f.id] ? '' : ' btn--primary'),
            text: picked[f.id] ? '已加入' : '加入配置',
            disabled: picked[f.id] ? 'disabled' : null,
            onclick: function () { addToPlan(f.id); }
          })
        ])
      ]);
      return tr;
    }));

    host.appendChild(h('table', { class: 'data' }, [thead, tbody]));
  }

  /* ==========================================================================
     配置試算
     ====================================================================== */

  function addToPlan(id) {
    if (state.plan.items.some(function (it) { return it.id === id; })) return;
    var used = state.plan.items.reduce(function (s, it) { return s + (Number(it.weight) || 0); }, 0);
    var w = Math.max(0, Math.min(100 - used, used === 0 ? 100 : 10));
    state.plan.items.push({ id: id, weight: w || 10 });
    saveState();
    renderAll();
    flash('已加入「' + fundById(id).short + '」，請於「配置試算」調整比例。');
  }

  function removeFromPlan(id) {
    state.plan.items = state.plan.items.filter(function (it) { return it.id !== id; });
    saveState();
    renderAll();
  }

  function equalize() {
    var n = state.plan.items.length;
    if (!n) return;
    var base = Math.floor((100 / n) * 100) / 100;
    state.plan.items.forEach(function (it) { it.weight = base; });
    var diff = Math.round((100 - base * n) * 100) / 100;
    state.plan.items[0].weight = Math.round((base + diff) * 100) / 100;
    saveState();
    renderAll();
  }

  function normalize() {
    var sum = state.plan.items.reduce(function (s, it) { return s + (Number(it.weight) || 0); }, 0);
    if (sum <= 0) return;
    state.plan.items.forEach(function (it) { it.weight = Math.round((it.weight / sum) * 10000) / 100; });
    var after = state.plan.items.reduce(function (s, it) { return s + it.weight; }, 0);
    state.plan.items[0].weight = Math.round((state.plan.items[0].weight + (100 - after)) * 100) / 100;
    saveState();
    renderAll();
  }

  /* 累積型沒有現金流，寫 NT$ 0 會被誤讀為「配息掛零」 */
  function allocAmtText(row) {
    if (!row) return '';
    return nt(row.amount) + '　月配 ' + (row.monthlyIncome > 0 ? nt(row.monthlyIncome) : '—（累積型）');
  }

  function renderAllocRows(res) {
    var host = $('#allocRows');
    host.textContent = '';
    if (!state.plan.items.length) {
      host.appendChild(h('div', { class: 'empty', text: '尚未選擇標的。請到「基金比較」分頁挑選，或直接使用下方快速加入。' }));
      return;
    }

    state.plan.items.forEach(function (it, i) {
      var f = fundById(it.id);
      if (!f) return;
      var row = res.items.filter(function (r) { return r.id === it.id; })[0];
      var color = i < SERIES.length ? SERIES[i] : 'var(--ink-3)';

      host.appendChild(h('div', { class: 'alloc-row' }, [
        h('div', { class: 'alloc-row__name' }, [
          h('div', { class: 'fund-name' }, [
            h('span', { class: 'alloc-swatch', style: 'background:' + color }),
            f.name
          ]),
          h('div', { class: 'fund-meta', text: 'RR' + f.rr + '｜' + f.payout + '｜年化配息 ' + pct(f.yield || 0) + '｜' + f.currency })
        ]),
        h('input', {
          class: 'input input--num', type: 'number', min: '0', max: '100', step: '0.5',
          value: it.weight, 'aria-label': f.short + ' 配置比例（%）',
          oninput: function (e) {
            it.weight = Math.max(0, Number(e.target.value) || 0);
            saveState();
            var r = compute();
            renderKPIs(r); renderPreviewCharts(r); renderTotalBar(r);
            $$('.alloc-amt', host).forEach(function (node, idx) {
              node.textContent = allocAmtText(r.items[idx]);
            });
          }
        }),
        h('div', { class: 'alloc-amt', text: allocAmtText(row) }),
        h('button', {
          class: 'icon-btn', title: '移除 ' + f.short, 'aria-label': '移除 ' + f.short,
          text: '✕', onclick: function () { removeFromPlan(it.id); }
        })
      ]));
    });
  }

  function renderTotalBar(res) {
    var bar = $('#totalBar');
    var sum = res.weightSum;
    var off = Math.abs(sum - 100) > 0.01;
    bar.className = 'total-bar' + (off ? ' is-off' : '');
    bar.textContent = '';
    bar.appendChild(h('span', { text: off ? '比例合計（不等於 100%，試算將按相對比重換算）' : '比例合計' }));
    bar.appendChild(h('span', { class: 'num', text: sum.toFixed(2) + '%' }));
  }

  function renderKPIs(res) {
    var host = $('#kpiRow');
    host.textContent = '';
    var p5 = projAt(res, 5), p10 = projAt(res, 10);
    var cards = [
      { label: '預估月領息', value: num(res.monthlyIncome), unit: 'NT$', foot: '加權年化配息率 ' + pct(res.weightedYield), key: true },
      { label: '5年資產預估', value: num(p5 ? p5.total : 0), unit: 'NT$', foot: p5 ? '年化 ' + pct(p5.cagr, 1) : '' },
      { label: '10年資產預估', value: num(p10 ? p10.total : 0), unit: 'NT$', foot: p10 ? '年化 ' + pct(p10.cagr, 1) : '' },
      { label: '加權風險等級', value: 'RR' + (res.weightedRR ? res.weightedRR.toFixed(1) : '—'), foot: '依配置比例加權' },
      { label: '預估年領息', value: num(res.annualIncome), unit: 'NT$', foot: '配息型標的合計' }
    ];
    cards.forEach(function (c) {
      host.appendChild(h('div', { class: 'kpi' + (c.key ? ' kpi--accent' : '') }, [
        h('div', { class: 'kpi__label', text: c.label }),
        h('div', { class: 'kpi__value' }, [c.unit ? h('small', { text: c.unit }) : null, c.value]),
        h('div', { class: 'kpi__foot', text: c.foot })
      ]));
    });
  }

  function renderPreviewCharts(res) {
    var host = $('#previewCharts');
    host.textContent = '';
    if (!res.items.length) {
      host.appendChild(h('div', { class: 'empty', text: '加入標的後即可預覽成長軌跡與配置結構。' }));
      return;
    }

    /* 畫面預覽與建議書用同一套視覺語言，避免「螢幕好看、印出來不一樣」 */
    var areaBox = h('div', { class: 'chart-box' }, [
      h('h4', { text: '預估資產成長軌跡' }),
      h('div', { class: 'chart-sub', text:
        '下層為投入本金，上層為預估獲利　·　' +
        (state.plan.mode === 'total' ? '配息再投入（總報酬）' : '配息領出：本金部位＋累計已領配息') })
    ]);
    var areaMount = h('div', {});
    areaBox.appendChild(areaMount);
    host.appendChild(areaBox);

    var series = growthSeries(res);
    window.Charts.area(areaMount, {
      labels: res.projections.map(function (p) { return p.years + 'Y'; }),
      series: series, width: 820, height: 200
    });
    window.Charts.legend(areaBox, series.map(function (s) { return { label: s.name, color: s.color }; }));
    areaBox.appendChild(milestoneRow(res));

    var spreadBox = h('div', { class: 'chart-box' }, [
      h('h4', { text: '風險分散度' }),
      h('div', { class: 'chart-sub', text: '資產類別、投資區域與幣別的金額占比' })
    ]);
    spreadBox.appendChild(spreadBlock(res));
    host.appendChild(spreadBox);
  }

  function renderAllocate() {
    var res = compute();
    $('#planClient').value  = state.plan.client;
    $('#planAdvisor').value = state.plan.advisor;
    $('#planName').value    = state.plan.planName;
    $('#planAmount').value  = state.plan.amount;
    $('#planFx').value      = state.plan.fx;
    $$('input[name="mode"]').forEach(function (r) { r.checked = r.value === state.plan.mode; });
    renderAllocRows(res);
    renderTotalBar(res);
    renderKPIs(res);
    renderPreviewCharts(res);
    renderQuickAdd();
    return res;
  }

  function renderQuickAdd() {
    var sel = $('#quickAdd');
    var cur = sel.value;
    sel.textContent = '';
    sel.appendChild(h('option', { value: '', text: '＋ 快速加入標的…' }));
    window.CATEGORIES.forEach(function (c) {
      var group = h('optgroup', { label: c.name });
      state.funds.filter(function (f) { return f.cat === c.id; }).forEach(function (f) {
        var used = state.plan.items.some(function (it) { return it.id === f.id; });
        group.appendChild(h('option', { value: f.id, text: (used ? '✓ ' : '') + f.name, disabled: used ? 'disabled' : null }));
      });
      if (group.children.length) sel.appendChild(group);
    });
    sel.value = cur;
  }

  /* ==========================================================================
     建議書（A4）
     ====================================================================== */

  /* 頁尾註記依實際基準日產生，避免與報頭的日期對不起來 */
  function navNote() {
    var auto = state.meta.navAuto;
    return '淨值：截至 ' + fmtDateFull(state.meta.navAsOf) + ' 最新可得' +
           (auto && auto.count ? '（掛牌 ETF 為自動更新收盤價）' : '公告') +
           '｜持股：最近一期公開月報';
  }

  function sheet(children, footNote, pageNo, pageTotal) {
    var body = h('div', { class: 'sheet__body' }, children);
    /* 沒有風險警語的頁面（例如比較表）需要撐開空白，讓頁尾貼齊紙張底部。
       但若頁面本身已有靠 margin-top:auto 沉底的區塊，再塞 spacer 會把空白
       搶走，反而讓那個區塊浮在中間。 */
    if (!body.querySelector('.disclaimer, .tips-close')) {
      body.appendChild(h('div', { style: 'flex:1 1 auto' }));
    }
    var s = h('div', { class: 'sheet' }, [body]);
    s.appendChild(h('div', { class: 'sheet__foot' }, [
      h('span', { text: footNote || navNote() }),
      h('span', { class: 'pageno', text: pageNo && pageTotal ? pageNo + ' / ' + pageTotal : '' })
    ]));
    return s;
  }

  /* 標的數量會撐高版面。內容超過一張 A4 時整頁等比縮到剛好一頁，
     避免最後一段被切到下一頁、或印出一張空白紙。 */
  var A4_PX = 297 / 25.4 * 96;
  var APPENDIX_PER_PAGE = 6;   /* 每頁 2 欄 × 3 列，剛好填滿附錄頁 */

  function fitSheet(s) {
    var body = s.querySelector('.sheet__body');
    if (!body) return;
    body.style.zoom = '';
    for (var pass = 0; pass < 6; pass++) {
      var overflow = s.scrollHeight - A4_PX;
      if (overflow <= 1) break;
      var current = parseFloat(body.style.zoom) || 1;
      var bodyH = body.scrollHeight * current;
      var next = Math.max(0.62, current * (bodyH - overflow) / bodyH);
      body.style.zoom = String(Math.floor(next * 1000) / 1000);
    }
  }

  function mountSheets(host, sheets) {
    host.textContent = '';
    sheets.forEach(function (s) { host.appendChild(s); });
    sheets.forEach(fitSheet);   /* 必須在進入 DOM 之後量測 */
  }


  /* 報頭：客戶名字與「每月可領」是客戶第一眼會看的兩件事，其餘退居其後 */
  function mastHead(res) {
    var now = new Date();
    var stamp = now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate();
    var p5 = projAt(res, 5), p10 = projAt(res, 10);

    return h('div', { class: 'mast' }, [
      h('div', { class: 'mast__id' }, [
        h('div', { class: 'mast__eyebrow', text: '投資配置建議書' }),
        h('div', { class: 'mast__name', text: state.plan.client || '未填客戶姓名' }),
        h('div', { class: 'mast__rule' }),
        h('div', { class: 'mast__meta', html:
          '投資方案：<b>' + esc(state.plan.planName || '—') + '</b>' +
          '<span class="sep">|</span>投資金額：<b>NT$ ' + num(res.amount) + '</b><br>' +
          '承辦顧問：<b>' + esc(state.plan.advisor || '—') + '</b>' +
          '<span class="sep">|</span>淨值基準 ' + fmtDateFull(state.meta.navAsOf) +
          '<span class="sep">|</span>產出 ' + stamp })
      ]),
      h('div', { class: 'hero' }, [
        h('div', { class: 'hero__label', text: '預估每月可領' }),
        h('div', { class: 'hero__value', html: '<small>NT$</small>' + num(res.monthlyIncome) }),
        h('div', { class: 'hero__foot', text:
          '加權年化配息率 ' + pct(res.weightedYield) + '　·　' +
          (state.plan.mode === 'total' ? '配息再投入試算' : '配息領出試算') }),
        h('div', { class: 'hero__split' }, [
          h('div', { class: 'hero__cell' }, [
            h('div', { class: 'k', text: '5 年後資產' }),
            h('div', { class: 'v', html: '<small>NT$</small>' + num(p5.total) }),
            h('div', { class: 's', text: '年化 ' + pct(p5.cagr, 1) })
          ]),
          h('div', { class: 'hero__cell' }, [
            h('div', { class: 'k', text: '10 年後資產' }),
            h('div', { class: 'v', html: '<small>NT$</small>' + num(p10.total) }),
            h('div', { class: 's', text: '年化 ' + pct(p10.cagr, 1) })
          ])
        ])
      ])
    ]);
  }

  function secHead(title, note) {
    return h('div', { class: 'sec__head' }, [
      h('span', { class: 'sec__title', text: title }),
      note ? h('span', { class: 'sec__note', text: note }) : null
    ]);
  }

  /* 一條 100% 橫條就能看出組合的形狀，比逐列讀比例快得多 */
  function compositionStrip(res) {
    var strip = h('div', { class: 'compo' });
    res.items.forEach(function (r) {
      var pctv = r.share * 100;
      strip.appendChild(h('div', {
        class: 'compo__seg',
        style: 'flex:' + pctv + ' 1 0; background:' + r.color,
        title: r.fund.short + ' ' + pctv.toFixed(1) + '%',
        text: pctv >= 7 ? pctv.toFixed(0) + '%' : ''
      }));
    });
    return strip;
  }

  /* 資產類別／投資區域／幣別：水平長條比甜甜圈省空間，也比較好比長度 */
  function spreadBlock(res, opts) {
    opts = opts || {};
    var titles = { assetClass: '資產類別', region: '投資區域', currency: '幣別' };
    var wrap = h('div', { class: opts.rootClass || 'pspread' });

    ['assetClass', 'region', 'currency'].forEach(function (key) {
      var slices = groupBy(res, key);
      var total = slices.reduce(function (s, x) { return s + x.value; }, 0) || 1;

      var bar = h('div', { class: 'psp__bar' });
      var keys = h('div', { class: 'psp__keys' });

      slices.forEach(function (s) {
        var share = (s.value / total) * 100;
        bar.appendChild(h('div', {
          class: 'psp__seg',
          style: 'flex:' + share + ' 1 0; background:' + s.color,
          title: s.label + ' ' + share.toFixed(1) + '%',
          text: share >= 12 ? share.toFixed(0) + '%' : ''
        }));
        keys.appendChild(h('span', { class: 'psp__key' }, [
          h('span', { class: 'psp__dot', style: 'background:' + s.color }),
          s.label + ' ' + share.toFixed(1) + '%'
        ]));
      });

      wrap.appendChild(h('div', {}, [
        h('div', { class: 'psp__label', text: titles[key] }),
        bar,
        keys
      ]));
    });
    return wrap;
  }

  /* 成長軌跡的堆疊層。兩種配息處理方式的分層不同。 */
  function growthSeries(res) {
    if (state.plan.mode === 'total') {
      return [
        { name: '投入本金', color: 'var(--series-2)', values: res.projections.map(function () { return res.amount; }), solid: true },
        { name: '預估獲利', color: 'var(--series-1)', values: res.projections.map(function (p) { return Math.max(0, p.gain); }) }
      ];
    }
    return [
      { name: '投入本金', color: 'var(--series-2)', values: res.projections.map(function () { return res.amount; }), solid: true },
      { name: '資本增值', color: 'var(--series-1)', values: res.projections.map(function (p) { return Math.max(0, p.capital - res.amount); }) },
      { name: '累計已領配息', color: 'var(--series-3)', values: res.projections.map(function (p) { return p.cumIncome; }) }
    ];
  }

  function milestoneRow(res) {
    return h('div', { class: 'milestones' }, res.projections.map(function (p) {
      return h('div', { class: 'ms' }, [
        h('div', { class: 'ms__y', text: p.years + ' 年' }),
        h('div', { class: 'ms__v', text: num(p.total) }),
        h('div', { class: 'ms__g', text: (p.gain >= 0 ? '+' : '') + num(p.gain) })
      ]);
    }));
  }

  function buildReportSheets() {
    var res = compute();
    var sheets = [];
    if (!res.items.length) return sheets;

    var totalPages = 2 + Math.ceil(res.items.length / APPENDIX_PER_PAGE);

    /* ------------------------------------------------- 第 1 頁：總覽 --- */
    var page1 = [];
    page1.push(mastHead(res));

    /* 配置一覽 */
    var rows = res.items.map(function (r) {
      return h('tr', {}, [
        h('td', { class: 'name' }, [
          h('span', { class: 'pswatch', style: 'background:' + r.color }),
          r.fund.name
        ]),
        h('td', {}, [h('span', { class: 'ptag', text: r.fund.assetClass })]),
        h('td', { class: 'num', text: 'RR' + r.fund.rr }),
        h('td', { class: 'num', text: r.fund.yield ? pct(r.fund.yield) : '累積' }),
        h('td', { class: 'num', text: (r.share * 100).toFixed(1) + '%' }),
        h('td', { class: 'num', text: nt(r.amount) }),
        h('td', { class: 'num', text: r.monthlyIncome > 0 ? nt(r.monthlyIncome) : '—' })
      ]);
    });

    page1.push(h('div', { class: 'sec' }, [
      secHead('配置一覽', '共 ' + res.items.length + ' 檔標的'),
      compositionStrip(res),
      h('table', { class: 'ptable' }, [
        h('thead', {}, [h('tr', {}, [
          h('th', { text: '標的名稱' }),
          h('th', { text: '類型' }),
          h('th', { class: 'num', text: 'RR' }),
          h('th', { class: 'num', text: '年化配息率' }),
          h('th', { class: 'num', text: '比例' }),
          h('th', { class: 'num', text: '投資金額' }),
          h('th', { class: 'num', text: '預估月配息' })
        ])]),
        h('tbody', {}, rows),
        h('tfoot', {}, [h('tr', {}, [
          h('td', { text: '合計' }),
          h('td', { text: '' }),
          h('td', { class: 'num', text: 'RR' + res.weightedRR.toFixed(1) }),
          h('td', { class: 'num', text: pct(res.weightedYield) }),
          h('td', { class: 'num', text: '100.0%' }),
          h('td', { class: 'num', text: nt(res.amount) }),
          h('td', { class: 'num', text: nt(res.monthlyIncome) })
        ])])
      ])
    ]));

    /* 成長軌跡 */
    var areaMount = h('div', {});
    var areaCard = h('div', { class: 'pchart' }, [
      h('div', { class: 'pchart__title', text: '預估資產成長軌跡' }),
      h('div', { class: 'pchart__sub', text:
        '面積下層為投入本金，上層為預估獲利；總高度即預估總值。各年期採該年期年化報酬率推算。' }),
      areaMount
    ]);
    page1.push(h('div', { class: 'sec' }, [
      secHead('資產成長預估', state.plan.mode === 'total' ? '配息再投入（總報酬）' : '配息領出：本金部位＋累計已領配息'),
      areaCard,
      milestoneRow(res)
    ]));

    /* 分散度 */
    page1.push(h('div', { class: 'sec' }, [
      secHead('風險分散度', '依投資金額占比'),
      spreadBlock(res)
    ]));

    page1.push(disclaimerBlock(res));

    sheets.push(sheet(page1, navNote(), 1, totalPages));

    /* 圖表在節點建立後再繪，確保 CSS 變數已可解析 */
    var series = growthSeries(res);
    window.Charts.area(areaMount, {
      labels: res.projections.map(function (p) { return p.years + 'Y'; }),
      series: series, width: 900, height: 190
    });
    window.Charts.legend(areaCard, series.map(function (s) { return { label: s.name, color: s.color }; }));

    /* --------------------------------------------- 第 2 頁起：持倉附錄 --- */
    var chunks = [];
    for (var i = 0; i < res.items.length; i += APPENDIX_PER_PAGE) {
      chunks.push(res.items.slice(i, i + APPENDIX_PER_PAGE));
    }

    chunks.forEach(function (chunk, ci) {
      var cards = chunk.map(function (r) {
        return h('div', { class: 'hold-card' }, [
          h('div', { class: 'hold-card__head' }, [
            h('h4', { text: r.fund.name }),
            h('div', { class: 'sub', text: '持股基準日 ' + fmtDateFull(r.fund.holdingsDate) + '　·　配置 ' + (r.share * 100).toFixed(1) + '%' })
          ]),
          h('table', {}, [
            h('thead', {}, [h('tr', {}, [
              h('th', { text: '標的名稱' }),
              h('th', { class: 'num', style: 'text-align:right', text: '權重' })
            ])]),
            h('tbody', {}, (r.fund.holdings || []).map(function (x) {
              return h('tr', {}, [h('td', { text: x.name }), h('td', { class: 'num', text: x.weight.toFixed(2) + '%' })]);
            }))
          ])
        ]);
      });

      sheets.push(sheet([
        h('div', { class: 'sec' }, [
          secHead('持倉明細' + (chunks.length > 1 ? '（' + (ci + 1) + '／' + chunks.length + '）' : ''),
                  '資料取自最近一期公開月報或每日持倉'),
          h('p', { style: 'font-size:7.8pt;color:var(--p-ink-2);margin-bottom:3mm', text:
            '這一頁列出您的組合中，各標的最大的五檔持股。同一家公司出現在多檔基金裡是正常的，' +
            '但如果同一檔股票在整體組合中重複出現，實際集中度會比單看一檔基金更高。' }),
          h('div', { class: 'hold-grid' }, cards)
        ])
      ], navNote(), ci + 2, totalPages));
    });

    /* ------------------------------------------------ 最後一頁：小叮嚀 --- */
    sheets.push(buildTipsSheet(totalPages));

    return sheets;
  }

  /* ==========================================================================
     長期持有小叮嚀（建議書背面）
     ====================================================================== */

  var LONG_TERM_TIPS = [
    {
      t: '時間比時機更重要',
      b: '長期報酬往往集中在少數幾個大漲的交易日。想「等跌一點再進場」而剛好錯過那幾天，' +
         '損失通常大於你原本想避開的那段跌幅。<b>留在市場裡的時間，才是報酬的來源。</b>'
    },
    {
      t: '帳面虧損不是真的虧損',
      b: '淨值下跌時，你持有的<b>單位數一張也沒有少</b>。只有在按下贖回的那一刻，' +
         '帳上的數字才會變成真正實現的損益。'
    },
    {
      t: '配息不等於獲利',
      b: '配息有可能一部分來自本金。判斷一檔基金好不好，要看<b>「淨值成長＋配息」的總報酬</b>，' +
         '而不是只比較配息率高低。配息率特別高的，更要看淨值是不是在往下走。'
    },
    {
      t: '定期檢視，不是定期更換',
      b: '建議一年檢視一到兩次即可。頻繁轉換會付出申購費、買賣價差與空手期，' +
         '<b>這些成本不會出現在任何一張報酬率表上</b>，卻會實實在在扣掉你的報酬。'
    },
    {
      t: '別用短期要用的錢投資',
      b: '六個月的生活費、一年內確定要用的錢（學費、頭期款、購屋款）請留在活存。' +
         '<b>被迫在低點贖回，是成本最高的一種賣出。</b>'
    },
    {
      t: '美元計價部位有兩個變數',
      b: '美元計價基金換算成台幣的價值，同時受<b>基金淨值</b>與<b>匯率</b>影響。' +
         '短期的匯率波動不代表基金本身表現不好，兩者要分開看。'
    },
    {
      t: '下跌時的扣款最有價值',
      b: '如果採定期定額，同樣的金額在低點會買到<b>更多單位</b>。' +
         '市場回升時，正是這些在低點累積的單位帶來報酬。下跌時停扣，等於放棄了這一段。'
    },
    {
      t: '看得懂才抱得住',
      b: '如果你說不出手上這檔基金<b>靠什麼賺錢</b>，下跌時就很難撐得住。' +
         '任何一檔標的有疑問，隨時找您的顧問問清楚，這比自己猜測後恐慌贖回好得多。'
    }
  ];

  function buildTipsSheet(totalPages) {
    var body = [
      h('div', { class: 'tips-lead' }, [
        h('h3', { text: '給' + (state.plan.client ? '　' + state.plan.client + '　' : '您') + '的長期持有叮嚀' }),
        h('p', { text:
          '前面幾頁的數字，全部建立在「長期持有」這個前提上。這份配置的預估成效，' +
          '只有在您能撐過中間必然出現的波動時才會兌現。以下八件事，' +
          '是實務上最常見、也最容易讓長期計畫中途夭折的地方。' })
      ]),
      h('div', { class: 'tips-grid' }, LONG_TERM_TIPS.map(function (tip, i) {
        return h('div', { class: 'tip' }, [
          h('div', { class: 'tip__n', text: String(i + 1).padStart(2, '0') }),
          h('div', {}, [
            h('div', { class: 'tip__title', text: tip.t }),
            h('div', { class: 'tip__body', html: tip.b })
          ])
        ]);
      })),
      h('div', { class: 'tips-close' }, [
        h('div', { class: 'tips-close__note', html:
          '<b>市場下跌時，請先聯絡您的顧問，再決定要不要動。</b><br>' +
          '多數讓長期報酬打折的決定，都是在情緒最強烈的那幾天做出來的。' +
          '一通電話的時間，通常就足以把「想賣掉」和「該賣掉」分開。' }),
        h('div', { class: 'sign' }, [
          h('div', { class: 'sign__row' }, [
            h('span', { class: 'sign__k', text: '承辦顧問' }),
            h('span', { class: 'sign__val', text: state.plan.advisor || '' })
          ]),
          h('div', { class: 'sign__row' }, [
            h('span', { class: 'sign__k', text: '聯絡方式' }),
            h('span', { class: 'sign__line' })
          ]),
          h('div', { class: 'sign__row' }, [
            h('span', { class: 'sign__k', text: '下次檢視' }),
            h('span', { class: 'sign__line' })
          ])
        ])
      ])
    ];
    return sheet(body, '本頁為投資觀念提醒，不構成個別投資建議', totalPages, totalPages);
  }


  function disclaimerBlock(res) {
    var items = [
      '本報告所有數據係以標的之歷史績效與數學模型推估之假設情境，<b>非保證收益、亦不代表未來實際報酬</b>；投資標的之價格可能因市場波動而漲跌，過去績效不代表未來表現。',
      '本試算之預估報酬以標的近年年化報酬率推算，未計入實際申購／轉換／管理等相關費用、匯率變動及稅負，實際結果將有差異。' +
        (res.approxUsed ? '<b>部分標的因成立時間較短，缺漏年期已沿用其最長可得年化報酬率替代。</b>' : ''),
      state.plan.mode === 'total'
        ? '本試算採「配息再投入」假設，配息金額視為滾入本金；若實際將配息領出，本金成長幅度將低於本表所列。'
        : '本試算採「配息領出」假設，資產價值已扣除配息對本金的稀釋，累計配息另計於獲利結構圖中。',
      '投資型保險商品（保單連結基金）之投資風險由要保人自行承擔，相關費用、保障內容與贖回條件請以保險公司正式契約條款及商品說明書為準。信貸／房貸資金投入具槓桿風險，可能造成本金虧損，請審慎評估自身還款能力。',
      '本報告僅供理財規劃參考，不構成任何投資要約或保證，實際投保與投資決策請洽專業人員並詳閱公開說明書。'
    ];
    return h('div', { class: 'disclaimer' }, [
      h('h5', { text: '重要聲明與風險警語' }),
      h('ol', {}, items.map(function (t) { return h('li', { html: t }); }))
    ]);
  }

  function renderReport() {
    var host = $('#reportPreview');
    host.textContent = '';
    var sheets = buildReportSheets();
    if (!sheets.length) {
      host.appendChild(h('div', { class: 'empty', text: '請先在「配置試算」分頁加入標的並設定比例，建議書會即時產生。' }));
      $('#btnPrintReport').disabled = true;
      return;
    }
    $('#btnPrintReport').disabled = false;
    mountSheets(host, sheets);
  }

  /* ==========================================================================
     比較表（A4）
     ====================================================================== */

  function buildCompareSheets() {
    var list = filteredFunds();
    var sheets = [];
    if (!list.length) return sheets;

    /* 依分類分頁；每頁 5 檔剛好填滿 A4，同一分類跨頁時標題會加註（1）（2） */
    var PER_PAGE = 8;
    var groups = [];
    window.CATEGORIES.forEach(function (c) {
      var inCat = list.filter(function (f) { return f.cat === c.id; });
      for (var i = 0; i < inCat.length; i += PER_PAGE) {
        groups.push({
          cat: c, funds: inCat.slice(i, i + PER_PAGE),
          part: Math.floor(i / PER_PAGE) + 1, parts: Math.ceil(inCat.length / PER_PAGE)
        });
      }
    });

    var total = groups.length + 1;

    /* 封面 */
    sheets.push(sheet([
      h('div', { class: 'mast' }, [
        h('div', { class: 'mast__id' }, [
          h('div', { class: 'mast__eyebrow', text: '基金比較表' }),
          h('div', { class: 'mast__name', style: 'font-size:19pt', text: '投資方向、RR 值與前五大持股' }),
          h('div', { class: 'mast__rule' }),
          h('div', { class: 'mast__meta', html:
            '淨值基準：<b>' + fmtDateFull(state.meta.navAsOf) + '</b> 最新可得公告' +
            '<span class="sep">|</span>持股基準：最近一期公開月報<br>' +
            '收錄 <b>' + list.length + '</b> 檔　·　產出 ' + fmtDateFull(todayISO()) })
        ]),
        h('div', { class: 'hero' }, [
          h('div', { class: 'hero__label', text: '收錄檔數' }),
          h('div', { class: 'hero__value', text: String(list.length) }),
          h('div', { class: 'hero__foot', text: '涵蓋 ' + window.CATEGORIES.filter(function (c) {
            return list.some(function (f) { return f.cat === c.id; });
          }).length + ' 個分類' })
        ])
      ]),
      h('div', { class: 'sec' }, [
        secHead('本份比較表的閱讀方式'),
        h('table', { class: 'ptable' }, [
          h('thead', {}, [h('tr', {}, [
            h('th', { text: '欄位' }), h('th', { text: '基準' }), h('th', { text: '說明' })
          ])]),
          h('tbody', {}, [
            h('tr', {}, [h('td', { class: 'name', text: 'RR1–RR5' }), h('td', { text: 'RR1 低 → RR5 高' }),
                         h('td', { text: '通路風險分級；同一基金在不同銷售機構可能有細微差異' })]),
            h('tr', {}, [h('td', { class: 'name', text: '淨值日期' }), h('td', { text: '截至 ' + fmtDateFull(state.meta.navAsOf) + ' 最新可得' }),
                         h('td', { text: '境外基金與美股常落後一至二個交易日，逐列標示實際日期' })]),
            h('tr', {}, [h('td', { class: 'name', text: '持股日期' }), h('td', { text: '基金月報／ETF 每日持倉' }),
                         h('td', { text: '每列均標示本次採用的最新公開持股日期' })]),
            h('tr', {}, [h('td', { class: 'name', text: '年化配息率' }), h('td', { text: '試算假設值' }),
                         h('td', { text: '用於推估月配息金額，須依最新月報核對後再提供客戶' })])
          ])
        ])
      ]),
      h('div', { class: 'sec' }, [
        secHead('收錄分類'),
        h('table', { class: 'ptable' }, [
          h('thead', {}, [h('tr', {}, [h('th', { text: '分類' }), h('th', { class: 'num', text: '檔數' }), h('th', { text: '判讀重點' })])]),
          h('tbody', {}, window.CATEGORIES.map(function (c) {
            var n = list.filter(function (f) { return f.cat === c.id; }).length;
            return n ? h('tr', {}, [
              h('td', { class: 'name', text: c.name }),
              h('td', { class: 'num', text: n }),
              h('td', { text: c.note })
            ]) : null;
          }).filter(Boolean))
        ])
      ]),
      h('div', { class: 'cmp-note', text: '同一檔基金的不同現金流級別（月配／累積／固定配息）通常持有完全相同的底層資產，配息方式不同不代表投資方向不同。' })
    ], state.meta.rrNote, 1, total));

    /* 內頁 */
    groups.forEach(function (g, gi) {
      var body = [
        h('div', { class: 'cmp-head' }, [
          h('div', {}, [
            h('div', { class: 'cmp-head__title', text: g.cat.name + (g.parts > 1 ? '（' + g.part + '）' : '') }),
            h('div', { class: 'cmp-head__sub', text: g.cat.note })
          ]),
          h('div', { class: 'cmp-head__no', text: String(gi + 2).padStart(2, '0') })
        ]),
        h('table', { class: 'cmp' }, [
          h('colgroup', {}, [
            h('col', { style: 'width:24%' }), h('col', { style: 'width:13%' }),
            h('col', { style: 'width:7%' }),  h('col', { style: 'width:18%' }),
            h('col', { style: 'width:38%' })
          ]),
          h('thead', {}, [h('tr', {}, [
            h('th', { text: '基金／ETF' }), h('th', { text: '最新淨值・日期' }),
            h('th', { text: 'RR' }), h('th', { text: '投資方向' }),
            h('th', { text: '前五大標的與占比（持股日）' })
          ])]),
          h('tbody', {}, g.funds.map(function (f) {
            return h('tr', {}, [
              h('td', {}, [
                h('div', { class: 'c-name', text: f.name }),
                h('div', { class: 'c-sub', text: f.payout + '｜' + f.currency + '｜' + f.region })
              ]),
              h('td', { class: 'c-nav', html: f.nav === null
                ? '<span style="color:var(--p-ink-3)">待平台核對</span>'
                : f.nav.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' ' + f.currency +
                  '<div class="c-sub">' + fmtDate(f.navDate) + '</div>' }),
              h('td', { text: 'RR' + f.rr }),
              h('td', { text: f.direction }),
              h('td', { class: 'c-hold', html: holdingsHTML(f) })
            ]);
          }))
        ])
      ];
      sheets.push(sheet(body, navNote() + '｜' + state.meta.rrNote, gi + 2, total));
    });

    return sheets;
  }

  function renderComparePreview() {
    mountSheets($('#comparePreview'), buildCompareSheets());
  }

  /* ==========================================================================
     列印
     ====================================================================== */

  function printSheets(sheets) {
    if (!sheets.length) { flash('沒有可列印的內容。'); return; }
    mountSheets($('#printRoot'), sheets);
    window.Charts.hideTip();
    setTimeout(function () { window.print(); }, 60);
  }

  window.addEventListener('afterprint', function () {
    var root = $('#printRoot');
    if (root) root.textContent = '';
  });

  /* ==========================================================================
     資料維護
     ====================================================================== */

  function renderData() {
    var host = $('#dataTable');
    host.textContent = '';

    var head = h('thead', {}, [h('tr', {}, [
      h('th', { text: '基金／ETF' }),
      h('th', { class: 'num', text: '最新淨值' }),
      h('th', { text: '淨值日' }),
      h('th', { class: 'num', text: 'RR' }),
      h('th', { class: 'num', text: '年化配息率 %' }),
      h('th', { class: 'num', text: '1年 %' }),
      h('th', { class: 'num', text: '3年 %' }),
      h('th', { class: 'num', text: '5年 %' }),
      h('th', { class: 'num', text: '7年 %' }),
      h('th', { class: 'num', text: '10年 %' })
    ])]);

    function numInput(f, get, set, cls) {
      return h('input', {
        class: 'input input--num ' + (cls || ''), type: 'number', step: 'any',
        value: get() === null || get() === undefined ? '' : get(),
        'aria-label': f.short,
        onchange: function (e) {
          var v = e.target.value === '' ? null : Number(e.target.value);
          set(v === null || isNaN(v) ? null : v);
          saveState();
          renderCompare();
        }
      });
    }

    var body = h('tbody', {}, filteredFunds().map(function (f) {
      return h('tr', {}, [
        h('td', {}, [
          h('div', { class: 'fund-name', text: f.name }),
          h('div', { class: 'fund-meta', text: catName(f.cat) + '｜' + f.currency + '｜' + f.payout })
        ]),
        h('td', { class: 'num w-nav' }, [numInput(f, function () { return f.nav; }, function (v) { f.nav = v; clearAutoTag(f); })]),
        h('td', { class: 'w-date' }, [h('input', {
          class: 'input', type: 'date', value: f.navDate || '',
          'aria-label': f.short + ' 淨值日',
          onchange: function (e) { f.navDate = e.target.value; clearAutoTag(f); saveState(); renderCompare(); }
        })]),
        h('td', { class: 'num w-rr' }, [numInput(f, function () { return f.rr; }, function (v) { f.rr = v; })]),
        h('td', { class: 'num w-pct' }, [numInput(f, function () { return f.yield; }, function (v) { f.yield = v || 0; })]),
        h('td', { class: 'num w-pct' }, [numInput(f, function () { return f.returns[1]; }, function (v) { f.returns[1] = v; })]),
        h('td', { class: 'num w-pct' }, [numInput(f, function () { return f.returns[3]; }, function (v) { f.returns[3] = v; })]),
        h('td', { class: 'num w-pct' }, [numInput(f, function () { return f.returns[5]; }, function (v) { f.returns[5] = v; })]),
        h('td', { class: 'num w-pct' }, [numInput(f, function () { return f.returns[7]; }, function (v) { f.returns[7] = v; })]),
        h('td', { class: 'num w-pct' }, [numInput(f, function () { return f.returns[10]; }, function (v) { f.returns[10] = v; })])
      ]);
    }));

    host.appendChild(h('table', { class: 'data data-table' }, [head, body]));
  }

  /* 貼上更新：一行一檔，用 tab 或逗號分隔（可直接從 Excel 複製） */
  function applyPaste(text) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var ok = 0, miss = [];
    lines.forEach(function (line) {
      var cells = line.split(/\t|,|｜|\|/).map(function (c) { return c.trim(); }).filter(function (c) { return c !== ''; });
      if (cells.length < 2) return;
      var key = cells[0];
      var f = state.funds.filter(function (x) {
        return x.id === key || x.name === key || x.short === key ||
               x.name.indexOf(key) >= 0 || key.indexOf(x.short) >= 0;
      })[0];
      if (!f) { miss.push(key); return; }
      var nav = Number(String(cells[1]).replace(/[^0-9.\-]/g, ''));
      if (!isNaN(nav) && cells[1] !== '') { f.nav = nav; clearAutoTag(f); }
      if (cells[2]) {
        var d = cells[2].replace(/\//g, '-');
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(d)) {
          var pp = d.split('-');
          f.navDate = pp[0] + '-' + pp[1].padStart(2, '0') + '-' + pp[2].padStart(2, '0');
        }
      }
      if (cells[3]) {
        var y = Number(String(cells[3]).replace(/[^0-9.\-]/g, ''));
        if (!isNaN(y)) f.yield = y;
      }
      ok++;
    });
    saveState();
    renderAll();
    var msg = '已更新 ' + ok + ' 檔。';
    if (miss.length) msg += '　找不到對應標的：' + miss.slice(0, 5).join('、') + (miss.length > 5 ? ' 等' : '');
    flash(msg);
  }

  function exportJSON() {
    var payload = { exportedAt: new Date().toISOString(), meta: state.meta, plan: state.plan, funds: state.funds };
    var text = JSON.stringify(payload, null, 2);
    var name = '基金資料備份_' + todayISO() + '.json';

    /* 線上版的頁面沒有直接存檔權限，必須透過瀏覽器代為詢問使用者 */
    var api = window.claude && window.claude.downloads;
    if (api) {
      api.save({ filename: name, data: text }).then(function () {
        flash('已匯出備份檔 ' + name);
      })['catch'](function (err) {
        var code = err && err.code;
        if (code === 'declined') flash('已取消匯出。');
        else if (code === 'rate_limited') flash('剛剛已經有一個存檔視窗，請稍候再試。');
        else if (code === 'too_large') flash('資料超過 16 MB，無法匯出，請先刪除不需要的標的。');
        else flash('這個環境無法直接存檔。請改用完整版或本機檔案匯出備份。');
      });
      return;
    }

    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    flash('已匯出備份檔 ' + name);
  }

  function importJSON(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var s = JSON.parse(fr.result);
        if (s.meta) Object.assign(state.meta, s.meta);
        if (s.plan) Object.assign(state.plan, s.plan);
        if (s.funds) mergeFunds(s.funds);
        saveState();
        renderAll();
        flash('匯入完成。');
      } catch (e) {
        flash('匯入失敗：檔案不是有效的備份 JSON。');
      }
    };
    fr.readAsText(file);
  }

  function resetAll() {
    if (!confirm('確定要清除所有自訂資料，回到內建預設值嗎？此動作無法復原。')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    state.meta = deepCopy(window.DEFAULT_META);
    state.funds = deepCopy(window.DEFAULT_FUNDS);
    state.plan = { client: '', advisor: '', planName: '平衡型策略', amount: 10000000, fx: 29.5, mode: 'total', items: [] };
    saveState();
    renderAll();
    flash('已回復預設值。');
  }

  /* ==========================================================================
     介面組裝
     ====================================================================== */

  var flashTimer = null;
  function flash(msg) {
    var el = $('#statusLine');
    el.textContent = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { el.textContent = ''; }, 5000);
  }

  function switchTab(id) {
    state.ui.tab = id;
    $$('.tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === id)); });
    $$('.panel').forEach(function (p) { p.hidden = p.id !== 'panel-' + id; });
    if (id === 'report') renderReport();
    if (id === 'data') renderData();
    window.scrollTo(0, 0);
  }

  function renderAll() {
    renderCompare();
    renderAllocate();
    if (state.ui.tab === 'report') renderReport();
    if (state.ui.tab === 'data') renderData();
  }

  function bindControls() {
    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function () { switchTab(t.dataset.tab); });
    });

    /* 篩選 */
    var catBar = $('#catChips');
    var allChip = h('button', { class: 'chip', 'aria-pressed': 'true', text: '全部', onclick: function () { setCat('all'); } });
    catBar.appendChild(allChip);
    window.CATEGORIES.forEach(function (c) {
      catBar.appendChild(h('button', { class: 'chip', 'aria-pressed': 'false', text: c.name, 'data-cat': c.id,
        onclick: function () { setCat(c.id); } }));
    });
    function setCat(id) {
      state.ui.cat = id;
      $$('.chip', catBar).forEach(function (b) {
        b.setAttribute('aria-pressed', String((b.dataset.cat || 'all') === id));
      });
      renderCompare();
      if (state.ui.tab === 'data') renderData();
    }

    $('#searchBox').addEventListener('input', function (e) { state.ui.q = e.target.value; renderCompare(); });
    $('#rrFilter').addEventListener('change', function (e) { state.ui.rr = e.target.value; renderCompare(); });
    $('#payoutFilter').addEventListener('change', function (e) { state.ui.payout = e.target.value; renderCompare(); });

    $('#btnPrintCompare').addEventListener('click', function () { printSheets(buildCompareSheets()); });
    $('#btnPreviewCompare').addEventListener('click', function () {
      var box = $('#comparePreviewWrap');
      var open = box.hasAttribute('hidden');
      if (open) { renderComparePreview(); box.removeAttribute('hidden'); this.textContent = '收合比較表預覽'; }
      else { box.setAttribute('hidden', ''); this.textContent = '預覽比較表 PDF'; }
    });

    /* 方案欄位 */
    function bindPlan(sel, key, cast) {
      $(sel).addEventListener('input', function (e) {
        state.plan[key] = cast ? cast(e.target.value) : e.target.value;
        saveState();
        var res = compute();
        renderKPIs(res); renderPreviewCharts(res); renderTotalBar(res);
        renderAllocRows(res);
      });
    }
    bindPlan('#planClient', 'client');
    bindPlan('#planAdvisor', 'advisor');
    bindPlan('#planName', 'planName');
    bindPlan('#planAmount', 'amount', Number);
    bindPlan('#planFx', 'fx', Number);

    $$('input[name="mode"]').forEach(function (r) {
      r.addEventListener('change', function () {
        state.plan.mode = r.value;
        saveState();
        var res = compute();
        renderKPIs(res); renderPreviewCharts(res);
      });
    });

    $('#btnEqualize').addEventListener('click', equalize);
    $('#btnNormalize').addEventListener('click', normalize);
    $('#btnClearPlan').addEventListener('click', function () {
      if (!state.plan.items.length) return;
      if (!confirm('清空目前配置？')) return;
      state.plan.items = [];
      saveState();
      renderAll();
    });
    $('#quickAdd').addEventListener('change', function (e) {
      if (e.target.value) { addToPlan(e.target.value); e.target.value = ''; }
    });

    $('#btnPrintReport').addEventListener('click', function () { printSheets(buildReportSheets()); });
    $('#btnGoAllocate').addEventListener('click', function () { switchTab('allocate'); });

    /* 資料維護 */
    $('#navAsOf').addEventListener('change', function (e) {
      state.meta.navAsOf = e.target.value;
      saveState();
      if (state.ui.tab === 'report') renderReport();
    });
    $('#btnApplyPaste').addEventListener('click', function () {
      var t = $('#pasteBox').value;
      if (!t.trim()) { flash('請先貼上資料。'); return; }
      applyPaste(t);
      $('#pasteBox').value = '';
    });
    $('#btnExport').addEventListener('click', exportJSON);
    $('#fileImport').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = '';
    });
    $('#btnReset').addEventListener('click', resetAll);

    /* 主題切換 */
    var themeBtn = $('#btnTheme');
    themeBtn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : cur === 'light' ? '' : 'dark';
      if (next) document.documentElement.setAttribute('data-theme', next);
      else document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('fundAdvisor.theme', next); } catch (e) {}
      themeBtn.title = next === 'dark' ? '深色（點擊切換為淺色）' : next === 'light' ? '淺色（點擊切換為跟隨系統）' : '跟隨系統（點擊切換為深色）';
    });
    try {
      var savedTheme = localStorage.getItem('fundAdvisor.theme');
      if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
    } catch (e) {}
  }

  /* 首次使用時給一組示範配置，讓畫面不是空的 */
  function seedIfEmpty() {
    if (state.plan.items.length) return;
    var seed = [['agi-amg7', 80], ['agi-tw-dam', 10], ['agi-am', 10]];
    seed.forEach(function (s) { if (fundById(s[0])) state.plan.items.push({ id: s[0], weight: s[1] }); });
  }

  function init() {
    loadState();
    seedIfEmpty();
    bindControls();
    renderAll();
    switchTab('compare');

    loadNavSnapshot().then(function (applied) {
      $('#navAsOf').value = state.meta.navAsOf;
      renderNavStatus();
      if (applied) { saveState(); renderAll(); }
    });
    $('#navAsOf').value = state.meta.navAsOf;
    renderNavStatus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
