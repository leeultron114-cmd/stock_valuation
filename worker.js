// Cloudflare Worker - 美股報價代理（部署到 workers.dev 免費方案）
// 部署後將下方 WORKER_URL 換成你的 Worker 網址

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol')?.toUpperCase();
  if (!symbol) {
    return new Response(JSON.stringify({ error: '缺少 symbol 參數' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const yahooUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price,summaryDetail,defaultKeyStatistics`;
    const res = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockValuation/1.0)' }
    });
    const data = await res.json();
    const r = data?.quoteSummary?.result?.[0];
    if (!r) return jsonErr('無此代碼', 404);

    const price = r.price?.regularMarketPrice?.raw ?? r.price?.regularMarketPrice;
    const name = r.price?.shortName || r.price?.longName || symbol;
    const eps = r.defaultKeyStatistics?.trailingEps?.raw ?? r.defaultKeyStatistics?.trailingEps;
    const pe = r.summaryDetail?.trailingPE?.raw ?? r.summaryDetail?.trailingPE;
    const divYield = r.summaryDetail?.dividendYield?.raw ?? r.summaryDetail?.dividendYield;
    const divRate = r.summaryDetail?.dividendRate?.raw ?? r.summaryDetail?.dividendRate;

    const result = {
      Price: price ? parseFloat(price) : null,
      Name: name,
      EPS: eps != null ? parseFloat(eps) : null,
      PERatio: pe != null ? parseFloat(pe) : null,
      DividendYield: divYield != null ? parseFloat(divYield) : null,
      DividendRate: divRate != null ? parseFloat(divRate) : null
    };

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return jsonErr(e.message || '請求失敗', 500);
  }
}

function jsonErr(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
