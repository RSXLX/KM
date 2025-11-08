# JWT 使用与调试方法

> 本文档用于记录在 KMarket 后端（Actix Web + Redis + Postgres）环境中使用、调试与优化 JWT 的完整方法。内容覆盖基础概念、代码示例、常见问题定位、错误处理规范以及安全配置建议，并将持续维护以反映最新实践。

---

## 目录
- 环境与配置
- JWT 基本概念与工作原理
- 生成与验证 JWT 的代码示例（Rust/Actix）
- 前后端交互与签名校验（含微信小程序示例）
- 常见调试场景与解决方案
- 错误处理最佳实践
- 安全注意事项与配置建议
- 变更记录与维护建议

---

## 环境与配置

后端通过环境变量控制 JWT 行为与就绪检查：

- `JWT_SECRET`：用于 HS256 对称签名的密钥（必须配置，生产环境至少 32 字节随机）
- `JWT_ISS`：签发者（issuer），如 `kmarket.auth`
- `JWT_AUD`：受众（audience），如 `kmarket.app`
- `JWT_EXP_DAYS`：令牌有效天数（默认 7 天），同时用于 Redis 会话 TTL 对齐
- `READYZ_SKIP_PING`：就绪检查可跳过真实连接（测试环境）

其他必要依赖：`DATABASE_URL`（Postgres）、`REDIS_URL`（Redis）。就绪端点 `/readyz` 会在启用真实连接检查时验证 DB/Redis/JWT 配置，或在跳过检查时验证配置存在性。

---

## JWT 基本概念与工作原理

- JWT 由三部分组成：`header.payload.signature`
  - Header：包含签名算法（本项目使用 `HS256`）与可选元数据
  - Payload：载荷声明（Claims），如：
    - `sub`（主体 / 用户 ID）
    - `address`（钱包地址，用于链上身份）
    - `iat`（签发时间，Unix 秒）
    - `exp`（过期时间，Unix 秒）
    - `iss`（签发者）
    - `aud`（受众）
    - `jti`（令牌唯一 ID，用于黑名单与审计）
    - `roles`（角色数组）
  - Signature：使用 `JWT_SECRET` 对 header+payload 进行 HS256 签名

- 生命周期与会话管理：
  - 在 `/auth/verify-sig` 成功后签发 JWT，并创建 Redis 会话，TTL 与 JWT 过期时间对齐（以支持即时注销与黑名单）
  - 客户端以 `Authorization: Bearer <token>` 访问受保护资源；注销会删除 Redis 会话，令牌随 TTL 失效或被立即拒绝

- 端点与消息格式：
  - `/auth/nonce`：返回一次性 `nonce`，前端以固定模板消息签名：`"Login to KMarket: nonce=<nonce>"`
  - `/auth/verify-sig`：校验 EIP-191 签名、消费 nonce、创建/更新用户、签发 JWT
  - `/auth/me`：验证 JWT + Redis 会话并返回用户信息
  - `/auth/logout`：撤销 Redis 会话（即时失效）

---

## 生成与验证 JWT 的代码示例（Rust/Actix）

以下示例与项目 `src/routes/auth.rs` 保持一致。

### 生成 JWT

```rust
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
pub struct Claims {
    sub: i32,
    address: String,
    iat: usize,
    exp: usize,
    iss: String,
    aud: String,
    jti: String,
    roles: Vec<String>,
}

fn issue_jwt(user_id: i32, address: String, iss: String, aud: String, secret: String, exp_days: i64) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = now + Duration::days(exp_days);
    let claims = Claims {
        sub: user_id,
        address,
        iat: now.timestamp() as usize,
        exp: exp.timestamp() as usize,
        iss,
        aud,
        jti: Uuid::new_v4().to_string(),
        roles: vec!["user".into()],
    };
    let header = Header::new(Algorithm::HS256);
    encode(&header, &claims, &EncodingKey::from_secret(secret.as_bytes()))
}
```

### 验证 JWT（含 `iss`/`aud` 严格校验）

