# H3 Video API 代理 - 架構設計

## 項目概述

將 h3video.haizhuapi.bond 的 API 逆向封裝為 Cloudflare Workers 上的完整影片生成平台。

## 目錄結構

```
h3video-api-proxy/
├── src/
│   └── index.js          # Workers 進入口 + 前端 UI (內嵌式)
├── package.json          # NPM 依賴配置
├── wrangler.toml         # Cloudflare Workers 配置
└── README.md             # 使用說明文件
```

## 核心功能

### 後端 API

| 端點 | 方法 | 功能 |
|------|------|------|
| `/api/models` | GET | 獲取支援模型列表 |
| `/api/generate/video` | POST | 影片生成任務 |
| `/api/status/:id` | GET | 任務狀態查詢 |
| `/api/result/:id` | GET | 獲取影片結果 |

### 前端功能

- 圖片上傳 (拖拽/點擊/粘貼)
- Prompt 輸入
- 影片長度選擇 (6s/10s/15s)
- 生成進度顯示
- 結果下載/分享

## 架構設計

### 單檔案內嵌式架構

本專案採用單檔案設計，將以下主要內容封裝於 `src/index.js`：

1. **後端 API 處理器**：
   - `handleVideoGeneration()`：處理影片生成請求
   - `handleStatus()`：輪詢取得任務狀態
   - `handleResult()`：獲取完成影片結果

2. **前端 UI 內嵌 HTML**：
   - `HTML` 常量：完整的 HTML 文檔，包含 CSS 和 JavaScript
   - 標頭引用 `charset="UTF-8"`，支援繁體中文

3. **任務狀態管理**：
   - 使用 `Map` 結構存儲任務 ID 與 h3video 內部任務 ID 的映射
   - 記憶體存放，但效能足夠支援短期使用

## 技術實現

### Workers 後端
- 使用 Cloudflare Workers 原生 Fetch API
- 代理 h3video 內部 API
- 處理 base64 圖片上傳
- 輪詢式任務狀態查詢

### 前端 UI
- 靜態 HTML/CSS/JavaScript
- 使用 Fetch API 調用後端
- 本地狀態管理
- 無框架依賴

### API 通訊流程

```
使用者瀏覽器 → Workers (src/index.js) → H3 Video API

1. 用戶訪問("/") → 回傳內嵌 HTML 首頁
2. 用戶上傳圖片 → 前端將圖片 base64 編碼
3. 前端呼叫 "/api/generate/video" → Workers 代理發送給 h3video
4. 用戶瀏覽器輪詢 "/api/status/{taskId}" → Workers 輪詢 h3video
5. 用戶端取得 "/api/result/{taskId}" → Workers 回傳影片連結
```

## 開發與部署

### 本地開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```

### 部署

```bash
# 登入 Cloudflare
wrangler login

# 部署至生產環境
npm run deploy
```

### 配置變數

在 `wrangler.toml` 中設定：

```toml
[vars]
API_BASE = "https://h3video.haizhuapi.bond"
```

## 注意事項

1. **生成時間**：1-6 分鐘不等，取決於排隊和渲染時間
2. **影片格式**：縱向 9:16 比例
3. **無需 API Key**：平台無需身份驗證
4. **GPU 配額**：免費使用有配額限制