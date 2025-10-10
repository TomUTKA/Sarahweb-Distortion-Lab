(() => {
  'use strict';

  // ======= helpers & UI =======
  const $ = (id) => document.getElementById(id);
  const status = (m) => { const s=$('status'); if(s) s.textContent = m; };

  const canvas = $('gl');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const vid = $('vid');

  const ui = {
    cell: $('cell'),           // Pixel size (used for pixelate)
    str: $('strength'),        // Distortion intensity
    rgb: $('rgb'),             // RGB split amount
    speed: $('speed'),         // Speed
    fx_trail: $('fx_trail'),
    fx_vhs: $('fx_vhs'),
    fx_cpunk: $('fx_cpunk'),
    fx_invert: $('fx_invert'),
    fx_binary: $('fx_binary'),
    fx_text: $('fx_text'),
    fx_blocks: $('fx_blocks'),
    fx_leak: $('fx_leak'),
    fx_tape: $('fx_tape'),
    fx_psort: $('fx_psort'),
    text_ms: $('text_ms'),
    fx_mono: $('fx_mono'),
    mono_a: $('mono_a'),
    mono_b: $('mono_b')
  };

  // Buttons
  $('btnCam')?.addEventListener('click', startCam);
  $('btnRandom')?.addEventListener('click', randomizeAll);
  $('btnShuffle')?.addEventListener('click', shuffleOrder);
  $('btnShuffle2')?.addEventListener('click', shuffleOrder);

  // Click SFX
  const clickSfx = $('clickSfx');
  if (clickSfx) {
    clickSfx.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACAAABAAEA/////wD///8AAP//AAD//wAA//8AAP///w==";
    document.querySelectorAll('.sfx').forEach(b =>
      b.addEventListener('click', () => { try { clickSfx.currentTime = 0; clickSfx.play(); } catch {} })
    );
  }

  // Pipeline order display
  let order = ['video','distort','pixel','rgb','blocks','vhs','cpunk','invert','leak','tape','binary','mono','trail','text'];
  const showOrder = (arr) => { const o=$('orderList'); if(o) o.textContent = arr.join('\n'); };
  showOrder(order);

  function shuffleOrder() {
    const arr = order.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    order = arr; showOrder(order);
  }

  function randomizeAll() {
    ui.cell.value  = (Math.random() * 64 + 8) | 0;
    ui.str.value   = (Math.random() * 70 + 10) | 0;
    ui.rgb.value   = (Math.random() * 80) | 0;
    ui.speed.value = (Math.random() * 80 + 10) | 0;

    ['fx_trail','fx_vhs','fx_cpunk','fx_invert','fx_binary','fx_text','fx_blocks','fx_leak','fx_tape','fx_psort','fx_mono']
      .forEach(k => ui[k].checked = Math.random()>0.5);

    shuffleOrder();
  }

  // ======= camera =======
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
      status('Camera access granted. Waiting for feed...');
      vid.onloadedmetadata = () => {
        vid.play();
        canvas.width  = vid.videoWidth || 640;
        canvas.height = vid.videoHeight || 480;
        running = true;
        status(`Camera started (${canvas.width}×${canvas.height}) — 2D pipeline`);
        render();
      };
    } catch (e) {
      status('Camera error: ' + e.message);
    }
  }

  // ======= text HUD =======
  const hudCanvas = document.createElement('canvas');
  const hudCtx = hudCanvas.getContext('2d', { willReadFrequently: true });
  const words = ['ERROR','FAILURE','SYSTEM CRASH',':(','CRITICAL ERROR','QUIT','STOP','CANCEL'];
  let activeMsgs = [];
  function spawnMsg(){
    const txt = words[(Math.random()*words.length)|0];
    const life = parseInt(ui.text_ms.value || '1400', 10);
    const rotation = [0,90,180,270][(Math.random()*4)|0];
    activeMsgs.push({
      txt,
      x: Math.random()*canvas.width*0.85,
      y: Math.random()*canvas.height*0.85,
      t: performance.now(), life, rotation
    });
  }
  setInterval(()=>{ if (ui.fx_text?.checked && running) spawnMsg(); }, 1200);

  function drawHUDOntoMain() {
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
      hudCtx.rotate(m.rotation * Math.PI / 180);
      hudCtx.globalAlpha = alpha * 0.95;
      hudCtx.fillStyle = i % 2 ? '#ff2a6d' : '#00e1ff';
      hudCtx.font = `bold ${18 + (i % 3) * 10}px ui-monospace, monospace`;
      hudCtx.fillText(m.txt, 0, 0);
      hudCtx.restore();
    }
    ctx.drawImage(hudCanvas, 0, 0);
  }

  // ======= utilities =======
  function hex2rgb(h){ const i=parseInt(h.slice(1),16); return [((i>>16)&255),((i>>8)&255),(i&255)]; }

  // ----- temp buffer for slice-based effects -----
  const tempCan = document.createElement('canvas');
  const tctx = tempCan.getContext('2d', { willReadFrequently: true });

  // ======= effects (2D, stackable) =======

  // 1) Distortion (row-wise sine warp)
  function applyDistortion() {
    const w = canvas.width, h = canvas.height;
    const strength = (parseInt(ui.str.value || '0', 10) / 100) * 20; // px
    if (strength < 0.5) return;
    const speed = parseInt(ui.speed.value || '50', 10) / 50; // 0..2
    const t = performance.now() / 1000;

    tempCan.width = w; tempCan.height = h;
    tctx.drawImage(canvas, 0, 0, w, h);
    ctx.clearRect(0, 0, w, h);

    // For each row, shift horizontally by sine
    for (let y = 0; y < h; y++) {
      const shift = Math.sin(y * 0.05 + t * 2.0 * speed) * strength;
      // wrap: draw in two passes to keep seamless
      const sy = y, sh = 1;
      ctx.drawImage(tempCan, 0, sy, w, sh, ((shift % w) + w) % w - w, sy, w, sh);
      ctx.drawImage(tempCan, 0, sy, w, sh, ((shift % w) + w) % w,      sy, w, sh);
    }
  }

  // 2) Pixelate (mapped to fx_psort + Pixel Size)
  function applyPixelate() {
    if (!ui.fx_psort?.checked) return;
    const w = canvas.width, h = canvas.height;
    const scale = Math.max(2, Math.floor(parseInt(ui.cell.value || '24', 10) / 4));
    tempCan.width = Math.max(1, (w / scale) | 0);
    tempCan.height = Math.max(1, (h / scale) | 0);
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(canvas, 0, 0, tempCan.width, tempCan.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCan, 0, 0, w, h);
  }

  // 3) RGB Split
  function applyRGBSplit() {
    const amt01 = Math.max(0, Math.min(1, (parseInt(ui.rgb.value || '0', 10) / 100)));
    if (amt01 <= 0.01) return;
    const w = canvas.width, h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const copy = new Uint8ClampedArray(d);
    const off = Math.max(1, Math.floor(amt01 * 12));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const rx = (y * w + Math.min(w - 1, x + off)) * 4;
        const bx = (y * w + Math.max(0, x - off)) * 4;
        d[i]     = copy[rx];
        d[i + 1] = copy[i + 1];
        d[i + 2] = copy[bx + 2];
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // 4) Glitch Blocks (random block shifts)
  function applyBlocks() {
    if (!ui.fx_blocks?.checked) return;
    const w = canvas.width, h = canvas.height;
    tempCan.width = w; tempCan.height = h;
    tctx.drawImage(canvas, 0, 0);
    const blocks = 6 + ((parseInt(ui.str.value || '0', 10) / 10) | 0);
    for (let i = 0; i < blocks; i++) {
      const bw = Math.max(16, ((Math.random() * w * 0.2) | 0));
      const bh = Math.max(8,  ((Math.random() * h * 0.1) | 0));
      const sx = (Math.random() * (w - bw)) | 0;
      const sy = (Math.random() * (h - bh)) | 0;
      const dx = sx + (((Math.random() * 2 - 1) * 30) | 0);
      const dy = sy + (((Math.random() * 2 - 1) * 15) | 0);
      ctx.drawImage(tempCan, sx, sy, bw, bh, dx, dy, bw, bh);
    }
  }

  // 5) VHS (jitter lines + scanline)
  function applyVHS() {
    if (!ui.fx_vhs?.checked) return;
    const w = canvas.width, h = canvas.height;
    const lines = 2 + ((parseInt(ui.speed.value || '50', 10) / 20) | 0);
    tempCan.width = w; tempCan.height = h;
    tctx.drawImage(canvas, 0, 0);
    for (let i = 0; i < lines; i++) {
      const y = (Math.random() * h) | 0;
      const sliceH = 1 + ((Math.random() * 5) | 0);
      const shift = ((Math.random() * 20) | 0) - 10;
      ctx.drawImage(tempCan, 0, y, w, sliceH, shift, y, w, sliceH);
    }
    // scanline flicker
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`;
    ctx.fillRect(0, (Math.random() * h) | 0, w, 1);
    ctx.globalAlpha = 1;
  }

  // 6) Cyberpunk grade
  function applyCyberpunk() {
    if (!ui.fx_cpunk?.checked) return;
    const w = canvas.width, h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      d[i]     = (r * 0.8 + b * 0.4);
      d[i + 1] = (g * 0.5 + b * 0.5);
      d[i + 2] = (b * 1.15);
    }
    ctx.putImageData(img, 0, 0);
  }

  // 7) Invert
  function applyInvert() {
    if (!ui.fx_invert?.checked) return;
    const w = canvas.width, h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
    ctx.putImageData(img, 0, 0);
  }

  // 8) Light leaks
  function applyLightLeak() {
    if (!ui.fx_leak?.checked) return;
    const w = canvas.width, h = canvas.height;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `rgba(255,0,80,${0.12 + Math.random()*0.18})`);
    g.addColorStop(1, `rgba(255,180,0,${0.06 + Math.random()*0.14})`);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  // 9) Tape Roll (vertical wrap + slight sine wobble)
  function applyTape() {
    if (!ui.fx_tape?.checked) return;
    const w = canvas.width, h = canvas.height;
    const speed = parseInt(ui.speed.value || '50', 10) / 50;
    const t = performance.now() / 1000;
    tempCan.width = w; tempCan.height = h;
    tctx.drawImage(canvas, 0, 0);
    const roll = ((t * 0.2 * (0.5 + speed)) % 1) * h;
    const wobble = Math.sin(t * 6) * 3;
    // Top part
    ctx.drawImage(tempCan, 0, roll, w, h - roll, wobble, 0, w, h - roll);
    // Bottom wrapped part
    ctx.drawImage(tempCan, 0, 0, w, roll, -wobble, h - roll, w, roll);
  }

  // 10) Binary overlay
  function applyBinary() {
    if (!ui.fx_binary?.checked) return;
    const w = canvas.width, h = canvas.height;
    const scale = 220;
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textBaseline = 'top';
    for (let y = 0; y < h; y += Math.max(10, (1000 / scale) | 0)) {
      for (let x = 0; x < w; x += Math.max(8, (800 / scale) | 0)) {
        ctx.fillText(Math.random() < 0.5 ? '0' : '1', x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  // 11) Monochrome (two-color map)
  function applyMono() {
    if (!ui.fx_mono?.checked) return;
    const w = canvas.width, h = canvas.height;
    const a = hex2rgb(ui.mono_a.value).map(v => v);
    const b = hex2rgb(ui.mono_b.value).map(v => v);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      d[i]     = a[0] * (1 - l/255) + b[0] * (l/255);
      d[i + 1] = a[1] * (1 - l/255) + b[1] * (l/255);
      d[i + 2] = a[2] * (1 - l/255) + b[2] * (l/255);
    }
    ctx.putImageData(img, 0, 0);
  }

  // 12) Motion Trail
  let lastFrame = null;
  function applyTrail() {
    if (!ui.fx_trail?.checked) return;
    if (lastFrame) {
      ctx.globalAlpha = 0.82;
      ctx.drawImage(lastFrame, 0, 0);
      ctx.globalAlpha = 1;
    }
    lastFrame = document.createElement('canvas');
    lastFrame.width = canvas.width;
    lastFrame.height = canvas.height;
    lastFrame.getContext('2d').drawImage(canvas, 0, 0);
  }

  // 13) Text overlay
  function applyText() {
    if (!ui.fx_text?.checked) return;
    drawHUDOntoMain();
  }

  // ======= render loop =======
  function render() {
    if (!running) return;
    requestAnimationFrame(render);

    const w = canvas.width, h = canvas.height;

    // mirrored video
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(vid, -w, 0, w, h);
    ctx.restore();

    // Apply effects in pipeline order
    for (const step of order) {
      switch (step) {
        case 'video':   /* already drawn */ break;
        case 'distort': applyDistortion(); break;
        case 'pixel':   applyPixelate(); break;
        case 'rgb':     applyRGBSplit(); break;
        case 'blocks':  applyBlocks(); break;
        case 'vhs':     applyVHS(); break;
        case 'cpunk':   applyCyberpunk(); break;
        case 'invert':  applyInvert(); break;
        case 'leak':    applyLightLeak(); break;
        case 'tape':    applyTape(); break;
        case 'binary':  applyBinary(); break;
        case 'mono':    applyMono(); break;
        case 'trail':   applyTrail(); break;
        case 'text':    applyText(); break;
        default: break;
      }
    }
  }
})();
