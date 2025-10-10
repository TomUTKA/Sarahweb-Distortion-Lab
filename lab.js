(() => {
  'use strict';

  // 🎛️ UI helpers
  const $ = (id) => document.getElementById(id);
  const status = (m) => { $('status').textContent = m; };
  const showOrder = (arr) => { $('orderList').textContent = arr.join('\n'); };

  const canvas = $('gl');
  const gl = canvas.getContext('webgl');
  const vid = $('vid');

  if (!gl) {
    status('WebGL not supported on this device.');
    return;
  }

  // 🔊 Click sounds
  const clickSfx = $('clickSfx');
  clickSfx.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACAAABAAEA/////wD///8AAP//AAD//wAA//8AAP///w==";
  document.querySelectorAll('.sfx').forEach(b => {
    b.addEventListener('click', () => {
      try { clickSfx.currentTime = 0; clickSfx.play(); } catch {}
    });
  });

  // 🎛️ UI controls
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

  // 🎥 Start webcam
  async function startCam() {
    if (!(location.protocol === 'https:' || location.hostname === 'localhost')) {
      alert('Webcam requires HTTPS or localhost');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      vid.srcObject = stream;
      await vid.play();
      const w = vid.videoWidth || 640;
      const h = vid.videoHeight || 480;
      setCanvasSize(w, h);
      status(`Camera started (${w}x${h})`);
    } catch (e) {
      status(`Camera error: ${e.message}`);
      alert('Could not access camera. Check permissions.');
    }
  }

  // 📏 Resize + WebGL setup
  function setCanvasSize(w, h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  // 🎨 Shaders
  const VS = `
    attribute vec2 aPos;
    attribute vec2 aUV;
    varying vec2 vUV;
    void main() {
      vUV = aUV;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const COM = `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uTex;
    uniform vec2 uRes;
    uniform float uTime;
  `;

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  };

  const prog = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    return p;
  };

  const makeShader = (src) => sh(gl.FRAGMENT_SHADER, COM + src);
  const P = {
    copy: prog(sh(gl.VERTEX_SHADER, VS), makeShader(`void main(){gl_FragColor=texture2D(uTex,vUV);}`)),
    invert: prog(sh(gl.VERTEX_SHADER, VS), makeShader(`void main(){vec4 c=texture2D(uTex,vUV);gl_FragColor=vec4(1.0-c.rgb,1.0);}`)),
  };

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 0, 0,
    1, -1, 1, 0,
    -1, 1, 0, 1,
    -1, 1, 0, 1,
    1, -1, 1, 0,
    1, 1, 1, 1
  ]), gl.STATIC_DRAW);

  // 🎞️ Effects placeholders (for expansion)
  let order = ['invert'];
  const updateOrderPanel = () => showOrder(order);

  updateOrderPanel();

  function shuffleOrder() {
    const arr = order.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    order = arr;
    updateOrderPanel();
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

  // 🖼️ Text popups
  const textCanvas = document.createElement('canvas');
  const textCtx = textCanvas.getContext('2d');
  const textTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const words = ['ERROR', 'FAILURE', 'SYSTEM CRASH', ':(', 'CRITICAL ERROR', 'QUIT', 'STOP', 'CANCEL'];
  let activeMsgs = [];

  function spawnMsg() {
    const txt = words[(Math.random() * words.length) | 0];
    const x = Math.random() * textCanvas.width * 0.8;
    const y = Math.random() * textCanvas.height * 0.8;
    const life = parseInt(ui.text_ms.value || 1200, 10);
    const rotation = [0, 90, 180, 270][(Math.random() * 4) | 0];
    activeMsgs.push({ txt, x, y, t: performance.now(), life, rotation });
  }

  setInterval(() => { if (ui.fx_text.checked) spawnMsg(); }, 1000);

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
  }

  // 🧠 Main render loop (simple placeholder)
  function render() {
    requestAnimationFrame(render);
    if (vid.readyState >= 2) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    drawTextOverlay();
  }

  render();
})();
