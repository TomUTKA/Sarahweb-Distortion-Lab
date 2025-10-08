(()=>{'use strict';
const status=(m)=>{document.getElementById('status').textContent=m;};
const showOrder=(arr)=>{document.getElementById('orderList').textContent=arr.join('\n');};
const canvas=document.getElementById('gl'); const gl=canvas.getContext('webgl');
const vid=document.getElementById('vid'); const drop=document.getElementById('drop');
if(!gl){ status('WebGL not available.'); throw new Error('No WebGL'); }

// Click sound
const clickSfx=document.getElementById('clickSfx');
clickSfx.src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACAAABAAEA/////wD///8AAP//AAD//wAA//8AAP///w==";
document.querySelectorAll('.sfx').forEach(b=> b.addEventListener('click', ()=>{ try{ clickSfx.currentTime=0; clickSfx.play(); }catch{} }));

// Secure origin note
const banner=document.getElementById('banner');
const isSecure=location.protocol==='https:'||location.hostname==='localhost';
banner.textContent = isSecure ? 'Secure origin: webcam allowed.' : 'Not secure origin → Webcam blocked (use HTTPS or localhost).';

// UI
const $=(id)=>document.getElementById(id);
const ui={ cell:$('cell'), str:$('strength'), rgb:$('rgb'), speed:$('speed'),
           fx_ascii:$('fx_ascii'), fx_trail:$('fx_trail'), fx_vhs:$('fx_vhs'),
           fx_cpunk:$('fx_cpunk'), fx_invert:$('fx_invert'), fx_binary:$('fx_binary'),
           fx_text:$('fx_text'), text_ms:$('text_ms'), fx_mono:$('fx_mono'),
           mono_a:$('mono_a'), mono_b:$('mono_b') };

// Buttons
const file=$('file');
$('btnUpload').onclick=()=>file.click();
$('btnCam').onclick=startCam;
$('btnSave').onclick=savePNG;
$('btnRandom').onclick=randomizeAll;
$('btnShuffle').onclick=shuffleOrder;
$('btnShuffle2').onclick=shuffleOrder;
file.onchange=e=>{ if(e.target.files[0]) loadFile(e.target.files[0]); };

drop.ondragover=e=>{ e.preventDefault(); drop.style.background="#222"; };
drop.ondragleave=e=>{ e.preventDefault(); drop.style.background=""; };
drop.ondrop=e=>{ e.preventDefault(); drop.style.background=""; if(e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); };

// Pipeline (stackable, order on the right)
let order=['orient','warp','pixel','rgb','vhs','cpunk','invert','ascii','binary','trail','mono','hudText'];
const updateOrderPanel=()=>showOrder(order); updateOrderPanel();

// GL helpers
function sh(type,src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ console.error(gl.getShaderInfoLog(s)); throw new Error(gl.getShaderInfoLog(s)); } return s; }
function prog(vs,fs){ const p=gl.createProgram(); gl.attachShader(p,vs); gl.attachShader(p,fs); gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){ console.error(gl.getProgramInfoLog(p)); throw new Error(gl.getProgramInfoLog(p)); } return p; }
const VS = `attribute vec2 aPos; attribute vec2 aUV; varying vec2 vUV; void main(){ vUV=aUV; gl_Position=vec4(aPos,0.,1.); }`;
const COM= `precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime;`;

// base
const fsCopy = sh(gl.FRAGMENT_SHADER, COM+`void main(){ gl_FragColor=texture2D(uTex,vUV); }`);
// orientation (no random flip from randomize)
const fsOrient= sh(gl.FRAGMENT_SHADER, COM+`
  uniform int uMode;
  vec2 map(vec2 uv){ if(uMode==1)return vec2(1.0-uv.x,uv.y); if(uMode==2) return vec2(uv.x,1.0-uv.y); if(uMode==3) return vec2(1.0-uv.x,1.0-uv.y); return uv; }
  void main(){ gl_FragColor=texture2D(uTex,map(vUV)); }
`);
// warp + rgb split
const fsWarp= sh(gl.FRAGMENT_SHADER, COM+`
  uniform float uStr,uRGB,uSpeed; vec2 dir(float t){ return vec2(cos(t*.7),sin(t*.9)); }
  void main(){ float t=uTime*uSpeed; vec2 uv=vUV;
    float w1=sin(uv.y*12.+1.2*t), w2=cos(uv.x*9.-1.1*t), w3=sin((uv.x+uv.y)*6.-.7*t);
    uv+=vec2(w1*w2,w3)*(uStr*.035);
    vec2 c=vec2(.5), d=uv-c; float r=length(d); float a=atan(d.y,d.x)+r*(uStr*.35)*sin(t*.4);
    uv=c+vec2(cos(a),sin(a))*r; vec2 off=dir(t)*(uRGB*.004);
    gl_FragColor=vec4(texture2D(uTex,uv+off).r,texture2D(uTex,uv).g,texture2D(uTex,uv-off).b,1.);
  }`);
