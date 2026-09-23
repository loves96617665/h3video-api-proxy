/**
 * H3 Video API Proxy - Cloudflare Workers
 * 代理 h3video.haizhuapi.bond 的影片生成 API
 */

const API_BASE = "https://h3video.haizhuapi.bond";

// 任務存儲
const jobs = new Map();

// 支援模型
const MODELS = {
    "minimax-h3": {
        name: "MiniMax H3 圖生影像",
        duration: 6,
        max_duration: 15
    }
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // 服務前端 HTML
        if (path === "/" || path === "/index.html") {
            return new Response(HTML, {
                headers: { "Content-Type": "text/html; charset=utf-8" }
            });
        }

        // API 路由
        if (path === "/api/models") return new Response(JSON.stringify({ models: Object.values(MODELS) }), { headers: { "Content-Type": "application/json" } });
        if (path === "/api/generate/video" && request.method === "POST") return handleVideoGeneration(request);
        if (path.startsWith("/api/status/") && request.method === "GET") return handleStatus(path.split("/").pop());
        if (path.startsWith("/api/result/") && request.method === "GET") return handleResult(path.split("/").pop(), url.origin);

        return new Response("Not Found", { status: 404 });
    }
};

/**
 * 影片生成
 */
async function handleVideoGeneration(request) {
    const { imageUrl, prompt = "", duration = 6, aspectRatio = "9:16" } = await request.json();

    if (!imageUrl) return json({ error: "imageUrl is required" }, 400);
    if (![6, 10, 15].includes(duration)) return json({ error: "duration must be 6, 10, or 15" }, 400);

    const taskId = "task_" + Math.random().toString(36).substr(2, 9);

    try {
        const resp = await fetch(API_BASE + "/v1/videos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: imageUrl, prompt, seconds: String(duration), size: aspectRatio })
        });

        const data = await resp.json();

        if (data.id) {
            jobs.set(taskId, { h3TaskId: data.id, status: data.status, seconds: duration, ratio: aspectRatio });
            return json({ taskId, status: data.status, seconds: duration, ratio: aspectRatio }, 200);
        }

        return json(data, resp.status);
    } catch (e) {
        return json({ error: e.message }, 500);
    }
}

/**
 * 獲取任務狀態
 */
async function handleStatus(taskId) {
    const job = jobs.get(taskId);
    if (!job) return json({ error: "Task not found" }, 404);

    try {
        const resp = await fetch(API_BASE + "/v1/videos/" + job.h3TaskId);
        const data = await resp.json();
        jobs.set(taskId, { ...job, status: data.status });
        return json({ taskId, status: data.status, seconds: job.seconds, ratio: job.ratio }, 200);
    } catch (e) {
        return json({ taskId, status: job.status, error: e.message }, 200);
    }
}

/**
 * 獲取影片結果
 */
async function handleResult(taskId, origin) {
    const job = jobs.get(taskId);
    if (!job) return json({ error: "Task not found" }, 404);

    const resp = await fetch(API_BASE + "/v1/videos/" + job.h3TaskId + "/content");
    if (!resp.ok) return json({ error: "Video not ready" }, 404);

    return json({
        taskId,
        status: "succeeded",
        videoUrl: origin + "/api/result/" + taskId,
        downloadUrl: resp.url
    }, 200);
}

/**
 * JSON 響應
 */
function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

