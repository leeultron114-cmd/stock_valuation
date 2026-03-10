// Stock Valuation Calculator
// DCF, P/E, DDM models | 台股 + 美股

const results = { dcf: null, pe: null, ddm: null };

// 多來源取得美股報價（依序嘗試）
async function fetchUSStockPrice(symbol) {
  const sources = [
    () => fetchStockPricesDev(symbol),
    () => fetchYahooViaProxy(symbol)
  ];
  const workerUrl = localStorage.getItem('stockProxyUrl');
  if (workerUrl) sources.push(() => fetchWorkerProxy(symbol));
  for (const fn of sources) {
    try {
      const data = await fn();
      if (data && data.Price != null) return data;
    } catch (_) { continue; }
  }
  throw new Error('無法取得報價，請手動輸入或設定代理（見說明）');
}

async function fetchStockPricesDev(symbol) {
  for (const p of ['stocks', 'etfs']) {
    const res = await fetch(`https://stockprices.dev/api/${p}/${symbol}`);
    if (res.ok) {
      const d = await res.json();
      if (d.Price != null) return { Price: d.Price, Name: d.Name };
    }
  }
  throw new Error();
}

async function fetchYahooViaProxy(symbol) {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price,summaryDetail,defaultKeyStatistics`;
  const proxies = [
    (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    (u) => 'https://corsproxy.io/?' + encodeURIComponent(u),
    (u) => 'https://api.cors.lol/?url=' + encodeURIComponent(u)
  ];
  let data;
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy(url));
      if (!res.ok) continue;
      data = await res.json();
      if (data?.quoteSummary) break;
    } catch (_) { continue; }
  }
  if (!data?.quoteSummary) throw new Error();
  const r = data?.quoteSummary?.result?.[0];
  if (!r) throw new Error();
  const price = r.price?.regularMarketPrice?.raw ?? r.price?.regularMarketPrice;
  const name = r.price?.shortName || r.price?.longName || symbol;
  const eps = r.defaultKeyStatistics?.trailingEps?.raw ?? r.defaultKeyStatistics?.trailingEps;
  const pe = r.summaryDetail?.trailingPE?.raw ?? r.summaryDetail?.trailingPE;
  const divY = r.summaryDetail?.dividendYield?.raw ?? r.summaryDetail?.dividendYield;
  const divR = r.summaryDetail?.dividendRate?.raw ?? r.summaryDetail?.dividendRate;
  return {
    Price: price ? parseFloat(price) : null,
    Name: name,
    EPS: eps != null ? parseFloat(eps) : null,
    PERatio: pe != null ? parseFloat(pe) : null,
    DividendYield: divY != null ? parseFloat(divY) : null,
    DividendRate: divR != null ? parseFloat(divR) : null
  };
}

async function fetchWorkerProxy(symbol) {
  const base = localStorage.getItem('stockProxyUrl');
  if (!base) throw new Error();
  const res = await fetch(`${base}?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error();
  return await res.json();
}

// Currency & market
function getCurrency() {
  return document.getElementById('market').value === 'us' ? 'USD' : 'NTD';
}

function getCurrencySymbol() {
  return getCurrency() === 'USD' ? '$' : '';
}

function updateCurrencyUI() {
  const isUS = document.getElementById('market').value === 'us';
  const unit = isUS ? 'USD' : 'NTD';
  document.getElementById('currencyLabel').textContent = `(${unit})`;
  document.getElementById('dcf-fcf-unit').textContent = `(百萬 ${unit})`;
  document.getElementById('ddm-div-unit').textContent = `(${unit})`;
  document.getElementById('usSymbolGroup').style.display = isUS ? 'block' : 'none';
  document.getElementById('stockNameGroup').style.display = isUS ? 'none' : 'block';
}

document.getElementById('market').addEventListener('change', updateCurrencyUI);

// US stock fetch (stockprices.dev - no API key, CORS enabled)
async function fetchUSStock() {
  const symbol = document.getElementById('usSymbol').value?.trim().toUpperCase();
  if (!symbol) {
    alert('請輸入美股代碼（如 AAPL、MSFT）');
    return;
  }

  const btn = document.getElementById('btnFetchUS');
  btn.disabled = true;
  btn.textContent = '取得中...';

  try {
    const data = await fetchUSStockPrice(symbol);
    const price = parseFloat(data.Price);
    document.getElementById('stockName').value = data.Name || symbol;
    document.getElementById('currentPrice').value = price.toFixed(2);
    if (data.EPS != null) document.getElementById('pe-eps').value = data.EPS.toFixed(2);
    if (data.PERatio != null) document.getElementById('pe-ratio').value = Math.round(data.PERatio);
    if (data.DividendRate != null && data.DividendRate > 0) {
      document.getElementById('ddm-dividend').value = data.DividendRate.toFixed(2);
    } else if (data.DividendYield != null && data.DividendYield > 0 && price) {
      document.getElementById('ddm-dividend').value = (price * data.DividendYield).toFixed(2);
    }
  } catch (err) {
    alert('取得失敗：' + (err.message || '請檢查代碼或稍後再試'));
  } finally {
    btn.disabled = false;
    btn.textContent = '取得報價';
  }
}