// pixelate + rgb
const fsPixel= sh(gl.FRAGMENT_SHADER, COM+`
  uniform float uCell,uRGB; void main(){ vec2 grid=uRes/max(uCell,1.); vec2 uvq=floor(vUV*grid)/grid;
    vec2 off=vec2(0.707)*(uRGB*0.004);
    gl_FragColor=vec4(texture2D(uTex,uvq+off).r,texture2D(uTex,uvq).g,texture2D(uTex,uvq-off).b,1.);
  }`);
// extra rgb
const fsRGB  = sh(gl.FRAGMENT_SHADER, COM+`
  uniform float uAmt; void main(){ vec2 off=vec2(cos(uTime*.7),sin(uTime*.9))*(uAmt*.004);
    gl_FragColor=vec4(texture2D(uTex,vUV+off).r,texture2D(uTex,vUV).g,texture2D(uTex,vUV-off).b,1.);
  }`);
// VHS: scanlines + chroma bleed + jitter + noise
const fsVHS = sh(gl.FRAGMENT_SHADER, COM+`
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main(){
    vec2 uv=vUV;
    float t=uTime*0.8;
    float jitter=(hash(vec2(t,uv.y))*2.0-1.0)*0.0025;
    uv.x += jitter;
    float scan = 0.04*sin(uv.y*1200.0/uRes.y + t*8.0);
    vec3 c=texture2D(uTex,uv).rgb;
    float bleed = 0.0025;
    float r=texture2D(uTex,uv+vec2(bleed,0.)).r;
    float b=texture2D(uTex,uv-vec2(bleed,0.)).b;
    float n = (hash(uv*vec2(900.0,700.0)+t)-0.5)*0.08;
    c = vec3(r,c.g,b) + scan + n;
    gl_FragColor=vec4(c,1.0);
  }`);
// Cyberpunk grade (teal-magenta vibe)
const fsCP = sh(gl.FRAGMENT_SHADER, COM+`
  vec3 grade(vec3 c){
    vec3 lift=vec3(-0.05,0.00,0.05);
    vec3 gamma=vec3(0.9,1.1,1.0);
    vec3 gain=vec3(0.9,1.15,1.15);
    c=(c+lift);
    c=pow(clamp(c,0.0,1.0), gamma);
    c=c*gain;
    c = mix(c, vec3(c.b, (c.r+c.b)*0.5, c.r), 0.20);
    return clamp(c,0.0,1.0);
  }
  void main(){ vec3 c=texture2D(uTex,vUV).rgb; gl_FragColor=vec4(grade(c),1.); }`);
// Invert
const fsInv = sh(gl.FRAGMENT_SHADER, COM+`void main(){ vec4 c=texture2D(uTex,vUV); gl_FragColor=vec4(1.0-c.rgb, c.a); }`);
// HUD blend
const fsHUD  = sh(gl.FRAGMENT_SHADER, COM+`
  uniform sampler2D uHUD; uniform float uAmt;
  void main(){ vec4 base=texture2D(uTex,vUV); vec4 hud=texture2D(uHUD,vUV); gl_FragColor=vec4(mix(base.rgb,hud.rgb,hud.a*uAmt),1.); }`);
// trail
const fsTrailU= sh(gl.FRAGMENT_SHADER, COM+`
  uniform sampler2D uCur; uniform sampler2D uTrail; uniform float uDecay;
  void main(){ vec3 cur=texture2D(uCur,vUV).rgb; vec3 old=texture2D(uTrail,vUV).rgb; vec3 acc=mix(cur,old,clamp(uDecay,0.0,1.0)); gl_FragColor=vec4(acc,1.); }`);
