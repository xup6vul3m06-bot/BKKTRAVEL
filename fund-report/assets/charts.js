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
     堆疊面積圖 — 資產成長軌跡
     把「總值成長」與「獲利占多少」合成同一張圖：下層是投入本金，
     上層是各種獲利，總高度就是預估總值。
     opts: { labels:[], series:[{name,color,values}], height }
     ====================================================================== */
  function stackedArea(box, opts) {
    var labels = opts.labels || [], series = opts.series || [];
    box.textContent = '';
    if (!labels.length) return;

    var W = opts.width || 480, H = opts.height || 168;
    var m = { t: 14, r: 14, b: 24, l: 50 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;

    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H, class: 'chart-svg',
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': opts.ariaLabel || '資產成長軌跡'
    }, box);

    var totals = labels.map(function (_, i) {
      return series.reduce(function (s, ser) { return s + Math.max(0, ser.values[i] || 0); }, 0);
    });
    var max = Math.max.apply(null, totals) || 1;
    var step = niceStep(max, 4);
    var hi = Math.ceil(max / step) * step;

    var x = function (i) { return m.l + (labels.length === 1 ? iw / 2 : (iw * i) / (labels.length - 1)); };
    var y = function (v) { return m.t + ih - (v / hi) * ih; };

    for (var g = 0; g <= hi + 1e-6; g += step) {
      el('line', { x1: m.l, x2: m.l + iw, y1: y(g), y2: y(g), stroke: 'var(--c-grid)', 'stroke-width': 1 }, svg);
      el('text', {
        x: m.l - 6, y: y(g) + 3.5, 'text-anchor': 'end',
        fill: 'var(--c-ink-3)', 'font-size': 8.5, 'font-family': 'var(--font-num)'
      }, svg).textContent = shortNum(g);
    }

    /* 由下往上疊，每層畫出自己的上緣與下緣所圍出的面積 */
    var lower = labels.map(function () { return 0; });
    series.forEach(function (ser) {
      var upper = lower.map(function (v, i) { return v + Math.max(0, ser.values[i] || 0); });

      var d = '';
      upper.forEach(function (v, i) { d += (i ? 'L' : 'M') + x(i).toFixed(2) + ' ' + y(v).toFixed(2) + ' '; });
      for (var i = lower.length - 1; i >= 0; i--) d += 'L' + x(i).toFixed(2) + ' ' + y(lower[i]).toFixed(2) + ' ';
      d += 'Z';

      el('path', {
        d: d, fill: ser.color, 'fill-opacity': ser.solid ? .92 : .55,
        stroke: 'var(--c-surface)', 'stroke-width': 1.2   /* 1.2px 紙面隔線讓層與層不相黏 */
      }, svg);

      lower = upper;
    });

    /* 總值線與端點 */
    var dTop = '';
    totals.forEach(function (v, i) { dTop += (i ? 'L' : 'M') + x(i).toFixed(2) + ' ' + y(v).toFixed(2) + ' '; });
    el('path', {
      d: dTop.trim(), fill: 'none', stroke: 'var(--series-1)', 'stroke-width': 2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }, svg);

    labels.forEach(function (lab, i) {
      el('circle', {
        cx: x(i), cy: y(totals[i]), r: i === labels.length - 1 ? 4 : 2.6,
        fill: 'var(--series-1)', stroke: 'var(--c-surface)', 'stroke-width': 1.6
      }, svg);
      el('text', {
        x: x(i), y: m.t + ih + 14, 'text-anchor': 'middle',
        fill: 'var(--c-ink-2)', 'font-size': 8.5, 'font-family': 'var(--font-num)'
      }, svg).textContent = lab;
    });

    el('text', {
      x: x(labels.length - 1), y: y(totals[totals.length - 1]) - 9, 'text-anchor': 'end',
      fill: 'var(--c-ink)', 'font-size': 9.5, 'font-weight': 700, 'font-family': 'var(--font-num)'
    }, svg).textContent = shortNum(totals[totals.length - 1]);

    /* 互動層 */
    var cross = el('line', {
      y1: m.t, y2: m.t + ih, stroke: 'var(--c-axis)', 'stroke-width': 1,
      'stroke-dasharray': '3 3', opacity: 0
    }, svg);

    labels.forEach(function (lab, i) {
      var bw = iw / labels.length;
      el('rect', {
        x: m.l + bw * i, y: m.t, width: bw, height: ih, fill: 'transparent', style: 'cursor:crosshair'
      }, svg).addEventListener('mousemove', function (e) {
        var rows = series.map(function (ser) {
          return ser.name + '　<b>' + money(Math.max(0, ser.values[i] || 0)) + '</b>';
        }).join('<br>');
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
        cross.setAttribute('opacity', 1);
        showTip('<div class="tip-title">' + lab + '　總值 ' + money(totals[i]) + '</div>' + rows, e);
      });
    });
    svg.addEventListener('mouseleave', function () { cross.setAttribute('opacity', 0); hideTip(); });
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
    area: stackedArea,
    legend: legend,
    shortNum: shortNum,
    hideTip: hideTip
  };
})();