```rust
use std::collections::HashSet;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};

fn verify_jwt(token: &str, secret: &str, expected_iss: &str, expected_aud: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::new(Algorithm::HS256);
    // 容忍少量时钟偏差（可选）
    validation.leeway = 5;
    // 严格受众与签发者
    validation.set_audience(&[expected_aud.to_string()]);
    validation.iss = Some(HashSet::from([expected_iss.to_string()]));

    let data = decode::<Claims>(token, &DecodingKey::from_secret(secret.as_bytes()), &validation)?;
    Ok(data.claims)
}
```

### Redis 会话 TTL 与 JWT 对齐

```rust
use chrono::Utc;
use crate::cache::store::{create_session_with_ttl, SessionData};

async fn persist_session(redis: &redis::Client, token: &str, user_id: i32, address: String, exp_unix: i64) -> redis::RedisResult<()> {
    let now = Utc::now().timestamp();
    let ttl_secs = (exp_unix - now) as usize;
    let mut conn = crate::cache::store::get_conn(redis).await?;
    let s = SessionData { user_id, address };
    create_session_with_ttl(&mut conn, token, &s, ttl_secs).await
}
```

---

## 前后端交互与签名校验（含微信小程序示例）

### 消息签名约定
- 模板：`Login to KMarket: nonce=<nonce>`
- 算法：EIP-191（personal_sign），后端使用 `ethers::utils::hash_message` 与 `Signature::recover` 验证签名与地址匹配
- 签名编码：十六进制字符串，带前缀 `0x`

### 请求流程（Mermaid 流程图）

```mermaid
flowchart LR
  A[GET /auth/nonce?address] --> B[返回 nonce]
  B --> C[前端构造 message 并 personal_sign]
  C --> D[POST /auth/verify-sig {address, message, signature}]
  D -->|验证签名+消费nonce| E[创建/更新用户]
  E --> F[签发 JWT 并写 Redis 会话]
  F --> G[返回 {token, expiresIn, user}]
  G --> H[客户端持 Bearer 访问受保护接口]
  H --> I[POST /auth/logout 立即撤销会话]
```

### 微信小程序调用示例（前端）

```js
// 获取 nonce
wx.request({
  url: `${API_BASE}/auth/nonce`,
  method: 'GET',
  data: { address }, // GET 将拼接为查询参数
  success: async (res) => {
    const { nonce } = res.data;
    const message = `Login to KMarket: nonce=${nonce}`;

    // 注意：小程序端需通过钱包 SDK 完成 EIP-191 签名
    // 例如：H5 环境可用 window.ethereum.request({ method: 'personal_sign', params: [message, address] })
    const signature = await walletSdk.personalSign(message, address); // 返回 0x 前缀的 hex

    wx.request({
      url: `${API_BASE}/auth/verify-sig`,
      method: 'POST',
      data: { address, message, signature },
      success: (r) => {
        const { token, expiresIn } = r.data;
        wx.setStorageSync('token', token);
        // 后续请求统一附带 Authorization 头
      }
    });
  }
});
```

### 客户端统一请求封装（附带 Bearer）

```js
function requestWithAuth(options) {
  const token = wx.getStorageSync('token');
  const headers = Object.assign({}, options.header, token ? { Authorization: `Bearer ${token}` } : {});
  return new Promise((resolve, reject) => {
    wx.request({ ...options, header: headers, success: resolve, fail: reject });
  });
}
```

---

## 常见调试场景与解决方案

1. 签名格式错误或不匹配
   - 现象：`/auth/verify-sig` 返回 `401 AUTH_FAILED` 或 `400 BAD_REQUEST`
   - 排查：
     - 确认消息模板完全一致（包含 `Login to KMarket: nonce=` 与实际 nonce）
     - 签名为 `0x` 前缀的 hex；地址大小写不影响，后端统一转小写比较
     - 使用 `ethers.utils.hashMessage(message)` + `Signature::recover` 思路自测

2. Nonce 过期或重复消费
   - 现象：`401 AUTH_FAILED`，提示 `nonce invalid or expired`
   - 排查：
     - 确认 `/auth/nonce` 后 5 分钟内使用
     - 保证每个 nonce 只用一次；服务端消费（delete）后不可复用