const fsTrailM= sh(gl.FRAGMENT_SHADER, COM+`
  uniform sampler2D uCur; uniform sampler2D uTrail; uniform float uAmt;
  void main(){ vec3 cur=texture2D(uCur,vUV).rgb; vec3 acc=texture2D(uTrail,vUV).rgb; gl_FragColor=vec4(mix(cur,acc,clamp(uAmt,0.0,1.0)),1.); }`);
// Monochrome map between two colors
const fsMono = sh(gl.FRAGMENT_SHADER, COM+`
  uniform vec3 uA, uB;
  void main(){
    vec3 c=texture2D(uTex,vUV).rgb;
    float l=dot(c, vec3(0.2126,0.7152,0.0722));
    gl_FragColor=vec4(mix(uA,uB,l),1.0);
  }`);
// Binary overlay
const fsBin = sh(gl.FRAGMENT_SHADER, COM+`
  uniform float uScale;
  float rnd(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    vec2 uv=vUV;
    float s=uScale;
    vec2 grid=floor(uv*vec2(s))*vec2(1.0);
    float v = step(0.5, rnd(grid));
    float g = mix(0.0,1.0,v);
    vec3 base=texture2D(uTex,uv).rgb;
    vec3 overlay = vec3(g);
    float a=0.25;
    gl_FragColor=vec4(mix(base, overlay, a),1.0);
  }`);

const P={ copy:prog(sh(gl.VERTEX_SHADER,VS),fsCopy), orient:prog(sh(gl.VERTEX_SHADER,VS),fsOrient),
  warp:prog(sh(gl.VERTEX_SHADER,VS),fsWarp), pixel:prog(sh(gl.VERTEX_SHADER,VS),fsPixel),
  rgb:prog(sh(gl.VERTEX_SHADER,VS),fsRGB), vhs:prog(sh(gl.VERTEX_SHADER,VS),fsVHS),
  cpunk:prog(sh(gl.VERTEX_SHADER,VS),fsCP), invert:prog(sh(gl.VERTEX_SHADER,VS),fsInv),
  hud:prog(sh(gl.VERTEX_SHADER,VS),fsHUD), trailU:prog(sh(gl.VERTEX_SHADER,VS),fsTrailU),
  trailM:prog(sh(gl.VERTEX_SHADER,VS),fsTrailM), mono:prog(sh(gl.VERTEX_SHADER,VS),fsMono),
  binary:prog(sh(gl.VERTEX_SHADER,VS),fsBin) };

// Quad
const quad=gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,quad);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([ -1,-1,0,0,  1,-1,1,0,  -1,1,0,1,  -1,1,0,1,   1,-1,1,0,   1,1,1,1 ]),gl.STATIC_DRAW);
function use(p){ gl.useProgram(p);
  const aPos=gl.getAttribLocation(p,'aPos'); const aUV=gl.getAttribLocation(p,'aUV');
  gl.bindBuffer(gl.ARRAY_BUFFER,quad);
  gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,16,0); gl.vertexAttribPointer(aUV,2,gl.FLOAT,false,16,8);
  const uRes=gl.getUniformLocation(p,'uRes'); if(uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
  const uTime=gl.getUniformLocation(p,'uTime'); if(uTime) gl.uniform1f(uTime, performance.now()/1000);
}

// Ping-pong
let fbA=null, fbB=null, texA=null, texB=null, srcTex=null;
function makeRT(w,h){
  function mkTex(){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    return t;
  }
  function mkFBO(t){ const f=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0); return f; }
  texA=mkTex(); texB=mkTex(); fbA=mkFBO(texA); fbB=mkFBO(texB);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
}

function setCanvasSize(w,h){
  canvas.width=w; canvas.height=h; gl.viewport(0,0,w,h); makeRT(w,h); allocTrail(w,h);
  asciiCanvas.width=w; asciiCanvas.height=h;
  gl.bindTexture(gl.TEXTURE_2D, asciiTex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  textCanvas.width=w; textCanvas.height=h; // HUD text layer
  gl.bindTexture(gl.TEXTURE_2D, textTex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
}

// Source tex
srcTex=gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D,srcTex);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);

