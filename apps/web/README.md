# annapod Web

annapod（安娜心训舱，简称安心舱）现已采用 Cloudflare Pages 全栈部署形态：

- Next.js 16 静态前端
- Pages advanced mode Worker
- D1 `runtime_state` 会话引擎
- D1 + Vectorize 数据层

## 本地开发

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

默认访问 `http://localhost:3000`。

## Cloudflare Pages

项目构建后会输出：

- `out/` 静态页面资源
- `out/_worker.js` Pages Worker 入口

建议的 Pages 设置：

- Root directory: `apps/web`
- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Build output directory: `out`

建议的运行时环境变量：

- `AI_API_KEY`
- `AI_BASE_URL=https://api.openai.com/v1`
- `AI_MODEL=gpt-5-nano`
- `JWT_SECRET=<强随机字符串>`

如果你把前后端都放在同一个 Pages 项目里，`NEXT_PUBLIC_API_URL` 可以不填，前端会默认走同域 `/api/v1/*`。

还需要手动完成：

1. 创建 D1 数据库并应用 `cloudflare/migrations/*.sql`
2. 创建 Vectorize index
3. 在 `wrangler.jsonc` 中填入真实 binding ID

## 一次性初始化

建议在 `apps/web` 下执行：

```bash
pnpm cf:bootstrap:db
pnpm cf:bootstrap:vector
pnpm cf:migrate:remote
```

说明：

- `pnpm cf:bootstrap:db` 会返回 D1 数据库 UUID，请把它填入 `wrangler.jsonc` 的 `database_id`
- `pnpm cf:bootstrap:vector` 会创建名为 `annapod-memory` 的 Vectorize index，维度为 `1536`

## GitHub 自动部署

仓库已补充 `.github/workflows/cloudflare-pages-deploy.yml`，推送到 `main` 后会自动：

1. 安装依赖
2. `lint`
3. 构建 `out/` 与 `out/_worker.js`
4. 同步 Pages secrets
5. 执行 D1 migrations
6. 发布到 Cloudflare Pages

需要在 GitHub 仓库 Secrets 中配置：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `AI_API_KEY`
- `JWT_SECRET`
