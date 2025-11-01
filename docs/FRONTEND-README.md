# 前端运行 README

只包含运行 Predix 前端所需的最小步骤。

## 前置要求
- Node.js `18+`
- `npm`（或 `yarn`）

## 安装与启动
1. 进入前端目录：
   ```bash
   cd Predix
   ```
2. 安装依赖：
   ```bash
   npm install
   ```
3. （建议）配置环境变量：
   ```bash
   cp .env.example .env.local
   ```
   在 `.env.local` 至少设置：
   - `NEXT_PUBLIC_SOLANA_NETWORK=devnet`
   - 可选：`NEXT_PUBLIC_SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=<YOUR_HELIUS_API_KEY>`（不设置则使用默认 `clusterApiUrl(devnet)`）
4. 启动开发服务器：
   - 默认端口 `3000`
     ```bash
     npm run dev
     ```
   - 指定端口（例如 `3002`）
     ```bash
     npm run dev -- -p 3002
     ```
5. 打开浏览器访问：
   - 默认：`http://localhost:3000`
   - 指定端口：`http://localhost:3002`

## 可选：ngrok 外网访问
在项目根目录执行（结合端口 `3002` 示例）：
```bash
./ngrok.exe http 3002 --log=stdout
```
成功后终端会展示一个 `https://xxxx.ngrok-free.dev/` 的地址用于外部访问。

## 钱包与网络
- 前端钱包适配器支持 Phantom / Solflare 等；使用 `@solana/wallet-adapter`。
- 网络配置由环境变量控制：
  - `NEXT_PUBLIC_SOLANA_NETWORK`（默认 `devnet`）
  - `NEXT_PUBLIC_SOLANA_RPC_URL`（设置后优先使用 Helius RPC）

## 常见问题
- 端口占用：使用 `npm run dev -- -p <PORT>` 指定其他端口。
- Node 版本：确保 `Node.js 18+`。
- Devnet RPC：如果未设置 `NEXT_PUBLIC_SOLANA_RPC_URL`，将自动使用默认 `clusterApiUrl(devnet)`。