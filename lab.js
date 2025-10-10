(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const status = (m) => { $('status').textContent = m; };
  const showOrder = (arr) => { $('orderList').textContent = arr.join('\n'); };

  const canvas = $('gl');
  const ctx = canvas.getContext('2d');
  const vid = $('vid');

  // 🔊 Click sound
  const clickSfx = $('clickSfx');
  clickSfx.src =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACAAABAAEA/////wD///8AAP//AAD//wAA//8AAP///w==";
  document.querySelectorAll('.sfx').forEach((b) =>
    b.addEventListener('click', () => {
      try {
        clickSfx.currentTime = 0;
        clickSfx.play();
      } catch {}
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
  $('btnShuffle').onclick = shuffleOrder;
  $('btnShuffle2').onclick = shuffleOrder;

  let running = false;
  let order = ['invert'];

  function shuffleOrder() {
    const arr = order.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    order = arr;
    showOrder(order);
  }

  function randomizeAll() {
    ui.cell.value = (Math.random() * 64 + 8) | 0;
    ui.str.value = (Math.random() * 70 + 10) | 0;
    ui.rgb.value = (Math.random() * 70) | 0;
    ui.speed.value = (Math.random() * 80 + 10) | 0;
    ui.fx_invert.checked = Math.random() > 0.5;
    ui.fx_vhs.checked = Math.random() > 0.4;
    ui.fx_cpunk.checked = Math.random() > 0.6;
    ui.fx_trail.checked = Math.random() > 0.3;
    ui.fx_text.checked = Math.random() > 0.5;
    shuffleOrder();
  }

  // 🎥 Start Camera — fixed version
  async function startCam() {
    if (!(location.protocol === 'https:' || location.hostname === 'localhost')) {
      alert('Webcam requires HTTPS or localhost.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
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
      alert('Could not access camera. Check permissions.');
    }
  }

  // 💬 Text pop-ups
  const textCanvas = document.createElement('canvas');
  const textCtx = textCanvas.getContext('2d');
  const words = [
    'ERROR',
    'FAILURE',
    'SYSTEM CRASH',
    ':(',
    'CRITICAL ERROR',
    'QUIT',
    'STOP',
    'CANCEL'
  ];
  let activeMsgs = [];

  function spawnMsg() {
    const txt = words[(Math.random() * words.length) | 0];
    const x = Math.random() * canvas.width * 0.8;
    const y = Math.random() * canvas.height * 0.8;
    const life = parseInt(ui.text_ms.value || 1200, 10);
    const rotation = [0, 90, 180, 270][(Math.random() * 4) | 0];
    activeMsgs.push({ txt, x, y, t: performance.now(), life, rotation });
  }

  setInterval(() => {
    if (ui.fx_text.checked && running) spawnMsg();
  }, 1200);

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

  // 🎨 Render loop — draws mirrored live feed
  function render() {
    if (!running) return;
    requestAnimationFrame(render);

    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(vid, -w, 0, w, h);
    ctx.restore();

    // Example simple effect: invert
    if (ui.fx_invert.checked) {
      const img = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = 255 - img.data[i];
        img.data[i + 1] = 255 - img.data[i + 1];
        img.data[i + 2] = 255 - img.data[i + 2];
      }
      ctx.putImageData(img, 0, 0);
    }

    drawTextOverlay();
  }
})();
