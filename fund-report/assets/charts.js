/* =============================================================================
   圖表引擎 — 純 SVG，無外部相依
   -----------------------------------------------------------------------------
   顏色一律透過 CSS 變數取得，因此同一份程式碼在深色介面與白紙列印下
   都會拿到正確的色票：
     --c-surface / --c-grid / --c-axis / --c-ink / --c-ink-2 / --c-ink-3
     --series-1 … --series-8
   ========================================================================== */

(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var tip = null;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function ensureTip() {
    if (tip && document.body.contains(tip)) return tip;
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.setAttribute('role', 'status');
    document.body.appendChild(tip);
    return tip;
  }

  function showTip(html, evt) {
    var t = ensureTip();
    t.innerHTML = html;
    t.style.opacity = '1';
    var pad = 14;
    var r = t.getBoundingClientRect();
    var x = evt.clientX + pad;
    var y = evt.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
    t.style.left = Math.max(8, x) + 'px';
    t.style.top = Math.max(8, y) + 'px';
  }

  function hideTip() { if (tip) tip.style.opacity = '0'; }

  /* 找出視覺上不擁擠的刻度間距 */
  function niceStep(range, target) {
    var raw = range / Math.max(1, target);
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag;
    var step = norm >= 5 ? 10 : norm >= 2.5 ? 5 : norm >= 1.5 ? 2 : 1;
    return step * mag;
  }

  function shortNum(v) {
    var a = Math.abs(v);
    if (a >= 1e8) return (v / 1e8).toFixed(a >= 1e9 ? 0 : 1) + '億';
    if (a >= 1e4) return (v / 1e4).toFixed(a >= 1e6 ? 0 : 1) + '萬';
    return Math.round(v).toLocaleString('en-US');
  }

  function money(v) { return 'NT$ ' + Math.round(v).toLocaleString('en-US'); }

  /* ==========================================================================
     折線圖 — 預估資產價值曲線
     opts: { data:[{label,value,note}], baseline, height }
     ====================================================================== */
  function lineChart(box, opts) {
    var data = opts.data || [];
    box.textContent = '';
    if (!data.length) return;

    var W = 480, H = opts.height || 190;
    var m = { t: 12, r: 16, b: 26, l: 52 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;

    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H, class: 'chart-svg',
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': opts.ariaLabel || '預估資產價值曲線'
    }, box);

    var vals = data.map(function (d) { return d.value; });
    if (opts.baseline) vals.push(opts.baseline);
    var max = Math.max.apply(null, vals);
    var min = Math.min.apply(null, vals);
    var pad = (max - min) * 0.18 || max * 0.1 || 1;
    var lo = Math.max(0, min - pad), hi = max + pad;
    var step = niceStep(hi - lo, 4);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;

    var x = function (i) { return m.l + (data.length === 1 ? iw / 2 : (iw * i) / (data.length - 1)); };
    var y = function (v) { return m.t + ih - ((v - lo) / (hi - lo)) * ih; };

    /* 水平格線 + y 軸刻度 */
    for (var g = lo; g <= hi + 1e-6; g += step) {
      el('line', { x1: m.l, x2: m.l + iw, y1: y(g), y2: y(g), stroke: 'var(--c-grid)', 'stroke-width': 1 }, svg);
      el('text', {
        x: m.l - 7, y: y(g) + 3.5, 'text-anchor': 'end',
        fill: 'var(--c-ink-3)', 'font-size': 9, 'font-family': 'var(--font-num)'
      }, svg).textContent = shortNum(g);
    }

    /* 投入本金參考線 */
    if (opts.baseline) {
      el('line', {
        x1: m.l, x2: m.l + iw, y1: y(opts.baseline), y2: y(opts.baseline),
        stroke: 'var(--c-axis)', 'stroke-width': 1, 'stroke-dasharray': '4 3'
      }, svg);
      el('text', {
        x: m.l + iw, y: y(opts.baseline) - 5, 'text-anchor': 'end',
        fill: 'var(--c-ink-3)', 'font-size': 8.5
      }, svg).textContent = '投入本金';
    }

    /* 面積 + 線 */
    var dLine = '', dArea = '';
    data.forEach(function (d, i) {
      dLine += (i ? 'L' : 'M') + x(i).toFixed(2) + ' ' + y(d.value).toFixed(2) + ' ';
    });
    dArea = dLine + 'L' + x(data.length - 1).toFixed(2) + ' ' + (m.t + ih) + ' L' + x(0).toFixed(2) + ' ' + (m.t + ih) + ' Z';

    var gid = 'ln' + Math.random().toString(36).slice(2, 8);
    var defs = el('defs', {}, svg);
    var lg = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': 'var(--series-1)', 'stop-opacity': .22 }, lg);
    el('stop', { offset: '100%', 'stop-color': 'var(--series-1)', 'stop-opacity': .02 }, lg);

    el('path', { d: dArea, fill: 'url(#' + gid + ')', stroke: 'none' }, svg);
    el('path', { d: dLine.trim(), fill: 'none', stroke: 'var(--series-1)', 'stroke-width': 2,
                 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);

    /* x 軸標籤與資料點 */
    data.forEach(function (d, i) {
      el('text', {
        x: x(i), y: m.t + ih + 15, 'text-anchor': 'middle',
        fill: 'var(--c-ink-2)', 'font-size': 9, 'font-family': 'var(--font-num)'
      }, svg).textContent = d.label;

      var last = i === data.length - 1;
      el('circle', {
        cx: x(i), cy: y(d.value), r: last ? 4.5 : 3,
        fill: 'var(--series-1)', stroke: 'var(--c-surface)', 'stroke-width': 2
      }, svg);
    });

    /* 端點直接標值 */
    var lastD = data[data.length - 1];
    el('text', {
      x: x(data.length - 1), y: y(lastD.value) - 11, 'text-anchor': 'end',
      fill: 'var(--c-ink)', 'font-size': 10, 'font-weight': 700, 'font-family': 'var(--font-num)'
    }, svg).textContent = shortNum(lastD.value);

    /* 互動層 */
    var cross = el('line', {
      y1: m.t, y2: m.t + ih, stroke: 'var(--c-axis)', 'stroke-width': 1,
      'stroke-dasharray': '3 3', opacity: 0
    }, svg);

    data.forEach(function (d, i) {
      var bw = iw / data.length;
      el('rect', {
        x: m.l + bw * i, y: m.t, width: bw, height: ih, fill: 'transparent',
        style: 'cursor:crosshair'
      }, svg).addEventListener('mousemove', function (e) {
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
        cross.setAttribute('opacity', 1);
        showTip('<div class="tip-title">' + d.label + '　' + (d.note || '') + '</div>' +
                '預估總值　<b>' + money(d.value) + '</b>', e);
      });
    });
    svg.addEventListener('mouseleave', function () { cross.setAttribute('opacity', 0); hideTip(); });
  }

  /* ==========================================================================
     堆疊長條圖 — 投入本金 / 預估獲利
     opts: { labels:[], series:[{name,color,values:[]}], height }
     ====================================================================== */
  function stackedBar(box, opts) {
    var labels = opts.labels || [], series = opts.series || [];
    box.textContent = '';
    if (!labels.length) return;

    var W = 480, H = opts.height || 190;
    var m = { t: 12, r: 12, b: 26, l: 52 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;

    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H, class: 'chart-svg',
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': opts.ariaLabel || '累積獲利結構圖'
    }, box);

    var totals = labels.map(function (_, i) {
      return series.reduce(function (s, ser) { return s + Math.max(0, ser.values[i] || 0); }, 0);
    });
    var max = Math.max.apply(null, totals) || 1;
    var step = niceStep(max, 4);
    var hi = Math.ceil(max / step) * step;
    var y = function (v) { return m.t + ih - (v / hi) * ih; };

    for (var g = 0; g <= hi + 1e-6; g += step) {
      el('line', { x1: m.l, x2: m.l + iw, y1: y(g), y2: y(g), stroke: 'var(--c-grid)', 'stroke-width': 1 }, svg);
      el('text', {
        x: m.l - 7, y: y(g) + 3.5, 'text-anchor': 'end',
        fill: 'var(--c-ink-3)', 'font-size': 9, 'font-family': 'var(--font-num)'
      }, svg).textContent = shortNum(g);
    }
    el('line', { x1: m.l, x2: m.l + iw, y1: y(0), y2: y(0), stroke: 'var(--c-axis)', 'stroke-width': 1 }, svg);

    var slot = iw / labels.length;
    var bw = Math.min(46, slot * 0.56);

    labels.forEach(function (lab, i) {
      var cx = m.l + slot * i + slot / 2;
      var acc = 0;
      series.forEach(function (ser, si) {
        var v = Math.max(0, ser.values[i] || 0);
        if (v <= 0) return;
        var yTop = y(acc + v), yBot = y(acc);
        var h = Math.max(0, yBot - yTop - (si > 0 ? 2 : 0)); /* 2px 隔線讓分段不相黏 */
        var isTop = si === series.length - 1;
        var r = isTop ? 4 : 0;
        var rect = el('rect', {
          x: cx - bw / 2, y: yTop, width: bw, height: h,
          rx: r, ry: r, fill: ser.color, style: 'cursor:pointer'
        }, svg);
        if (isTop && r) { /* 只讓頂端圓角，底部維持切齊基線 */
          rect.setAttribute('rx', 4); rect.setAttribute('ry', 4);
        }
        acc += v;
        rect.addEventListener('mousemove', function (e) {
          showTip('<div class="tip-title">' + lab + '</div>' +
                  ser.name + '　<b>' + money(v) + '</b><br>合計　<b>' + money(totals[i]) + '</b>', e);
        });
        rect.addEventListener('mouseleave', hideTip);
      });

      el('text', {
        x: cx, y: m.t + ih + 15, 'text-anchor': 'middle',
        fill: 'var(--c-ink-2)', 'font-size': 9, 'font-family': 'var(--font-num)'
      }, svg).textContent = lab;
    });
  }

  /* ==========================================================================
     甜甜圈圖 — 資產類別 / 投資區域 / 幣別
     opts: { slices:[{label,value,color}], height }
     ====================================================================== */
  function donut(box, opts) {
    var slices = (opts.slices || []).filter(function (s) { return s.value > 0; });
    box.textContent = '';
    if (!slices.length) return;

    var S = 168, H = opts.height || S;
    var cx = S / 2, cy = H / 2;
    var rOuter = Math.min(S, H) / 2 - 20;
    var rInner = rOuter * 0.6;

    var svg = el('svg', {
      viewBox: '0 0 ' + S + ' ' + H, class: 'chart-svg',
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': opts.ariaLabel || '配置比例圖',
      /* 甜甜圈不隨欄寬無限放大，否則會蓋掉版面節奏 */
      style: 'max-width:' + (opts.maxWidth || 190) + 'px; margin:0 auto;'
    }, box);

    var total = slices.reduce(function (s, x) { return s + x.value; }, 0);
    var ang = -Math.PI / 2;

    function pt(r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }

    slices.forEach(function (s) {
      var sweep = (s.value / total) * Math.PI * 2;
      var a0 = ang, a1 = ang + sweep;
      ang = a1;

      var big = sweep > Math.PI ? 1 : 0;
      var p0 = pt(rOuter, a0), p1 = pt(rOuter, a1);
      var q1 = pt(rInner, a1), q0 = pt(rInner, a0);
      var d = 'M' + p0[0] + ' ' + p0[1] +
              'A' + rOuter + ' ' + rOuter + ' 0 ' + big + ' 1 ' + p1[0] + ' ' + p1[1] +
              'L' + q1[0] + ' ' + q1[1] +
              'A' + rInner + ' ' + rInner + ' 0 ' + big + ' 0 ' + q0[0] + ' ' + q0[1] + 'Z';

      var path = el('path', {
        d: d, fill: s.color,
        stroke: 'var(--c-surface)', 'stroke-width': 2, /* 2px 紙面隔線 */
        style: 'cursor:pointer'
      }, svg);

      var pct = (s.value / total) * 100;
      path.addEventListener('mousemove', function (e) {
        showTip('<div class="tip-title">' + s.label + '</div><b>' + pct.toFixed(1) + '%</b>　' + money(s.value), e);
      });
      path.addEventListener('mouseleave', hideTip);

      /* 占比夠大才直接標在圖上，避免文字打架 */
      if (pct >= 12) {
        var mid = (a0 + a1) / 2;
        var lp = pt((rOuter + rInner) / 2, mid);
        el('text', {
          x: lp[0], y: lp[1] + 3.5, 'text-anchor': 'middle',
          fill: '#fff', 'font-size': 10, 'font-weight': 700, 'font-family': 'var(--font-num)',
          style: 'paint-order:stroke; stroke:rgba(0,0,0,.22); stroke-width:2.5px;'
        }, svg).textContent = Math.round(pct) + '%';
      }
    });

    if (opts.centerLabel) {
      el('text', {
        x: cx, y: cy + 4, 'text-anchor': 'middle',
        fill: 'var(--c-ink-2)', 'font-size': 10, 'font-weight': 700
      }, svg).textContent = opts.centerLabel;
    }
  }

  /* 圖例 — 兩個以上系列一律附圖例，識別不靠顏色單獨承擔 */
  function legend(container, items, opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'legend';
    items.forEach(function (it) {
      var span = document.createElement('span');
      span.className = 'legend__item';
      var dot = document.createElement('span');
      dot.className = 'legend__dot';
      dot.style.background = it.color;
      span.appendChild(dot);
      span.appendChild(document.createTextNode(it.label));
      if (it.value !== undefined && it.value !== null) {
        var v = document.createElement('span');
        v.className = 'legend__val';
        v.textContent = it.value;
        span.appendChild(v);
      }
      wrap.appendChild(span);
    });
    container.appendChild(wrap);
    return wrap;
  }

  window.Charts = {
    line: lineChart,
    stacked: stackedBar,
    donut: donut,
    legend: legend,
    shortNum: shortNum,
    hideTip: hideTip
  };
})();