// Trail
const trailTex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, trailTex);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
const trailFB=gl.createFramebuffer();
function allocTrail(w,h){
  gl.bindTexture(gl.TEXTURE_2D, trailTex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, trailFB);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trailTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// ASCII layer
const asciiCanvas=document.createElement('canvas'), asciiCtx=asciiCanvas.getContext('2d'); const asciiTex=gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, asciiTex);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
const asciiChars=" .:-=+*#%@";
function drawASCII(){
  const w=asciiCanvas.width,h=asciiCanvas.height; if(!w||!h || !ui.fx_ascii.checked) return;
  const size=12; const cols=Math.max(2,Math.floor(w/size)), rows=Math.max(2,Math.floor(h/size));
  const snap=document.createElement('canvas'), sctx=snap.getContext('2d'); snap.width=cols; snap.height=rows;
  sctx.drawImage(canvas,0,0,cols,rows); const img=sctx.getImageData(0,0,cols,rows).data;
  asciiCtx.clearRect(0,0,w,h); asciiCtx.fillStyle='rgba(0,0,0,0)'; asciiCtx.clearRect(0,0,w,h);
  asciiCtx.fillStyle='#0f0'; asciiCtx.font=`bold ${size}px ui-monospace, Menlo, Consolas, monospace`; asciiCtx.textBaseline='top';
  for(let y=0;y<rows;y++){ for(let x=0;x<cols;x++){ const idx=(y*cols+x)*4; const r=img[idx],g=img[idx+1],b=img[idx+2];
    const lum=0.2126*r+0.7152*g+0.0722*b; const p=lum/255; const ch=asciiChars[Math.floor(p*(asciiChars.length-1))];
    asciiCtx.fillText(ch, x*size, y*size); } }
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, asciiTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,asciiCanvas);
  gl.activeTexture(gl.TEXTURE0);
}

// Text HUD layer
const textCanvas=document.createElement('canvas'), textCtx=textCanvas.getContext('2d'); const textTex=gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, textTex);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
const words=["ERROR","FAILURE","exe","1","0","!","?","SYSTEM CRASH",":(","CRITICAL ERROR","QUIT","RETRY","STOP","CANCEL"];
let activeMsgs=[];
function spawnMsg(){
  const txt=words[(Math.random()*words.length)|0];
  const x=Math.random()*textCanvas.width*0.9;
  const y=Math.random()*textCanvas.height*0.9;
  const life=parseInt(ui.text_ms.value||1200,10);
  activeMsgs.push({txt,x,y,t:performance.now(),life});
}
setInterval(()=>{ if(ui.fx_text.checked) spawnMsg(); }, 900);
function drawHUDText(){
  const now=performance.now();
  if(!ui.fx_text.checked){ activeMsgs.length=0; textCtx.clearRect(0,0,textCanvas.width,textCanvas.height); return; }
  textCtx.clearRect(0,0,textCanvas.width,textCanvas.height);
  for(let i=activeMsgs.length-1;i>=0;i--){
    const m=activeMsgs[i]; const age=now-m.t;
    if(age>m.life){ activeMsgs.splice(i,1); continue; }
    const alpha=1.0 - age/m.life;
    textCtx.globalAlpha=alpha*0.9;
    textCtx.fillStyle= (i%2? '#ff2a6d':'#00e1ff');
    textCtx.font=`bold ${18 + (i%3)*10}px ui-monospace, Menlo, Consolas, monospace`;
    textCtx.fillText(m.txt, m.x, m.y);
  }
  textCtx.globalAlpha=1;
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, textTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,textCanvas);
  gl.activeTexture(gl.TEXTURE0);
}

// Binary overlay draw happens in shader, no buffer needed

// Draw helper
function drawTo(texIn, fbOut, program, uniforms){
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbOut); use(program);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texIn);
  const uTex=gl.getUniformLocation(program,'uTex'); if(uTex) gl.uniform1i(uTex,0);
  if(uniforms) uniforms(program);
  gl.drawArrays(gl.TRIANGLES,0,6); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
}

