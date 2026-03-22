# Quickstart: 內部登入與註冊系統

## 啟動

以下帳密與 origin 僅供本機開發示範，請勿在共享環境或正式環境沿用，也不要把 runtime 產生的 `backend/data/users.json`、`backend/data/sessions.json`、`backend/data/password-reset-tokens.json` 提交到版控。

```bash
export API_SHARED_SECRET=local-dev-secret
export BOOTSTRAP_ADMIN_EMAIL=admin@example.com
export BOOTSTRAP_ADMIN_PASSWORD=AdminPassword123!
export PUBLIC_APP_ORIGIN=http://127.0.0.1:5173
npm start
```

## 註冊

```bash
curl -X POST http://127.0.0.1:3000/api/v1/auth/register \
  -H "content-type: application/json" \
  -d '{"display_name":"王小明","email":"member@example.com","password":"MemberPassword123!"}'
```

## 登入

```bash
curl -i -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPassword123!"}'
```

成功登入時回應會同時包含：

- `Set-Cookie: social_data_session=...; HttpOnly; SameSite=Lax`
- JSON body：

```json
{
  "system_message": "登入成功。",
  "user": {
    "id": "user-id",
    "email": "admin@example.com",
    "displayName": "系統管理員",
    "role": "admin",
    "status": "active"
  }
}
```

## 忘記密碼

```bash
curl -X POST http://127.0.0.1:3000/api/v1/auth/forgot-password \
  -H "content-type: application/json" \
  -d '{"email":"member@example.com"}'
```

重設連結會寫入 `backend/data/outbox-messages.json`。

若有設定 `PUBLIC_APP_ORIGIN`，reset link 會指向該 frontend origin；未設定時會退回受信任的 frontend origin 設定。
