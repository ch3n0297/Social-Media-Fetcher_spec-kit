# Implementation Plan: 內部登入與註冊系統

## Summary

新增一套與既有社群資料中台並存的 Web 身份系統，採 Email/密碼、HttpOnly Cookie Session、管理員核准制與本地 outbox 密碼重設流程。Apps Script 與 HMAC API 保持原狀；目前的 JSON store 僅限本機開發、測試與示範資料，正式環境需遷移到具唯一索引與交易能力的資料庫。

## Technical Context

- Language: Node.js 24, ESM JavaScript
- Frontend: React 18 + Vite
- Storage: file-backed JSON store（local/dev/test only）
- Planned production storage: relational DB with unique indexes, foreign keys, retry-safe outbox
- Auth model: server-side session + HttpOnly cookie + trusted-origin CSRF policy
- Password hashing: Node `crypto.scrypt`
- Reset delivery: local outbox stub
- Session policy: 7-day sliding expiration, login/password reset rotate session state
- Auth abuse protection: rate limiting on register/login/forgot-password/reset-password

## Structure

- Backend: `src/repositories/*`, `src/services/*`, `src/routes/*`
- Frontend: `frontend/src/*`
- Tests: `tests/integration/*`, `frontend/src/*.test.jsx`

## Decisions

- 角色固定為 `admin/member`
- 註冊後狀態為 `pending`
- `admin` 由環境變數在啟動時 seed
- `member` 僅可讀 Dashboard，不能審核使用者
- `PUBLIC_APP_ORIGIN` 優先用於 password reset 連結；未設定時退回受信任 frontend origin
- runtime 認證資料（users / sessions / password-reset-tokens / outbox）不可提交真實內容到版控
