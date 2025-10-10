(() => {
  'use strict';

  // ---------- DOM / UI ----------
  const $ = (id) => document.getElementById(id);
  const status = (m) => { const s=$('status'); if (s) s.textContent = m; };

  const canvas = $('gl');
  const vid    = $('vid');

  const ui = {
    cell: $('cell'),           // Pixel size
    str:  $('strength'),       // Distortion strength
    rgb:  $('rgb'),            // RGB split
    speed:$('speed'),          // Speed
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
  };

  const clickSfx = $('clickSfx');
  if (clickSfx) {
    clickSfx.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACAAABAAEA/////wD///8AAP//AAD//wAA//8AAP///w==";
    document.querySelectorAll('.sfx').forEach(b =>
      b.addEventListener('click', () => { try { clickSfx.currentTime = 0; clickSfx.play(); } catch {} })
    );
  }

  $('btnCam')?.addEventListener('click', startCam);
  $('btnRandom')?.addEventListener('click', randomizeAll);
  $('btnShuffle')?.addEventListener('click', shuffleOrder);
  $('btnShuffle2')?.addEventListener('click', shuffleOrder);

  // Effect pipeline order (same names we reference below)
  let order = ['warp','pixel','rgb','blocks','vhs','cpunk','invert','leak','tape','binary','trail','mono','hudText','psort'];

  function showOrder() {
    const o = $('orderList');
    if (o) o.textContent = order.join('\n');
  }
  showOrder();

  function shuffleOrder() {
    const arr = order.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    order = arr; showOrder();
  }
  function randomizeAll() {
    ui.cell.value  = (Math.random()*64+8)|0;
    ui.str.value   = (Math.random()*70+10)|0;
    ui.rgb.value   = (Math.random()*80)|0;
    ui.speed.value = (Math.random()*80+10)|0;
    ['fx_trail','fx_vhs','fx_cpunk','fx_invert','fx_binary','fx_text','fx_blocks','fx_leak','fx_tape','fx_psort','fx_mono']
      .forEach(k => ui[k].checked = Math.random() > 0.5);
    shuffleOrder();
  }

  // ---------- Camera ----------
  let running = false;

  async function startCam() {
    if (!(location.protocol === 'https:' || location.hostname === 'localhost')) {
      alert('Webcam requires HTTPS or localhost.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      vid.srcObject = stream;
      status('Camera access granted. Waiting for feed…');

      vid.onloadedmetadata = () => {
        vid.play();
        const w = vid.videoWidth || 640;
        const h = vid.videoHeight || 480;
        setCanvasSize(w, h);
        running = true;
        status(`Camera started (${canvas.width}×${canvas.height})`);
        initPipelines();  // sets up WebGL or 2D fallback
        render();
      };
    } catch (e) {
      status('Camera error: ' + e.message);
    }
  }

  function setCanvasSize(w,h) {
    canvas.width = w; canvas.height = h;
    if (gl) gl.viewport(0,0,w,h);
  }

  // ---------- HUD Text (shared for both paths) ----------
  const hudCanvas = document.createElement('canvas');
  const hudCtx = hudCanvas.getContext('2d');
  const words = ['ERROR','FAILURE','SYSTEM CRASH',':(','CRITICAL ERROR','QUIT','STOP','CANCEL'];
  let activeMsgs = [];
  function spawnMsg(){
    const txt = words[(Math.random()*words.length)|0];
    const life = parseInt(ui.text_ms.value||'1400',10);
    const rotation = [0,90,180,270][(Math.random()*4)|0];
    activeMsgs.push({
      txt,
      x: Math.random()*canvas.width*0.85,
      y: Math.random()*canvas.height*0.85,
      t: performance.now(), life, rotation
    });
  }
  setInterval(()=>{ if (ui.fx_text?.checked && running) spawnMsg(); }, 1200);

  function drawHUD() {
    hudCanvas.width = canvas.width;
    hudCanvas.height = canvas.height;
    hudCtx.clearRect(0,0,hudCanvas.width,hudCanvas.height);
    const now = performance.now();
    for (let i = activeMsgs.length - 1; i >= 0; i--) {
      const m = activeMsgs[i];
      const age = now - m.t;
      if (age > m.life) { activeMsgs.splice(i, 1); continue; }
      const alpha = 1 - age / m.life;
      hudCtx.save();
      hudCtx.translate(m.x, m.y);
      hudCtx.rotate(m.rotation*Math.PI/180);
      hudCtx.globalAlpha = alpha * 0.95;
      hudCtx.fillStyle = i % 2 ? '#ff2a6d' : '#00e1ff';
      hudCtx.font = `bold ${18 + (i % 3) * 10}px ui-monospace, monospace`;
      hudCtx.fillText(m.txt, 0, 0);
      hudCtx.restore();
    }
  }

  // =======================================================
  // =============== WebGL PRIMARY PIPELINE ================
  // =======================================================
  let gl = null, hasGL = false;
  let P={}, quad=null;
  let texSrc=null, texA=null, texB=null, fbA=null, fbB=null, hudTex=null, trailTex=null, trailFB=null;

  function initPipelines() {
    // Try WebGL
    try { gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); } catch {}
    if (gl) {
      try { initGL(); hasGL = true; status('WebGL pipeline ready.'); }
      catch (err) { console.warn('WebGL init failed:', err); gl = null; hasGL = false; status('Falling back to 2D pipeline.'); }
    } else {
      status('No WebGL. Using 2D pipeline.');
    }
    if (!hasGL) init2D();
  }

  // ---------- WebGL compile/link helpers ----------
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

  function use(p) {
    gl.useProgram(p);
    const aPos = gl.getAttribLocation(p,'aPos');
    const aUV  = gl.getAttribLocation(p,'aUV');
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,16,0);
    gl.vertexAttribPointer(aUV ,2,gl.FLOAT,false,16,8);
    const uRes = gl.getUniformLocation(p,'uRes'); if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    const uTime= gl.getUniformLocation(p,'uTime'); if (uTime) gl.uniform1f(uTime, performance.now()/1000);
  }

  function mkTex(w,h) {
    const t=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA, w,h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }
  function mkFBO(tex){
    const f=gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    return f;
  }

  function initGL() {
    // Programs
    const fsCopy = sh(gl.FRAGMENT_SHADER, COM+`void main(){ gl_FragColor=texture2D(uTex,vUV); }`);
    const fsWarp = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uStr,uRGB,uSpeed;
      void main(){
        float t=uTime*uSpeed;
        vec2 uv=vUV;
        float w1=sin(uv.y*12.+1.2*t), w2=cos(uv.x*9.-1.1*t), w3=sin((uv.x+uv.y)*6.-.7*t);
        uv+=vec2(w1*w2,w3)*(uStr*.035);
        vec2 c=vec2(.5), d=uv-c; float r=length(d);
        float a=atan(d.y,d.x)+r*(uStr*.35)*sin(t*.4);
        uv=c+vec2(cos(a),sin(a))*r;
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
    const fsRGB = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uAmt;
      void main(){
        vec2 off=vec2(cos(uTime*.7),sin(uTime*.9))*(uAmt*.004);
        gl_FragColor=vec4(texture2D(uTex,vUV+off).r,texture2D(uTex,vUV).g,texture2D(uTex,vUV-off).b,1.);
      }`);
    const fsBlocks = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uAmt;
      float hash(float n){ return fract(sin(n)*43758.5453); }
      void main(){
        vec2 uv=vUV; float rows=60., cols=80.; float t=floor(uTime*8.);
        float ry=floor(uv.y*rows), rx=floor(uv.x*cols);
        float offx=(hash(ry+t)*2.-1.)*0.05 * step(0.96,hash(ry+t*1.7)) * uAmt;
        float offy=(hash(rx+t*2.1)*2.-1.)*0.04 * step(0.97,hash(rx+t*0.9)) * uAmt;
        uv+=vec2(offx,offy); gl_FragColor=texture2D(uTex,uv);
      }`);
    const fsLeak = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uAmt;
      float noise(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 uv=vUV; vec3 base=texture2D(uTex,uv).rgb; float t=uTime*0.2;
        vec2 c1=vec2(0.1+0.2*sin(t),0.2+0.2*cos(t*1.3));
        vec2 c2=vec2(0.8+0.1*cos(t*0.8),0.9+0.05*sin(t*1.1));
        float r1=1.0 - smoothstep(0.0,0.8, distance(uv,c1));
        float r2=1.0 - smoothstep(0.0,0.9, distance(uv,c2));
        vec3 leak = r1*vec3(1.0,0.3,0.0) + r2*vec3(1.0,0.0,0.8);
        leak += (noise(uv*uRes*0.8+t)-0.5)*0.1;
        vec3 c = base + leak*(0.22*uAmt);
        gl_FragColor=vec4(clamp(c,0.,1.),1.);
      }`);
    const fsTape = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uSpeed;
      void main(){
        float t=uTime*(0.1+uSpeed*0.02); vec2 uv=vUV;
        float roll=fract(uv.y + t*0.08);
        float seam=smoothstep(0.95,1.0, roll) * 0.06;
        uv.y=roll; uv.x += sin(uv.y*40.0 + t*6.0)*0.003 + seam;
        gl_FragColor=texture2D(uTex,uv);
      }`);
    const fsVHS = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uAmt;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec2 uv=vUV; float t=uTime*0.8;
        float jitter=(hash(vec2(t,uv.y))*2.0-1.0)*0.0025*uAmt;
        uv.x += jitter;
        float scan = (0.04*uAmt)*sin(uv.y*1200.0/uRes.y + t*8.0);
        vec3 c=texture2D(uTex,uv).rgb;
        float bleed = 0.0025*uAmt;
        float r=texture2D(uTex,uv+vec2(bleed,0.)).r;
        float b=texture2D(uTex,uv-vec2(bleed,0.)).b;
        float n = (hash(uv*vec2(900.0,700.0)+t)-0.5)*0.08*uAmt;
        c = vec3(r,c.g,b) + scan + n;
        gl_FragColor=vec4(c,1.0);
      }`);
    const fsCP   = sh(gl.FRAGMENT_SHADER, COM+`
      vec3 grade(vec3 c){
        vec3 lift=vec3(-0.05,0.00,0.05);
        vec3 gamma=vec3(0.9,1.1,1.0);
        vec3 gain=vec3(0.9,1.15,1.15);
        c=(c+lift); c=pow(clamp(c,0.0,1.0), gamma); c=c*gain;
        c=mix(c, vec3(c.b, (c.r+c.b)*0.5, c.r), 0.20); return clamp(c,0.,1.);
      }
      void main(){ vec3 c=texture2D(uTex,vUV).rgb; gl_FragColor=vec4(grade(c),1.); }`);
    const fsInv  = sh(gl.FRAGMENT_SHADER, COM+`void main(){ vec4 c=texture2D(uTex,vUV); gl_FragColor=vec4(1.0-c.rgb,1.0); }`);
    const fsBin  = sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uScale;
      float rnd(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 uv=vUV; float s=uScale; vec2 grid=floor(uv*vec2(s));
        float v = step(0.5, rnd(grid)); vec3 base=texture2D(uTex,uv).rgb;
        vec3 overlay=vec3(v); float a=0.25; gl_FragColor=vec4(mix(base,overlay,a),1.);
      }`);
    const fsMono = sh(gl.FRAGMENT_SHADER, COM+`uniform vec3 uA,uB;
      void main(){ vec3 c=texture2D(uTex,vUV).rgb; float l=dot(c, vec3(0.2126,0.7152,0.0722)); gl_FragColor=vec4(mix(uA,uB,l),1.); }`);
    const fsHUD  = sh(gl.FRAGMENT_SHADER, COM+`uniform sampler2D uHUD; uniform float uAmt;
      void main(){ vec4 base=texture2D(uTex,vUV); vec4 hud=texture2D(uHUD,vUV); gl_FragColor=vec4(mix(base.rgb,hud.rgb,hud.a*uAmt),1.); }`);
    const fsPSort= sh(gl.FRAGMENT_SHADER, COM+`
      uniform float uSpan;
      vec4 tap(vec2 uv){ return texture2D(uTex,uv); }
      float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
      void main(){
        vec2 uv=vUV; float stepX=(uSpan)/uRes.x;
        vec4 c0=tap(uv-3.0*vec2(stepX,0.0));
        vec4 c1=tap(uv-1.5*vec2(stepX,0.0));
        vec4 c2=tap(uv);
        vec4 c3=tap(uv+1.5*vec2(stepX,0.0));
        vec4 c4=tap(uv+3.0*vec2(stepX,0.0));
        vec4 best=c0; float bl=lum(c0.rgb);
        float l1=lum(c1.rgb); if(l1>bl){best=c1; bl=l1;}
        float l2=lum(c2.rgb); if(l2>bl){best=c2; bl=l2;}
        float l3=lum(c3.rgb); if(l3>bl){best=c3; bl=l3;}
        float l4=lum(c4.rgb); if(l4>bl){best=c4; bl=l4;}
        gl_FragColor=best;
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
      psort: program(sh(gl.VERTEX_SHADER,VS), fsPSort)
    };

    // Quad buffer
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1,0,0,  1,-1,1,0,  -1,1,0,1,
      -1, 1,0,1,  1,-1,1,0,   1,1,1,1
    ]), gl.STATIC_DRAW);

    // Color attachments / FBOs (ping-pong)
    const w = canvas.width, h = canvas.height;
    texA = mkTex(w,h); texB = mkTex(w,h); fbA = mkFBO(texA); fbB = mkFBO(texB);
    trailTex = mkTex(w,h); trailFB = mkFBO(trailTex);

    // Source video texture
    texSrc = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texSrc);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);

    // HUD texture
    hudTex = mkTex(w,h);
  }

  function drawTo(texIn, fbOut, prog, uniforms) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbOut);
    use(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texIn);
    const uTex = gl.getUniformLocation(prog, 'uTex');
    if (uTex) gl.uniform1i(uTex, 0);
    if (uniforms) uniforms(prog);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // =======================================================
  // =================== 2D FALLBACK =======================
  // =======================================================
  let ctx2d = null, lastFrame2d = null;
  function init2D(){ ctx2d = canvas.getContext('2d', { willReadFrequently: true }); }
  function render2D() {
    if (!running) return;
    requestAnimationFrame(render2D);
    const w = canvas.width, h = canvas.height;

    // mirrored video
    if (vid.readyState >= 2) {
      ctx2d.save(); ctx2d.scale(-1,1);
      ctx2d.drawImage(vid, -w, 0, w, h);
      ctx2d.restore();
    }

    // minimal 2D: invert + text (to ensure *something* shows)
    if (ui.fx_invert?.checked) {
      const img = ctx2d.getImageData(0,0,w,h), d=img.data;
      for (let i=0;i<d.length;i+=4){ d[i]=255-d[i]; d[i+1]=255-d[i+1]; d[i+2]=255-d[i+2]; }
      ctx2d.putImageData(img,0,0);
    }
    if (ui.fx_text?.checked) {
      drawHUD(); ctx2d.drawImage(hudCanvas, 0, 0);
    }
  }

  // =======================================================
  // ===================== RENDER LOOP =====================
  // =======================================================
  function render() {
    if (!running) return;

    // Fallback path
    if (!hasGL) { render2D(); return; }

    requestAnimationFrame(render);

    // Wait until the video has real frames
    if (vid.readyState < 2 || (vid.videoWidth|0) === 0) return;

    // Upload live frame → texSrc
    gl.bindTexture(gl.TEXTURE_2D, texSrc);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // mirror like webcam UI
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE, vid);

    // Ping-pong between texA and texB
    let read = texSrc;
    let writeFB = fbA, writeTex = texA;
    const swap = ()=>{ const tmp=writeTex; writeTex=(writeTex===texA?texB:texA); writeFB=(writeFB===fbA?fbB:fbA); read=tmp; };

    for (const step of order) {
      switch (step) {
        case 'warp': {
          const uStr   = parseInt(ui.str.value||'0',10)/100;
          const uRGB   = parseInt(ui.rgb.value||'0',10)/100;
          const uSpeed = parseInt(ui.speed.value||'50',10)/50;
          drawTo(read, writeFB, P.warp, p=>{
            gl.uniform1f(gl.getUniformLocation(p,'uStr'), uStr);
            gl.uniform1f(gl.getUniformLocation(p,'uRGB'), uRGB);
            gl.uniform1f(gl.getUniformLocation(p,'uSpeed'), uSpeed);
          });
          swap(); break;
        }
        case 'pixel': {
          const uCell = parseInt(ui.cell.value||'24',10);
          const uRGB  = parseInt(ui.rgb.value||'0',10)/100;
          drawTo(read, writeFB, P.pixel, p=>{
            gl.uniform1f(gl.getUniformLocation(p,'uCell'), uCell);
            gl.uniform1f(gl.getUniformLocation(p,'uRGB'), uRGB);
          });
          swap(); break;
        }
        case 'rgb': {
          const amt = parseInt(ui.rgb.value||'0',10)/100;
          if (amt > 0.01) {
            drawTo(read, writeFB, P.rgb, p=>{
              gl.uniform1f(gl.getUniformLocation(p,'uAmt'), amt);
            });
            swap();
          }
          break;
        }
        case 'blocks': if (ui.fx_blocks?.checked) {
          const a = 0.01 + (parseInt(ui.str.value||'0',10)/100);
          drawTo(read, writeFB, P.blocks, p=>{
            gl.uniform1f(gl.getUniformLocation(p,'uAmt'), a);
          });
          swap();
        } break;
        case 'vhs': if (ui.fx_vhs?.checked) {
          const a = 0.2 + (parseInt(ui.speed.value||'0',10)/100);
          drawTo(read, writeFB, P.vhs, p=>{
            gl.uniform1f(gl.getUniformLocation(p,'uAmt'), a);
          });
          swap();
        } break;
        case 'cpunk': if (ui.fx_cpunk?.checked) { drawTo(read, writeFB, P.cpunk); swap(); } break;
        case 'invert': if (ui.fx_invert?.checked) { drawTo(read, writeFB, P.invert); swap(); } break;
        case 'leak': if (ui.fx_leak?.checked) {
          const a = 0.2 + (parseInt(ui.str.value||'0',10)/100);
          drawTo(read, writeFB, P.leak, p=>{ gl.uniform1f(gl.getUniformLocation(p,'uAmt'), a); });
          swap();
        } break;
        case 'tape': if (ui.fx_tape?.checked) {
          const sp = parseInt(ui.speed.value||'50',10)/100;
          drawTo(read, writeFB, P.tape, p=>{ gl.uniform1f(gl.getUniformLocation(p,'uSpeed'), sp); });
          swap();
        } break;
        case 'binary': if (ui.fx_binary?.checked) {
          drawTo(read, writeFB, P.binary, p=>{ gl.uniform1f(gl.getUniformLocation(p,'uScale'), 220.0); });
          swap();
        } break;
        case 'trail': if (ui.fx_trail?.checked) {
          // copy current read to trailTex
          gl.bindFramebuffer(gl.FRAMEBUFFER, trailFB);
          use(P.copy);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, read);
          gl.uniform1i(gl.getUniformLocation(P.copy,'uTex'), 0);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          // blend read + trail using HUD shader with low alpha
          gl.bindFramebuffer(gl.FRAMEBUFFER, writeFB);
          use(P.hud);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, read);
          gl.uniform1i(gl.getUniformLocation(P.hud,'uTex'), 0);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, trailTex);
          gl.uniform1i(gl.getUniformLocation(P.hud,'uHUD'), 1);
          gl.uniform1f(gl.getUniformLocation(P.hud,'uAmt'), 0.18);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          swap();
        } break;
        case 'mono': if (ui.fx_mono?.checked) {
          const a = hex2rgb(ui.mono_a.value).map(v=>v/255);
          const b = hex2rgb(ui.mono_b.value).map(v=>v/255);
          drawTo(read, writeFB, P.mono, p=>{
            gl.uniform3f(gl.getUniformLocation(p,'uA'), a[0],a[1],a[2]);
            gl.uniform3f(gl.getUniformLocation(p,'uB'), b[0],b[1],b[2]);
          });
          swap();
        } break;
        case 'hudText': if (ui.fx_text?.checked) {
          drawHUD();
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, hudTex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE, hudCanvas);

          drawTo(read, writeFB, P.hud, p=>{
            gl.uniform1i(gl.getUniformLocation(p,'uHUD'), 1);
            gl.uniform1f(gl.getUniformLocation(p,'uAmt'), 1.0);
          });
          swap();
        } break;
        case 'psort': if (ui.fx_psort?.checked) {
          const span = Math.max(1.0, parseInt(ui.cell.value||'8',10)/8.0);
          drawTo(read, writeFB, P.psort, p=>{
            gl.uniform1f(gl.getUniformLocation(p,'uSpan'), span);
          });
          swap();
        } break;
        default: break;
      }
    }

    // Blit final to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    use(P.copy);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read);
    gl.uniform1i(gl.getUniformLocation(P.copy,'uTex'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ---------- Utils ----------
  function hex2rgb(h){ const i=parseInt(h.slice(1),16); return [((i>>16)&255),((i>>8)&255),(i&255)]; }

})();
