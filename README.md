# Flavor-HuHoBot 下载站

Flavor-HuHoBot-Discord-Bridge 的 Discord 风格下载站。

- 首页：`/`
- 下载页：`/download`
- 自动读取 GitHub Releases 与 Modrinth 版本
- 部署目标：Cloudflare Pages

## 目录

```text
index.html                 首页
download.html              /download 下载页
404.html                   404
assets/
  cover.png                网站封面
  styles.css               Discord 风格样式
  app.js                   首页版本卡片
  download.js              下载页版本列表
functions/api/releases.js  Pages Function：聚合 GitHub / Modrinth
_headers                   Cloudflare 响应头
_redirects                 /download 重写
wrangler.toml              Pages 配置
```

## 版本逻辑

`/api/releases` 会：

1. 请求 GitHub Releases API
2. 请求 Modrinth Versions API
3. 排除 draft / prerelease / 非 release
4. 只保留带 `.jar` 的版本
5. 统一去掉 GitHub tag 的 `v` 前缀
6. 按语义版本排序
7. 返回最新版本和完整版本列表

每个版本分别包含：

```json
{
  "version": "1.0.2",
  "github": { "download": "...", "page": "..." },
  "modrinth": null
}
```

因此：

- 1.0.2 只有 GitHub 时，只显示 GitHub 下载
- 1.0.0 同时存在时，显示 GitHub + Modrinth
- Modrinth 审核中时，不会出现死链

结果缓存 10 分钟。

## 本地运行

需要 Node.js：

```bash
npm install
npm run dev
```

打开 Wrangler 输出的本地地址。

直接打开 `index.html` 时无法访问 `/api/releases`，因为版本接口由 Pages Function 提供。

## 部署到 Cloudflare Pages

### 方式 A：Wrangler 直接上传（推荐）

```bash
npm install
npx wrangler login
npx wrangler pages deploy . --project-name flavor-huhobot-site
```

首次部署后，Cloudflare 会生成：

```text
flavor-huhobot-site.pages.dev
```

### 方式 B：Cloudflare Dashboard

1. Cloudflare Dashboard → Workers & Pages → Create → Pages
2. 选择 Direct Upload
3. 把本项目目录打包为 zip 上传
4. 不需要构建命令，输出目录为项目根目录

## 绑定域名

域名 `mcfwq.top` 已托管在 Cloudflare。

在 Pages 项目中：

```text
Settings → Custom domains → Set up a custom domain
```

填写：

```text
huhobot.mcfwq.top
```

因为 `mcfwq.top` 在同一个 Cloudflare 账号下，Cloudflare 会自动创建对应的 CNAME。

如果手动配置 DNS：

```text
类型：CNAME
名称：huhobot
目标：flavor-huhobot-site.pages.dev
代理：已代理（橙色云）
```

最终地址：

```text
https://huhobot.mcfwq.top/
https://huhobot.mcfwq.top/download
```

`/download` 由 `_redirects` 重写到 `download.html`，URL 保持为 `/download`。

## 环境变量

GitHub API 未认证时约 60 次/小时/IP，Cloudflare 出口 IP 可能共享，建议配置 Token。

在 Pages 项目：

```text
Settings → Environment variables
```

添加：

```text
GITHUB_TOKEN = github_pat_xxx
```

- 只给公开仓库读取权限即可
- 不要写进前端 JS
- 不配置也能运行，但更容易被 GitHub 限流

Modrinth 不需要 Token。

## Modrinth 审核期间

项目审核中时，Modrinth API 可能：

- 返回 404
- 返回非公开数据
- 暂时不可访问

页面会显示：

```text
Modrinth 暂未公开版本（审核中）
```

并且只展示 GitHub 版本。

审核通过后，刷新缓存或等待 10 分钟，Modrinth 版本会自动出现。

## 缓存

- `/api/releases`：10 分钟
- 静态资源：1 年（带 hash 文件名更佳）
- 页面 HTML：由 Cloudflare 默认缓存策略处理

如果发布新版本后页面没立即更新，等待 10 分钟或重新部署。

## 注意事项

- 本站只跳转 GitHub / Modrinth，不转存 jar
- 不显示源代码下载链接
- 所有外部链接使用 `rel="noopener noreferrer"`
- 页面会对外部版本字符串做转义，避免 XSS
- 本站不是 Discord 或 Mojang 官方站点