const HTML = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>H3 Video 影片生成器</title>
<style>
:root{--p:#2563eb;--c:#fff;--t:#0f172a;--b:#e2e8f0;--r:12px}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f8fafc;color:var(--t);min-height:100vh}
.wrapper{max-width:600px;margin:0 auto;padding:20px}
.header{text-align:center;padding:32px 0}
.header h1{font-size:1.8rem;color:var(--p);margin-bottom:8px}
.header p{color:var(--b);font-size:1rem}
.upload-section{background:var(--c);border-radius:var(--r);padding:24px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.05)}
.upload-title{font-weight:600;color:var(--t);margin-bottom:12px;font-size:0.95rem}
.drop-zone{border:2px dashed var(--b);border-radius:var(--r);padding:28px;text-align:center;background:var(--c);cursor:pointer;transition:all 0.2s}
.drop-zone:hover{border-color:var(--p);background:#eff6ff}
.drop-zone.active{border-color:var(--p);background:#eff6ff}
.drop-zone.hidden{display:none}
.upload-icon{font-size:48px;margin-bottom:12px}
.upload-text{font-size:1.1rem;font-weight:600;color:var(--t);margin-bottom:8px}
.upload-desc{color:var(--b);font-size:0.85rem}
.preview-section{background:var(--c);border-radius:var(--r);padding:20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.05)}
.preview{position:relative;text-align:center}
.preview img{max-width:100%;max-height:180px;border-radius:8px;display:block;margin:0 auto;object-fit:cover}
.clear-btn{position:absolute;top:8px;right:8px;width:26px;height:26px;background:var(--p);color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:0.9rem;line-height:1;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s}
.preview:hover .clear-btn{opacity:1}
.input-section{background:var(--c);border-radius:var(--r);padding:20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.05)}
.prompt-wrapper{margin-bottom:14px}
.prompt-label{font-weight:500;color:var(--t);margin-bottom:6px;font-size:0.9rem}
#prompt{width:100%;padding:12px;border:1px solid var(--b);border-radius:6px;font-size:0.95rem;resize:vertical;min-height:44px;max-height:100px}
#prompt::placeholder{color:var(--b)}
.duration-group{display:flex;gap:10px;flex-wrap:wrap}
.duration-btn{flex:1;min-width:70px;padding:10px 8px;border:1px solid var(--b);border-radius:6px;background:#fff;cursor:pointer;font-size:0.9rem;font-weight:500;color:var(--t);transition:all 0.2s;text-align:center}
.duration-btn:hover{background:#f8fafc}
.duration-btn.active{background:var(--p);color:#fff;border-color:var(--p)}
.generate-section{text-align:center}
#go{padding:14px 32px;font-size:1rem;font-weight:600;background:var(--p);color:#fff;border:none;border-radius:8px;cursor:pointer;transition:background 0.2s}
#go:hover{background:#1d4ed8}
#go:disabled{background:#cbd5e1;cursor:not-allowed}
.progress-section{background:var(--c);border-radius:var(--r);padding:20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.05)}
.progress-bar{width:100%;height:8px;background:var(--b);border-radius:4px;overflow:hidden;margin-bottom:8px}
.progress-fill{height:100%;background:var(--p);width:0%;transition:width 0.3s}
.progress-text{font-size:0.9rem;color:var(--b)}
.video-section{background:var(--c);border-radius:var(--r);padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05)}
.video-wrapper{position:relative;width:100%;background:#000;border-radius:8px;margin-bottom:12px}
#vid{width:100%;height:auto;display:block}
#dl{display:inline-block;padding:10px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;transition:background 0.2s;margin-top:8px}
#dl:hover{background:#059669}
.status-note{font-size:0.8rem;color:var(--b);text-align:center;margin-top:16px}
.hidden{display:none!important}
</style>
</head>
<body>
<div class="wrapper">
<header class="header">
<h1>H3 Video 影片生成器</h1>
<p>將您的靜態圖片轉換為動態影片</p>
</header>

<div class="upload-section">
<div class="upload-title">上傳圖片</div>
<div class="drop-zone" id="drop">
<div class="upload-icon">📷</div>
<div class="upload-text" id="uploadText">點擊或拖曳圖片至此</div>
<div class="upload-desc">支援 JPG/PNG/WebP，最大 20MB</div>
<input type="file" id="file" accept="image/*" hidden>
</div>
</div>

<div class="preview-section hidden" id="preview">
<div class="preview">
<img id="img" alt="預覽圖片">
<button class="clear-btn" id="clear">✕</button>
</div>
</div>

<div class="input-section">
<div class="prompt-wrapper">
<label class="prompt-label" for="prompt">影片描述 (選填)</label>
<textarea id="prompt" placeholder="請描述您期望的影片內容，例如：溫柔的岬浜，金色的夕陽..."></textarea>
</div>
<div class="duration-group">
<button class="duration-btn active" data-duration="6">6 秒</button>
<button class="duration-btn" data-duration="10">10 秒</button>
<button class="duration-btn" data-duration="15">15 秒</button>
</div>
</div>

<div class="generate-section">
<button class="gen-btn" id="go" disabled>🎬 開始生成影片</button>
</div>

<div id="prog" class="progress-section hidden">
<div class="progress-bar">
<div class="progress-fill" id="fill"></div>
</div>
<div class="progress-text" id="txt">處理中...</div>
</div>

<div class="video-section hidden" id="videoSection">
<div class="video-wrapper">
<video id="vid" controls></video>
</div>
<a id="dl" href="#" download>📥 下載影片</a>
</div>

<div class="status-note" id="statusNote">生成影片預計耗時 1-3 分鐘，請耐心等待</div>
</div>

<script>
document.addEventListener('DOMContentLoaded',function(){
const a=document.getElementById,z={img:null,d:'6',id:null,g:0};

// 上傳區塊
a('drop').onclick=function(){a('file').click();};
a('file').onchange=function(e){
    const f=e.target.files[0];
    if(f){
        const r=new FileReader();
        r.onload=function(t){
            z.img=t.target.result;
            a('img').src=z.img;
            a('preview').hidden=false;
            a('drop').hidden=true;
            a('go').disabled=false;
        };
        r.readAsDataURL(f);
    }
};
a('clear').onclick=function(){
    z.img=null;
    a('preview').hidden=true;
    a('drop').hidden=false;
    a('go').disabled=true;
};

// 影片長度選擇
document.querySelectorAll('.duration-btn').forEach(function(btn){
    btn.onclick=function(e){
        const b=e.target.closest('.duration-btn');
        if(b){
            document.querySelectorAll('.duration-btn').forEach(function(c){
                c.classList.remove('active');
            });
            b.classList.add('active');
            z.d=b.dataset.duration;
        }
    };
});

// 開始生成
a('go').onclick=async function(){
    if(!z.img||z.g)return;z.g=1;a('go').disabled=true;a('prog').hidden=false;a('uploadText').textContent='影片渲染中...';
    try{
        const r=await fetch('/api/generate/video',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({imageUrl:z.img,duration:+z.d})
        });
        const d=await r.json();
        if(d.error)throw new Error(d.error);
        z.id=d.taskId;
        poll();
    }catch(e){
        alert(e.message);
        z.g=0;a('go').disabled=false;a('prog').hidden=true;a('uploadText').textContent='點擊或拖曳圖片至此';
    }
};

// 輪詢狀態
async function poll(){
    const r=await fetch('/api/status/'+z.id);
    const d=await r.json();
    const c=d.status==='succeeded'?100:Math.min((Date.now()%10000)/100,90);
    a('fill').style.width=c+'%';
    a('txt').textContent=d.status==='succeeded'?'完成!':d.status==='failed'?'失敗':'處理中...';
    if(d.status==='succeeded'){
        const w=await fetch('/api/result/'+z.id).then(r=>r.json());
        a('vid').src=w.videoUrl;
        a('vid').hidden=false;
        a('dl').href=w.downloadUrl;
        a('videoSection').hidden=false;
        z.g=0;a('prog').hidden=true;a('uploadText').textContent='生成完成! 可下載影片';
    }else if(d.status!=='failed'){
        setTimeout(poll,3000);
    }else{
        z.g=0;a('go').disabled=false;a('prog').hidden=true;a('uploadText').textContent='點擊或拖曳圖片至此';
    }
};
});
</script>
</body></html>`;
