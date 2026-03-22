# Data Model: 內部登入與註冊系統

## 說明

目前執行期仍使用 JSON collection 模擬資料表，但欄位定義已依正式資料庫 schema 方式整理，方便後續遷移。凡是標示為 index / FK / constraint 的項目，在 JSON store 階段由 service / repository 維持，資料庫化後必須改成真正的 schema constraint。

## User

| Field | Type | Constraints / Indexes | Notes |
|---|---|---|---|
| `id` | string | PK | UUID |
| `email` | string | unique index `uq_users_email` | 永遠以 lowercase 保存 |
| `displayName` | string | not null | 顯示名稱 |
| `passwordHash` | string | not null | `scrypt` 結果 |
| `role` | enum | check (`admin`,`member`) | 權限角色 |
| `status` | enum | check (`pending`,`active`,`rejected`,`disabled`) | 帳號狀態 |
| `approvedAt` | string\|null | nullable | 核准時間 |
| `approvedBy` | string\|null | FK -> `User.id` | 核准者 |
| `rejectedAt` | string\|null | nullable | 拒絕時間 |
| `rejectedBy` | string\|null | FK -> `User.id` | 拒絕者 |
| `lastLoginAt` | string\|null | index `idx_users_last_login_at` | 最近登入時間 |
| `createdAt` | string | not null | 建立時間 |
| `updatedAt` | string | not null | 更新時間 |

## Session

| Field | Type | Constraints / Indexes | Notes |
|---|---|---|---|
| `id` | string | PK | opaque session id |
| `userId` | string | FK -> `User.id`, index `idx_sessions_user_id` | 對應登入使用者 |
| `createdAt` | string | not null | 建立時間 |
| `lastSeenAt` | string | index `idx_sessions_last_seen_at` | 滑動續期依據 |
| `expiresAt` | string | index `idx_sessions_expires_at` | session 過期時間 |
| `rotatedFromSessionId` | string\|null | nullable FK -> `Session.id` | 正式資料庫化後建議補上 session rotation lineage |
| `ipHash` | string\|null | nullable | 建議保存經過 hash 的 client IP |
| `userAgentHash` | string\|null | nullable | 建議保存經過 hash 的 UA 指紋 |
| `revokedAt` | string\|null | nullable | 支援主動失效或登出審計 |

## PasswordResetToken

| Field | Type | Constraints / Indexes | Notes |
|---|---|---|---|
| `id` | string | PK | UUID |
| `userId` | string | FK -> `User.id`, index `idx_reset_tokens_user_id` | 對應使用者 |
| `tokenHash` | string | unique index `uq_reset_tokens_token_hash` | 現況為 token 的 SHA-256；正式環境建議升級為 HMAC-SHA256 |
| `createdAt` | string | not null | 建立時間 |
| `expiresAt` | string | index `idx_reset_tokens_expires_at` | 過期時間 |
| `usedAt` | string\|null | nullable | 已使用時間 |
| `requestCountWindow` | integer\|null | nullable | 正式資料庫化後可支援帳號層級 reset rate limiting |

## OutboxMessage

| Field | Type | Constraints / Indexes | Notes |
|---|---|---|---|
| `id` | string | PK | UUID |
| `type` | string | index `idx_outbox_type` | `password-reset` / `user-approved` / `user-rejected` |
| `to` | string | index `idx_outbox_to` | 收件人 email |
| `subject` | string | not null | 主旨 |
| `body` | string | not null | 內文 |
| `status` | enum | check (`pending`,`sent`,`failed`) | 正式 outbox pattern 建議欄位 |
| `retryCount` | integer | default 0 | 重試次數 |
| `lastAttemptedAt` | string\|null | nullable | 最近嘗試送出時間 |
| `errorCode` | string\|null | nullable | 最近失敗原因 |
| `createdAt` | string | not null | 建立時間 |
