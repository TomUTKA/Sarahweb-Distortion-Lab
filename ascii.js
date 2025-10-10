(() => {
  const canvas = document.getElementById('asciiCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const vid = document.getElementById('vid');
  const charsetEl = document.getElementById('charset');
  const densityEl = document.getElementById('density');
  const colorEl = document.getElementById('color');
  const btnCam = document.getElementById('btnCam');
  const btnToggle = document.getElementById('btnToggle');
  const status = (m) => { document.getElementById('status').textContent = m; };

  // click sfx
  const clickSfx = document.getElementById('clickSfx');
  if (clickSfx) {
    clickSfx.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACAAABAAEA/////wD///8AAP//AAD//wAA//8AAP///w==";
    document.querySelectorAll('.sfx').forEach(b =>
      b.addEventListener('click', () => { try { clickSfx.currentTime = 0; clickSfx.play(); } catch {} })
    );
  }

  const sets = {
    classic: " .:-=+*#%@",
    numbers: "0123456789",
    latin: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    binary: "01",
    cyrillic: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ",
    kana: "アイウエオカキクケコサシスセソタチツテトナニヌネノ",
    braille: "⠁⠂⠄⠈⠐⠠⠡⠣⠥⠧⠩⠫⠭⠯⠷⠿"
  };

  let running = false;
  let asciiMode = true;

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
      status("Camera access granted. Waiting for feed…");
      vid.onloadedmetadata = () => {
        vid.play();
        canvas.width = vid.videoWidth || 640;
        canvas.height = vid.videoHeight || 480;
        running = true;
        status("Camera started.");
        render();
      };
    } catch (e) {
      console.error(e);
      status("Camera error: " + e.message);
    }
  }

  btnCam.onclick = startCam;
  btnToggle.onclick = () => (asciiMode = !asciiMode);

  function render() {
    if (!running) return;
    requestAnimationFrame(render);

    const w = canvas.width, h = canvas.height;
    const d = parseInt(densityEl.value, 10);
    const charset = sets[charsetEl.value] || sets.classic;

    // Draw current video frame
    ctx.drawImage(vid, 0, 0, w, h);

    if (!asciiMode) return; // show raw video if toggled off

    // Read pixels then render ASCII
    const frame = ctx.getImageData(0, 0, w, h);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = colorEl.value;
    ctx.font = `${d * 1.5}px monospace`;
    ctx.textBaseline = 'top';

    for (let y = 0; y < h; y += d * 2) {
      for (let x = 0; x < w; x += d) {
        const i = (y * w + x) * 4;
        const r = frame.data[i], g = frame.data[i + 1], b = frame.data[i + 2];
        const brightness = (r + g + b) / 3;
        const index = Math.floor((brightness / 255) * (charset.length - 1));
        const ch = charset[index] || " ";
        ctx.fillText(ch, x, y);
      }
    }
  }
})();
