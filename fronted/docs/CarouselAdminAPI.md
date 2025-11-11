# Carousel 管理端 API 文档

基础路径：`/api/carousel/items`

## GET /api/carousel/items
- 返回所有轮播卡片
- 响应：
```json
{ "ok": true, "items": [ {"id":"c1","title":"...","href":"...","order":1,"enabled":true} ] }
```

## POST /api/carousel/items
- 新增卡片
- 请求体：
```json
{ "title":"string", "subtitle":"string?", "imageUrl":"string", "href":"string", "order":1, "enabled":true }
```
- 响应：
```json
{ "ok": true, "item": { "id":"generated", ... } }
```

## PUT /api/carousel/items
- 更新卡片
- 请求体：
```json
{ "id":"string", "title":"string?", "subtitle":"string?", "imageUrl":"string?", "href":"string?", "order":2, "enabled":false }
```
- 响应：
```json
{ "ok": true, "item": { ... } }
```

## DELETE /api/carousel/items
- 删除卡片
- 请求体：
```json
{ "id":"string" }
```
- 响应：
```json
{ "ok": true }
```

## 注意事项
- 当前实现使用本地 JSON 文件 `fronted/lib/database/carousel.json` 持久化（开发环境）。
- 生产环境建议替换为后端数据库写入（例如通过环境变量配置后端 Base URL 并由 `apiClient` 转发）。
- 所有写操作按 `order` 字段自动排序并覆盖写入。