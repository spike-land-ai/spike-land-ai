import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";

const iwd = new Hono<{ Bindings: Env }>();

function todayStartMs(): number {
  const now = new Date();
  return new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()).getTime();
}

// POST /api/iwd/checkin — record visitor geo from CF headers
iwd.post("/api/iwd/checkin", async (c) => {
  const cf = (c.req.raw as unknown as { cf?: Record<string, unknown> }).cf;
  let latitude = cf?.latitude as number | undefined;
  let longitude = cf?.longitude as number | undefined;
  let city = cf?.city as string | undefined;
  let country = cf?.country as string | undefined;

  // Dev fallback: random coordinates when CF geo is missing
  if (latitude == null || longitude == null) {
    latitude = Math.random() * 140 - 70;
    longitude = Math.random() * 360 - 180;
    city = "DevCity";
    country = "XX";
  }

  const start = todayStartMs();

  // Deduplicate by lat/lon/city within today
  const existing = await c.env.DB.prepare(
    "SELECT id FROM iwd_visitors WHERE latitude = ? AND longitude = ? AND city IS ? AND created_at >= ?",
  )
    .bind(latitude, longitude, city ?? null, start)
    .first<{ id: string }>();

  if (existing) {
    return c.json({ ok: true, id: existing.id, isNew: false });
  }

  const result = await c.env.DB.prepare(
    "INSERT INTO iwd_visitors (latitude, longitude, city, country) VALUES (?, ?, ?, ?) RETURNING id",
  )
    .bind(latitude, longitude, city ?? null, country ?? null)
    .first<{ id: string }>();

  return c.json({ ok: true, id: result?.id, isNew: true });
});

// GET /api/iwd/visitors — all today's visitors, with optional ?since= for incremental
iwd.get("/api/iwd/visitors", async (c) => {
  const since = Number(c.req.query("since")) || todayStartMs();
  const visitors = await c.env.DB.prepare(
    "SELECT id, latitude, longitude, city, country, created_at FROM iwd_visitors WHERE created_at >= ? ORDER BY created_at ASC",
  )
    .bind(since)
    .all();

  return c.json({
    visitors: visitors.results,
    count: visitors.results.length,
    serverTime: Date.now(),
  });
});

// GET /iwd — serve standalone HTML page
iwd.get("/iwd", (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>International Women's Day 2026 — spike.land</title>
<meta name="description" content="See visitors from around the world lighting up the map in real-time for International Women's Day 2026">
<link rel="stylesheet" href="https://esm.spike.land/leaflet@1.9.4/dist/leaflet.css">
<script src="https://esm.spike.land/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script src="https://unpkg.com/canvas-confetti@1.9.3/dist/confetti.browser.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
body{background:linear-gradient(135deg,#1a0a2e 0%,#0d1117 100%)}
#map{width:100%;height:100%;position:absolute;top:0;left:0;z-index:1}
.leaflet-tile-pane{filter:hue-rotate(260deg) saturate(1.4) brightness(0.85)}
#banner{position:fixed;top:0;left:0;right:0;z-index:1000;
  background:linear-gradient(90deg,rgba(160,32,240,0.9),rgba(68,183,139,0.85));
  backdrop-filter:blur(12px);padding:12px 24px;display:flex;
  align-items:center;justify-content:space-between;color:#fff}
#banner h1{font-size:1.2rem;font-weight:700;letter-spacing:0.5px}
#banner .subtitle{font-size:0.85rem;opacity:0.9}
#counter{font-size:1.4rem;font-weight:800;background:rgba(255,255,255,0.15);
  padding:6px 16px;border-radius:20px;min-width:60px;text-align:center}
@keyframes pulse-glow{
  0%{transform:scale(1);box-shadow:0 0 0 0 rgba(160,32,240,0.7)}
  50%{transform:scale(1.8);box-shadow:0 0 20px 10px rgba(160,32,240,0.3)}
  100%{transform:scale(1);box-shadow:0 0 0 0 rgba(160,32,240,0)}
}
.pulse-marker{animation:pulse-glow 2s ease-in-out 3}
.visitor-pin{width:10px;height:10px;border-radius:50%;background:#A020F0;
  border:2px solid rgba(255,255,255,0.6);cursor:default}
.visitor-pin.new{background:#44B78B}
</style>
</head>
<body>
<div id="banner">
  <div>
    <h1>International Women's Day 2026</h1>
    <div class="subtitle">spike.land — lighting up the world together</div>
  </div>
  <div id="counter">0</div>
</div>
<div id="map"></div>
<script>
(function(){
  const map = L.map('map',{zoomControl:false,attributionControl:false}).setView([20,0],2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
    maxZoom:18,subdomains:'abcd'
  }).addTo(map);
  L.control.zoom({position:'bottomright'}).addTo(map);

  const markers=new Map();
  let lastServerTime=0;
  let totalCount=0;
  const counterEl=document.getElementById('counter');

  function addPin(v,isNew){
    if(markers.has(v.id))return;
    const el=document.createElement('div');
    el.className='visitor-pin'+(isNew?' new':'');
    if(isNew)el.classList.add('pulse-marker');
    const icon=L.divIcon({className:'',html:el,iconSize:[14,14],iconAnchor:[7,7]});
    const m=L.marker([v.latitude,v.longitude],{icon,interactive:false}).addTo(map);
    if(v.city&&v.country){
      m.bindTooltip(v.city+', '+v.country,{direction:'top',offset:[0,-8]});
    }
    markers.set(v.id,m);
  }

  async function checkin(){
    try{
      const r=await fetch('/api/iwd/checkin',{method:'POST'});
      const d=await r.json();
      if(d.isNew&&typeof confetti==='function'){
        confetti({particleCount:120,spread:80,origin:{y:0.3},
          colors:['#A020F0','#44B78B','#fff','#D946EF']});
      }
    }catch(e){console.warn('checkin failed',e)}
  }

  async function loadVisitors(since){
    try{
      const url='/api/iwd/visitors'+(since?'?since='+since:'');
      const r=await fetch(url);
      const d=await r.json();
      const isIncremental=!!since;
      d.visitors.forEach(v=>addPin(v,isIncremental));
      if(!isIncremental)totalCount=d.count;
      else totalCount+=d.count;
      counterEl.textContent=totalCount;
      lastServerTime=d.serverTime;
    }catch(e){console.warn('load failed',e)}
  }

  async function init(){
    await checkin();
    await loadVisitors();
    setInterval(()=>loadVisitors(lastServerTime),5000);
  }
  init();
})();
<\/script>
</body>
</html>`;

  return c.html(html);
});

export { iwd };
