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

/**
 * 前端 HTML 內容 (簡化版)
 */
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
.header h1{font-size:2rem;color:var(--p)}
.drop-zone{border:2px dashed var(--b);border-radius:var(--r);padding:40px;text-align:center;background:var(--c);cursor:pointer}
.drop-zone.active{border-color:var(--p);background:#eff6ff}
.preview{position:relative;margin-top:20px}
.preview img{max-width:100%;max-height:200px;border-radius:8px}
.btn{padding:10px 16px;border-radius:8px;margin:4px}
.gen{background:var(--p);color:#fff;border:none;cursor:pointer}
.gen:disabled{background:#647480;cursor:not-allowed}
.prg{margin:24px 0}
.bar{height:8px;background:var(--b);border-radius:4px}
.fill{height:100%;background:var(--p);transition:width .3s}
</style>
</head>
<body>
<div class="wrapper">
<header class="header"><h1>H3 Video 影片生成器</h1></header>
<div class="drop-zone" id="drop">
<input type="file" id="file" accept="image/*" hidden>
<div id="content">📷<h3>點擊或拖曳圖片</h3><p>JPG/PNG ≤ 20MB</p></div>
<div class="preview" id="preview" hidden><img id="img"><button id="clear">✕</button></div>
</div>
<textarea id="prompt" placeholder="影片描述 (可選)..."></textarea>
<div><button class="btn dur active" data-v="6">6秒</button><button class="btn dur" data-v="10">10秒</button><button class="btn dur" data-v="15">15秒</button></div>
<button class="gen" id="go" disabled>開拍影片</button>
<div class="prg" id="prog" hidden><div class="bar"><div class="fill" id="fill"></div></div><p id="txt">處理中...</p></div>
<video id="vid" controls hidden></video>
<a id="dl" class="btn" href="#" download>下載</a>
</div>
<script>
document.addEventListener('DOMContentLoaded',()=>{
const a=document.getElementById,z={img:null,d:'6',id:null,g:0};
a('drop').onclick=()=>a('file').click();
a('file').onchange=e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=t=>{z.img=t.target.result;a('img').src=z.img;a('preview').hidden=!1;a('go').disabled=!1};r.readAsDataURL(f)}};
a('clear').onclick=()=>{z.img=null;a('preview').hidden=!0;a('go').disabled=!0};
document.querySelectorAll('.dur').forEach(btn=>{
    btn.onclick=e=>{const b=e.target.closest('.dur');if(b){document.querySelectorAll('.dur').forEach(c=>c.classList.remove('active'));b.classList.add('active');z.d=b.dataset.v}
}});
a('go').onclick=async()=>{if(!z.img||z.g)return;z.g=1;a('go').disabled=!0;a('prog').hidden=!1;try{const r=await fetch('/api/generate/video',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageUrl:z.img,duration:+z.d})});const d=await r.json();if(d.error)throw new Error(d.error);z.id=d.taskId;poll()};catch(e){alert(e.message);z.g=0;a('go').disabled=!1;a('prog').hidden=!0};};
async function poll(){const r=await fetch('/api/status/'+z.id);const d=await r.json();const c=d.status==='succeeded'?100:Math.min((Date.now()%10000)/100,90);a('fill').style.width=c+'%';a('txt').textContent=d.status==='succeeded'?'完成!':d.status==='failed'?'失敗':'處理中...';if(d.status==='succeeded'){const w=await fetch('/api/result/'+z.id).then(r=>r.json());a('vid').src=w.videoUrl;a('vid').hidden=!1;a('dl').href=w.downloadUrl;z.g=0;a('prog').hidden=!0}else if(d.status!=='failed'){setTimeout(poll,3000)}else{z.g=0;a('go').disabled=!1;a('prog').hidden=!0}};
});
</script>
</body></html>`;
