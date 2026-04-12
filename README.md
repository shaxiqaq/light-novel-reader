# Novel Reader

一个基于 Vue 3 + Vite 的纯前端项目，直接在浏览器里读取上游小说 API。

## 功能

- 首页列表，数据来自 `/api/v3/books`
- 小说详情页与卷列表合并
- 阅读页支持卷元数据与 GBK 文本解码
- `content_type = 2` 的插图直接渲染
- 本地保存字号、行距、主题和阅读进度
- 首页接入上游搜索 API，按关键词直接搜索作品
- 提供独立的历史记录页面，集中查看最近浏览和继续阅读

## 安装

1. 安装 Node.js 18+
2. 运行 `npm install`
3. 运行 `npm run dev`

## 构建

- `npm run build`
- `npm run preview`

## 路由

- `/`
- `/history`
- `/book/:pathWord`
- `/book/:pathWord/volume/:volumeId`

## 注意事项

- 项目直接从浏览器调用远程 API，没有自建后端。
- 部署时需要在 CSP 中允许这些域名：
  - `connect-src https://api.2026copy.com https://s3.mangafunb.fun`
  - `img-src https://s3.mangafunb.fun data:`
- 正文文本使用 `TextDecoder('gbk')` 解码。
- 首页搜索直接调用 `search/books` 接口，并支持独立分页。
- 历史记录保存在浏览器 `localStorage` 中。
- 如果上游 API 结构变化，项目需要同步调整。