// Steps (conditionally apply based on toggles)
let currentOrientMode=0; // orientation fixed (no randomize flips)
const steps={
  orient:(r,w)=>drawTo(r,w,P.orient,(p)=>{ gl.uniform1i(gl.getUniformLocation(p,'uMode'), currentOrientMode); }),
  warp:(r,w)=>drawTo(r,w,P.warp,(p)=>{
    gl.uniform1f(gl.getUniformLocation(p,'uStr'), parseFloat(ui.str.value)/100);
    gl.uniform1f(gl.getUniformLocation(p,'uRGB'), parseFloat(ui.rgb.value)/100);
    gl.uniform1f(gl.getUniformLocation(p,'uSpeed'), parseFloat(ui.speed.value)/50);
  }),
  pixel:(r,w)=>drawTo(r,w,P.pixel,(p)=>{
    gl.uniform1f(gl.getUniformLocation(p,'uCell'), parseFloat(ui.cell.value));
    gl.uniform1f(gl.getUniformLocation(p,'uRGB'), parseFloat(ui.rgb.value)/100);
  }),
  rgb:(r,w)=>drawTo(r,w,P.rgb,(p)=>{ if(ui.rgb.value>0) gl.uniform1f(gl.getUniformLocation(p,'uAmt'), parseFloat(ui.rgb.value)/100); }),
  vhs:(r,w)=>{ if(ui.fx_vhs.checked) drawTo(r,w,P.vhs); },
  cpunk:(r,w)=>{ if(ui.fx_cpunk.checked) drawTo(r,w,P.cpunk); },
  invert:(r,w)=>{ if(ui.fx_invert.checked) drawTo(r,w,P.invert); },
  ascii:(r,w)=>{ if(ui.fx_ascii.checked){ drawASCII(); drawTo(r,w,P.hud,(p)=>{
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, asciiTex);
    gl.uniform1i(gl.getUniformLocation(p,'uHUD'),1); gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(gl.getUniformLocation(p,'uAmt'), 0.7);
  }); } },
  binary:(r,w)=>{ if(ui.fx_binary.checked) drawTo(r,w,P.binary,(p)=>{
      gl.uniform1f(gl.getUniformLocation(p,'uScale'), 220.0); // density
  }); },
  trail:(r,w)=>{ if(ui.fx_trail.checked){
    gl.bindFramebuffer(gl.FRAMEBUFFER, trailFB); use(P.trailU);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r); gl.uniform1i(gl.getUniformLocation(P.trailU,'uCur'),0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, trailTex); gl.uniform1i(gl.getUniformLocation(P.trailU,'uTrail'),1);
    gl.uniform1f(gl.getUniformLocation(P.trailU,'uDecay'), 0.88); gl.drawArrays(gl.TRIANGLES,0,6);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    use(P.trailM); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r); gl.uniform1i(gl.getUniformLocation(P.trailM,'uCur'),0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, trailTex); gl.uniform1i(gl.getUniformLocation(P.trailM,'uTrail'),1);
    gl.uniform1f(gl.getUniformLocation(P.trailM,'uAmt'), 0.45); gl.drawArrays(gl.TRIANGLES,0,6); gl.activeTexture(gl.TEXTURE0);
  }},
  mono:(r,w)=>{ if(ui.fx_mono.checked){ drawTo(r,w,P.mono,(p)=>{
      const c1=hex2rgb(ui.mono_a.value), c2=hex2rgb(ui.mono_b.value);
      gl.uniform3f(gl.getUniformLocation(p,'uA'), c1[0],c1[1],c1[2]);
      gl.uniform3f(gl.getUniformLocation(p,'uB'), c2[0],c2[1],c2[2]);
  }); } },
  hudText:(r,w)=>{ if(ui.fx_text.checked){ drawHUDText(); drawTo(r,w,P.hud,(p)=>{
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.uniform1i(gl.getUniformLocation(p,'uHUD'),1); gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(gl.getUniformLocation(p,'uAmt'), 1.0);
  }); } }
};

function hex2rgb(h){
  const i=parseInt(h.slice(1),16);
  return [((i>>16)&255)/255, ((i>>8)&255)/255, (i&255)/255];
}

