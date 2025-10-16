(() => {
  const canvas = document.getElementById('asciiCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const vid = document.getElementById('vid');
  const charsetEl = document.getElementById('charset');
  const densityEl = document.getElementById('density');
  const colorEl = document.getElementById('color');
  const btnCam = document.getElementById('btnCam');
  const btnToggle = document.getElementById('btnToggle');
  const setStatus = (m) => { const s = document.getElementById('status'); if (s) s.textContent = m; };

  // click sfx
  const clickSfx = document.getElementById('clickSfx');
  if (clickSfx) {
    clickSfx.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACAAABAAEA/////wD///8AAP//AAD//wAA//8AAP///w==";
    document.querySelectorAll('.sfx').forEach(b =>
      b.addEventListener('click', () => { try { clickSfx.currentTime = 0; clickSfx.play(); } catch {} })
    );
  }

  // Character sets (light → dark for non-binary)
  const sets = {
    classic: " .'`\",:^;Il!i~-_+?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    numbers: " 1234567890",
    latin: " .,:;!iI1l|/\\rjtfLCJUYXzcvunxrjft|()[]{}?-_+~<>i!lI;:,'^`\". ",
    binary: "01",
    cyrillic: " .·:-=+*#ЖШЩЭЮЯ",
    kana: " .｡ｧｨｩｪｫｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ",
    braille: " ⠁⠃⠇⠏⠟⠿"
  };

  // 4×4 Bayer matrix normalized to [0..1)
  const B4 = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
  ].map(r => r.map(v => (v + 0.5) / 16));

  let running = false;
  let asciiMode = true;

  btnCam.onclick = startCam;
  btnToggle.onclick = () => (asciiMode = !asciiMode);

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
      setStatus("Camera access granted. Waiting for feed…");
      vid.onloadedmetadata = () => {
        vid.play();
        canvas.width = vid.videoWidth || 640;
        canvas.height = vid.videoHeight || 480;
        running = true;
        setStatus(`Camera started (${canvas.width}×${canvas.height})`);
        render();
      };
    } catch (e) {
      console.error(e);
      setStatus("Camera error: " + e.message);
    }
  }

  function render() {
    if (!running) return;
    requestAnimationFrame(render);

    const w = canvas.width, h = canvas.height;
    const density = clampInt(parseInt(densityEl.value || '12', 10), 2, 48); // higher → finer detail
    const color   = colorEl.value || '#00e1ff';
    const mode    = (charsetEl.value || 'classic');
    const charset = sets[mode] || sets.classic;
    const isBinary = (mode === 'binary');

    // Draw latest frame (mirrored)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(vid, -w, 0, w, h);
    ctx.restore();

    // Read pixels
    const frame = ctx.getImageData(0, 0, w, h);
    const data = frame.data;

    // --- Adaptive exposure ---
    let sum = 0, count = 0;
    const step = 4 * 16;
    for (let i = 0; i < data.length; i += step) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      count++;
    }
    const meanL = (sum / count) / 255;
    const targetMid = 0.5;
    const gain = clamp(targetMid / Math.max(0.08, meanL), 0.6, 1.8);
    const contrast = 1.12;

    // --- Density-based scaling ---
    const targetCols = Math.max(40, Math.round(80 * (density / 8)));
    let cell = Math.max(3, Math.floor(w / targetCols));
    let cols = Math.max(1, Math.floor(w / cell));
    let rows = Math.max(1, Math.floor(h / cell));

    const MAX_GLYPHS = 120000; // safety cap
    if (cols * rows > MAX_GLYPHS) {
      const scale = Math.sqrt((cols * rows) / MAX_GLYPHS);
      cell = Math.max(3, Math.floor(cell * scale));
      cols = Math.max(1, Math.floor(w / cell));
      rows = Math.max(1, Math.floor(h / cell));
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.font = `${Math.floor(cell * 0.9)}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'top';

    const t = (performance.now() % 1000) / 1000;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cell;
        const y = r * cell;
        const sx = Math.min(w - 1, x + (cell >> 1));
        const sy = Math.min(h - 1, y + (cell >> 1));
        const i = (sy * w + sx) * 4;

        // luminance 0..1
        let L = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        L = clamp((L * gain), 0, 1);
        L = clamp((L - 0.5) * contrast + 0.5, 0, 1);

        let ch = ' ';
        if (isBinary) {
          const b = B4[r & 3][c & 3];
          const thr = clamp(0.48 + 0.08 * Math.sin(6.283 * t) + (b - 0.5) * 0.25, 0.25, 0.75);
          ch = (L > thr) ? '1' : '0';
        } else {
          const idx = Math.floor(L * (charset.length - 1));
          ch = charset[idx] || charset[0];
        }

        if (asciiMode) ctx.fillText(ch, x, y);
      }
    }
  }

  // utils
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function clampInt(v, lo, hi) { v |= 0; return clamp(v, lo, hi); }
})();
