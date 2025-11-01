# 项目启动指南（K Market / Predix Markets）

本指南帮助你在本地快速启动前端应用、配置 Solana Devnet 以及（可选）通过 ngrok 暴露外网访问地址。

## 前置要求
- Node.js `18+`
- `npm` 或 `yarn`
- Windows 用户（可选）：安装 WSL（用于 Solana CLI / Anchor 等链上开发）

## 安装依赖
1. 进入前端项目目录：
   ```bash
   cd Predix
   ```
2. 安装依赖：
   ```bash
   npm install
   ```

## 配置环境变量
1. 复制示例环境文件：
   ```bash
   cp .env.example .env.local
   ```
2. 打开并设置关键变量（按需）：
   - `NEXT_PUBLIC_SOLANA_NETWORK=devnet`（或 `mainnet-beta` / `testnet`）
   - `NEXT_PUBLIC_SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=<YOUR_HELIUS_API_KEY>`（可选；留空则使用 `clusterApiUrl(network)`）
   - `NEXT_PUBLIC_WC_PROJECT_ID=<your_walletconnect_project_id>`（可选）
   - `NEXT_PUBLIC_CONTRACT_ADDRESS=0x...`（以太坊合约可选）
   - `NEXT_PUBLIC_USDC_MINT` / `NEXT_PUBLIC_USDT_MINT`（可选；用于过滤 SPL Token 余额）
   - `CRAWLER_API_KEY=<your_crawler_api_key>`（可选；内容爬取）

示例文件位于 `Predix/.env.example`，可参考并根据实际需要填写。

## 启动开发服务器
- 默认端口（3000）：
  ```bash
  npm run dev
  ```
- 指定端口（例如 3002，便于与 ngrok 配合）：
  ```bash
  npm run dev -- -p 3002
  ```
  启动后访问 `http://localhost:3002`

## （可选）通过 ngrok 暴露外网地址
项目根目录已包含 `ngrok.exe`，可将本地端口映射到公网：
```bash
./ngrok.exe http 3002 --log=stdout
```
执行成功后，终端会显示一个 `https://xxxx.ngrok-free.dev/` 地址，将其分享给外部进行访问。

## Solana Devnet 设置与钱包
- 前端钱包适配器使用 `@solana/wallet-adapter`，网络与 RPC 由以下变量控制：
  - `NEXT_PUBLIC_SOLANA_NETWORK`（默认 `devnet`）
  - `NEXT_PUBLIC_SOLANA_RPC_URL`（设置后优先使用 Helius RPC）
- 在页面中连接 Phantom / Solflare 等钱包后，可进行投注操作，交易会在 Devnet 上发送并记录。
- 交易发送逻辑参考：`Predix/lib/solana-ledger.ts` 与组件 `SportsBettingClient`；历史记录可在 `Account -> Bets` 页面查看，并可跳转到区块浏览器：
  - `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`

## 常见问题
- 端口占用：改用 `npm run dev -- -p <PORT>` 指定其他端口。
- 无法连接 Devnet：检查 `NEXT_PUBLIC_SOLANA_RPC_URL` 是否正确、网络是否代理。
- Node 版本问题：确保使用 `Node.js 18+`，与 `netlify.toml` 环境一致。
- Windows/WSL：如需使用 Solana CLI/Anchor，建议在 WSL 中进行链上操作。

## 参考文档
- `docs/solana-wallet-ledger-devnet-plan.md`（Devnet 与 Helius RPC 说明）
- `docs/helius-anchor-wsl/STEP-BY-STEP.md`（WSL 环境与 Anchor 步骤）
- `Predix/README.md`（项目特性与基本启动）

---
如需将前端部署到 Netlify，请参考 `Predix/netlify.toml` 并在 Netlify 控制台配置环境变量与构建命令（`npm run build`）。