document.getElementById('btnFetchUS').addEventListener('click', fetchUSStock);

document.getElementById('yahooLink').addEventListener('click', (e) => {
  const s = document.getElementById('usSymbol').value?.trim() || 'AAPL';
  e.target.href = 'https://finance.yahoo.com/quote/' + encodeURIComponent(s);
});

document.addEventListener('DOMContentLoaded', updateCurrencyUI);

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-panel`).classList.add('active');
  });
});

// DCF: Present Value of future free cash flows
function calculateDCF() {
  const fcf = parseFloat(document.getElementById('dcf-fcf').value) * 1e6; // 百萬 → 元
  const growth = parseFloat(document.getElementById('dcf-growth').value) / 100;
  const wacc = parseFloat(document.getElementById('dcf-wacc').value) / 100;
  const years = parseInt(document.getElementById('dcf-years').value) || 10;

  if (!fcf || !growth || !wacc) {
    alert('請填寫 FCF、成長率與折現率');
    return;
  }

  if (growth >= wacc) {
    alert('成長率必須小於折現率，否則估值會發散');
    return;
  }

  let pv = 0;
  let cf = fcf;
  for (let t = 1; t <= years; t++) {
    cf *= (1 + growth);
    pv += cf / Math.pow(1 + wacc, t);
  }

  const sharesInput = parseFloat(document.getElementById('dcf-shares').value);
  const shares = (sharesInput && sharesInput > 0) ? sharesInput * 1e6 : 25e9;
  const fairValue = pv / shares;
  results.dcf = fairValue;
  displayResult('result-dcf', fairValue);
  updateSummary();
}

// P/E: Fair Value = EPS × P/E
function calculatePE() {
  const eps = parseFloat(document.getElementById('pe-eps').value);
  const pe = parseFloat(document.getElementById('pe-ratio').value);

  if (!eps || !pe) {
    alert('請填寫 EPS 與合理本益比');
    return;
  }

  const fairValue = eps * pe;
  results.pe = fairValue;
  displayResult('result-pe', fairValue);
  updateSummary();
}

// DDM: P = D / (r - g)
function calculateDDM() {
  const dividend = parseFloat(document.getElementById('ddm-dividend').value);
  const rate = parseFloat(document.getElementById('ddm-rate').value) / 100;
  const growth = parseFloat(document.getElementById('ddm-growth').value) / 100;

  if (!dividend || !rate || !growth) {
    alert('請填寫股利、折現率與成長率');
    return;
  }

  if (growth >= rate) {
    alert('成長率必須小於折現率');
    return;
  }

  const fairValue = dividend / (rate - growth);
  results.ddm = fairValue;
  displayResult('result-ddm', fairValue);
  updateSummary();
}

function displayResult(id, value) {
  if (value == null || isNaN(value)) return;
  const el = document.getElementById(id);
  el.textContent = formatPrice(value);
}

function formatPrice(n) {
  const sym = getCurrencySymbol();
  return sym + new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

function updateSummary() {
  const currentPrice = parseFloat(document.getElementById('currentPrice').value);
  const stockName = document.getElementById('stockName').value || '該股票';

  if (!currentPrice || isNaN(currentPrice)) {
    document.getElementById('summary').innerHTML = '<p>請輸入當前股價以比較估值差異</p>';
    return;
  }

  const vals = [];
  if (results.dcf != null) vals.push({ label: 'DCF', val: results.dcf });
  if (results.pe != null) vals.push({ label: '本益比', val: results.pe });
  if (results.ddm != null) vals.push({ label: 'DDM', val: results.ddm });

  if (vals.length === 0) {
    document.getElementById('summary').innerHTML = '<p>輸入數據並計算各模型估值</p>';
    return;
  }

  const avg = vals.reduce((s, x) => s + x.val, 0) / vals.length;
  const diff = ((avg - currentPrice) / currentPrice * 100).toFixed(1);
  const sentiment = diff > 0 ? '低估' : diff < 0 ? '高估' : '合理';
  const color = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-muted)';

  const unit = getCurrency() === 'USD' ? ' 美元' : ' 元';
  let html = `<p><strong>${stockName || '該股票'}</strong> 當前股價 <strong>${formatPrice(currentPrice)}</strong>${unit}</p>`;
  html += `<p>加權平均估值約 <strong>${formatPrice(avg)}</strong>${unit}</p>`;
  html += `<p style="color:${color}">相較當前價格 ${diff > 0 ? '+' : ''}${diff}%，整體偏向 <strong>${sentiment}</strong></p>`;

  document.getElementById('summary').innerHTML = html;
}
