(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const status = (m) => { $('status').textContent = m; };

  const canvas = $('gl');
  const ctx = canvas.getContext('2d');
  const vid = $('vid');

  // 🔊 Click sound
  const clickSfx = $('clickSfx');
  clickSfx.src =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACAAABAAEA/////wD///8AAP//AAD//wAA//8AAP///w==";
  document.querySelectorAll('.sfx').forEach((b) =>
    b.addEventListener('click', () => {
      try { clickSfx.currentTime = 0; clickSfx.play(); } catch {}
    })
  );

  // 🎛️ Controls
  const ui = {
    cell: $('cell'),
    str: $('strength'),
    rgb: $('rgb'),
    speed: $('speed'),
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

  $('btnCam').onclick = startCam;
  $('btnRandom').onclick = randomizeAll;

  let running = false;
  let lastFrame = null;

  // 🎥 Start Camera
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
        canvas.width = vid.videoWidth || 640;
        canvas.height = vid.videoHeight || 480;
        running = true;
        status(`Camera started (${canvas.width}x${canvas.height})`);
        render();
      };
    } catch (e) {
      status(`Camera error: ${e.message}`);
      alert('Could not access camera.');
    }
  }

  function randomizeAll() {
    ui.rgb.value = (Math.random() * 70) | 0;
    ui.str.value = (Math.random() * 70) | 0;
    ui.speed.value = (Math.random() * 80 + 10) | 0;
    for (let fx of [
      'fx_trail','fx_vhs','fx_cpunk','fx_invert','fx_binary','fx_text','fx_blocks','fx_leak','fx_tape','fx_psort'
    ]) ui[fx].checked = Math.random() > 0.5;
  }

  // 💬 Text Popups
  const textCanvas = document.createElement('canvas');
  const textCtx = textCanvas.getContext('2d');
  const words = ['ERROR','FAILURE','SYSTEM CRASH',':(','CRITICAL ERROR','QUIT','STOP','CANCEL'];
  let activeMsgs = [];

  function spawnMsg() {
    const txt = words[(Math.random() * words.length) | 0];
    const x = Math.random() * canvas.width * 0.8;
    const y = Math.random() * canvas.height * 0.8;
    const life = parseInt(ui.text_ms.value || 1200, 10);
    const rotation = [0, 90, 180, 270][(Math.random() * 4) | 0];
    activeMsgs.push({ txt, x, y, t: performance.now(), life, rotation });
  }

  setInterval(() => { if (ui.fx_text.checked && running) spawnMsg(); }, 1200);

  function drawTextOverlay() {
    const now = performance.now();
    textCanvas.width = canvas.width;
    textCanvas.height = canvas.height;
    textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    for (let i = activeMsgs.length - 1; i >= 0; i--) {
      const m = activeMsgs[i];
      const age = now - m.t;
      if (age > m.life) {
        activeMsgs.splice(i, 1);
        continue;
      }
      const alpha = 1 - age / m.life;
      textCtx.save();
      textCtx.translate(m.x, m.y);
      textCtx.rotate((m.rotation * Math.PI) / 180);
      textCtx.globalAlpha = alpha;
      textCtx.fillStyle = i % 2 ? '#ff2a6d' : '#00e1ff';
      textCtx.font = `bold ${18 + (i % 3) * 10}px monospace`;
      textCtx.fillText(m.txt, 0, 0);
      textCtx.restore();
    }
    ctx.drawImage(textCanvas, 0, 0);
  }

  // 🎨 Effects
  function applyRGBSplit(img, strength = 10) {
    const d = img.data;
    const offset = strength * 4;
    const w = img.width * 4;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < w; x += 4) {
        const i = y * w + x;
        const r = d[i + offset] || 0;
        const g = d[i + 1];
        const b = d[i - offset + 2] || 0;
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
      }
    }
    return img;
  }

  function applyPixelate(scale = 8) {
    const w = canvas.width, h = canvas.height;
    const temp = document.createElement('canvas');
    temp.width = w / scale; temp.height = h / scale;
    const tctx = temp.getContext('2d');
    tctx.drawImage(canvas, 0, 0, temp.width, temp.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(temp, 0, 0, w, h);
  }

  function applyCyberpunk() {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      let r = img.data[i], g = img.data[i+1], b = img.data[i+2];
      img.data[i] = (r * 0.8 + b * 0.4);
      img.data[i+1] = (g * 0.5 + b * 0.5);
      img.data[i+2] = (b * 1.2);
    }
    ctx.putImageData(img, 0, 0);
  }

  function applyVHS() {
    const w = canvas.width, h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      if (Math.random() < 0.03) {
        const start = y * w * 4;
        const end = start + w * 4;
        const row = img.data.slice(start, end);
        const shift = (Math.random() * 10) | 0;
        img.data.set(row.slice(shift * 4).concat(row.slice(0, shift * 4)), start);
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.1})`;
    ctx.fillRect(0, Math.random()*h, w, 1);
    ctx.globalAlpha = 1;
  }

  function applyMotionTrail() {
    if (lastFrame) {
      ctx.globalAlpha = 0.8;
      ctx.drawImage(lastFrame, 0, 0);
      ctx.globalAlpha = 1;
    }
    lastFrame = document.createElement('canvas');
    lastFrame.width = canvas.width;
    lastFrame.height = canvas.height;
    lastFrame.getContext('2d').drawImage(canvas, 0, 0);
  }

  function applyLightLeak() {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, `rgba(255,0,80,${Math.random()*0.3})`);
    g.addColorStop(1, `rgba(255,180,0,${Math.random()*0.2})`);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  // 🎞️ Render loop
  function render() {
    if (!running) return;
    requestAnimationFrame(render);

    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(vid, -w, 0, w, h);
    ctx.restore();

    if (ui.fx_invert.checked) {
      const img = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = 255 - img.data[i];
        img.data[i + 1] = 255 - img.data[i + 1];
        img.data[i + 2] = 255 - img.data[i + 2];
      }
      ctx.putImageData(img, 0, 0);
    }

    if (ui.fx_rgb && ui.fx_rgb.checked) {
      const img = ctx.getImageData(0, 0, w, h);
      ctx.putImageData(applyRGBSplit(img, parseInt(ui.rgb.value, 10) / 3), 0, 0);
    }

    if (ui.fx_cpunk.checked) applyCyberpunk();
    if (ui.fx_vhs.checked) applyVHS();
    if (ui.fx_trail.checked) applyMotionTrail();
    if (ui.fx_leak.checked) applyLightLeak();
    if (ui.fx_psort.checked) applyPixelate(8);

    drawTextOverlay();
  }
})();