3. 令牌过期或受众/签发者不一致
   - 现象：`/auth/me` 返回 `401 UNAUTHORIZED`
   - 排查：
     - 检查 `JWT_ISS`/`JWT_AUD` 与验证端一致
     - 检查 `JWT_EXP_DAYS` 与客户端时间；建议服务端 `Validation.leeway = 5`

4. Redis 会话缺失或已撤销
   - 现象：`/auth/me` 返回 `session not found` 或 `logout` 后仍可访问
   - 排查：
     - 确认 Redis 正常；使用 `/readyz` 检查
     - 确认服务端写入使用了 `create_session_with_ttl` 且 TTL 与 JWT 对齐

5. 环境变量未配置或不一致
   - 现象：`SERVICE_UNAVAILABLE` 或就绪检查失败
   - 排查：
     - `.env.example` / `docker-compose.yml` 与实际部署一致
     - 在测试环境设置 `READYZ_SKIP_PING=true`

6. 调试辅助
   - 启用日志：`RUST_LOG=info` 或 `RUST_LOG=debug`，关注 `jwt encode failed`、`signature mismatch`、`redis unavailable` 等日志
   - 本地测试：`cargo test -q` 会运行契约与性能基线测试（`tests/auth_jwt.rs`）

---

## 错误处理最佳实践

- 统一错误响应结构：`{ code: string, message: string }`
  - 典型 Code：`BAD_REQUEST`、`UNAUTHORIZED`、`AUTH_FAILED`、`INTERNAL_ERROR`、`SERVICE_UNAVAILABLE`
- 状态码语义：
  - `400`：请求参数或签名格式错误（不可重试）
  - `401`：认证失败或会话缺失（需重新登录）
  - `503`：依赖服务暂不可用（可重试）
  - `500`：服务器内部错误（记录日志并报警）
- 日志与追踪：
  - 使用结构化日志记录错误上下文（`address`、`nonce`、`jti` 等）
  - 对外隐藏敏感细节，内部保留完整堆栈与原因

---

## 安全注意事项与配置建议

- 强密钥与安全存储：`JWT_SECRET` 至少 32 字节随机，使用密钥管理（KMS/Secret Manager），禁止硬编码或日志输出
- 算法限制：仅允许 `HS256`，拒绝 `alg=none`；验证时显式设置 `Algorithm::HS256`
- 声明校验：
  - 必须校验 `exp/iat/iss/aud`；建议设置 `Validation.leeway` 容忍小量时钟偏差
  - 使用 `jti` 支持令牌黑名单与撤销
- 会话与撤销：以 Redis 会话为准实现即时注销；令牌过期作为兜底
- 速率限制与防重放：对 `/auth/nonce`/`/auth/verify-sig` 添加限流（已可选使用 `actix-governor`），nonce 一次性消费
- 密钥轮换：
  - 低风险方案：在验证端支持两把密钥（当前/新）验证期 24–48h，随后切换编码密钥
  - 完整方案：在 Header 使用 `kid` 标识密钥版本，服务端按 `kid` 选择验证密钥

---

## 变更记录与维护建议

- 每次更新 JWT 相关逻辑（Claims 字段、校验策略、TTL、端点契约）均需同步更新本文件
- 将 `.env.example` 与 `docker-compose.yml` 中的 JWT 配置保持与文档一致
- 建议在 PR 模板中添加“更新 JWT_USE.markdown”检查项
- 定期（每季度）进行密钥轮换与安全审计，并在文档“变更记录”中记录

---

## 快速验证清单

- `/readyz` 报告 `ready=true`（或在 Skip 模式下三项配置存在）
- `/auth/nonce` → `/auth/verify-sig` → `/auth/me` 正常返回，注销后访问受限
- 契约测试通过：`cargo test -q`（含性能基线中位数 < 150ms）
- Redis 中会话 TTL 与 JWT `exp` 对齐

---

如果发现文档与实现不一致或有改进建议，请在代码库提 Issue 或直接提交 PR 更新本文件。