// Render
function render(){
  requestAnimationFrame(render);
  if(vid.srcObject && !vid.paused && !vid.ended){
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // fix webcam vertical flip
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,vid);
  }
  let read=srcTex, writeFB=fbA, writeTex=texA;
  const swap=()=>{ const tmp=writeTex; writeTex=(writeTex===texA?texB:texA); writeFB=(writeFB===fbA?fbB:fbA); read=tmp; };
  for(const name of order){ steps[name](read, writeFB); swap(); }
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); use(P.copy);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, read);
  gl.uniform1i(gl.getUniformLocation(P.copy,'uTex'),0); gl.drawArrays(gl.TRIANGLES,0,6);
}
render();

// Init placeholder
(function(){
  const ph=document.createElement('canvas'); ph.width=800; ph.height=450; const ctx=ph.getContext('2d');
  const g=ctx.createLinearGradient(0,0,800,450); g.addColorStop(0,'#222'); g.addColorStop(1,'#333');
  ctx.fillStyle=g; ctx.fillRect(0,0,800,450);
  setCanvasSize(ph.width,ph.height);
  gl.bindTexture(gl.TEXTURE_2D, srcTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,ph);
  status('Ready. Upload an image or start webcam.');
})();

// File & Cam
function loadFile(f){
  try{
    const url=URL.createObjectURL(f);
    const img=new Image(); img.decoding='async';
    img.onload=()=>{
      URL.revokeObjectURL(url);
      setCanvasSize(img.width,img.height);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
      status('Image loaded.');
    };
    img.onerror=(e)=>{ console.error('Image error',e); status('Could not load that file.'); };
    img.src=url;
  }catch(e){ console.error(e); status('Upload error: '+e); }
}
async function startCam(){
  if(!(location.protocol==='https:'||location.hostname==='localhost')){ alert('Webcam needs https or localhost'); return; }
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});
    vid.srcObject=stream;
    await new Promise(res=>{ if(vid.readyState>=1&&vid.videoWidth) return res(); vid.onloadedmetadata=()=>res(); });
    await vid.play();
    const w=vid.videoWidth||640, h=vid.videoHeight||480;
    setCanvasSize(w,h); drop.style.display='none'; status(`Webcam on (${w}×${h}).`);
  }catch(e){ console.error(e); status('Webcam error: '+e.name+(e.message?(': '+e.message):'')); alert('Camera blocked? Allow it and retry.'); }
}

// Utils
function shuffleOrder(){
  const arr=order.slice();
  for(let i=arr.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [arr[i],arr[j]]=[arr[j],arr[i]]; }
  order=arr; updateOrderPanel();
}
function randomizeAll(){
  // Do NOT randomize orientation/camera flip
  ui.cell.value = (Math.random()*64+8)|0;
  ui.str.value  = (Math.random()*70+10)|0;
  ui.rgb.value  = (Math.random()*70)|0;
  ui.speed.value= (Math.random()*80+10)|0;
  // random toggles (but keep webcam/orientation unaffected)
  ui.fx_vhs.checked = Math.random()>0.4;
  ui.fx_cpunk.checked = Math.random()>0.6;
  ui.fx_invert.checked = Math.random()>0.7;
  ui.fx_trail.checked = Math.random()>0.3;
  ui.fx_ascii.checked = Math.random()>0.5;
  ui.fx_binary.checked = Math.random()>0.6;
  ui.fx_text.checked = Math.random()>0.5;
  ui.fx_mono.checked = Math.random()>0.7;
  shuffleOrder();
}
function savePNG(){
  try{
    canvas.toBlob((blob)=>{
      if(!blob){ alert('Could not export image.'); return; }
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download='distorted.png'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
    }, 'image/png');
  }catch(e){ console.error(e); alert('Download failed'); }
}

// Hook buttons again (safety)
document.getElementById('btnSave').onclick=savePNG;
document.getElementById('btnUpload').onclick=()=>file.click();
document.getElementById('btnShuffle').onclick=shuffleOrder;
document.getElementById('btnShuffle2').onclick=shuffleOrder;
document.getElementById('btnRandom').onclick=randomizeAll;
document.getElementById('btnCam').onclick=startCam;
document.getElementById('file').onchange = e=>{ if(e.target.files[0]) loadFile(e.target.files[0]); };

})();