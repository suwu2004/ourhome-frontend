# OurHome 前端

React + Vite 的 OurHome 主页与六个房间：聊天、时光信差、记忆、心情日历、猫の金库、设置。

## 本地运行

建议使用 Node.js 22。

```bash
npm ci
cp .env.example .env
npm run dev
```

手机同一局域网预览：

```bash
npm run dev -- --host 0.0.0.0
```

生产构建：

```bash
npm run build
```

## 配置

`VITE_BACKEND_URL` 填已部署的 OurHome 后端 HTTPS 地址。未填写时仍使用当前默认 Render 地址。

API key、Tavily key 与 MCP Token 都不要写进前端环境变量；它们在设置页保存，并由后端存入 Supabase Vault。

## 部署顺序

本次增加了新的后端接口，因此先部署 `ourhome-backend`，确认健康检查成功，再部署前端。主页使用 hash 房间地址，不需要额外的 SPA rewrite。
