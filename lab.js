(() => {
  'use strict';

  // ---------- DOM / UI ----------
  const $ = (id) => document.getElementById(id);
  const status = (m) => { const s=$('status'); if (s) s.textContent = m; };

  const canvas = $('gl');
  const vid    = $('vid');

  const ui = {
    // existing
    cell: $('cell'),
    str:  $('strength'),
    rgb:  $('rgb'),
    speed:$('speed'),
    fx_trail:  $('fx_trail'),
    fx_vhs:    $('fx_vhs'),
    fx_cpunk:  $('fx_cpunk'),
    fx_invert: $('fx_invert'),
    fx_binary: $('fx_binary'),
    fx_text:   $('fx_text'),
    fx_blocks: $('fx_blocks'),
    fx_leak:   $('fx_leak'),
    fx_tape:   $('fx_tape'),
    fx_psort:  $('fx_psort'),
    text_ms:   $('text_ms'),
    fx_mono:   $('fx_mono'),
    mono_a:    $('mono_a'),
    mono_b:    $('mono_b'),
    // NEW (optional – safe defaults if missing)
    fx_crt:        $('fx_crt'),
    crt_curve:     $('crt_curve'),
    crt_scan:      $('crt_scan'),
    fx_bloom:      $('fx_bloom'),
    bloom_thresh:  $('bloom_thresh'),
    bloom_amt:     $('bloom_amt'),
    fx_edges:      $('fx_edges'),
    edge_amt:      $('edge_amt'),
    fx_kaleido:    $('fx_kaleido'),
    kaleido_slices:$('kaleido_slices'),
    kaleido_angle: $('kaleido_angle'),
    fx_ripple:     $('fx_ripple'),
    ripple_radius: $('ripple_radius'),
    ripple_amt:    $('ripple_amt'),
    psort_thresh:  $('psort_thresh'),
    psort_dir:     $('psort_dir') // 'h' or 'v'
  };

  // ---------- Include-for-Randomize (⭐) ----------
  const EFFECT_KEYS = [
    'cpunk','invert','leak','vhs','tape','blocks','trail','binary','psort','mono','text','crt','bloom','edges','kaleido','ripple'
  ];

  // map effect -> elements
  const inc = {};
  for (const k of EFFECT_KEYS) inc[k] = $(`inc_${k}`);

  const randSummary = $('randSummary');
  const btnIncAll   = $('incAll');
  const btnIncNone  = $('incNone');

  // persist include pool
  const STORE_KEY = 'swfx_randomize_pool_v1';

  function loadIncludePool() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      const set = new Set(arr);
      for (const k of EFFECT_KEYS) {
        if (!inc[k]) continue;
        inc[k].checked = set.has(k);
      }
    } catch {}
  }
  function saveIncludePool() {
    try {
      const pool = getIncludePool();
      localStorage.setItem(STORE_KEY, JSON.stringify(pool));
    } catch {}
  }
  function getIncludePool() {
    const list = [];
    for (const k of EFFECT_KEYS) {
      if (inc[k]?.checked) list.push(k);
    }
    return list;
  }
  function updateRandSummary() {
    if (!randSummary) return;
    const pool = getIncludePool();
    randSummary.textContent = pool.length
      ? `Randomize will use: ${pool.join(', ')}`
      : `Randomize will use: (none — toggle ⭐ to include effects)`;
  }

  // wire star checkboxes
  for (const k of EFFECT_KEYS) {
    if (!inc[k]) continue;
    inc[k].addEventListener('change', () => {
      saveIncludePool();
      updateRandSummary();
    });
  }
  // wire Select All / None
  btnIncAll?.addEventListener('click', () => {
    for (const k of EFFECT_KEYS) if (inc[k]) inc[k].checked = true;
    saveIncludePool(); updateRandSummary();
  });
  btnIncNone?.addEventListener('click', () => {
    for (const k of EFFECT_KEYS) if (inc[k]) inc[k].checked = false;
    saveIncludePool(); updateRandSummary();
  });

  // load persisted pool (once DOM is ready enough)
  loadIncludePool();
  updateRandSummary();

  // ---------- Buttons ----------
  $('btnCam')?.addEventListener('click', startCam);
  $('btnRandom')?.addEventListener('click', randomizeAll);
  $('btnShuffle')?.addEventListener('click', shuffleOrder);
  $('btnShuffle2')?.addEventListener('click', shuffleOrder);

  const clickSfx = $('clickSfx');
  if (clickSfx) {
    clickSfx.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACAAABAAEA/////wD///8AAP//AAD//wAA//8AAP///w==";
    document.querySelectorAll('.sfx').forEach(b =>
      b.addEventListener('click', () => { try { clickSfx.currentTime = 0; clickSfx.play(); } catch {} })
    );
  }

  // ---------- Randomize logic ----------
  function randomizeAll(){
    // Always randomize core globals (as before)
    if (ui.cell)  ui.cell.value  = (Math.random()*64+8)|0;
    if (ui.str)   ui.str.value   = (Math.random()*70+10)|0;
    if (ui.rgb)   ui.rgb.value   = (Math.random()*80)|0;
    if (ui.speed) ui.speed.value = (Math.random()*80+10)|0;

    // Only randomize INCLUDED effects + their params
    const pool = new Set(getIncludePool()); // e.g., { 'vhs','bloom' }

    // toggles
    const toggleMap = {
      cpunk:  ui.fx_cpunk,
      invert: ui.fx_invert,
      leak:   ui.fx_leak,
      vhs:    ui.fx_vhs,
      tape:   ui.fx_tape,
      blocks: ui.fx_blocks,
      trail:  ui.fx_trail,
      binary: ui.fx_binary,
      psort:  ui.fx_psort,
      mono:   ui.fx_mono,
      text:   ui.fx_text,
      crt:    ui.fx_crt,
      bloom:  ui.fx_bloom,
      edges:  ui.fx_edges,
      kaleido:ui.fx_kaleido,
      ripple: ui.fx_ripple
    };

    for (const k of EFFECT_KEYS) {
      // leave non-included effects untouched
      if (!pool.has(k)) continue;
      const el = toggleMap[k];
      if (el) el.checked = Math.random() > 0.5;
      // param ranges per effect (only if included)
      switch (k) {
        case 'crt':
          if (ui.crt_curve) ui.crt_curve.value = (Math.random()*60+20)|0;
          if (ui.crt_scan)  ui.crt_scan.value  = (Math.random()*80)|0;
          break;
        case 'bloom':
          if (ui.bloom_thresh) ui.bloom_thresh.value = (Math.random()*60+20)|0;
          if (ui.bloom_amt)    ui.bloom_amt.value    = (Math.random()*80+10)|0;
          break;
        case 'edges':
          if (ui.edge_amt) ui.edge_amt.value = (Math.random()*80+10)|0;
          break;
        case 'kaleido':
          if (ui.kaleido_slices) ui.kaleido_slices.value = (Math.random()*10+4)|0;
          if (ui.kaleido_angle)  ui.kaleido_angle.value  = (Math.random()*360)|0;
          break;
        case 'ripple':
          if (ui.ripple_radius) ui.ripple_radius.value = (Math.random()*60+20)|0;
          if (ui.ripple_amt)    ui.ripple_amt.value    = (Math.random()*60+20)|0;
          break;
        case 'psort':
          if (ui.psort_thresh) ui.psort_thresh.value = (Math.random()*80+10)|0;
          if (ui.psort_dir)    ui.psort_dir.value    = Math.random()>0.5 ? 'h' : 'v';
          break;
        case 'mono':
          if (ui.mono_a) ui.mono_a.value = randHex();
          if (ui.mono_b) ui.mono_b.value = randHex();
          break;
        // others have no unique sliders (leak/vhs use core speed/strength which we already randomized)
      }
    }

    shuffleOrder(); // still fun to shuffle pipeline
  }

  function randHex(){
    const r = () => (Math.random()*255)|0;
    const h = (n)=> n.toString(16).padStart(2,'0');
    return `#${h(r())}${h(r())}${h(r())}`;
  }

  // ---------- Effect pipeline order ----------
  let order = [
    'kaleido','warp','ripple','pixel','rgb','sobel','vhs','crt','bloom','cpunk',
    'invert','leak','tape','binary','trail','mono','hudText','blocks','psort'
  ];
  const showOrder = () => { const o=$('orderList'); if(o) o.textContent = order.join('\n'); };
  showOrder();

  function shuffleOrder(){
    const arr = order.slice();
    for (let i=arr.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [arr[i],arr[j]]=[arr[j],arr[i]]; }
    order = arr; showOrder();
  }

  // ---------- Camera ----------
  let running = false;

  async function startCam() {
    if (!(location.protocol === 'https:' || location.hostname === 'localhost')) {
      alert('Webcam requires HTTPS or localhost.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
      });
      vid.srcObject = stream;
      status('Camera access granted. Waiting for feed…');
      vid.onloadedmetadata = () => {
        vid.play();
        const w = vid.videoWidth || 640, h = vid.videoHeight || 480;
        setCanvasSize(w,h);
        running = true;
        status(`Camera started (${w}×${h})`);
        initPipelines();
        render();
      };
    } catch (e) { status('Camera error: ' + e.message); }
  }
  function setCanvasSize(w,h){ canvas.width=w; canvas.height=h; if(gl) gl.viewport(0,0,w,h); }

  // ---------- HUD Text ----------
  const hudCanvas = document.createElement('canvas');
  const hudCtx    = hudCanvas.getContext('2d');
  const words = ['ERROR','FAILURE','SYSTEM CRASH',':(','CRITICAL ERROR','QUIT','STOP','CANCEL'];
  let activeMsgs = [];
  function spawnMsg(){
    const txt = words[(Math.random()*words.length)|0];
    const life = parseInt(ui.text_ms?.value||'1400',10);
    const rotation = [0,90,180,270][(Math.random()*4)|0];
    activeMsgs.push({ txt, x: Math.random()*canvas.width*0.85, y: Math.random()*canvas.height*0.85, t: performance.now(), life, rotation });
  }
  setInterval(()=>{ if (ui.fx_text?.checked && running) spawnMsg(); }, 1200);
  function drawHUD(){
    hudCanvas.width=canvas.width; hudCanvas.height=canvas.height;
    hudCtx.clearRect(0,0,hudCanvas.width,hudCanvas.height);
    const now=performance.now();
    for(let i=activeMsgs.length-1;i>=0;i--){
      const m=activeMsgs[i], age=now-m.t; if(age>m.life){ activeMsgs.splice(i,1); continue; }
      const a=1-age/m.life;
      hudCtx.save(); hudCtx.translate(m.x,m.y); hudCtx.rotate(m.rotation*Math.PI/180);
      hudCtx.globalAlpha=a*0.95; hudCtx.fillStyle=i%2?'#ff2a6d':'#00e1ff';
      hudCtx.font=`bold ${18+(i%3)*10}px ui-monospace,monospace`; hudCtx.fillText(m.txt,0,0); hudCtx.restore();
    }
  }

  // =======================================================
  // ================== WebGL Pipeline =====================
  // =======================================================
  let gl=null, hasGL=false;
  let P={}, quad=null;
  let texSrc=null, texA=null, texB=null, fbA=null, fbB=null, hudTex=null, trailTex=null, trailFB=null;

  function initPipelines(){
    try { gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); } catch {}
    if (gl) { try { initGL(); hasGL=true; status('WebGL pipeline ready.'); } catch(e){ console.warn(e); hasGL=false; } }
    if (!hasGL) { status('Falling back to 2D.'); init2D(); }
  }

  function sh(t,src){ const s=gl.createShader(t); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function program(vs,fs){ const p=gl.createProgram(); gl.attachShader(p,vs); gl.attachShader(p,fs); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }

  const VS = `
    attribute vec2 aPos; attribute vec2 aUV; varying vec2 vUV;
    void main(){ vUV=aUV; gl_Position=vec4(aPos,0.,1.); }
  `;
  const COM = `
    precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime;
  `;

  function use(p){
    gl.useProgram(p);
    const aPos=gl.getAttribLocation(p,'aPos');
    const aUV =gl.getAttribLocation(p,'aUV');
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,16,0);
    gl.vertexAttribPointer(aUV ,2,gl.FLOAT,false,16,8);
    const uRes=gl.getUniformLocation(p,'uRes'); if(uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    const uTime=gl.getUniformLocation(p,'uTime'); if(uTime) gl.uniform1f(uTime, performance.now()/1000);
  }
  function mkTex(w,h){ const t=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null); return t; }
  function mkFBO(tex){ const f=gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); return f; }

  function initGL(){
    // ---------- Shaders ----------
    const fsCopy = sh(gl.FRAGMENT_SHADER, COM+`void main(){ gl_FragColor=texture2D(uTex,vUV); }`);
    const fsWarp = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uStr,uRGB,uSpeed;
      void main(){
        float t=uTime*uSpeed; vec2 uv=vUV;
        float w1=sin(uv.y*12.+1.2*t), w2=cos(uv.x*9.-1.1*t), w3=sin((uv.x+uv.y)*6.-.7*t);
        uv+=vec2(w1*w2,w3)*(uStr*.035);
        vec2 c=vec2(.5), d=uv-c; float r=length(d);
        float a=atan(d.y,d.x)+r*(uStr*.35)*sin(t*.4); uv=c+vec2(cos(a),sin(a))*r;
        vec2 off=vec2(cos(t*.7),sin(t*.9))*(uRGB*.004);
        gl_FragColor=vec4(texture2D(uTex,uv+off).r,texture2D(uTex,uv).g,texture2D(uTex,uv-off).b,1.);
      }`);
    const fsPixel = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uCell,uRGB;
      void main(){
        vec2 grid=uRes/max(uCell,1.);
        vec2 uvq=floor(vUV*grid)/grid;
        vec2 off=vec2(0.707)*(uRGB*0.004);
        gl_FragColor=vec4(texture2D(uTex,uvq+off).r,texture2D(uTex,uvq).g,texture2D(uTex,uvq-off).b,1.);
      }`);
    const fsRGB   = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uAmt;
      void main(){
        vec2 off=vec2(cos(uTime*.7),sin(uTime*.9))*(uAmt*.004);
        gl_FragColor=vec4(texture2D(uTex,vUV+off).r, texture2D(uTex,vUV).g, texture2D(uTex,vUV-off).b, 1.);
      }`);
    const fsBlocks= sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uAmt;
      float hash(float n){ return fract(sin(n)*43758.5453); }
      void main(){
        vec2 uv=vUV; float rows=60., cols=80.; float t=floor(uTime*8.);
        float ry=floor(uv.y*rows), rx=floor(uv.x*cols);
        float offx=(hash(ry+t)*2.-1.)*0.05 * step(0.96,hash(ry+t*1.7)) * uAmt;
        float offy=(hash(rx+t*2.1)*2.-1.)*0.04 * step(0.97,hash(rx+t*0.9)) * uAmt;
        uv+=vec2(offx,offy); gl_FragColor=texture2D(uTex,uv);
      }`);
    const fsLeak  = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uAmt;
      float noise(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec3 base=texture2D(uTex,vUV).rgb; float t=uTime*0.2;
        vec2 c1=vec2(0.1+0.2*sin(t),0.2+0.2*cos(t*1.3));
        vec2 c2=vec2(0.8+0.1*cos(t*0.8),0.9+0.05*sin(t*1.1));
        float r1=1.0 - smoothstep(0.0,0.8, distance(vUV,c1));
        float r2=1.0 - smoothstep(0.0,0.9, distance(vUV,c2));
        vec3 leak=r1*vec3(1.0,0.3,0.0)+r2*vec3(1.0,0.0,0.8);
        leak += (noise(vUV*uRes*0.8+t)-0.5)*0.1;
        gl_FragColor=vec4(clamp(base+leak*(0.22*uAmt),0.,1.),1.);
      }`);
    const fsTape  = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uSpeed;
      void main(){
        float t=uTime*(0.1+uSpeed*0.02); vec2 uv=vUV;
        float roll=fract(uv.y + t*0.08);
        float seam=smoothstep(0.95,1.0, roll) * 0.06;
        uv.y=roll; uv.x += sin(uv.y*40.0 + t*6.0)*0.003 + seam;
        gl_FragColor=texture2D(uTex,uv);
      }`);
    const fsVHS   = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uAmt;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec2 uv=vUV; float t=uTime*0.8;
        float jitter=(hash(vec2(t,uv.y))*2.0-1.0)*0.0025*uAmt;
        uv.x += jitter;
        float scan = (0.04*uAmt)*sin(uv.y*1200.0/uRes.y + t*8.0);
        float bleed=0.0025*uAmt;
        vec3 c=texture2D(uTex,uv).rgb;
        float r=texture2D(uTex,uv+vec2(bleed,0.)).r;
        float b=texture2D(uTex,uv-vec2(bleed,0.)).b;
        float n=(hash(uv*vec2(900.0,700.0)+t)-0.5)*0.08*uAmt;
        gl_FragColor=vec4(vec3(r,c.g,b)+scan+n,1.0);
      }`);
    const fsCP    = sh(gl.FRAGMENT_SHADER, COM+`
      vec3 grade(vec3 c){
        vec3 lift=vec3(-0.05,0.00,0.05);
        vec3 gamma=vec3(0.9,1.1,1.0);
        vec3 gain=vec3(0.9,1.15,1.15);
        c=(c+lift); c=pow(clamp(c,0.0,1.0), gamma); c=c*gain;
        c=mix(c, vec3(c.b, (c.r+c.b)*0.5, c.r), 0.20); return clamp(c,0.,1.);
      }
      void main(){ vec3 c=texture2D(uTex,vUV).rgb; gl_FragColor=vec4(grade(c),1.); }`);
    const fsInv   = sh(gl.FRAGMENT_SHADER, COM+`void main(){ vec4 c=texture2D(uTex,vUV); gl_FragColor=vec4(1.0-c.rgb,1.0); }`);
    const fsBin   = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uScale;
      float rnd(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 uv=vUV; float s=uScale; vec2 grid=floor(uv*vec2(s));
        float v = step(0.5, rnd(grid)); vec3 base=texture2D(uTex,uv).rgb;
        vec3 overlay=vec3(v); float a=0.25; gl_FragColor=vec4(mix(base,overlay,a),1.);
      }`);
    const fsMono  = sh(gl.FRAGMENT_SHADER, COM+`uniform vec3 uA,uB;
      void main(){ vec3 c=texture2D(uTex,vUV).rgb; float l=dot(c, vec3(0.2126,0.7152,0.0722)); gl_FragColor=vec4(mix(uA,uB,l),1.); }`);
    const fsHUD   = sh(gl.FRAGMENT_SHADER, COM+`uniform sampler2D uHUD; uniform float uAmt;
      void main(){ vec4 base=texture2D(uTex,vUV); vec4 hud=texture2D(uHUD,vUV); gl_FragColor=vec4(mix(base.rgb,hud.rgb,hud.a*uAmt),1.); }`);
    const fsPSort = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uSpan, uThres, uDir; // uDir: 0=H, 1=V
      float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
      vec4 tap(vec2 uv){ return texture2D(uTex,uv); }
      void main(){
        vec2 step = (uDir<0.5) ? vec2(uSpan/uRes.x,0.) : vec2(0.,uSpan/uRes.y);
        vec4 c0=tap(vUV-3.0*step), c1=tap(vUV-1.5*step), c2=tap(vUV), c3=tap(vUV+1.5*step), c4=tap(vUV+3.0*step);
        float l0=lum(c0.rgb), l1=lum(c1.rgb), l2=lum(c2.rgb), l3=lum(c3.rgb), l4=lum(c4.rgb);
        float best=l2; vec4 outc=c2;
        if(l0>best && l0>uThres) { best=l0; outc=c0; }
        if(l1>best && l1>uThres) { best=l1; outc=c1; }
        if(l3>best && l3>uThres) { best=l3; outc=c3; }
        if(l4>best && l4>uThres) { best=l4; outc=c4; }
        gl_FragColor=outc;
      }`);
    // NEW: Sobel + neon edge
    const fsSobel = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uAmt;
      vec3 rgb(vec2 p){ return texture2D(uTex,p).rgb; }
      void main(){
        vec2 px=1.0/uRes; vec2 uv=vUV;
        vec3 tl=rgb(uv+px*vec2(-1,-1)),  t=rgb(uv+px*vec2(0,-1)),  tr=rgb(uv+px*vec2(1,-1));
        vec3 l =rgb(uv+px*vec2(-1, 0)),  c=rgb(uv),                 r =rgb(uv+px*vec2(1, 0));
        vec3 bl=rgb(uv+px*vec2(-1, 1)),  b=rgb(uv+px*vec2(0, 1)),  br=rgb(uv+px*vec2(1, 1));
        vec3 gx = -tl -2.0*l -bl + tr +2.0*r + br;
        vec3 gy = -tl -2.0*t -tr + bl +2.0*b + br;
        float g = length(gx+gy);
        vec3 neon = vec3(0.0, g, g*1.5);
        gl_FragColor=vec4(mix(c, neon, clamp(uAmt,0.,1.)),1.0);
      }`);
    // NEW: CRT curvature + scanlines + mask
    const fsCRT = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uCurve, uScan;
      float barrel(vec2 uv, float k){ uv=uv*2.-1.; float r2=dot(uv,uv); uv*=1.0 + k*r2; return 0.5*(1.0 - step(1.0, dot(uv,uv))); }
      void main(){
        float k = uCurve*0.0005;
        vec2 uv = vUV*2.-1.;
        float r2=dot(uv,uv);
        uv = uv*(1.0 + k*r2);
        uv = uv*0.5+0.5;
        if (uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) { gl_FragColor=vec4(0.0); return; }
        vec3 c = texture2D(uTex, uv).rgb;
        float scan = 1.0 - uScan*0.01 * (0.5+0.5*sin(uv.y*800.0));
        float mask = 0.85 + 0.15*sin(uv.x*1440.0);
        gl_FragColor = vec4(c*scan*mask,1.0);
      }`);
    // NEW: Bloom (single-pass approx)
    const fsBloom = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uThres, uAmt;
      vec3 samp(vec2 o){ return texture2D(uTex, vUV + o).rgb; }
      void main(){
        float th = uThres;
        vec3 c = texture2D(uTex, vUV).rgb;
        vec3 bright = max(c - th, 0.0);
        vec2 px = 1.0/uRes * 2.0;
        vec3 blur = ( bright
          + samp(vec2( px.x, 0.0))
          + samp(vec2(-px.x, 0.0))
          + samp(vec2(0.0,  px.y))
          + samp(vec2(0.0, -px.y))
          + samp(vec2( px.x,  px.y))
          + samp(vec2(-px.x,  px.y))
          + samp(vec2( px.x, -px.y))
          + samp(vec2(-px.x, -px.y))
        )/9.0;
        gl_FragColor = vec4( clamp(c + blur*uAmt, 0.0, 1.0), 1.0 );
      }`);
    // NEW: Kaleidoscope
    const fsKaleido = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uSlices, uAngle;
      vec2 rot(vec2 p,float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c)*p; }
      void main(){
        vec2 uv = vUV - 0.5; uv = rot(uv, radians(uAngle));
        float n = max(3.0, uSlices);
        float a = atan(uv.y, uv.x);
        float r = length(uv);
        float sector = 6.2831853 / n;
        a = mod(a, sector);
        if (a > sector*0.5) a = sector - a;
        vec2 uvr = vec2(cos(a), sin(a))*r + 0.5;
        gl_FragColor = texture2D(uTex, uvr);
      }`);
    // NEW: Ripple (centered)
    const fsRipple = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uR, uAmt;
      void main(){
        vec2 uv=vUV; vec2 c=vec2(0.5); vec2 d=uv-c; float r=length(d);
        float wave = sin((r*10.0 - uTime*3.0))*uAmt*0.02 * smoothstep(uR*0.0, uR*0.01, r);
        vec2 uvd = uv + normalize(d)*wave;
        gl_FragColor = texture2D(uTex, uvd);
      }`);

    P = {
      copy:  program(sh(gl.VERTEX_SHADER,VS), fsCopy),
      warp:  program(sh(gl.VERTEX_SHADER,VS), fsWarp),
      pixel: program(sh(gl.VERTEX_SHADER,VS), fsPixel),
      rgb:   program(sh(gl.VERTEX_SHADER,VS), fsRGB),
      blocks:program(sh(gl.VERTEX_SHADER,VS), fsBlocks),
      leak:  program(sh(gl.VERTEX_SHADER,VS), fsLeak),
      tape:  program(sh(gl.VERTEX_SHADER,VS), fsTape),
      vhs:   program(sh(gl.VERTEX_SHADER,VS), fsVHS),
      cpunk: program(sh(gl.VERTEX_SHADER,VS), fsCP),
      invert:program(sh(gl.VERTEX_SHADER,VS), fsInv),
      binary:program(sh(gl.VERTEX_SHADER,VS), fsBin),
      mono:  program(sh(gl.VERTEX_SHADER,VS), fsMono),
      hud:   program(sh(gl.VERTEX_SHADER,VS), fsHUD),
      psort: program(sh(gl.VERTEX_SHADER,VS), fsPSort),
      sobel: program(sh(gl.VERTEX_SHADER,VS), fsSobel),
      crt:   program(sh(gl.VERTEX_SHADER,VS), fsCRT),
      bloom: program(sh(gl.VERTEX_SHADER,VS), fsBloom),
      kaleido: program(sh(gl.VERTEX_SHADER,VS), fsKaleido),
      ripple: program(sh(gl.VERTEX_SHADER,VS), fsRipple),
    };

    // Quad
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1,0,0,  1,-1,1,0,  -1,1,0,1,
      -1, 1,0,1,  1,-1,1,0,   1,1,1,1
    ]), gl.STATIC_DRAW);

    // Ping-pong
    const w=canvas.width, h=canvas.height;
    texA=mkTex(w,h); texB=mkTex(w,h); fbA=mkFBO(texA); fbB=mkFBO(texB);
    trailTex=mkTex(w,h); trailFB=mkFBO(trailTex);

    // Source
    texSrc=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texSrc);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);

    // HUD
    hudTex=mkTex(w,h);
  }

  function use(p){
    gl.useProgram(p);
    const aPos=gl.getAttribLocation(p,'aPos');
    const aUV =gl.getAttribLocation(p,'aUV');
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,16,0);
    gl.vertexAttribPointer(aUV ,2,gl.FLOAT,false,16,8);
    const uRes=gl.getUniformLocation(p,'uRes'); if(uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    const uTime=gl.getUniformLocation(p,'uTime'); if(uTime) gl.uniform1f(uTime, performance.now()/1000);
  }
  function drawTo(texIn, fbOut, prog, uniforms){
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbOut);
    use(prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texIn);
    const uTex=gl.getUniformLocation(prog,'uTex'); if(uTex) gl.uniform1i(uTex,0);
    if (uniforms) uniforms(prog);
    gl.drawArrays(gl.TRIANGLES,0,6);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  function mkTex(w,h){ const t=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null); return t; }
  function mkFBO(tex){ const f=gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); return f; }

  // =======================================================
  // =================== 2D Fallback =======================
  // =======================================================
  let ctx2d=null;
  function init2D(){ ctx2d = canvas.getContext('2d', { willReadFrequently: true }); }
  function render2D(){
    if (!running) return;
    requestAnimationFrame(render2D);
    const w=canvas.width,h=canvas.height;
    if (vid.readyState>=2){ ctx2d.save(); ctx2d.scale(-1,1); ctx2d.drawImage(vid,-w,0,w,h); ctx2d.restore(); }
    if (ui.fx_text?.checked){ drawHUD(); ctx2d.drawImage(hudCanvas,0,0); }
  }

  // =======================================================
  // ===================== RENDER LOOP =====================
  // =======================================================
  function render(){
    if (!running) return;

    if (!hasGL) { render2D(); return; }
    requestAnimationFrame(render);
    if (vid.readyState < 2 || (vid.videoWidth|0)===0) return;

    // upload live frame
    gl.bindTexture(gl.TEXTURE_2D, texSrc);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,vid);

    let read = texSrc, writeFB = fbA, writeTex = texA;
    const swap = ()=>{ const tmp=writeTex; writeTex=(writeTex===texA?texB:texA); writeFB=(writeFB===fbA?fbB:fbA); read=tmp; };

    for (const step of order){
      switch(step){
        case 'kaleido': if (ui.fx_kaleido?.checked){
          const slices = parseFloat(ui.kaleido_slices?.value||'6');
          const ang    = parseFloat(ui.kaleido_angle?.value||'0');
          drawTo(read, writeFB, P.kaleido, p=>{
            gl.uniform1f(gl.getUniformLocation(p,'uSlices'), slices);
            gl.uniform1f(gl.getUniformLocation(p,'uAngle'),  ang);
          }); swap();
        } break;

        case 'warp': {
          const uStr=parseInt(ui.str?.value||'0',10)/100;
          const uRGB=parseInt(ui.rgb?.value||'0',10)/100;
          const uSpeed=parseInt(ui.speed?.value||'50',10)/50;
          drawTo(read, writeFB, P.warp, p=>{
            gl.uniform1f(gl.getUniformLocation(p,'uStr'), uStr);
            gl.uniform1f(gl.getUniformLocation(p,'uRGB'), uRGB);
            gl.uniform1f(gl.getUniformLocation(p,'uSpeed'), uSpeed);
          }); swap();
        } break;

        case 'ripple': if (ui.fx_ripple?.checked){
          const R   = parseFloat(ui.ripple_radius?.value||'40'); // 0..100
          const Amt = parseFloat(ui.ripple_amt?.value||'40');    // 0..100
          drawTo(read, writeFB, P.ripple, p=>{
            gl.uniform1f(gl.getUniformLocation(p,'uR'),   R);
            gl.uniform1f(gl.getUniformLocation(p,'uAmt'), Amt/100.0);
          }); swap();
        } break;

        case 'pixel': {
          const uCell=parseInt(ui.cell?.value||'24',10);
          const uRGB=parseInt(ui.rgb?.value||'0',10)/100;
          drawTo(read, writeFB, P.pixel, p=>{
            gl.uniform1f(gl.getUniformLocation(p,'uCell'), uCell);
            gl.uniform1f(gl.getUniformLocation(p,'uRGB'), uRGB);
          }); swap();
        } break;

        case 'rgb': {
          const amt=parseInt(ui.rgb?.value||'0',10)/100;
          if (amt>0.01){
            drawTo(read, writeFB, P.rgb, p=>{ gl.uniform1f(gl.getUniformLocation(p,'uAmt'), amt); });
            swap();
          }
        } break;

        case 'sobel': if (ui.fx_edges?.checked){
          const a=parseInt(ui.edge_amt?.value||'40',10)/100;
          drawTo(read, writeFB, P.sobel, p=>{ gl.uniform1f(gl.getUniformLocation(p,'uAmt'), a); });
          swap();
        } break;

        case 'vhs': if (ui.fx_vhs?.checked){
          const a=0.2 + (parseInt(ui.speed?.value||'0',10)/100);
          drawTo(read, writeFB, P.vhs, p=>{ gl.uniform1f(gl.getUniformLocation(p,'uAmt'), a); });
          swap();
        } break;

        case 'crt': if (ui.fx_crt?.checked){
          const curve=parseInt(ui.crt_curve?.value||'40',10); // 0..100
          const scan =parseInt(ui.crt_scan?.value||'40',10);
          drawTo(read, writeFB, P.crt, p=>{
            gl.uniform1f(gl.getUniformLocation(p,'uCurve'), curve);
            gl.uniform1f(gl.getUniformLocation(p,'uScan'),  scan);
          }); swap();
        } break;

        case 'bloom': if (ui.fx_bloom?.checked){
          const th=(parseInt(ui.bloom_thresh?.value||'40',10)/100); // 0..1
          const amt=(parseInt(ui.bloom_amt?.value||'40',10)/100);
          drawTo(read, writeFB, P.bloom, p=>{
            gl.uniform1f(gl.getUniformLocation(p,'uThres'), th);
            gl.uniform1f(gl.getUniformLocation(p,'uAmt'),   amt);
          }); swap();
        } break;

        case 'cpunk': if (ui.fx_cpunk?.checked){ drawTo(read, writeFB, P.cpunk); swap(); } break;
        case 'invert': if (ui.fx_invert?.checked){ drawTo(read, writeFB, P.invert); swap(); } break;

        case 'leak': if (ui.fx_leak?.checked){
          const a=0.2 + (parseInt(ui.str?.value||'0',10)/100);
          drawTo(read, writeFB, P.leak, p=>{ gl.uniform1f(gl.getUniformLocation(p,'uAmt'), a); });
          swap();
        } break;

        case 'tape': if (ui.fx_tape?.checked){
          const sp=parseInt(ui.speed?.value||'50',10)/100;
          drawTo(read, writeFB, P.tape, p=>{ gl.uniform1f(gl.getUniformLocation(p,'uSpeed'), sp); });
          swap();
        } break;

        case 'binary': if (ui.fx_binary?.checked){
          drawTo(read, writeFB, P.binary, p=>{ gl.uniform1f(gl.getUniformLocation(p,'uScale'), 220.0); });
          swap();
        } break;

        case 'trail': if (ui.fx_trail?.checked){
          gl.bindFramebuffer(gl.FRAMEBUFFER, trailFB);
          use(P.copy);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, read);
          gl.uniform1i(gl.getUniformLocation(P.copy,'uTex'),0);
          gl.drawArrays(gl.TRIANGLES,0,6);
          gl.bindFramebuffer(gl.FRAMEBUFFER,null);

          gl.bindFramebuffer(gl.FRAMEBUFFER, writeFB);
          use(P.hud);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, read);
          gl.uniform1i(gl.getUniformLocation(P.hud,'uTex'),0);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, trailTex);
          gl.uniform1i(gl.getUniformLocation(P.hud,'uHUD'),1);
          gl.uniform1f(gl.getUniformLocation(P.hud,'uAmt'),0.18);
          gl.drawArrays(gl.TRIANGLES,0,6);
          gl.bindFramebuffer(gl.FRAMEBUFFER,null);
          swap();
        } break;

        case 'mono': if (ui.fx_mono?.checked){
          const a=hex2rgb(ui.mono_a?.value||'#00ffcc').map(v=>v/255);
          const b=hex2rgb(ui.mono_b?.value||'#220022').map(v=>v/255);
          drawTo(read, writeFB, P.mono, p=>{
            gl.uniform3f(gl.getUniformLocation(p,'uA'), a[0],a[1],a[2]);
            gl.uniform3f(gl.getUniformLocation(p,'uB'), b[0],b[1],b[2]);
          }); swap();
        } break;

        case 'hudText': if (ui.fx_text?.checked){
          drawHUD();
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, hudTex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,hudCanvas);
          drawTo(read, writeFB, P.hud, p=>{
            gl.uniform1i(gl.getUniformLocation(p,'uHUD'),1);
            gl.uniform1f(gl.getUniformLocation(p,'uAmt'),1.0);
          }); swap();
        } break;

        case 'psort': if (ui.fx_psort?.checked){
          const span = Math.max(1.0, parseInt(ui.cell?.value||'8',10)/8.0);
          const th   = parseInt(ui.psort_thresh?.value||'40',10)/100;
          const dir  = (ui.psort_dir?.value||'h')==='v' ? 1.0 : 0.0;
          drawTo(read, writeFB, P.psort, p=>{
            gl.uniform1f(gl.getUniformLocation(p,'uSpan'),  span);
            gl.uniform1f(gl.getUniformLocation(p,'uThres'), th);
            gl.uniform1f(gl.getUniformLocation(p,'uDir'),   dir);
          }); swap();
        } break;

        default: break;
      }
    }

    // blit to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    use(P.copy);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, read);
    gl.uniform1i(gl.getUniformLocation(P.copy,'uTex'),0);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }

  // 2D utils
  function hex2rgb(h){ const i=parseInt(h.slice(1),16); return [((i>>16)&255),((i>>8)&255),(i&255)]; }

})();
