# 股票估值計算器 Stock Valuation App

透過三種常見估值模型計算股票合理價格：DCF、本益比法、股利折現模型。

## 功能

- **台股 (NTD) + 美股 (USD)** 雙市場支援
- **美股即時報價**：多來源（stockprices.dev、Yahoo 代理）自動嘗試；若失敗可點連結至 Yahoo Finance 手動查詢
- **DCF 現金流折現**：以自由現金流、成長率、折現率預測企業價值
- **本益比法**：股價 = EPS × 合理 P/E
- **股利折現模型 (Gordon Growth)**：P = D / (r - g)

輸入當前股價可比較各模型估值與市價差異。

## 使用方式

1. 用瀏覽器開啟 `index.html`
2. 選擇市場（台股 / 美股）
3. **美股**：輸入代碼（如 AAPL），點「取得報價」從 Yahoo Finance 自動帶入股價、EPS、股利
4. 填寫股票基本資訊（或由報價自動帶入）
5. 選擇估值模型並輸入參數
6. 點擊「計算」取得合理價
7. 在「估值結果」區塊查看彙總與偏低估/高估判斷

## 若「取得報價」失敗

報價依序嘗試 stockprices.dev、Yahoo Finance（經 CORS 代理）。若仍失敗可：
1. 點「Yahoo Finance」連結查詢後手動輸入股價
2. 自行部署 Cloudflare Worker：在專案目錄執行 `npx wrangler deploy`（需 Cloudflare 帳號），部署後於瀏覽器 Console 執行 `localStorage.setItem('stockProxyUrl', 'https://你的-worker.workers.dev')` 儲存代理網址

## 注意

本工具僅供學習與參考，不構成任何投資建議。投資有風險，請自行評估。
