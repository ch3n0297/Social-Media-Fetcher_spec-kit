# Quickstart: 社群行銷資料中台

## Prerequisites

- Node.js 24+
- npm 11+

## 1. 啟動服務

```bash
npm install
export API_SHARED_SECRET=local-dev-secret
npm start
```

預設會：

- 在 `backend/data/` 建立檔案式資料庫
- 在 `backend/fixtures/platforms/` 讀取三個平台的示範原始資料
- 啟動 Fastify API server 與排程器

## 1.1 React + Vite 開發模式（選用）

```bash
export API_SHARED_SECRET=local-dev-secret
npm run dev:backend
npm run dev:frontend
```

Vite dev server 會將 `/health` 與 `/api` proxy 到目前的 Fastify backend，方便在不暴露任何 shared secret 到瀏覽器端的前提下開發前端。

## 1.2 建置前端（選用）

```bash
npm run build:frontend
```

前端 build 產物會輸出到 `frontend/dist/`，需由獨立前端部署或靜態主機提供；backend 不再直接提供前端資產。

## 2. 檢查健康狀態

```bash
curl http://localhost:3000/health
```

預期回傳 `200 OK` 與目前 queue/scheduler 狀態。

## 3. 觸發一次排程同步

```bash
curl -X POST http://localhost:3000/api/v1/internal/scheduled-sync \
  -H "content-type: application/json" \
  -H "x-client-id: demo-sheet" \
  -H "x-timestamp: <ISO_TIMESTAMP>" \
  -H "x-signature: <HMAC_SIGNATURE>" \
  -d '{"requested_by":"quickstart"}'
```

預期：

- 服務為所有 active account 建立 `scheduled` jobs
- `data/jobs.json` 出現 `queued` / `running` / `success` 或 `error`
- `data/sheet-status.json` 與 `data/sheet-output.json` 被更新

## 4. 送出單一帳號手動刷新

Request body:

```json
{
  "platform": "instagram",
  "account_id": "acct-instagram-demo",
  "refresh_days": 7,
  "request_source": "apps-script"
}
```

建立簽章方式：

1. 將 request body 序列化為單行 JSON
2. 組合字串：`<timestamp>.<json-body>`
3. 使用 `API_SHARED_SECRET` 做 HMAC SHA256

送出請求：

```bash
curl -X POST http://localhost:3000/api/v1/refresh-jobs/manual \
  -H "content-type: application/json" \
  -H "x-client-id: demo-sheet" \
  -H "x-timestamp: <ISO_TIMESTAMP>" \
  -H "x-signature: <HMAC_SIGNATURE>" \
  -d '{"platform":"instagram","account_id":"acct-instagram-demo","refresh_days":7,"request_source":"apps-script"}'
```

預期：

- 立即回傳 `202 Accepted`
- 帳號狀態先變為 `queued`
- 背景 worker 轉成 `running`
- 完成後回寫 `success` 或 `error`

## 5. 驗證資料輸出

檢查以下檔案：

- `backend/data/raw-platform-records.json`
- `backend/data/normalized-content-records.json`
- `backend/data/jobs.json`
- `backend/data/sheet-status.json`
- `backend/data/sheet-output.json`

## 6. 執行測試

```bash
npm test
```

測試涵蓋：

- 排程同步會保存 raw/normalized data 並同步狀態
- 手動刷新為非同步、可去重複、可限流
- 非法 `refresh_days` 與平台錯誤會回傳可理解訊息
- 前端與後端分離後，唯讀 UI API 與受保護寫入端點的安全限制持續有效
