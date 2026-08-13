/* =============================================================================
   基金資料庫（預設值）
   -----------------------------------------------------------------------------
   資料來源分兩類，請務必分開理解：

   [A] 公告事實 — nav / navDate / rr / holdings / holdingsDate / direction
       取自 2026/08/10 版「基金投資方向、RR值 與前五大持股」比較表。
       淨值日多為 8/6–8/7（8/10 為週一，境外基金與美股尚未更新）。

   [B] 試算假設 — yield（年化配息率）/ returns（各年期年化報酬率）
       這兩欄是「假設值」，不是官方公告數字。它們直接決定建議書上的
       預估月領息與未來資產預估，請在「資料維護」分頁依最新月報或
       平台資料覆寫後再輸出給客戶。

   欄位說明
     id           唯一代碼（請勿重複）
     name         完整名稱（顯示於建議書）
     short        簡稱（顯示於圖表與表格）
     cat          分類代碼，對應 CATEGORIES
     currency     計價幣別 TWD / USD
     nav          最新淨值；無法取得時填 null，介面會顯示「待平台核對」
     navDate      淨值日期 YYYY-MM-DD
     rr           風險報酬等級 1–5
     assetClass   資產類別（用於資產類別圓餅圖）
     region       投資區域（用於投資區域圓餅圖）
     payout       配息頻率：月配 / 季配 / 半年配 / 年配 / 累積
     yield        年化配息率 %（累積型填 0）          ← 假設值
     direction    投資方向（一句話）
     returns      各年期年化報酬率 %                   ← 假設值
                  可只填部分年期，缺漏年期會沿用最長可得年期並在報告加註
     holdings     前五大持股 [{ name, weight }]
     holdingsDate 持股基準日 YYYY-MM-DD
   ========================================================================== */

window.CATEGORIES = [
  { id: 'multi',    name: '多元資產收益',   note: '股債混合，現金流為主要訴求' },
  { id: 'bond',     name: '債券與證券化',   note: '收益來自利息與信用利差' },
  { id: 'eqinc',    name: '股票入息',       note: '收益來自股息與選擇權權利金' },
  { id: 'tw-etf',   name: '台灣 ETF',       note: '被動追蹤指數' },
  { id: 'us-etf',   name: '美國 ETF',       note: '被動追蹤指數' },
  { id: 'tw-active',name: '台股主動',       note: '由經理人選股，非追蹤指數' },
  { id: 'tech',     name: '科技與美國成長', note: '集中於半導體、軟體與雲端' },
  { id: 'sector',   name: '全球產業主題',   note: '景氣敏感因子各不相同' },
  { id: 'region',   name: '區域與生技',     note: '衛星曝險，波動較大' }
];

window.DEFAULT_META = {
  navAsOf: '2026-08-10',
  navNote: '淨值：截至 2026/08/10 最新可得公告｜持股：最近一期公開月報',
  rrNote: 'RR 依台灣銷售平台常用分級；不同通路可能略有差異',
  fxUSDTWD: 29.5
};

/* 安聯收益成長系列共用底層持股（同一檔基金的不同現金流級別） */
var AGI_HOLDINGS = [
  { name: 'NVIDIA CORP',        weight: 2.81 },
  { name: 'APPLE INC',          weight: 2.44 },
  { name: 'AMAZON.COM INC',     weight: 1.49 },
  { name: 'ALPHABET INC-CL A',  weight: 1.36 },
  { name: 'ALPHABET INC',       weight: 1.17 }
];
var AGI_RETURNS = { 1: 14.5, 3: 12.8, 5: 9.2, 7: 7.6, 10: 8.4 };

