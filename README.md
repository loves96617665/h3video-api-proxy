# H3 Video API 代理平台

將 [H3 Video](https://h3video.haizhuapi.bond/) 的 API 封裝為 Cloudflare Workers 上的完整影片生成平台。

## 功能特性

- 🎥 **圖生影片生成**：將靜態圖片轉換為 6-15 秒動態影片
- 🖼️ **多格式支援**：JPG / PNG / WebP，最大 20MB
- ⏱️ **可調長度**：支援 6 秒、10 秒、15 秒影片
- 📱 **響應式設計**：適應手機和桌面端
- 🔁 **輪詢狀態**：自動輪詢檢查生成進度
- 💾 **歷史記錄**：本地保存生成歷史

## 後端 API

### 1. 獲取模型列表
```
GET /api/models
```

回應：
```json
{
  "models": [
    {
      "id": "minimax-h3",
      "name": "MiniMax H3 圖生影像",
      "duration": 6,
      "max_duration": 15
    }
  ]
}
```

### 2. 影片生成
```
POST /api/generate/video
Content-Type: application/json

{
  "imageUrl": "data:image/png;base64,...",
  "prompt": "影片描述",
  "duration": 6
}
```

回應：
```json
{
  "taskId": "task_xxx",
  "status": "queued",
  "seconds": 6
}
```

### 3. 獲取任務狀態
```
GET /api/status/{taskId}
```

回應：
```json
{
  "taskId": "task_xxx",
  "status": "succeeded",
  "seconds": 6,
  "ratio": "9:16"
}
```

### 4. 獲取影片結果
```
GET /api/result/{taskId}
```

回應：
```json
{
  "taskId": "task_xxx",
  "status": "succeeded",
  "videoUrl": "https://...//api/result/task_xxx",
  "downloadUrl": "https://h3video.haizhuapi.bond/v1/videos/xxx/content"
}
```

## 前端使用

### 部署步驟

1. **安裝依賴**
```bash
npm install
```

2. **本地測試**
```bash
npm run dev
```

3. **部署到 Cloudflare Workers**
```bash
# 登入 Cloudflare
wrangler login

# 部署
npm run deploy
```

### 部署後設定

需要在 Cloudflare Workers 設定以下變數：

```toml
[vars]
API_BASE = "https://h3video.haizhuapi.bond"
```

## 開發說明

### 項目結構

```
h3video-api-proxy/
├── src/
│   └── index.js          # Workers 後端與前端 UI (內嵌式)
├── package.json          # NPM 依賴配置
├── wrangler.toml         # Cloudflare Workers 配置
└── README.md             # 本文件
```

### 架構特點

- **單檔案設計**：後端與前端內嵌於同一檔案 `src/index.js` 中
- **ES Module**：使用 Cloudflare Workers 原生 ES Module
- **零依賴**：前端無需額外框架

### 主要技術

- **Cloudflare Workers**：邊緣計算平台
- **Vanilla JavaScript**：無框架的前端實現
- **Fetch API**：與 h3video API 通信
- **Service Worker**：代理請求

## 注意事項

1. **生成時間**：1-6 分鐘不等，取決於排隊和渲染時間
2. **影片格式**：縱向 9:16 比例
3. **無需 API Key**：平台無需身份驗證
4. **GPU 配額**：免費使用有配額限制

## 授權

MIT License