window.DEFAULT_FUNDS = [
  /* ---------- 多元資產收益 ---------- */
  {
    id: 'agi-amg7', name: '安聯收益成長基金-AMg7月收總收益類股(美元)', short: '安聯收益成長 AMg7',
    cat: 'multi', currency: 'USD', nav: 8.8629, navDate: '2026-08-07', rr: 3,
    assetClass: '多重資產', region: '美國', payout: '月配', yield: 9.50,
    direction: '美國股債多元收益，以總收益方式配發',
    returns: AGI_RETURNS, holdings: AGI_HOLDINGS, holdingsDate: '2026-06-30'
  },
  {
    id: 'agi-am', name: '安聯收益成長基金-AM穩定月收類股(美元)', short: '安聯收益成長 AM',
    cat: 'multi', currency: 'USD', nav: 8.6928, navDate: '2026-08-07', rr: 3,
    assetClass: '多重資產', region: '美國', payout: '月配', yield: 6.70,
    direction: '同一底層基金，配息較穩定、金額較低',
    returns: AGI_RETURNS, holdings: AGI_HOLDINGS, holdingsDate: '2026-06-30'
  },
  {
    id: 'agi-at', name: '安聯收益成長基金-AT累積類股(美元)', short: '安聯收益成長 AT',
    cat: 'multi', currency: 'USD', nav: 31.19, navDate: '2026-08-07', rr: 3,
    assetClass: '多重資產', region: '美國', payout: '累積', yield: 0,
    direction: '同一底層基金，收益留在基金內滾入淨值',
    returns: AGI_RETURNS, holdings: AGI_HOLDINGS, holdingsDate: '2026-06-30'
  },
  {
    id: 'ftif-income', name: '富蘭克林穩定月收益基金 美元A(月配)', short: '富蘭克林穩定月收益',
    cat: 'multi', currency: 'USD', nav: 9.98, navDate: '2026-08-07', rr: 3,
    assetClass: '平衡型', region: '美國', payout: '月配', yield: 5.80,
    direction: '美國平衡收益，公債與投資級債為底',
    returns: { 1: 9.8, 3: 8.4, 5: 6.9, 7: 5.8, 10: 6.2 },
    holdings: [
      { name: '美國公債', weight: 6.57 }, { name: 'CHS', weight: 2.52 },
      { name: 'Oracle', weight: 2.20 }, { name: 'GNMA', weight: 2.18 },
      { name: 'Exxon', weight: 1.71 }
    ], holdingsDate: '2026-05-31'
  },
  {
    id: 'schroder-gig', name: '施羅德環球基金系列-環球收益成長 美元A月配固定2', short: '施羅德環球收益成長',
    cat: 'multi', currency: 'USD', nav: 143.4558, navDate: '2026-08-06', rr: 3,
    assetClass: '多重資產', region: '全球', payout: '月配', yield: 7.20,
    direction: '全球股債收益，配息採固定金額機制',
    returns: { 1: 10.2, 3: 9.1, 5: 6.4, 7: 5.5, 10: 5.9 },
    holdings: [
      { name: 'Alphabet Inc-CL A', weight: 1.00 }, { name: '巴西公債', weight: 0.90 },
      { name: '匈牙利公債', weight: 0.90 }, { name: 'Goldman Sachs 債', weight: 0.80 },
      { name: 'HD Korea 造船債', weight: 0.80 }
    ], holdingsDate: '2026-04-30'
  },
  {
    id: 'ab-agi-ai', name: '聯博美國成長入息基金 AI配息', short: '聯博美國成長入息 AI',
    cat: 'multi', currency: 'USD', nav: 15.09, navDate: '2026-07-30', rr: 4,
    assetClass: '股票', region: '美國', payout: '月配', yield: 6.50,
    direction: '美國大型成長股搭配收益設計',
    returns: { 1: 18.2, 3: 16.4, 5: 13.1, 7: 12.0, 10: 12.8 },
    holdings: [
      { name: 'Alphabet', weight: 8.66 }, { name: 'NVIDIA', weight: 8.26 },
      { name: 'Broadcom', weight: 5.24 }, { name: 'Meta', weight: 4.18 },
      { name: 'Microsoft', weight: 3.99 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'ab-growth-ap', name: '聯博美國成長基金 AP總報酬月配', short: '聯博美國成長 AP',
    cat: 'multi', currency: 'USD', nav: 74.97, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '美國', payout: '月配', yield: 6.00,
    direction: '美國大型成長股，以總報酬方式月配',
    returns: { 1: 19.5, 3: 17.8, 5: 14.2, 7: 13.5, 10: 14.6 },
    holdings: [
      { name: 'NVIDIA', weight: 9.93 }, { name: 'Alphabet', weight: 9.30 },
      { name: 'Amazon', weight: 8.05 }, { name: 'Microsoft', weight: 6.66 },
      { name: 'Broadcom', weight: 5.83 }
    ], holdingsDate: '2026-04-30'
  },

  /* ---------- 債券與證券化 ---------- */
  {
    id: 'ab-mortgage', name: '聯博房貸收益基金 AA穩定月配', short: '聯博房貸收益 AA',
    cat: 'bond', currency: 'USD', nav: 9.25, navDate: '2026-08-07', rr: 3,
    assetClass: '債券', region: '美國', payout: '月配', yield: 6.20,
    direction: '美國證券化信用，收益來自房貸利差',
    returns: { 1: 7.4, 3: 5.6, 5: 2.8, 7: 2.4, 10: 2.9 },
    holdings: [
      { name: 'FHLM REMICS', weight: 2.12 }, { name: 'UMBS 5% TBA', weight: 1.38 },
      { name: 'DeltaTerra', weight: 1.33 }, { name: 'UMBS 4.5% TBA', weight: 1.05 },
      { name: 'FNMA REMICS', weight: 1.04 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'bnpp-corp', name: '法巴永續高評等企業債券基金 月配美元', short: '法巴永續高評等企業債',
    cat: 'bond', currency: 'USD', nav: 68.35, navDate: '2026-08-06', rr: 2,
    assetClass: '債券', region: '全球', payout: '月配', yield: 4.30,
    direction: '投資級企業債，信用風險最低的一檔',
    returns: { 1: 6.1, 3: 4.2, 5: 1.4, 7: 2.0, 10: 2.6 },
    holdings: [
      { name: 'WSP Global 債', weight: 1.06 }, { name: 'Verisk 債', weight: 0.92 },
      { name: 'Citibank 債', weight: 0.89 }, { name: 'CRH America 債', weight: 0.73 },
      { name: 'Omega Healthcare 債', weight: 0.72 }
    ], holdingsDate: '2026-06-30'
  },

  /* ---------- 股票入息 ---------- */
  {
    id: 'blk-sdd-income', name: '貝萊德全球智慧數據股票入息基金 A6', short: '貝萊德智慧數據入息 A6',
    cat: 'eqinc', currency: 'USD', nav: 10.01, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '全球', payout: '月配', yield: 6.80,
    direction: '全球量化選股入息，收益含選擇權策略',
    returns: { 1: 13.6, 3: 12.2, 5: 11.0, 7: 8.4, 10: 8.1 },
    holdings: [
      { name: 'NVIDIA', weight: 4.26 }, { name: 'Alphabet', weight: 4.05 },
      { name: 'Apple', weight: 3.98 }, { name: 'Cisco', weight: 2.38 },
      { name: 'Accenture', weight: 2.23 }
    ], holdingsDate: '2026-05-31'
  },

  /* ---------- 台灣 ETF ---------- */
  {
    id: 'tw-0050', name: '0050 元大台灣50', short: '0050 元大台灣50',
    cat: 'tw-etf', currency: 'TWD', nav: 102.85, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '台灣', payout: '季配', yield: 2.80,
    direction: '臺灣 50 市值型，台積電權重過半',
    returns: { 1: 22.4, 3: 19.6, 5: 15.8, 7: 14.2, 10: 13.1 },
    holdings: [
      { name: '台積電', weight: 58.64 }, { name: '聯發科', weight: 5.81 },
      { name: '台達電', weight: 3.23 }, { name: '鴻海', weight: 3.22 },
      { name: '日月光投控', weight: 1.96 }
    ], holdingsDate: '2026-08-07'
  },
  {
    id: 'tw-006208', name: '006208 富邦台50', short: '006208 富邦台50',
    cat: 'tw-etf', currency: 'TWD', nav: 235.35, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '台灣', payout: '季配', yield: 2.75,
    direction: '與 0050 追蹤同一指數，差別在費用與規模',
    returns: { 1: 22.3, 3: 19.5, 5: 15.7, 7: 14.1, 10: 13.0 },
    holdings: [
      { name: '台積電', weight: 58.58 }, { name: '聯發科', weight: 5.80 },
      { name: '台達電', weight: 3.22 }, { name: '鴻海', weight: 3.21 },
      { name: '日月光投控', weight: 1.96 }
    ], holdingsDate: '2026-08-07'
  },
  {
    id: 'tw-0056', name: '0056 元大高股息', short: '0056 元大高股息',
    cat: 'tw-etf', currency: 'TWD', nav: 51.38, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '台灣', payout: '季配', yield: 8.00,
    direction: '高股息因子，不是純市值型',
    returns: { 1: 12.4, 3: 14.8, 5: 11.2, 7: 9.6, 10: 8.8 },
    holdings: [
      { name: '南亞', weight: 6.63 }, { name: '華南金', weight: 4.22 },
      { name: '南亞科', weight: 4.19 }, { name: '中信金', weight: 3.95 },
      { name: '緯創', weight: 3.95 }
    ], holdingsDate: '2026-08-07'
  },

  /* ---------- 美國 ETF ---------- */
  {
    id: 'us-qqq', name: 'QQQ 景順納斯達克100 ETF', short: 'QQQ', ticker: 'QQQ',
    cat: 'us-etf', currency: 'USD', nav: 723.03, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '美國', payout: '季配', yield: 0.55,
    direction: 'Nasdaq-100，成長偏壓且不含金融股',
    returns: { 1: 21.6, 3: 23.4, 5: 18.2, 7: 19.4, 10: 18.6 },
    holdings: [
      { name: 'NVIDIA', weight: 8.56 }, { name: 'Apple', weight: 7.27 },
      { name: 'Microsoft', weight: 5.87 }, { name: 'Amazon', weight: 4.66 },
      { name: 'Micron', weight: 4.31 }
    ], holdingsDate: '2026-08-07'
  },
  {
    id: 'us-spy', name: 'SPY 標普500 ETF', short: 'SPY', ticker: 'SPY',
    cat: 'us-etf', currency: 'USD', nav: null, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '美國', payout: '季配', yield: 1.20,
    direction: 'S&P 500 市值型',
    returns: { 1: 17.2, 3: 17.8, 5: 14.6, 7: 14.0, 10: 13.4 },
    holdings: [
      { name: 'NVIDIA', weight: 7.55 }, { name: 'Apple', weight: 7.04 },
      { name: 'Microsoft', weight: 5.36 }, { name: 'Amazon', weight: 4.13 },
      { name: 'Alphabet', weight: 3.02 }
    ], holdingsDate: '2026-08-07'
  },
  {
    id: 'us-ivv', name: 'IVV 安碩核心標普500 ETF', short: 'IVV', ticker: 'IVV',
    cat: 'us-etf', currency: 'USD', nav: 777.04, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '美國', payout: '季配', yield: 1.25,
    direction: '與 SPY 同指數，費用率較低',
    returns: { 1: 17.2, 3: 17.8, 5: 14.6, 7: 14.0, 10: 13.4 },
    holdings: [
      { name: 'Apple', weight: 7.64 }, { name: 'NVIDIA', weight: 7.37 },
      { name: 'Microsoft', weight: 5.23 }, { name: 'Amazon', weight: 3.60 },
      { name: 'Alphabet Inc-CL A', weight: 3.05 }
    ], holdingsDate: '2026-08-07'
  },

  /* ---------- 台股主動 ---------- */
  {
    id: 'tw-00981a', name: '00981A 主動統一台股增長', short: '00981A 主動統一台股增長',
    cat: 'tw-active', currency: 'TWD', nav: 28.03, navDate: '2026-08-07', rr: 5,
    assetClass: '股票', region: '台灣', payout: '累積', yield: 0,
    direction: '主動式 ETF，大型＋創新＋成長',
    returns: { 1: 26.0 },
    holdings: [
      { name: '台積電', weight: 9.63 }, { name: '台光電', weight: 8.53 },
      { name: '聯發科', weight: 7.11 }, { name: '欣興', weight: 6.46 },
      { name: '台指期貨', weight: 5.75 }
    ], holdingsDate: '2026-08-07'
  },
  {
    id: 'fh-allweather', name: '復華全方位基金 A類型', short: '復華全方位 A',
    cat: 'tw-active', currency: 'TWD', nav: 184.73, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '台灣', payout: '累積', yield: 0,
    direction: '台股全市場彈性配置',
    returns: { 1: 23.5, 3: 18.9, 5: 16.4, 7: 14.8, 10: 13.6 },
    holdings: [
      { name: '國巨', weight: 9.46 }, { name: '欣興', weight: 7.05 },
      { name: '聯發科', weight: 6.67 }, { name: '台光電', weight: 6.23 },
      { name: '台積電', weight: 5.90 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'pst-blackhorse', name: '統一黑馬基金', short: '統一黑馬',
    cat: 'tw-active', currency: 'TWD', nav: null, navDate: '2026-08-07', rr: 5,
    assetClass: '股票', region: '台灣', payout: '累積', yield: 0,
    direction: '台股集中精選',
    returns: { 1: 25.8, 3: 20.4, 5: 18.2, 7: 16.0, 10: 14.9 },
    holdings: [
      { name: '台光電', weight: 7.35 }, { name: '台積電', weight: 6.10 },
      { name: '國巨', weight: 5.65 }, { name: '聯電', weight: 5.58 },
      { name: '奇鋐', weight: 5.47 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'agi-tw-tech', name: '安聯台灣科技基金', short: '安聯台灣科技',
    cat: 'tw-active', currency: 'TWD', nav: 734.24, navDate: '2026-08-07', rr: 5,
    assetClass: '股票', region: '台灣', payout: '累積', yield: 0,
    direction: '台灣科技股，記憶體與測試介面權重高',
    returns: { 1: 27.2, 3: 22.6, 5: 19.8, 7: 17.4, 10: 16.2 },
    holdings: [
      { name: '華邦電', weight: 7.44 }, { name: '旺矽', weight: 7.32 },
      { name: '台積電', weight: 6.37 }, { name: '國巨', weight: 5.65 },
      { name: '台燿', weight: 5.38 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'agi-tw-smart', name: '安聯台灣智慧基金', short: '安聯台灣智慧',
    cat: 'tw-active', currency: 'TWD', nav: 394.91, navDate: '2026-08-07', rr: 5,
    assetClass: '股票', region: '台灣', payout: '累積', yield: 0,
    direction: '台灣趨勢成長',
    returns: { 1: 26.4, 3: 21.8, 5: 19.1, 7: 16.8, 10: 15.6 },
    holdings: [
      { name: '旺矽', weight: 8.28 }, { name: '華邦電', weight: 7.46 },
      { name: '台光電', weight: 6.28 }, { name: '信驊', weight: 5.86 },
      { name: '台燿', weight: 5.72 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'agi-tw-dam', name: '安聯台灣大壩基金-A累積型(台幣)', short: '安聯台灣大壩 A累積',
    cat: 'tw-active', currency: 'TWD', nav: null, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '台灣', payout: '累積', yield: 0,
    direction: '台股全市場主動選股',
    returns: { 1: 25.1, 3: 20.2, 5: 18.4, 7: 16.2, 10: 15.1 },
    holdings: [
      { name: '旺矽', weight: 12.17 }, { name: '台燿', weight: 7.19 },
      { name: '穎崴', weight: 7.11 }, { name: '台光電', weight: 6.65 },
      { name: '台積電', weight: 5.20 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'nomura-logistics', name: '野村台灣運籌基金', short: '野村台灣運籌',
    cat: 'tw-active', currency: 'TWD', nav: 437.74, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '台灣', payout: '累積', yield: 0,
    direction: '台灣科技供應鏈',
    returns: { 1: 24.2, 3: 19.4, 5: 17.2, 7: 15.1, 10: 14.0 },
    holdings: [
      { name: '台光電', weight: 7.47 }, { name: '聯發科', weight: 7.31 },
      { name: '欣興', weight: 6.12 }, { name: '台積電', weight: 5.75 },
      { name: '川湖', weight: 5.56 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'pst-benteng', name: '統一奔騰基金', short: '統一奔騰',
    cat: 'tw-active', currency: 'TWD', nav: 713.30, navDate: '2026-08-07', rr: 5,
    assetClass: '股票', region: '台灣', payout: '累積', yield: 0,
    direction: '台股成長選股',
    returns: { 1: 26.8, 3: 21.2, 5: 18.9, 7: 16.5, 10: 15.4 },
    holdings: [
      { name: '台光電', weight: 9.25 }, { name: '國巨', weight: 9.12 },
      { name: '台積電', weight: 7.81 }, { name: '欣興', weight: 7.60 },
      { name: '旺矽', weight: 6.99 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'nomura-quality', name: '野村優質基金 累積', short: '野村優質 累積',
    cat: 'tw-active', currency: 'TWD', nav: 452.00, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '台灣', payout: '累積', yield: 0,
    direction: '台灣品質成長選股',
    returns: { 1: 23.8, 3: 19.0, 5: 16.8, 7: 14.9, 10: 13.8 },
    holdings: [
      { name: '川湖', weight: 10.06 }, { name: '台光電', weight: 9.71 },
      { name: '台積電', weight: 8.61 }, { name: '鴻勁', weight: 7.67 },
      { name: '健策', weight: 7.23 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'nomura-smallcap', name: '野村中小基金 累積', short: '野村中小 累積',
    cat: 'tw-active', currency: 'TWD', nav: 567.06, navDate: '2026-08-07', rr: 5,
    assetClass: '股票', region: '台灣', payout: '累積', yield: 0,
    direction: '台灣中小型成長，個股與流動性風險較高',
    returns: { 1: 25.4, 3: 20.8, 5: 18.6, 7: 16.4, 10: 15.2 },
    holdings: [
      { name: '川湖', weight: 9.18 }, { name: '台光電', weight: 8.38 },
      { name: '聯發科', weight: 6.10 }, { name: '健策', weight: 5.88 },
      { name: '欣興', weight: 5.75 }
    ], holdingsDate: '2026-06-30'
  },

  /* ---------- 科技與美國成長 ---------- */
  {
    id: 'blk-wtech-a2', name: '貝萊德世界科技基金 A2累積(美元)', short: '貝萊德世界科技 A2',
    cat: 'tech', currency: 'USD', nav: 144.63, navDate: '2026-08-07', rr: 5,
    assetClass: '股票', region: '全球', payout: '累積', yield: 0,
    direction: '全球科技股，含韓國記憶體與設備',
    returns: { 1: 24.6, 3: 22.4, 5: 16.8, 7: 18.2, 10: 17.4 },
    holdings: [
      { name: 'SK 海力士', weight: 6.79 }, { name: 'NVIDIA', weight: 6.69 },
      { name: 'Broadcom', weight: 5.70 }, { name: 'Samsung', weight: 5.49 },
      { name: 'Lam Research', weight: 5.23 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'blk-wtech-a10', name: '貝萊德世界科技基金 A10月配(美元)', short: '貝萊德世界科技 A10',
    cat: 'tech', currency: 'USD', nav: 20.70, navDate: '2026-08-07', rr: 5,
    assetClass: '股票', region: '全球', payout: '月配', yield: 6.00,
    direction: '同 A2 底層，改以固定比率月配',
    returns: { 1: 24.6, 3: 22.4, 5: 16.8, 7: 18.2, 10: 17.4 },
    holdings: [
      { name: 'SK 海力士', weight: 6.79 }, { name: 'NVIDIA', weight: 6.69 },
      { name: 'Broadcom', weight: 5.70 }, { name: 'Samsung', weight: 5.49 },
      { name: 'Lam Research', weight: 5.23 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'jpm-us-tech', name: '摩根美國科技基金 A美元累計', short: '摩根美國科技 A累計',
    cat: 'tech', currency: 'USD', nav: 147.16, navDate: '2026-08-06', rr: 4,
    assetClass: '股票', region: '美國', payout: '累積', yield: 0,
    direction: '美國科技主動選股',
    returns: { 1: 20.8, 3: 19.6, 5: 14.4, 7: 16.2, 10: 16.8 },
    holdings: [
      { name: 'Intel', weight: 5.20 }, { name: 'Lam Research', weight: 5.00 },
      { name: 'Alphabet', weight: 3.90 }, { name: 'AMD', weight: 3.70 },
      { name: 'Palo Alto', weight: 3.60 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'trp-uslcg', name: '普徠仕美國大型成長股票基金 A美元', short: '普徠仕美國大型成長 A',
    cat: 'tech', currency: 'USD', nav: 119.11, navDate: '2026-08-06', rr: 4,
    assetClass: '股票', region: '美國', payout: '累積', yield: 0,
    direction: '美國大型成長，前五大權重集中',
    returns: { 1: 19.4, 3: 20.2, 5: 14.8, 7: 15.6, 10: 15.9 },
    holdings: [
      { name: 'Apple', weight: 9.60 }, { name: 'Microsoft', weight: 9.40 },
      { name: 'NVIDIA', weight: 9.20 }, { name: 'Alphabet', weight: 8.60 },
      { name: 'Broadcom', weight: 4.80 }
    ], holdingsDate: '2026-05-31'
  },

  /* ---------- 全球產業主題 ---------- */
  {
    id: 'blk-wfin-a10', name: '貝萊德世界金融基金 A10(美元)', short: '貝萊德世界金融 A10',
    cat: 'sector', currency: 'USD', nav: 20.28, navDate: '2026-08-07', rr: 5,
    assetClass: '股票', region: '全球', payout: '月配', yield: 5.40,
    direction: '全球金融股，對利率與信用循環敏感',
    returns: { 1: 22.6, 3: 18.4, 5: 14.2, 7: 9.8, 10: 9.4 },
    holdings: [
      { name: 'Bank of America', weight: 6.55 }, { name: 'Citigroup', weight: 5.43 },
      { name: 'UBS', weight: 3.31 }, { name: 'Capital One', weight: 3.16 },
      { name: 'BNP Paribas', weight: 3.06 }
    ], holdingsDate: '2026-05-31'
  },
  {
    id: 'cl-infra', name: '美盛凱利基礎建設價值基金 A美元配息(M)避險', short: '美盛凱利基礎建設 A配息M',
    cat: 'sector', currency: 'USD', nav: 12.31, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '全球', payout: '月配', yield: 5.60,
    direction: '全球上市基建，公用事業與運輸為主',
    returns: { 1: 11.2, 3: 6.8, 5: 6.2, 7: 5.4, 10: 6.0 },
    holdings: [
      { name: 'Entergy', weight: 5.05 }, { name: 'RWE', weight: 4.95 },
      { name: 'Severn Trent', weight: 4.70 }, { name: 'TC Energy', weight: 4.49 },
      { name: 'Canadian National Railway', weight: 4.23 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'blk-gold-a2', name: '貝萊德世界黃金基金 A2', short: '貝萊德世界黃金 A2',
    cat: 'sector', currency: 'USD', nav: 104.49, navDate: '2026-08-07', rr: 5,
    assetClass: '股票', region: '全球', payout: '累積', yield: 0,
    direction: '全球黃金礦業股，非直接持有黃金',
    returns: { 1: 38.4, 3: 22.6, 5: 8.4, 7: 11.2, 10: 9.6 },
    holdings: [
      { name: 'Barrick', weight: 8.20 }, { name: 'Newmont', weight: 6.73 },
      { name: 'AngloGold', weight: 6.61 }, { name: 'Wheaton', weight: 5.89 },
      { name: 'Endeavour', weight: 4.95 }
    ], holdingsDate: '2026-05-31'
  },

  /* ---------- 區域與生技 ---------- */
  {
    id: 'jpm-korea', name: '摩根南韓基金', short: '摩根南韓',
    cat: 'region', currency: 'USD', nav: null, navDate: '2026-08-07', rr: 5,
    assetClass: '股票', region: '南韓', payout: '累積', yield: 0,
    direction: '南韓單一市場，前三大占比近三成',
    returns: { 1: 29.6, 3: 12.4, 5: 6.8, 7: 8.2, 10: 7.4 },
    holdings: [
      { name: 'Samsung Elec', weight: 10.20 }, { name: 'SK hynix', weight: 10.00 },
      { name: 'SK Square', weight: 8.80 }, { name: 'Samsung Electro', weight: 6.30 },
      { name: 'Samsung C&T', weight: 5.00 }
    ], holdingsDate: '2026-06-30'
  },
  {
    id: 'jh-life-sci', name: '駿利亨德森環球生命科技基金 A2', short: '駿利環球生命科技 A2',
    cat: 'region', currency: 'USD', nav: 69.30, navDate: '2026-08-07', rr: 4,
    assetClass: '股票', region: '全球', payout: '累積', yield: 0,
    direction: '全球生命科技，與科技股循環不同步',
    returns: { 1: 8.6, 3: 4.2, 5: 2.4, 7: 5.8, 10: 7.2 },
    holdings: [
      { name: 'Eli Lilly', weight: 9.68 }, { name: 'J&J', weight: 6.76 },
      { name: 'UnitedHealth', weight: 4.21 }, { name: 'AstraZeneca', weight: 4.19 },
      { name: 'AbbVie', weight: 3.94 }
    ], holdingsDate: '2026-05-31'
  }
];
