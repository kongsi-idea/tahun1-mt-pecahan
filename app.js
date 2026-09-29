/* 燕菜切切乐 — 一年级数学·分数（DSKP 3.1：1/2、1/4、2/4、3/4）
 *
 * 几何约定：
 *   - 所有燕菜块共用一个「原位坐标」（单位长度 = 圆形燕菜半径），切割永远在这个坐标里做，
 *     所以不管切了几刀、块与块之间视觉上分开多少，面积都是精确的。
 *   - piece.off / piece.s 只是视觉位移与缩放（飞到朋友盘子、打包盒）。
 *   - 画面是俯视 + 一点厚度（2.5D），顶面不做透视变形，「一样大」看起来就真的一样大。
 */
'use strict';

/* ───────────────────────── 小工具 ───────────────────────── */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const cnNum = n => (n <= 10 ? CN[n] : String(n));
const fracRead = (num, den) => `${cnNum(den)}分之${cnNum(num)}`;
const fracHTML = (num, den, cls = '') => `<span class="frac ${cls}"><b>${num}</b><i></i><b>${den}</b></span>`;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────────────────────── Twemoji ───────────────────────── */
const EMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/';
const emojiCache = new Map();
function emojiImg(code) {
  if (!emojiCache.has(code)) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = EMOJI_BASE + code + '.svg';
    emojiCache.set(code, img);
  }
  return emojiCache.get(code);
}
const emojiChar = code => String.fromCodePoint(...code.split('-').map(h => parseInt(h, 16)));
function emojiEl(code, size) {
  const img = document.createElement('img');
  img.alt = ''; img.width = size; img.height = size; img.draggable = false;
  img.src = EMOJI_BASE + code + '.svg';
  img.onerror = () => { const s = document.createElement('span'); s.textContent = emojiChar(code); s.style.fontSize = size * 0.85 + 'px'; img.replaceWith(s); };
  return img;
}

const ANIMALS = {
  panda: { code: '1f43c', name: '熊猫' },
  rabbit: { code: '1f430', name: '小白兔' },
  tiger: { code: '1f42f', name: '小老虎' },
  elephant: { code: '1f418', name: '大象' },
  frog: { code: '1f438', name: '青蛙' },
  fox: { code: '1f98a', name: '狐狸' },
  monkey: { code: '1f435', name: '猴子' },
  pig: { code: '1f437', name: '小猪' },
  cat: { code: '1f431', name: '小猫' },
  dog: { code: '1f436', name: '小狗' },
  bear: { code: '1f43b', name: '小熊' },
  lion: { code: '1f981', name: '狮子' },
  chick: { code: '1f425', name: '小鸡' },
  hamster: { code: '1f439', name: '仓鼠' },
};

/* ───────────────────────── 声音 ───────────────────────── */
const Sound = {
  on: true, ctx: null,
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  tone(freq, dur, { type = 'sine', vol = 0.18, slide = 0, delay = 0, vib = 0 } = {}) {
    if (!this.on) return; const c = this.ensure(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    if (vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 14; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, { vol = 0.2, from = 1800, to = 5200, delay = 0 } = {}) {
    if (!this.on) return; const c = this.ensure(); if (!c) return;
    const t = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(c.destination); src.start(t);
  },
  slice() { this.noise(0.16, { vol: 0.28, from: 2400, to: 7000 }); this.tone(1400, 0.08, { type: 'triangle', vol: 0.05, delay: 0.02 }); },
  boing() { this.tone(260, 0.38, { type: 'sine', vol: 0.2, slide: 0.55, vib: 18 }); },
  squish() { this.tone(180, 0.16, { type: 'sine', vol: 0.16, slide: 1.8 }); },
  pick() { this.tone(660, 0.09, { type: 'triangle', vol: 0.14, slide: 1.3 }); },
  unpick() { this.tone(520, 0.09, { type: 'triangle', vol: 0.1, slide: 0.75 }); },
  whoosh() { this.noise(0.28, { vol: 0.12, from: 500, to: 1600 }); },
  good() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.14, delay: i * 0.085 })); },
  coin() { this.tone(988, 0.08, { type: 'square', vol: 0.06 }); this.tone(1319, 0.28, { type: 'square', vol: 0.06, delay: 0.08 }); },
  bad() { this.tone(330, 0.2, { type: 'sine', vol: 0.14 }); this.tone(262, 0.32, { type: 'sine', vol: 0.14, delay: 0.16 }); },
};

/* ───────────────────────── 朗读 ───────────────────────── */
// macOS 14 起中文声音列表最前面是 Eddy／Grandpa／Rocko 这类搞怪声音，浏览器默认会选到它们，
// 所以一定要自己挑，而且每次朗读前都重挑（声音列表是异步载入的）。
const NOVELTY_VOICES = /Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox/i;
const VOICE_RANK = [/Xiaoxiao.*Natural|Xiaoxiao Online/i, /Google 普通话|Google.*(Mandarin|中国)/i, /Xiaoxiao|Xiaoyi|Yunxi/i, /Huihui/i, /Tingting|婷婷/i, /Lili|李莉/i, /Yaoyao|Kangkang/i];
// 预录人声（edge-tts 神经网络语音，由 gen-voice.py 生成到 audio/）。
// 旁白＝晓晓（温暖清楚）；动物客人男生＝云夏、女生＝晓伊（卡通可爱）。
const VOICE_NARRATOR = 'zh-CN-XiaoxiaoNeural';
const VOICE_BOY = 'zh-CN-YunxiaNeural', VOICE_GIRL = 'zh-CN-XiaoyiNeural';
const GIRL_ANIMALS = new Set(['rabbit', 'cat', 'fox', 'pig', 'chick', 'hamster']);
const voiceOf = who => (!who ? VOICE_NARRATOR : GIRL_ANIMALS.has(who) ? VOICE_GIRL : VOICE_BOY);
function clipKey(voice, text) {
  // FNV-1a 32 位（UTF-8），gen-voice.py 用同一个算法算档名
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(voice + '|' + text)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const Voice = {
  on: true, voice: null, audio: null,
  pick() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices().filter(v => /^zh[-_](CN|Hans|SG|MY)/i.test(v.lang) && !NOVELTY_VOICES.test(v.name));
    this.voice = null;
    for (const re of VOICE_RANK) { const v = vs.find(x => re.test(x.name)); if (v) { this.voice = v; break; } }
    if (!this.voice) this.voice = vs[0] || null;
  },
  say(text, who = null) {
    this.stop();
    if (!this.on || !text) return;
    text = text.replace(/<[^>]+>/g, '');
    const key = clipKey(voiceOf(who), text);
    if (window.VOICE_CLIPS && window.VOICE_CLIPS[key]) {
      const au = new Audio(`audio/${key}.mp3`);
      this.audio = au;
      au.play().catch(() => { if (this.audio === au) this.tts(text); });
      return;
    }
    this.tts(text);
  },
  tts(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    if (!this.voice) this.pick();
    const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ''));
    u.lang = 'zh-CN'; u.rate = 0.92; u.pitch = 1;
    if (this.voice) u.voice = this.voice;
    speechSynthesis.speak(u);
  },
  stop() {
    if (this.audio) { this.audio.pause(); this.audio = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  },
};
if ('speechSynthesis' in window) { Voice.pick(); speechSynthesis.onvoiceschanged = () => Voice.pick(); }

/* ───────────────────────── 几何 ───────────────────────── */
// 多边形：[{x, y, c}]，c = 从这个顶点出发的边是否为「切面」
function polyArea(P) {
  let a = 0;
  for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
}
function polyCentroid(P) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], f = p.x * q.y - q.x * p.y;
    a += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-9) return { x: P[0].x, y: P[0].y };
  return { x: cx / (3 * a), y: cy / (3 * a) };
}
function clipHalf(P, px, py, nx, ny) {
  const out = [], n = P.length;
  for (let i = 0; i < n; i++) {
    const A = P[i], B = P[(i + 1) % n];
    const da = (A.x - px) * nx + (A.y - py) * ny, db = (B.x - px) * nx + (B.y - py) * ny;
    const ain = da >= -1e-9, bin = db >= -1e-9;
    if (ain) out.push({ x: A.x, y: A.y, c: A.c });
    if (ain !== bin) {
      const t = da / (da - db);
      const I = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
      I.c = ain ? true : A.c;
      out.push(I);
    }
  }
  // 去掉几乎重复的点
  const clean = [];
  for (const p of out) { const l = clean[clean.length - 1]; if (!l || Math.hypot(l.x - p.x, l.y - p.y) > 1e-7) clean.push(p); }
  if (clean.length > 1) { const f = clean[0], l = clean[clean.length - 1]; if (Math.hypot(l.x - f.x, l.y - f.y) < 1e-7) clean.pop(); }
  return clean.length >= 3 ? clean : null;
}
function pointInPoly(x, y, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function segsIntersect(a, b, c, d) {
  const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
  return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
}
function segHitsPoly(a, b, P) {
  if (pointInPoly(a.x, a.y, P) || pointInPoly(b.x, b.y, P)) return true;
  for (let i = 0; i < P.length; i++) if (segsIntersect(a, b, P[i], P[(i + 1) % P.length])) return true;
  return false;
}
function lineCrossesPoly(px, py, nx, ny, P) {
  let pos = false, neg = false;
  for (const v of P) { const d = (v.x - px) * nx + (v.y - py) * ny; if (d > 1e-4) pos = true; else if (d < -1e-4) neg = true; }
  return pos && neg;
}

const SHAPES = {
  circle() { const P = []; const N = 120; for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; P.push({ x: Math.cos(a), y: Math.sin(a), c: false }); } return P; },
  square() { const h = 0.9; return [{ x: -h, y: -h, c: false }, { x: h, y: -h, c: false }, { x: h, y: h, c: false }, { x: -h, y: h, c: false }]; },
  rect() { const w = 1.14, h = 0.68; return [{ x: -w, y: -h, c: false }, { x: w, y: -h, c: false }, { x: w, y: h, c: false }, { x: -w, y: h, c: false }]; },
};
const SHAPE_NAME = { circle: '圆形', square: '正方形', rect: '长方形' };

/* ───────────────────────── 口味 ───────────────────────── */
const FLAVORS = {
  watermelon: { name: '西瓜燕菜', top: '#EE4A5B', hi: '#FF8E96', deep: '#B92439', rim: '#D5334A',
    side: ['#C92E44', '#EE4A5B', '#EE4A5B'], outer: ['#2E6F35', '#3E8E3F', '#DDEFC0'], decor: 'watermelon', glow: 'rgba(238,74,91,.38)', juice: '#F2586A' },
  pandan: { name: '斑斓椰浆燕菜', top: '#5DB864', hi: '#A8E4A2', deep: '#2F7D3C', rim: '#48A652',
    side: ['#4FAA58', '#FFFBEE', '#4FAA58', '#FFFBEE', '#5DB864'], decor: 'bubbles', glow: 'rgba(93,184,100,.36)', juice: '#7CCB7F' },
  rose: { name: '玫瑰燕菜', top: '#F27BA6', hi: '#FFC4D8', deep: '#C1466F', rim: '#E4658F',
    side: ['#E4658F', '#FFF4F7', '#E4658F', '#FFF4F7', '#F27BA6'], decor: 'petals', glow: 'rgba(242,123,166,.36)', juice: '#F58DB2' },
  mango: { name: '芒果燕菜', top: '#FFB43C', hi: '#FFE28E', deep: '#D07A12', rim: '#F4A026',
    side: ['#F4A026', '#FFF3D2', '#FFB43C'], decor: 'cubes', glow: 'rgba(255,180,60,.4)', juice: '#FFC45C' },
  kopi: { name: '咖啡燕菜', top: '#A36A47', hi: '#D8AE88', deep: '#6E4027', rim: '#8E5936',
    side: ['#8E5936', '#F6E7CF', '#8E5936', '#F6E7CF', '#A36A47'], decor: 'swirl', glow: 'rgba(163,106,71,.32)', juice: '#B98060' },
};

/* 装饰（原位坐标，随块一起移动；每盘燕菜固定种子，切开后花纹对得上） */
function makeDecor(kind, seed) {
  const r = mulberry32(seed), D = [];
  if (kind === 'watermelon') {
    const rings = [0.34, 0.58];
    rings.forEach((rad, ri) => {
      const n = ri === 0 ? 7 : 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ri * 0.26 + (r() - 0.5) * 0.18;
        D.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad, a, s: 0.055 + r() * 0.012 });
      }
    });
  } else if (kind === 'bubbles') {
    for (let i = 0; i < 26; i++) D.push({ x: (r() * 2 - 1) * 1.15, y: (r() * 2 - 1) * 1.15, s: 0.02 + r() * 0.045 });
  } else if (kind === 'petals') {
    for (let i = 0; i < 16; i++) D.push({ x: (r() * 2 - 1) * 1.15, y: (r() * 2 - 1) * 0.8, a: r() * Math.PI, s: 0.07 + r() * 0.06 });
  } else if (kind === 'cubes') {
    for (let i = 0; i < 14; i++) D.push({ x: (r() * 2 - 1) * 0.85, y: (r() * 2 - 1) * 0.85, a: r() * Math.PI, s: 0.09 + r() * 0.05 });
  } else if (kind === 'swirl') {
    for (let i = 0; i < 5; i++) D.push({ y: -0.8 + i * 0.4 + (r() - 0.5) * 0.1, ph: r() * 6, amp: 0.08 + r() * 0.06 });
  }
  return D;
}

/* ───────────────────────── 场景 ───────────────────────── */
class Scene {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.hero = !!opts.hero;
    this.pieces = []; this.ghosts = []; this.particles = []; this.seats = []; this.box = null;
    this.cutEnabled = false; this.pickEnabled = false; this.snap = true;
    this.stroke = null; this.knife = null; this.hover = null; this.busy = false;
    this.onCut = null; this.onPick = null;
    this.highlights = new Map(); this.labels = [];
    this.time = 0; this.nextId = 1;
    this.shape = 'circle'; this.flavor = FLAVORS.watermelon; this.decor = [];
    this.bg = document.createElement('canvas');
    this.layoutKind = 'center';
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.bindInput();
    const loop = t => { this.frame(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  /* —— 布局 —— */
  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(10, r.width); this.H = Math.max(10, r.height); this.dpr = dpr;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.computeLayout(); this.renderBg();
    // 缩放后重新把已送出的块放到新的座位位置
    if (this.sent) for (const s of this.sent) this.placeGroup(s.group, s.dest, s.fitR);
  }
  computeLayout() {
    const W = this.W, H = this.H;
    if (this.hero) {
      this.TR = 0; this.tc = { x: W / 2, y: H / 2 };
      this.PR = Math.min(W, H) * 0.44; this.plate = { x: W / 2, y: H / 2 };
      this.k = this.PR / 1.36; return;
    }
    // 直放（手机竖屏）：朋友坐上下、打包盒放下方，桌子才能撑满宽度
    this.portrait = H > W * 1.1;
    // 横放手机（矮画面）：桌子上下可以超出画面一点（像镜头拉近），四位朋友坐扁一点
    this.shortLand = !this.portrait && H < 460 && W > H * 1.3;
    const compact = this.portrait || this.shortLand;
    const tr = this.portrait ? Math.min(W / 2 / 1.02, H / 2 / 1.3)
      : this.shortLand ? Math.min(W / 2 / 1.3, H / 2 / 0.9)
      : Math.min(W / 2 / 1.28, H / 2 / 1.08);
    this.TR = tr; this.tc = { x: W / 2, y: H / 2 + tr * 0.02 };
    this.PR = tr * (this.layoutKind === 'share' && !this.portrait ? 0.5 : 0.56);
    this.jellyFit = compact ? 1.28 : 1.34; // 燕菜半径与盘子半径的比例（小屏幕让燕菜占多一点）
    const shop = this.layoutKind === 'shop';
    this.plate = {
      x: shop && !this.portrait ? this.tc.x - tr * 0.14 : this.tc.x,
      y: shop && this.portrait ? this.tc.y - tr * 0.14 : this.tc.y,
    };
    this.k = this.PR / this.jellyFit;
    this.placeSeats();
  }
  placeSeats() {
    const tr = this.TR;
    const n = this.seats.length;
    let angs = [];
    if (this.layoutKind === 'shop') angs = [this.portrait ? 58 : -30];
    else if (n === 2) angs = this.portrait ? [-90, 90] : [180, 0];
    else if (n === 4) angs = this.shortLand ? [-150, -30, 30, 150] : [-135, -45, 45, 135];
    else if (n === 3) angs = [180, -45, 45];
    this.seats.forEach((s, i) => {
      const a = (angs[i] ?? 0) * Math.PI / 180;
      s.ang = a;
      const avD = this.layoutKind === 'shop' ? 1.04 : 1.1;
      s.av = { x: this.tc.x + Math.cos(a) * tr * avD, y: this.tc.y + Math.sin(a) * tr * avD };
      s.avR = tr * 0.125;
      if (this.layoutKind === 'shop') {
        s.plate = null;
      } else {
        const pd = this.portrait ? 0.79 : 0.73;
        s.plate = { x: this.tc.x + Math.cos(a) * tr * pd, y: this.tc.y + Math.sin(a) * tr * pd };
        s.plateR = tr * (this.portrait ? 0.18 : 0.2);
      }
    });
    if (this.box) {
      if (this.portrait) { this.box.x = this.tc.x - tr * 0.06; this.box.y = this.tc.y + tr * 0.66; }
      else { this.box.x = this.tc.x + tr * 0.68; this.box.y = this.tc.y + tr * 0.06; }
      this.box.hw = tr * 0.2; this.box.hh = tr * 0.19;
    }
  }
  toUnits(px, py) { return { x: (px - this.plate.x) / this.k, y: (py - this.plate.y) / this.k }; }

  /* —— 静态背景（桌子与盘子）预先画好 —— */
  renderBg() {
    const bg = this.bg, d = this.dpr;
    bg.width = this.cv.width; bg.height = this.cv.height;
    const g = bg.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
    if (!this.hero) this.drawTable(g);
    this.drawPlate(g, this.plate.x, this.plate.y, this.PR, true);
    if (!this.hero) {
      for (const s of this.seats) if (s.plate) this.drawPlate(g, s.plate.x, s.plate.y, s.plateR, false);
      if (this.box) this.drawBox(g, this.box);
    }
  }
  drawTable(g) {
    const { x, y } = this.tc, R = this.TR;
    // 地上阴影
    g.save();
    g.fillStyle = 'rgba(67,20,23,.28)'; g.filter = 'blur(18px)';
    g.beginPath(); g.ellipse(x + R * 0.05, y + R * 0.08, R * 1.02, R * 1.0, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    // 木边
    const wood = g.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.2, x, y, R * 1.05);
    wood.addColorStop(0, '#9A4A3A'); wood.addColorStop(0.7, '#6B2E26'); wood.addColorStop(1, '#431A16');
    g.fillStyle = wood; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,220,180,.25)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, R - 2, Math.PI * 0.95, Math.PI * 1.65); g.stroke();
    // 大理石面
    const mr = R * 0.93;
    const m = g.createRadialGradient(x - mr * 0.35, y - mr * 0.4, mr * 0.05, x, y, mr);
    m.addColorStop(0, '#FFFFFF'); m.addColorStop(0.6, '#F5F2EC'); m.addColorStop(1, '#E4DED3');
    g.fillStyle = m; g.beginPath(); g.arc(x, y, mr, 0, Math.PI * 2); g.fill();
    // 大理石纹
    g.save(); g.beginPath(); g.arc(x, y, mr, 0, Math.PI * 2); g.clip();
    const r = mulberry32(77);
    for (let i = 0; i < 9; i++) {
      const sx = x - mr + r() * mr * 0.6, sy = y - mr + r() * mr * 2;
      g.strokeStyle = `rgba(150,140,128,${0.10 + r() * 0.14})`; g.lineWidth = 0.8 + r() * 1.8;
      g.beginPath(); g.moveTo(sx, sy);
      let cx = sx, cy = sy;
      for (let j = 0; j < 5; j++) {
        const nx = cx + mr * (0.2 + r() * 0.3), ny = cy + (r() - 0.45) * mr * 0.5;
        g.bezierCurveTo(cx + (nx - cx) * 0.3, cy + (r() - 0.5) * mr * 0.3, cx + (nx - cx) * 0.7, ny + (r() - 0.5) * mr * 0.3, nx, ny);
        cx = nx; cy = ny;
      }
      g.stroke();
    }
    g.restore();
    // 内缘环境光遮蔽
    const ao = g.createRadialGradient(x, y, mr * 0.86, x, y, mr);
    ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(67,30,20,.16)');
    g.fillStyle = ao; g.beginPath(); g.arc(x, y, mr, 0, Math.PI * 2); g.fill();
  }
  drawPlate(g, x, y, R, main) {
    g.save();
    g.fillStyle = 'rgba(67,30,20,.22)'; g.filter = 'blur(' + Math.round(R * 0.08) + 'px)';
    g.beginPath(); g.arc(x + R * 0.05, y + R * 0.08, R, 0, Math.PI * 2); g.fill();
    g.restore();
    const body = g.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
    body.addColorStop(0, '#FFFFFF'); body.addColorStop(0.75, '#FBF8F2'); body.addColorStop(1, '#E9E2D6');
    g.fillStyle = body; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
    // 娘惹花边：粉底 + 绿叶点 + 金线
    const band0 = R * 0.84, band1 = R * 0.96;
    g.lineWidth = band1 - band0; g.strokeStyle = main ? '#F0C4CF' : '#CFE3D0';
    g.beginPath(); g.arc(x, y, (band0 + band1) / 2, 0, Math.PI * 2); g.stroke();
    const n = main ? 28 : 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, rr = (band0 + band1) / 2;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr, s = (band1 - band0) * 0.34;
      g.fillStyle = i % 2 ? (main ? '#8FBC94' : '#E6A0B2') : '#E8B94E';
      g.beginPath();
      if (i % 2) { g.ellipse(px, py, s, s * 0.55, a + Math.PI / 2, 0, Math.PI * 2); }
      else { g.arc(px, py, s * 0.55, 0, Math.PI * 2); }
      g.fill();
    }
    g.strokeStyle = '#D4A017'; g.lineWidth = Math.max(1, R * 0.012);
    g.beginPath(); g.arc(x, y, band0 - R * 0.015, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(x, y, band1 + R * 0.012, 0, Math.PI * 2); g.stroke();
    // 盘心凹陷
    const well = g.createRadialGradient(x + R * 0.2, y + R * 0.25, R * 0.1, x, y, band0 * 0.95);
    well.addColorStop(0, 'rgba(255,255,255,0)'); well.addColorStop(0.85, 'rgba(0,0,0,0)'); well.addColorStop(1, 'rgba(120,90,60,.10)');
    g.fillStyle = well; g.beginPath(); g.arc(x, y, band0 * 0.97, 0, Math.PI * 2); g.fill();
    // 釉面高光
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(1.5, R * 0.02); g.lineCap = 'round';
    g.beginPath(); g.arc(x, y, R * 0.985, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
  }
  drawBox(g, b) {
    const { x, y, hw, hh } = b, rr = hw * 0.16;
    g.save();
    g.fillStyle = 'rgba(67,30,20,.25)'; g.filter = 'blur(10px)';
    this.rrect(g, x - hw + 6, y - hh + 10, hw * 2, hh * 2, rr); g.fill();
    g.restore();
    const k = g.createLinearGradient(x - hw, y - hh, x + hw, y + hh);
    k.addColorStop(0, '#E4C08E'); k.addColorStop(1, '#C49661');
    g.fillStyle = k; this.rrect(g, x - hw, y - hh, hw * 2, hh * 2, rr); g.fill();
    const inner = g.createLinearGradient(x, y - hh, x, y + hh);
    inner.addColorStop(0, '#B8895A'); inner.addColorStop(0.2, '#F3DDB8'); inner.addColorStop(1, '#EBD0A6');
    g.fillStyle = inner; this.rrect(g, x - hw * 0.86, y - hh * 0.84, hw * 1.72, hh * 1.72, rr * 0.7); g.fill();
    g.fillStyle = '#8A5A2E'; g.font = `400 ${Math.round(hh * 0.28)}px ${getComputedStyle(document.body).getPropertyValue('--f-head')}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('打包盒', x, y + hh + hh * 0.26);
  }
  rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  /* —— 燕菜 —— */
  setup({ shape, flavor, seats = [], box = false, layout = 'center' }) {
    this.shape = shape; this.flavor = FLAVORS[flavor]; this.flavorKey = flavor;
    this.decor = makeDecor(this.flavor.decor, (Math.random() * 1e9) | 0);
    this.layoutKind = layout;
    this.seats = seats.map(s => ({ ...s, img: emojiImg(s.code), bubble: null }));
    this.box = box ? { x: 0, y: 0, hw: 0, hh: 0 } : null;
    this.highlights.clear(); this.labels = []; this.particles = []; this.ghosts = []; this.sent = [];
    this.computeLayout(); this.renderBg();
    this.pieces = [];
    this.addPiece(SHAPES[shape](), { drop: true });
  }
  addPiece(poly, { drop = false } = {}) {
    const p = {
      id: this.nextId++, poly, area: polyArea(poly), c: polyCentroid(poly),
      off: { x: 0, y: drop ? -0.5 : 0 }, v: { x: 0, y: 0 }, home: { x: 0, y: 0 },
      s: drop ? 0.9 : 1, sv: 0, sT: 1, sc: null,
      wob: drop ? 1 : 0, wobT: 0, wobPh: Math.random() * 6, lift: 0, liftT: 0,
      selected: false, where: 'plate', dest: null,
    };
    p.sc = p.c;
    this.pieces.push(p);
    return p;
  }
  totalArea() { return this.pieces.reduce((a, p) => a + p.area, 0); }
  resetJelly(anim = true) {
    this.pieces.forEach(p => { p.dest = null; p.where = 'plate'; p.selected = false; p.liftT = 0; p.sT = 1; p.sc = p.c; });
    this.highlights.clear(); this.labels = []; this.ghosts = []; this.sent = [];
    this.seats.forEach(s => (s.bubble = null));
    const done = () => {
      this.pieces = [];
      const p = this.addPiece(SHAPES[this.shape]());
      p.wob = 0.9; p.wobT = 0; Sound.boing();
    };
    if (!anim || this.pieces.length <= 1) { done(); return; }
    this.busy = true;
    this.pieces.forEach(p => (p.home = { x: 0, y: 0 }));
    setTimeout(() => { done(); this.busy = false; }, 380);
  }
  // 以原位坐标里的直线切：只切「刀经过」的块（hitIds），或所有被这条线穿过的块
  cutLine(px, py, nx, ny, hitIds = null) {
    const made = [];
    const next = [];
    for (const p of this.pieces) {
      if (p.where !== 'plate' || (hitIds && !hitIds.has(p.id)) || !lineCrossesPoly(px, py, nx, ny, p.poly)) { next.push(p); continue; }
      const a = clipHalf(p.poly, px, py, nx, ny), b = clipHalf(p.poly, px, py, -nx, -ny);
      if (!a || !b) { next.push(p); continue; }
      const total = this.totalArea();
      if (polyArea(a) < total * 0.012 || polyArea(b) < total * 0.012) { next.push(p); continue; }
      for (const poly of [a, b]) {
        const q = this.addPiece(poly);
        this.pieces.pop();
        q.off = { ...p.off }; q.v = { x: 0, y: 0 }; q.s = p.s;
        q.wob = 1; q.wobT = 0;
        next.push(q); made.push(q);
      }
    }
    this.pieces = next;
    this.relayoutHome();
    return made;
  }
  relayoutHome() {
    // 块与块之间只拉开一点点视觉缝隙，方向从整盘中心往外
    const n = this.pieces.filter(p => p.where === 'plate').length;
    const gap = n <= 1 ? 0 : 0.045 + Math.min(0.03, n * 0.004);
    for (const p of this.pieces) {
      if (p.where !== 'plate') continue;
      const L = Math.hypot(p.c.x, p.c.y);
      p.home = L < 1e-3 ? { x: 0, y: 0 } : { x: (p.c.x / L) * gap, y: (p.c.y / L) * gap };
    }
  }
  plateAreas() { return this.pieces.filter(p => p.where === 'plate').map(p => p.area); }

  /* —— 移动到座位、盒子 —— */
  sendGroup(group, dest, fitR) {
    this.sent = this.sent || [];
    this.sent.push({ group, dest, fitR });
    // group: 一起走的块；dest: 目的地（px）；fitR: 目的地可放半径（px）
    this.placeGroup(group, dest, fitR);
    group.forEach(p => { p.liftT = 0; p.selected = false; p.wob = 0.8; p.wobT = -Math.random() * 0.1; });
  }
  placeGroup(group, dest, fitR) {
    // dest / fitR 可以是函数（跟着版面走）
    const D = typeof dest === 'function' ? dest() : dest, FR = typeof fitR === 'function' ? fitR() : fitR;
    let A = 0, gx = 0, gy = 0;
    group.forEach(p => { A += p.area; gx += p.c.x * p.area; gy += p.c.y * p.area; });
    const gc = { x: gx / A, y: gy / A };
    let ext = 0;
    group.forEach(p => p.poly.forEach(v => (ext = Math.max(ext, Math.hypot(v.x - gc.x, v.y - gc.y)))));
    const s = Math.min(1, (FR / this.k) * 0.86 / Math.max(ext, 0.05));
    const d = this.toUnits(D.x, D.y);
    group.forEach(p => { p.sc = gc; p.sT = s; p.home = { x: d.x - gc.x, y: d.y - gc.y }; });
  }
  ghostOf(p) { this.ghosts.push({ poly: p.poly }); }

  /* —— 高亮与标签 —— */
  highlight(p, color) { this.highlights.set(p.id, color); }
  clearHighlights() { this.highlights.clear(); }

  /* —— 粒子 —— */
  juice(ax, ay, bx, by, color) {
    for (let i = 0; i < 26; i++) {
      const t = Math.random(), x = lerp(ax, bx, t), y = lerp(ay, by, t);
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, r: 2 + Math.random() * 4, life: 0.5 + Math.random() * 0.4, t: 0, color, kind: 'drop' });
    }
  }
  confetti(x, y, n = 46) {
    const cols = ['#EE4A5B', '#5DB864', '#F27BA6', '#FFB43C', '#F3CE7C', '#7CC7AE'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 220 + Math.random() * 380;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4 + Math.random() * 6, life: 1.2 + Math.random() * 0.6, t: 0,
        color: cols[i % cols.length], kind: Math.random() < 0.35 ? 'star' : 'cube', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 });
    }
  }

  /* —— 输入 —— */
  bindInput() {
    const cv = this.cv;
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', e => {
      Sound.ensure();
      const p = pos(e);
      cv.setPointerCapture(e.pointerId);
      if (this.busy) return;
      if (this.cutEnabled) { this.stroke = { a: p, b: p, id: e.pointerId }; return; }
      const hit = this.pieceAt(p.x, p.y);
      if (hit) {
        if (this.pickEnabled && hit.where === 'plate') { this.onPick && this.onPick(hit); }
        else { hit.wob = 0.9; hit.wobT = 0; Sound.squish(); }
      }
    });
    cv.addEventListener('pointermove', e => {
      const p = pos(e); this.hover = p;
      if (this.stroke && this.stroke.id === e.pointerId) this.stroke.b = p;
      cv.style.cursor = this.cutEnabled ? 'none' : (this.pieceAt(p.x, p.y) ? 'pointer' : 'default');
    });
    const end = e => {
      if (!this.stroke || this.stroke.id !== e.pointerId) return;
      const s = this.stroke; this.stroke = null;
      const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
      if (len < 18) {
        const hit = this.pieceAt(s.a.x, s.a.y);
        if (hit) { hit.wob = 0.9; hit.wobT = 0; Sound.squish(); }
        return;
      }
      this.performStroke(s.a, s.b);
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', e => { if (this.stroke && this.stroke.id === e.pointerId) this.stroke = null; });
    cv.addEventListener('pointerleave', () => { this.hover = null; });
  }
  worldPoly(p) {
    const s = p.s, sc = p.sc, o = p.off;
    return p.poly.map(v => ({ x: sc.x + (v.x - sc.x) * s + o.x, y: sc.y + (v.y - sc.y) * s + o.y }));
  }
  pieceAt(px, py) {
    const u = this.toUnits(px, py);
    const hh = this.thick();
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      const lift = hh * p.s + p.lift / this.k;
      if (pointInPoly(u.x, u.y + lift, this.worldPoly(p))) return p;
    }
    return null;
  }
  thick() { return 0.15; }

  // 把一笔刀痕换成原位坐标里的一条线（必要时对齐「帮手刀」）
  resolveStroke(a, b) {
    const A = this.toUnits(a.x, a.y), B = this.toUnits(b.x, b.y);
    const lift = this.thick();
    // 学生看到的是抬高的顶面，所以把笔划往下挪到底面坐标来算
    A.y += lift; B.y += lift;
    const hits = this.pieces.filter(p => p.where === 'plate' && segHitsPoly(A, B, this.worldPoly(p)));
    if (!hits.length) return null;
    let ox = 0, oy = 0; hits.forEach(p => { ox += p.off.x; oy += p.off.y; }); ox /= hits.length; oy /= hits.length;
    const a0 = { x: A.x - ox, y: A.y - oy }, b0 = { x: B.x - ox, y: B.y - oy };
    let dx = b0.x - a0.x, dy = b0.y - a0.y; const L = Math.hypot(dx, dy); dx /= L; dy /= L;
    const mid = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
    let line = { px: mid.x, py: mid.y, nx: -dy, ny: dx, snapped: false };
    if (this.snap) {
      const ang = Math.atan2(dy, dx);
      const anchors = [{ x: 0, y: 0 }, ...this.pieces.filter(p => p.where === 'plate').map(p => p.c)];
      let best = null;
      for (const deg of [0, 45, 90, 135]) {
        const t = (deg * Math.PI) / 180;
        const diff = (((ang - t) % Math.PI) + Math.PI) % Math.PI;
        const da = Math.min(diff, Math.PI - diff); // 与该方向的夹角（0..π/2）
        if (da > (16 * Math.PI) / 180) continue;
        const nx = -Math.sin(t), ny = Math.cos(t);
        for (const c of anchors) {
          const dist = Math.abs((mid.x - c.x) * nx + (mid.y - c.y) * ny);
          if (dist > 0.2) continue;
          if (!hits.some(p => lineCrossesPoly(c.x, c.y, nx, ny, p.poly))) continue;
          const score = da / ((16 * Math.PI) / 180) + dist / 0.2;
          if (!best || score < best.score) best = { score, px: c.x, py: c.y, nx, ny };
        }
      }
      if (best) line = { px: best.px, py: best.py, nx: best.nx, ny: best.ny, snapped: true };
    }
    return { line, hits, off: { x: ox, y: oy } };
  }
  performStroke(a, b) {
    const r = this.resolveStroke(a, b);
    if (!r) return;
    const { line, hits, off } = r;
    const hitIds = new Set(hits.map(p => p.id));
    // 刀沿着这条线扫过去
    const seg = this.lineSegmentOverPieces(line, hits, off);
    if (!seg) return;
    this.busy = true;
    this.knife = { a: seg.a, b: seg.b, t: 0, dur: REDUCED ? 0.05 : 0.24 };
    Sound.whoosh();
    setTimeout(() => {
      const made = this.cutLine(line.px, line.py, line.nx, line.ny, hitIds);
      this.busy = false;
      if (made.length) {
        Sound.slice(); setTimeout(() => Sound.boing(), 60);
        const pa = this.unitToPx(seg.a), pb = this.unitToPx(seg.b);
        this.juice(pa.x, pa.y, pb.x, pb.y, this.flavor.juice);
        this.onCut && this.onCut(made);
      }
    }, REDUCED ? 60 : 240);
  }
  lineSegmentOverPieces(line, hits, off) {
    // 求直线在这些块上覆盖的范围（原位坐标 + 平均位移），刀的动画用
    const dx = line.ny, dy = -line.nx;
    let tmin = Infinity, tmax = -Infinity;
    for (const p of hits) {
      const P = p.poly;
      for (let i = 0; i < P.length; i++) {
        const A = P[i], B = P[(i + 1) % P.length];
        const da = (A.x - line.px) * line.nx + (A.y - line.py) * line.ny;
        const db = (B.x - line.px) * line.nx + (B.y - line.py) * line.ny;
        if ((da > 0) === (db > 0) && da !== 0) continue;
        const f = da === db ? 0 : da / (da - db);
        const X = A.x + (B.x - A.x) * f, Y = A.y + (B.y - A.y) * f;
        const t = (X - line.px) * dx + (Y - line.py) * dy;
        tmin = Math.min(tmin, t); tmax = Math.max(tmax, t);
      }
    }
    if (!isFinite(tmin)) return null;
    tmin -= 0.15; tmax += 0.15;
    const lift = this.thick();
    return {
      a: { x: line.px + dx * tmin + off.x, y: line.py + dy * tmin + off.y - lift },
      b: { x: line.px + dx * tmax + off.x, y: line.py + dy * tmax + off.y - lift },
    };
  }
  unitToPx(u) { return { x: this.plate.x + u.x * this.k, y: this.plate.y + u.y * this.k }; }

  /* —— 每帧 —— */
  frame(ts) {
    const t = ts / 1000, dt = Math.min(0.033, this.last ? t - this.last : 0.016);
    this.last = t; this.time += dt;
    this.step(dt); this.draw();
  }
  step(dt) {
    const K = 170, C = 13;
    for (const p of this.pieces) {
      const ax = K * (p.home.x - p.off.x) - C * p.v.x, ay = K * (p.home.y - p.off.y) - C * p.v.y;
      p.v.x += ax * dt; p.v.y += ay * dt; p.off.x += p.v.x * dt; p.off.y += p.v.y * dt;
      const as = 150 * (p.sT - p.s) - 14 * p.sv; p.sv += as * dt; p.s += p.sv * dt;
      p.lift = lerp(p.lift, p.liftT, 1 - Math.pow(0.0005, dt));
      if (p.wob > 0) { p.wobT += dt; if (p.wobT > 1.6) p.wob = 0; }
    }
    if (this.knife) { this.knife.t += dt; if (this.knife.t > this.knife.dur + 0.18) this.knife = null; }
    this.particles = this.particles.filter(q => {
      q.t += dt; if (q.t > q.life) return false;
      q.vy += (q.kind === 'drop' ? 520 : 700) * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 0.985; if (q.rot !== undefined) q.rot += q.vr * dt;
      return true;
    });
    for (const s of this.seats) if (s.bubble) { s.bubble.t += dt; }
  }

  draw() {
    const g = this.ctx, d = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    g.drawImage(this.bg, 0, 0);
    g.setTransform(d, 0, 0, d, 0, 0);

    // 座位（头像）
    if (!this.hero) for (const s of this.seats) this.drawSeat(g, s);

    // 空位虚线（被拿走的块留下的位置）
    for (const gh of this.ghosts) this.drawGhost(g, gh);

    // 燕菜：由后往前
    const order = [...this.pieces].sort((a, b) => (a.c.y * a.s + a.off.y + a.lift * -1) - (b.c.y * b.s + b.off.y + b.lift * -1));
    for (const p of order) this.drawShadow(g, p);
    for (const p of order) this.drawPiece(g, p);

    // 标签
    for (const L of this.labels) this.drawLabel(g, L);

    // 笔划预览 / 刀
    if (this.stroke) this.drawStroke(g);
    if (this.knife) this.drawKnifeSweep(g);
    else if (this.cutEnabled && this.hover && !this.busy) this.drawKnife(g, this.hover.x, this.hover.y, this.stroke ? Math.atan2(this.stroke.b.y - this.stroke.a.y, this.stroke.b.x - this.stroke.a.x) : -0.5, 0.8);

    // 气泡
    if (!this.hero) for (const s of this.seats) if (s.bubble) this.drawBubble(g, s);

    // 粒子
    for (const q of this.particles) this.drawParticle(g, q);
  }

  pieceMatrix(p, liftUnits) {
    // 返回：原位坐标 → 画面 px 的仿射矩阵（含抖动的挤压与轻微摇摆）
    let a = 0, sh = 0;
    if (p.wob > 0) {
      const tt = Math.max(0, p.wobT), env = p.wob * Math.exp(-tt * 3.6);
      const amp = REDUCED ? 0.02 : 0.085;
      a = amp * env * Math.sin(tt * 21 + p.wobPh);
      sh = amp * 0.45 * env * Math.sin(tt * 17 + p.wobPh * 1.7);
    }
    const s = p.s, sc = p.sc, o = p.off, k = this.k;
    // 世界坐标 w = s*v + (sc*(1-s) + o)
    const tx = sc.x * (1 - s) + o.x, ty = sc.y * (1 - s) + o.y;
    // 以块的世界重心为中心做挤压
    const cw = { x: s * p.c.x + tx, y: s * p.c.y + ty };
    const m11 = 1 + a, m12 = sh, m21 = sh * 0.3, m22 = 1 - a;
    // q = M*(w - cw) + cw ；w = s*v + t
    const A = k * s * m11, B = k * s * m21, Cc = k * s * m12, D = k * s * m22;
    const ex = k * (m11 * (tx - cw.x) + m12 * (ty - cw.y) + cw.x) + this.plate.x;
    const ey = k * (m21 * (tx - cw.x) + m22 * (ty - cw.y) + cw.y) + this.plate.y - (liftUnits * k);
    return [A, B, Cc, D, ex, ey];
  }
  applyM(g, M) { const d = this.dpr; g.setTransform(M[0] * d, M[1] * d, M[2] * d, M[3] * d, M[4] * d, M[5] * d); }
  pathPoly(g, P) { g.beginPath(); g.moveTo(P[0].x, P[0].y); for (let i = 1; i < P.length; i++) g.lineTo(P[i].x, P[i].y); g.closePath(); }

  drawShadow(g, p) {
    const M = this.pieceMatrix(p, 0);
    const lift = p.lift;
    g.save();
    this.applyM(g, M);
    // 彩色透光 + 接触阴影（阴影参数是画面像素，不受矩阵影响）
    g.shadowColor = this.flavor.glow; g.shadowBlur = 26 * this.dpr; g.shadowOffsetX = 4 * this.dpr; g.shadowOffsetY = (10 + lift * 0.6) * this.dpr;
    g.fillStyle = 'rgba(0,0,0,1)';
    g.globalAlpha = 0.9;
    this.pathPoly(g, p.poly); g.fill();
    g.shadowColor = 'rgba(70,30,20,.35)'; g.shadowBlur = 6 * this.dpr; g.shadowOffsetX = 2 * this.dpr; g.shadowOffsetY = (3 + lift * 0.4) * this.dpr;
    g.fill();
    g.restore();
    // 把黑色填充本体擦掉，只留阴影
    g.save();
    this.applyM(g, M);
    g.globalCompositeOperation = 'destination-out';
    this.pathPoly(g, p.poly); g.fill();
    g.restore();
    // 擦掉后露出了盘子背景的洞，补回背景
    g.save();
    this.applyM(g, M);
    this.pathPoly(g, p.poly); g.clip();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-over';
    g.drawImage(this.bg, 0, 0);
    g.restore();
  }

  drawPiece(g, p) {
    const H = this.thick();
    const F = this.flavor;
    const baseM = this.pieceMatrix(p, H * p.s + p.lift / this.k); // p.lift 以 px 存
    const P = p.poly;
    g.save();
    this.applyM(g, baseM);
    const px1 = 1 / (this.k * p.s); // 一个画面像素在原位坐标的长度

    // 侧面：只画朝向观者（往下）的边，每层一条
    const layers = this.isWatermelon() ? null : F.side;
    for (let i = 0; i < P.length; i++) {
      const A = P[i], B = P[(i + 1) % P.length];
      const ex = B.x - A.x, ey = B.y - A.y;
      // 逆时针或顺时针都可能，用重心判断外法线
      let nx = ey, ny = -ex;
      const mx = (A.x + B.x) / 2 - p.c.x, my = (A.y + B.y) / 2 - p.c.y;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      if (ny <= 0.0001) continue;
      const shade = clamp(0.55 + 0.45 * (nx * 0.55 + ny * 0.2), 0.55, 1); // 光从左上来
      const bands = layers ? layers : (A.c ? ['#C92E44', '#EE4A5B', '#F46B78'] : F.outer);
      const n = bands.length;
      for (let j = 0; j < n; j++) {
        const h0 = (H * j) / n, h1 = (H * (j + 1)) / n;
        g.beginPath();
        g.moveTo(A.x, A.y + H - h0); g.lineTo(B.x, B.y + H - h0);
        g.lineTo(B.x, B.y + H - h1); g.lineTo(A.x, A.y + H - h1); g.closePath();
        g.fillStyle = bands[j];
        g.fill();
        g.strokeStyle = bands[j]; g.lineWidth = px1 * 0.8; g.stroke();
      }
      // 明暗
      g.beginPath();
      g.moveTo(A.x, A.y + H); g.lineTo(B.x, B.y + H); g.lineTo(B.x, B.y); g.lineTo(A.x, A.y); g.closePath();
      g.fillStyle = `rgba(40,10,10,${(1 - shade) * 0.55})`; g.fill();
    }
    // 侧面底部一条暗线 + 顶部亮边
    g.lineJoin = 'round';

    // 顶面
    this.pathPoly(g, P);
    g.save();
    g.clip();
    this.drawTopFace(g, p, px1);
    g.restore();

    // 圆角外缘（同色描边让尖角看起来软）
    g.lineWidth = px1 * 3.2; g.lineCap = 'round'; g.globalAlpha = 0.9;
    for (let i = 0; i < P.length; i++) {
      const A = P[i], B = P[(i + 1) % P.length];
      g.strokeStyle = this.isWatermelon() && !A.c ? '#2E6F35' : F.rim;
      g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
    }
    g.globalAlpha = 1;

    // 选中：金色光晕
    if (p.selected || this.highlights.has(p.id)) {
      const col = p.selected ? '#FFD54A' : this.highlights.get(p.id);
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 6);
      g.save();
      this.pathPoly(g, P);
      g.shadowColor = col; g.shadowBlur = 26 * this.dpr * pulse;
      g.lineWidth = px1 * 7; g.strokeStyle = col; g.stroke();
      g.lineWidth = px1 * 2; g.strokeStyle = 'rgba(255,255,255,.9)'; g.shadowBlur = 0; g.stroke();
      g.restore();
    }
    g.restore();
  }
  isWatermelon() { return this.flavor.decor === 'watermelon'; }

  drawTopFace(g, p, px1) {
    const F = this.flavor;
    const bb = this.bbox(SHAPES[this.shape]());
    // 底色：左上亮、右下深
    const grad = g.createLinearGradient(bb.x0, bb.y0, bb.x1, bb.y1);
    grad.addColorStop(0, F.hi); grad.addColorStop(0.45, F.top); grad.addColorStop(1, F.deep);
    g.fillStyle = grad; g.fillRect(bb.x0 - 1, bb.y0 - 1, bb.x1 - bb.x0 + 2, bb.y1 - bb.y0 + 2);

    const D = this.decor;
    if (F.decor === 'watermelon') {
      // 果肉中心较亮
      const rg = g.createRadialGradient(-0.25, -0.3, 0.05, 0, 0, 1);
      rg.addColorStop(0, 'rgba(255,170,170,.55)'); rg.addColorStop(0.7, 'rgba(255,120,130,0)');
      g.fillStyle = rg; g.fillRect(-1.1, -1.1, 2.2, 2.2);
      // 瓜皮：白 → 浅绿 → 深绿
      g.lineWidth = 0.05; g.strokeStyle = '#F4F8DD'; g.beginPath(); g.arc(0, 0, 0.88, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 0.05; g.strokeStyle = '#9FCB6B'; g.beginPath(); g.arc(0, 0, 0.93, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 0.07; g.strokeStyle = '#2F7A36'; g.beginPath(); g.arc(0, 0, 0.99, 0, Math.PI * 2); g.stroke();
      // 瓜子
      for (const s of D) {
        g.save(); g.translate(s.x, s.y); g.rotate(s.a + Math.PI / 2);
        g.fillStyle = '#2A1A16';
        g.beginPath(); g.ellipse(0, 0, s.s * 0.55, s.s, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-s.s * 0.18, -s.s * 0.3, s.s * 0.14, s.s * 0.3, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    } else if (F.decor === 'bubbles') {
      for (const b of D) {
        g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(b.x, b.y, b.s, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(b.x - b.s * 0.35, b.y - b.s * 0.35, b.s * 0.28, 0, Math.PI * 2); g.fill();
      }
    } else if (F.decor === 'petals') {
      for (const b of D) {
        g.save(); g.translate(b.x, b.y); g.rotate(b.a);
        g.fillStyle = 'rgba(193,70,111,.28)';
        g.beginPath(); g.ellipse(0, 0, b.s * 0.45, b.s, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.beginPath(); g.ellipse(-b.s * 0.1, -b.s * 0.2, b.s * 0.12, b.s * 0.45, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    } else if (F.decor === 'cubes') {
      for (const b of D) {
        g.save(); g.translate(b.x, b.y); g.rotate(b.a);
        g.fillStyle = 'rgba(255,230,140,.55)';
        this.rrect(g, -b.s / 2, -b.s / 2, b.s, b.s, b.s * 0.25); g.fill();
        g.fillStyle = 'rgba(208,122,18,.25)';
        this.rrect(g, -b.s / 2 + b.s * 0.12, -b.s / 2 + b.s * 0.12, b.s, b.s, b.s * 0.25); g.fill();
        g.restore();
      }
    } else if (F.decor === 'swirl') {
      g.strokeStyle = 'rgba(246,231,207,.5)'; g.lineCap = 'round';
      for (const w of D) {
        g.lineWidth = 0.05 + w.amp * 0.3;
        g.beginPath();
        for (let x = -1.3; x <= 1.3; x += 0.05) { const y = w.y + Math.sin(x * 3 + w.ph) * w.amp; x === -1.3 ? g.moveTo(x, y) : g.lineTo(x, y); }
        g.stroke();
      }
    }

    // 果冻光泽：大面积柔光 + 一个清楚的镜面高光（落在各块自己的左上）
    const gl = g.createLinearGradient(bb.x0, bb.y0, (bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2);
    gl.addColorStop(0, 'rgba(255,255,255,.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(bb.x0 - 1, bb.y0 - 1, bb.x1 - bb.x0 + 2, bb.y1 - bb.y0 + 2);

    const pb = this.bbox(p.poly);
    const hx = lerp(pb.x0, p.c.x, 0.45), hy = lerp(pb.y0, p.c.y, 0.45);
    const hr = Math.min(pb.x1 - pb.x0, pb.y1 - pb.y0) * 0.32;
    const sp = g.createRadialGradient(hx, hy, 0, hx, hy, hr);
    sp.addColorStop(0, 'rgba(255,255,255,.75)'); sp.addColorStop(0.35, 'rgba(255,255,255,.25)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sp; g.beginPath(); g.ellipse(hx, hy, hr * 1.2, hr * 0.7, -0.6, 0, Math.PI * 2); g.fill();

    // 斜面：左上亮边、右下暗边（在裁切区内）
    g.save();
    g.translate(-px1 * 2, -px1 * 2);
    this.pathPoly(g, p.poly); g.lineWidth = px1 * 5; g.strokeStyle = 'rgba(255,255,255,.4)'; g.stroke();
    g.restore();
    g.save();
    g.translate(px1 * 2.5, px1 * 2.5);
    this.pathPoly(g, p.poly); g.lineWidth = px1 * 6; g.strokeStyle = 'rgba(60,10,10,.14)'; g.stroke();
    g.restore();
  }
  bbox(P) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const v of P) { x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y); }
    return { x0, y0, x1, y1 };
  }

  drawGhost(g, gh) {
    g.save();
    const d = this.dpr, k = this.k;
    g.setTransform(k * d, 0, 0, k * d, this.plate.x * d, this.plate.y * d);
    this.pathPoly(g, gh.poly);
    g.fillStyle = 'rgba(193,91,116,.06)'; g.fill();
    g.setLineDash([6 / k, 6 / k]); g.lineWidth = 2.2 / k; g.strokeStyle = 'rgba(140,59,82,.55)'; g.stroke();
    g.restore();
  }

  drawSeat(g, s) {
    const { x, y } = s.av, R = s.avR;
    g.save();
    g.fillStyle = 'rgba(67,20,23,.25)'; g.beginPath(); g.arc(x + 3, y + 6, R, 0, Math.PI * 2); g.fill();
    const disc = g.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
    disc.addColorStop(0, '#FFFFFF'); disc.addColorStop(0.7, '#F6E7C9'); disc.addColorStop(1, '#E2C898');
    g.fillStyle = disc; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
    g.lineWidth = Math.max(2, R * 0.08); g.strokeStyle = '#D4A017'; g.stroke();
    g.lineWidth = 1; g.strokeStyle = 'rgba(156,107,18,.6)'; g.beginPath(); g.arc(x, y, R + R * 0.06, 0, Math.PI * 2); g.stroke();
    const bob = s.bubble && s.bubble.mood === 'happy' ? Math.abs(Math.sin(this.time * 7)) * R * 0.12 : 0;
    const shake = s.bubble && s.bubble.mood === 'sad' && s.bubble.t < 0.8 ? Math.sin(s.bubble.t * 40) * R * 0.06 : 0;
    const sz = R * 1.35;
    if (s.img.complete && s.img.naturalWidth) g.drawImage(s.img, x - sz / 2 + shake, y - sz / 2 - bob, sz, sz);
    else { g.font = `${sz * 0.8}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emojiChar(s.code), x + shake, y - bob); }
    // 名字
    g.font = `700 ${Math.max(13, R * 0.34)}px ${getComputedStyle(document.body).getPropertyValue('--f-body')}`;
    g.textAlign = 'center'; g.textBaseline = 'top';
    const ny = y + R + R * 0.14;
    const tw = g.measureText(s.name).width + R * 0.5;
    g.fillStyle = 'rgba(255,253,247,.92)'; this.rrect(g, x - tw / 2, ny, tw, R * 0.48, R * 0.24); g.fill();
    g.fillStyle = '#6E5646'; g.fillText(s.name, x, ny + R * 0.06);
    g.restore();
  }
  drawBubble(g, s) {
    const b = s.bubble, R = s.avR;
    const appear = clamp(b.t / 0.25, 0, 1), sc = 0.6 + 0.4 * (1 - Math.pow(1 - appear, 3)) + (appear < 1 ? 0 : 0);
    const fs = Math.max(16, R * 0.42);
    g.save();
    g.font = `900 ${fs}px ${getComputedStyle(document.body).getPropertyValue('--f-body')}`;
    const w = g.measureText(b.text).width + fs * 1.3, h = fs * 1.9;
    // 竖屏时下排朋友的气泡放在头像下面，免得盖住他们的盘子
    const below = this.portrait && s.av.y > this.tc.y;
    let bx = s.av.x, by = below ? s.av.y + R * 1.75 + h * 0.62 : s.av.y - R - h * 0.72;
    // 别跑出画面
    bx = clamp(bx, w / 2 + 6, this.W - w / 2 - 6); by = clamp(by, h / 2 + 4, this.H - h / 2 - 4);
    g.translate(bx, by); g.scale(sc, sc); g.globalAlpha = appear;
    const col = b.mood === 'happy' ? '#FFFFFF' : b.mood === 'sad' ? '#FFF1E8' : '#FFFBEF';
    const edge = b.mood === 'happy' ? '#9FD3AE' : b.mood === 'sad' ? '#E9B394' : '#E7D3A9';
    g.shadowColor = 'rgba(67,20,23,.25)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
    g.fillStyle = col; this.rrect(g, -w / 2, -h / 2, w, h, h * 0.45); g.fill();
    g.shadowColor = 'transparent';
    const ty = below ? -1 : 1; // 尾巴朝头像
    g.beginPath(); g.moveTo(-fs * 0.4, ty * (h / 2 - 1)); g.lineTo(0, ty * (h / 2 + fs * 0.55)); g.lineTo(fs * 0.4, ty * (h / 2 - 1)); g.closePath(); g.fill();
    g.lineWidth = 2; g.strokeStyle = edge; this.rrect(g, -w / 2, -h / 2, w, h, h * 0.45); g.stroke();
    g.fillStyle = b.mood === 'sad' ? '#7A3A15' : '#3B2A1E'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(b.text, 0, 1);
    g.restore();
  }
  drawLabel(g, L) {
    // 在画面某处画一张小分数牌
    const pos = L.at ? L.at() : L, x = pos.x, y = pos.y;
    const fs = L.sizeF ? Math.max(L.min || 13, this.TR * L.sizeF) : (L.size || Math.max(18, this.TR * 0.075));
    g.save();
    g.font = `800 ${fs}px ${getComputedStyle(document.body).getPropertyValue('--f-num')}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = fs * 1.9, h = fs * 2.6;
    g.shadowColor = 'rgba(67,20,23,.25)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
    g.fillStyle = L.bg || '#FFFDF7'; this.rrect(g, x - w / 2, y - h / 2, w, h, fs * 0.45); g.fill();
    g.shadowColor = 'transparent';
    g.lineWidth = 2; g.strokeStyle = L.edge || '#D4A017'; g.stroke();
    g.fillStyle = L.color || '#8C3B52';
    if (L.text) { g.fillText(L.text, x, y + 2); }
    else {
      g.fillText(String(L.num), x, y - fs * 0.55);
      g.fillRect(x - fs * 0.5, y - fs * 0.06, fs, Math.max(2, fs * 0.12));
      g.fillText(String(L.den), x, y + fs * 0.62);
    }
    g.restore();
  }

  drawStroke(g) {
    const s = this.stroke;
    const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
    if (len < 6) return;
    // 预览：会被帮手刀对齐成什么样
    const r = len > 18 ? this.resolveStroke(s.a, s.b) : null;
    g.save();
    if (r && r.line.snapped) {
      const seg = this.lineSegmentOverPieces(r.line, r.hits, r.off);
      if (seg) {
        const a = this.unitToPx(seg.a), b = this.unitToPx(seg.b);
        g.lineCap = 'round';
        g.strokeStyle = 'rgba(212,160,23,.35)'; g.lineWidth = 12; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        g.strokeStyle = '#D4A017'; g.lineWidth = 3.5; g.setLineDash([12, 8]); g.lineDashOffset = -this.time * 40;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        g.setLineDash([]);
      }
    }
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(59,42,30,.25)'; g.lineWidth = 7; g.beginPath(); g.moveTo(s.a.x + 2, s.a.y + 3); g.lineTo(s.b.x + 2, s.b.y + 3); g.stroke();
    g.strokeStyle = r && r.line.snapped ? 'rgba(255,255,255,.75)' : '#FFFFFF'; g.lineWidth = 5; g.beginPath(); g.moveTo(s.a.x, s.a.y); g.lineTo(s.b.x, s.b.y); g.stroke();
    g.restore();
  }
  drawKnife(g, x, y, ang, alpha = 1) {
    const L = this.k * 1.05;
    g.save();
    g.translate(x, y); g.rotate(ang); g.globalAlpha = alpha;
    // 刀身在指针的右侧往前伸；刀刃在下
    const bh = L * 0.26;
    g.shadowColor = 'rgba(40,20,10,.3)'; g.shadowBlur = 10; g.shadowOffsetX = 4; g.shadowOffsetY = 8;
    const blade = g.createLinearGradient(0, -bh, 0, bh * 0.2);
    blade.addColorStop(0, '#F7F9FB'); blade.addColorStop(0.55, '#C4CCD4'); blade.addColorStop(1, '#8E98A2');
    g.fillStyle = blade;
    g.beginPath(); g.moveTo(-L * 0.1, -bh); g.lineTo(L * 0.72, -bh); g.quadraticCurveTo(L * 0.92, -bh * 0.7, L * 0.95, 0);
    g.lineTo(-L * 0.1, 0); g.closePath(); g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-L * 0.08, -1); g.lineTo(L * 0.93, -1); g.stroke();
    g.strokeStyle = 'rgba(80,90,100,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-L * 0.1, -bh); g.lineTo(L * 0.72, -bh); g.stroke();
    // 刀柄
    const hw = L * 0.42, hh = bh * 0.55;
    const wood = g.createLinearGradient(0, -bh * 0.8, 0, -bh * 0.8 + hh);
    wood.addColorStop(0, '#7A3A2A'); wood.addColorStop(1, '#3E1A12');
    g.fillStyle = wood; this.rrect(g, -L * 0.1 - hw, -bh * 0.78, hw, hh, hh * 0.45); g.fill();
    g.fillStyle = '#E9E2D6';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-L * 0.1 - hw * (0.22 + i * 0.28), -bh * 0.78 + hh / 2, hh * 0.13, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  drawKnifeSweep(g) {
    const K = this.knife, t = clamp(K.t / K.dur, 0, 1), e = 1 - Math.pow(1 - t, 3);
    const a = this.unitToPx(K.a), b = this.unitToPx(K.b);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    // 刀痕：扫过的部分留一条亮线
    const cx = lerp(a.x, b.x, e), cy = lerp(a.y, b.y, e);
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(cx, cy); g.stroke();
    g.restore();
    const fade = K.t > K.dur ? 1 - (K.t - K.dur) / 0.18 : 1;
    // 刀尖走在前面
    const L = this.k * 1.05;
    this.drawKnife(g, cx - Math.cos(ang) * L * 0.85, cy - Math.sin(ang) * L * 0.85, ang, clamp(fade, 0, 1));
  }
  drawParticle(g, q) {
    const life = 1 - q.t / q.life;
    g.save(); g.globalAlpha = clamp(life * 1.4, 0, 1);
    if (q.kind === 'drop') {
      g.fillStyle = q.color; g.beginPath(); g.arc(q.x, q.y, q.r * (0.6 + life * 0.4), 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(q.x - q.r * 0.3, q.y - q.r * 0.3, q.r * 0.3, 0, Math.PI * 2); g.fill();
    } else if (q.kind === 'cube') {
      g.translate(q.x, q.y); g.rotate(q.rot);
      g.fillStyle = q.color; this.rrect(g, -q.r / 2, -q.r / 2, q.r, q.r, q.r * 0.25); g.fill();
      g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(-q.r / 2 + 1, -q.r / 2 + 1, q.r * 0.4, q.r * 0.25);
    } else {
      g.translate(q.x, q.y); g.rotate(q.rot); g.fillStyle = '#F3CE7C';
      g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? q.r * 0.45 : q.r; const a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); g.strokeStyle = '#D4A017'; g.lineWidth = 1; g.stroke();
    }
    g.restore();
  }
}

/* ───────────────────────── 关卡资料 ───────────────────────── */
const SHARE_LEVELS = [
  { shape: 'circle', flavor: 'watermelon', friends: ['panda', 'rabbit'] },
  { shape: 'square', flavor: 'pandan', friends: ['tiger', 'elephant'] },
  { shape: 'circle', flavor: 'mango', friends: ['frog', 'fox', 'monkey', 'pig'] },
  { shape: 'rect', flavor: 'rose', friends: ['cat', 'dog', 'bear', 'chick'] },
  { shape: 'square', flavor: 'kopi', friends: ['lion', 'hamster', 'panda', 'rabbit'] },
];

// type: cut（切好再拿）/ recog（看一看，拿走了几分之几）/ isit（这块是不是四分之一）
const SHOP_ORDERS = [
  { type: 'cut', shape: 'circle', flavor: 'watermelon', who: 'panda', num: 1, den: 2 },
  { type: 'recog', shape: 'square', flavor: 'pandan', who: 'rabbit', num: 1, den: 4, cuts: 'grid', options: [[1, 2], [1, 4], [3, 4]] },
  { type: 'cut', shape: 'rect', flavor: 'rose', who: 'tiger', num: 1, den: 4 },
  { type: 'isit', shape: 'square', flavor: 'mango', who: 'fox', cuts: 'unequal4', answer: false, num: 1, den: 4 },
  { type: 'cut', shape: 'circle', flavor: 'mango', who: 'elephant', num: 3, den: 4 },
  { type: 'recog', shape: 'circle', flavor: 'kopi', who: 'monkey', num: 2, den: 4, cuts: 'grid', options: [[1, 4], [2, 4], [3, 4]] },
  { type: 'isit', shape: 'rect', flavor: 'pandan', who: 'cat', cuts: 'strips', answer: true, num: 1, den: 4 },
  { type: 'cut', shape: 'square', flavor: 'kopi', who: 'bear', num: 2, den: 4 },
  { type: 'isit', shape: 'circle', flavor: 'watermelon', who: 'pig', cuts: 'unequal2', answer: false, num: 1, den: 2 },
  { type: 'recog', shape: 'rect', flavor: 'rose', who: 'lion', num: 3, den: 4, cuts: 'grid', options: [[3, 4], [1, 2], [1, 4]] },
];

function preCut(scene, kind) {
  const R = Math.SQRT1_2;
  if (kind === 'grid') { scene.cutLine(0, 0, 1, 0); scene.cutLine(0, 0, 0, 1); }
  else if (kind === 'strips') { scene.cutLine(0, 0, 1, 0); scene.cutLine(0.57, 0, 1, 0); scene.cutLine(-0.57, 0, 1, 0); }
  else if (kind === 'unequal4') { scene.cutLine(-0.32, 0, 1, 0); scene.cutLine(0, 0.3, 0, 1); }
  else if (kind === 'unequal2') { scene.cutLine(0.36, 0, R, R); }
  scene.pieces.forEach(p => { p.off = { ...p.home }; p.wob = 0; });
}
function sortByAngle(pieces) {
  // 从左上开始顺时针，让「拿走哪几块」看起来有次序
  return [...pieces].sort((a, b) => {
    const aa = (Math.atan2(a.c.y, a.c.x) + Math.PI * 1.25 + Math.PI * 2) % (Math.PI * 2);
    const bb = (Math.atan2(b.c.y, b.c.x) + Math.PI * 1.25 + Math.PI * 2) % (Math.PI * 2);
    return aa - bb;
  });
}

/* ───────────────────────── 朗读句子 ───────────────────────── */
// 会读出来的句子全部在这里。改了句子要重跑 gen-voice.py，否则那一句会退回浏览器朗读。
// 句子里刻意不放「学生切了几块」这种不可预期的数字，这样每一句都能预先录好。
const SAY = {
  shareTask: (n, fname) => `有${n}位朋友来吃${fname}。切一切，每人要一样多！`,
  notCut: () => '还没切哦！用刀在燕菜上划一条线。',
  notEnough: n => `块数不够分给${n}位朋友，再切一切！`,
  notDivisible: n => `这些块分给${n}位朋友，分不完哦。再来一次。`,
  fair: (per, m) => `切得一样大，真公平！每人得到${fracRead(per, m)}。`,
  unfair: () => '不公平！有的大，有的小。每一块要一样大才行。',
  order: (fname, num, den) => `我要这盘${fname}的${fracRead(num, den)}。`,
  recogTask: fname => `我拿走了这盘${fname}的几分之几？`,
  isitTask: (num, den) => `亮亮的这一块，是这盘燕菜的${fracRead(num, den)}吗？`,
  wrongCount: den => `要切成${den}块哦。数一数，现在有几块？`,
  unequal: den => `${den}块不一样大，这样不是${fracRead(1, den)}哦。`,
  cutDone: (num, den) => `切好了！每一块是${fracRead(1, den)}。现在拿${num}块给我。`,
  wantCount: (num, den) => `我要的是${fracRead(num, den)}，就是${num}块。`,
  delivered: (num, den) => `送到了！这是${fracRead(num, den)}。`,
  recogRight: (n, d) => `对了！整盘切成${d}块，拿走${n}块，就是${fracRead(n, d)}。`,
  recogWrongDen: () => '整盘一共切成几块？虚线的也要算进去。',
  recogWrongNum: () => '拿走了几块？数一数打包盒里的。',
  isitYes: (right, den, num) => `${right ? '对了！' : '其实是的！'}${den}块一样大，每一块都是${fracRead(num, den)}。长长的也可以！`,
  isitNo: (right, count, num, den) => `${right ? '对了！' : '要小心哦！'}${count}块不一样大，所以不是${fracRead(num, den)}。`,
  freeTask: () => '想怎么切就怎么切！切成一样大，看看是几分之几。',
  end: (title, total) => `${title}一共得到${total}颗星。`,
};
const endTitle = (total, max) => (total >= max * 0.85 ? '太棒了！' : total >= max * 0.6 ? '做得好！' : '继续加油！');
const PRECUT_COUNT = { grid: 4, strips: 4, unequal4: 4, unequal2: 2 };
const FAIR_MAX_PIECES = 12; // 分给朋友时，超过这个块数的「公平」句子没有预录（退回浏览器朗读）

// 列出所有可能读到的句子 → gen-voice.py 用来生成音档
function allVoiceLines() {
  const out = new Map();
  const add = (text, who = null) => { const voice = voiceOf(who); out.set(voice + '|' + text, { text, voice, key: clipKey(voice, text) }); };
  add(SAY.notCut()); add(SAY.unfair()); add(SAY.freeTask());
  for (const L of SHARE_LEVELS) {
    const n = L.friends.length;
    add(SAY.shareTask(n, FLAVORS[L.flavor].name)); add(SAY.notEnough(n)); add(SAY.notDivisible(n));
    for (let m = n; m <= FAIR_MAX_PIECES; m += n) add(SAY.fair(m / n, m));
  }
  for (const O of SHOP_ORDERS) {
    const F = FLAVORS[O.flavor].name, w = O.who;
    if (O.type === 'cut') {
      add(SAY.order(F, O.num, O.den), w); add(SAY.wrongCount(O.den)); add(SAY.unequal(O.den));
      add(SAY.cutDone(O.num, O.den), w); add(SAY.wantCount(O.num, O.den), w); add(SAY.delivered(O.num, O.den));
    } else if (O.type === 'recog') {
      add(SAY.recogTask(F), w); add(SAY.recogRight(O.num, O.den)); add(SAY.recogWrongDen()); add(SAY.recogWrongNum());
    } else {
      add(SAY.isitTask(O.num, O.den), w);
      for (const right of [true, false]) add(O.answer ? SAY.isitYes(right, O.den, O.num) : SAY.isitNo(right, PRECUT_COUNT[O.cuts], O.num, O.den));
    }
  }
  for (const len of [SHARE_LEVELS.length, SHOP_ORDERS.length]) for (let t = len; t <= len * 3; t++) add(SAY.end(endTitle(t, len * 3), t));
  return [...out.values()];
}

/* ───────────────────────── 游戏流程 ───────────────────────── */
const UI = {
  home: $('#home'), game: $('#game'), modeTitle: $('#modeTitle'), studs: $('#studs'),
  avatar: $('#taskAvatar'), who: $('#taskWho'), say: $('#taskSay'), hint: $('#hint'), result: $('#result'),
  choices: $('#choices'), freeTools: $('#freeTools'), actions: $('#actions'),
  btnReset: $('#btnReset'), btnMain: $('#btnMain'), btnSnap: $('#btnSnap'), btnSound: $('#btnSound'), btnSpeak: $('#btnSpeak'),
  end: $('#endOverlay'), endStars: $('#endStars'), endTitle: $('#endTitle'), endText: $('#endText'),
};

const scene = new Scene($('#gameCanvas'));
const G = { mode: null, idx: 0, phase: '', stars: [], miss: 0, speakText: '', speakWho: null, mainAction: null, resetAction: null };

function setTask(animalKey, sayHTML, speakText) {
  const a = animalKey ? ANIMALS[animalKey] : null;
  UI.avatar.innerHTML = '';
  UI.avatar.appendChild(emojiEl(a ? a.code : '1f36e', 40));
  UI.who.textContent = a ? a.name : '燕菜铺';
  UI.say.innerHTML = sayHTML;
  G.speakText = speakText || sayHTML; G.speakWho = animalKey || null;
  Voice.say(G.speakText, G.speakWho);
}
function setHint(html) { UI.hint.innerHTML = html || ''; }
function showResult(kind, html) {
  if (!kind) { UI.result.hidden = true; UI.result.className = 'result'; return; }
  UI.result.hidden = false; UI.result.className = `result ${kind}`;
  // 分数牌单独一栏，其余文字包在同一个块里（不然 flex 会把每段字拆成一栏）
  const m = html.match(/^(<span class="frac big-frac">.*?<\/span>)([\s\S]*)$/);
  UI.result.innerHTML = m ? `${m[1]}<div class="res-body">${m[2]}</div>` : `<div class="res-body">${html}</div>`;
  void UI.result.offsetWidth; UI.result.classList.add('pop');
}
function setButtons({ main = null, mainLabel = '', mainClass = 'primary', reset = null, resetLabel = '↺ 重新切', mainDisabled = false } = {}) {
  G.mainAction = main; G.resetAction = reset;
  UI.btnMain.hidden = !main; UI.btnReset.hidden = !reset;
  UI.btnMain.textContent = mainLabel; UI.btnMain.className = `btn ${mainClass}`; UI.btnMain.disabled = mainDisabled;
  UI.btnReset.textContent = resetLabel;
  UI.actions.classList.toggle('single', !main || !reset);
  UI.actions.hidden = !main && !reset;
}
function renderStuds(total) {
  UI.studs.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const li = document.createElement('li');
    if (i < G.stars.length) { li.className = 'done'; li.textContent = '★'; }
    else if (i === G.idx) li.className = 'now';
    UI.studs.appendChild(li);
  }
}
function earnStar() {
  const s = clamp(3 - G.miss, 1, 3);
  G.stars.push(s);
  const li = UI.studs.children[G.stars.length - 1];
  if (li) { li.className = 'done pop'; li.textContent = '★'; }
  Sound.coin();
}
function show(screen) {
  UI.home.classList.toggle('is-active', screen === 'home');
  UI.game.classList.toggle('is-active', screen === 'game');
  // 共用组件的「换班级」按钮固定在右上角，游戏中会压住声音按钮；只在首页显示
  document.body.classList.toggle('in-game', screen === 'game');
  if (screen === 'game') requestAnimationFrame(() => scene.resize());
}

/* —— 模式一：分给朋友 —— */
function startShare(i) {
  G.idx = i; G.miss = 0;
  const L = SHARE_LEVELS[i], n = L.friends.length;
  renderStuds(SHARE_LEVELS.length);
  scene.setup({ shape: L.shape, flavor: L.flavor, seats: L.friends.map(k => ({ ...ANIMALS[k] })), layout: 'share' });
  const F = FLAVORS[L.flavor];
  setTask(null, `有 <em>${n}</em> 位朋友来吃${F.name}。<br>切一切，每人要<em>一样多</em>！`, SAY.shareTask(n, F.name));
  const tips = n === 2
    ? '在燕菜上<b>划一条线</b>，放开手就会切下去。'
    : '要分给 4 个人，想一想：<b>要切几刀</b>？';
  setHint(tips + (i === 0 ? '<br>切好了按「切好了」。' : ''));
  showResult(null); UI.choices.hidden = true; UI.freeTools.hidden = true;
  scene.cutEnabled = true; scene.pickEnabled = false;
  scene.onCut = () => { setHint(`现在有 <b>${scene.plateAreas().length}</b> 块。`); };
  setButtons({ main: shareCheck, mainLabel: '✓ 切好了', reset: () => { scene.resetJelly(); setHint('重新来！划一条线切燕菜。'); } });
}
function shareCheck() {
  const L = SHARE_LEVELS[G.idx], n = L.friends.length;
  const plate = scene.pieces.filter(p => p.where === 'plate');
  const m = plate.length;
  if (m === 1) { Sound.bad(); setHint('还没切哦！用刀在燕菜上<b>划一条线</b>。'); Voice.say(SAY.notCut()); return; }
  if (m < n) { G.miss++; Sound.bad(); showResult('bad', `只有 ${m} 块，不够分给 ${n} 位朋友。再切一切！`); Voice.say(SAY.notEnough(n)); return; }
  if (m % n !== 0) { G.miss++; Sound.bad(); showResult('bad', `${m} 块分给 ${n} 位朋友，分不完哦。<br>按「重新切」再来一次。`); Voice.say(SAY.notDivisible(n)); return; }

  // 分下去：每人 m/n 块（按位置分组，让同一个人拿到的块挨在一起）
  const per = m / n;
  const sorted = sortByAngle(plate);
  const groups = L.friends.map((_, i) => sorted.slice(i * per, (i + 1) * per));
  // 让离座位近的组去那个座位
  const seatOrder = assignGroupsToSeats(groups, scene.seats);
  scene.cutEnabled = false; scene.busy = true;
  setButtons({});
  Sound.whoosh();
  seatOrder.forEach(({ group, seat }) => {
    group.forEach(p => { p.where = 'seat'; });
    scene.sendGroup(group, () => seat.plate, () => seat.plateR);
  });

  const areas = groups.map(gp => gp.reduce((a, p) => a + p.area, 0));
  const pieceAreas = plate.map(p => p.area);
  const equal = Math.max(...pieceAreas) / Math.min(...pieceAreas) <= 1.12;
  setTimeout(() => {
    scene.busy = false;
    if (equal) {
      seatOrder.forEach(({ seat }) => (seat.bubble = { text: '一样多！', mood: 'happy', t: 0 }));
      scene.labels = seatOrder.map(({ seat }) => labelNear(seat, per, m));
      Sound.good(); scene.confetti(scene.tc.x, scene.tc.y - scene.TR * 0.2);
      earnStar();
      const read = fracRead(per, m);
      const extra = per > 1 && m === 4 && n === 2 ? `<br><small>跟${fracRead(1, 2)}一样多</small>` : '';
      showResult('ok', `${fracHTML(per, m, 'big-frac')}<span>每人得到 ${per} 块，<span class="read">${read}</span>${extra}</span>`);
      Voice.say(SAY.fair(per, m));
      setHint(per === 1 ? `整盘切成 <b>${m}</b> 块一样大的，每块就是 <b>${read}</b>。` : `整盘切成 <b>${m}</b> 块一样大的，每人拿 <b>${per}</b> 块。`);
      const last = G.idx === SHARE_LEVELS.length - 1;
      setButtons({ main: () => (last ? finish() : startShare(G.idx + 1)), mainLabel: last ? '★ 看成绩' : '下一关 ›', mainClass: 'gold' });
    } else {
      G.miss++;
      const maxA = Math.max(...areas), minA = Math.min(...areas);
      seatOrder.forEach(({ seat }, i) => {
        const a = areas[groups.indexOf(seatOrder[i].group)];
        if (Math.abs(a - minA) < 1e-6) seat.bubble = { text: '我的比较小…', mood: 'sad', t: 0 };
        else if (Math.abs(a - maxA) < 1e-6) seat.bubble = { text: '哇，我的最大！', mood: 'happy', t: 0 };
        else seat.bubble = { text: '嗯…', mood: 'meh', t: 0 };
      });
      Sound.bad();
      showResult('bad', `不公平！有的<b>大</b>，有的<b>小</b>。<br>每一块要<b>一样大</b>才行。`);
      Voice.say(SAY.unfair());
      setHint('看看朋友的盘子：谁的比较小？');
      setButtons({ main: () => startShareRetry(), mainLabel: '↺ 再切一次', mainClass: 'primary' });
    }
  }, 700);
}
function startShareRetry() {
  const keepMiss = G.miss; startShare(G.idx); G.miss = keepMiss;
}
function assignGroupsToSeats(groups, seats) {
  // 贪心：每组去最近的空座位
  const used = new Set(), res = [];
  const gcs = groups.map(gp => { let A = 0, x = 0, y = 0; gp.forEach(p => { A += p.area; x += p.c.x * p.area; y += p.c.y * p.area; }); return { x: x / A, y: y / A }; });
  const pairs = [];
  groups.forEach((gp, gi) => seats.forEach((s, si) => {
    const u = scene.toUnits(s.plate.x, s.plate.y);
    pairs.push({ gi, si, d: Math.hypot(u.x - gcs[gi].x, u.y - gcs[gi].y) });
  }));
  pairs.sort((a, b) => a.d - b.d);
  const gUsed = new Set();
  for (const pr of pairs) { if (gUsed.has(pr.gi) || used.has(pr.si)) continue; gUsed.add(pr.gi); used.add(pr.si); res.push({ group: groups[pr.gi], seat: seats[pr.si] }); }
  return res;
}
function labelNear(seat, num, den) {
  // 分数牌放在盘子往桌心的方向
  // 分数牌挂在盘子朝桌子上下边缘的一侧（左右座位放下方），不压主盘也不压头像
  const at = () => {
    const up = seat.plate.y < scene.tc.y - 1, side = Math.abs(seat.plate.y - scene.tc.y) < 1;
    const x = seat.plate.x + (side ? 0 : (seat.plate.x < scene.tc.x ? 1 : -1) * seat.plateR * 1.05);
    const y = side ? seat.plate.y + seat.plateR * 1.55 : seat.plate.y + (up ? -1 : 1) * seat.plateR * 0.95;
    return { x, y };
  };
  return { at, num, den, sizeF: 0.062, min: 16 };
}
const pieceLabelAt = p => () => ({ x: scene.plate.x + (p.c.x + p.home.x) * scene.k, y: scene.plate.y + (p.c.y + p.home.y - scene.thick()) * scene.k });
const boxLabelAt = () => ({ x: scene.box.x, y: scene.box.y + scene.box.hh + scene.TR * 0.2 });

/* —— 模式二：燕菜铺开张 —— */
function startShop(i) {
  G.idx = i; G.miss = 0;
  const O = SHOP_ORDERS[i], A = ANIMALS[O.who];
  renderStuds(SHOP_ORDERS.length);
  scene.setup({ shape: O.shape, flavor: O.flavor, seats: [{ ...A }], box: true, layout: 'shop' });
  showResult(null); UI.choices.hidden = true; UI.freeTools.hidden = true;
  scene.cutEnabled = false; scene.pickEnabled = false; scene.onPick = null; scene.onCut = null;
  const F = FLAVORS[O.flavor];
  if (O.type === 'cut') {
    setTask(O.who, `我要这盘${F.name}<span class="nb">的${fracHTML(O.num, O.den)}。</span>`, SAY.order(F.name, O.num, O.den));
    setHint(`先把燕菜切成 <b>${O.den}</b> 块<b>一样大</b>的。`);
    scene.cutEnabled = true;
    scene.onCut = () => setHint(`现在有 <b>${scene.plateAreas().length}</b> 块。要切成 <b>${O.den}</b> 块一样大的。`);
    setButtons({ main: shopCutCheck, mainLabel: '✓ 切好了', reset: () => { scene.resetJelly(); setHint(`把燕菜切成 <b>${O.den}</b> 块一样大的。`); } });
  } else if (O.type === 'recog') {
    preCut(scene, O.cuts);
    const sorted = sortByAngle(scene.pieces);
    const taken = sorted.slice(0, O.num);
    taken.forEach(p => { scene.ghostOf(p); p.where = 'box'; });
    scene.sendGroup(taken, () => scene.box, () => Math.min(scene.box.hw, scene.box.hh));
    scene.seats[0].bubble = { text: '谢谢！', mood: 'happy', t: 0 };
    setTask(O.who, `我拿走了这盘${F.name}的几分之几？`, SAY.recogTask(F.name));
    setHint('数一数：整盘切成几块？拿走了几块？');
    UI.choices.className = 'choices'; UI.choices.hidden = false; UI.choices.innerHTML = '';
    O.options.forEach(([n, d]) => {
      const b = document.createElement('button'); b.className = 'choice';
      b.innerHTML = `${fracHTML(n, d)}<span class="cn">${fracRead(n, d)}</span>`;
      b.onclick = () => recogAnswer(b, n, d);
      UI.choices.appendChild(b);
    });
    setButtons({});
  } else if (O.type === 'isit') {
    preCut(scene, O.cuts);
    const sorted = sortByAngle(scene.pieces);
    const target = O.cuts === 'unequal2' ? sorted.reduce((a, b) => (a.area < b.area ? a : b)) : sorted[0];
    G.target = target;
    scene.highlight(target, '#F3CE7C');
    const read = fracRead(O.num, O.den);
    setTask(O.who, `亮亮的这一块，是这盘燕菜<span class="nb">的${fracHTML(O.num, O.den)}吗？</span>`, SAY.isitTask(O.num, O.den));
    setHint(`看清楚：一共有几块？每一块<b>一样大</b>吗？`);
    UI.choices.className = 'choices two'; UI.choices.hidden = false; UI.choices.innerHTML = '';
    [['是', true], ['不是', false]].forEach(([t, v]) => {
      const b = document.createElement('button'); b.className = 'choice yn'; b.textContent = t;
      b.onclick = () => isitAnswer(b, v);
      UI.choices.appendChild(b);
    });
    setButtons({});
  }
}
function shopCutCheck() {
  const O = SHOP_ORDERS[G.idx];
  const plate = scene.pieces.filter(p => p.where === 'plate'), m = plate.length;
  if (m === 1) { Sound.bad(); setHint('还没切哦！用刀在燕菜上<b>划一条线</b>。'); Voice.say(SAY.notCut()); return; }
  const areas = plate.map(p => p.area), equal = Math.max(...areas) / Math.min(...areas) <= 1.12;
  if (m !== O.den) {
    G.miss++; Sound.bad();
    showResult('bad', `要切成 <b>${O.den}</b> 块，现在是 <b>${m}</b> 块。<br>按「重新切」再来。`);
    Voice.say(SAY.wrongCount(O.den));
    return;
  }
  if (!equal) {
    G.miss++; Sound.bad();
    const big = plate.reduce((a, b) => (a.area > b.area ? a : b)), small = plate.reduce((a, b) => (a.area < b.area ? a : b));
    scene.highlight(big, '#E0A374'); scene.highlight(small, '#7CC7AE');
    showResult('bad', `${O.den} 块<b>不一样大</b>，这样不是${fracRead(1, O.den)}哦。<br>按「重新切」再来。`);
    Voice.say(SAY.unequal(O.den));
    return;
  }
  // 切好了 → 拿
  Sound.good();
  scene.clearHighlights();
  scene.cutEnabled = false; scene.pickEnabled = true;
  showResult('ok', `${fracHTML(1, O.den, 'big-frac')}<span>切好了！每一块是<span class="read">${fracRead(1, O.den)}</span></span>`);
  setHint(`现在<b>点一点</b>燕菜，拿 <b>${O.num}</b> 块给客人。（已拿 0 块）`);
  Voice.say(SAY.cutDone(O.num, O.den), O.who);
  const refresh = () => {
    const k = scene.pieces.filter(p => p.selected).length;
    setHint(`现在<b>点一点</b>燕菜，拿 <b>${O.num}</b> 块给客人。（已拿 <b>${k}</b> 块）`);
    UI.btnMain.disabled = k === 0;
  };
  scene.onPick = p => {
    p.selected = !p.selected; p.liftT = p.selected ? scene.k * 0.2 : 0; p.wob = 0.6; p.wobT = 0;
    p.selected ? Sound.pick() : Sound.unpick();
    if (!UI.result.classList.contains('ok')) showResult(null);
    if (scene.seats[0]) scene.seats[0].bubble = null;
    refresh();
  };
  setButtons({ main: shopGive, mainLabel: '🎁 给客人', mainClass: 'gold', reset: () => { scene.pieces.forEach(p => { p.selected = false; p.liftT = 0; }); refresh(); }, resetLabel: '全部放回', mainDisabled: true });
}
function shopGive() {
  const O = SHOP_ORDERS[G.idx];
  const sel = scene.pieces.filter(p => p.selected), k = sel.length;
  if (k !== O.num) {
    G.miss++; Sound.bad();
    scene.seats[0].bubble = { text: `我要 ${O.num} 块哦`, mood: 'sad', t: 0 };
    showResult('bad', `客人要的是 ${fracHTML(O.num, O.den)}，就是 <b>${O.num}</b> 块。你拿了 <b>${k}</b> 块。`);
    Voice.say(SAY.wantCount(O.num, O.den), O.who);
    return;
  }
  scene.pickEnabled = false;
  sel.forEach(p => { scene.ghostOf(p); p.where = 'box'; });
  scene.sendGroup(sel, () => scene.box, () => Math.min(scene.box.hw, scene.box.hh));
  Sound.whoosh();
  setButtons({});
  setTimeout(() => {
    scene.seats[0].bubble = { text: '谢谢！好好吃！', mood: 'happy', t: 0 };
    Sound.good(); scene.confetti(scene.box.x, scene.box.y);
    earnStar();
    scene.labels = [{ at: boxLabelAt, num: O.num, den: O.den, sizeF: 0.065, min: 16 }];
    showResult('ok', `${fracHTML(O.num, O.den, 'big-frac')}<span>送到了！<span class="read">${fracRead(O.num, O.den)}</span></span>`);
    Voice.say(SAY.delivered(O.num, O.den));
    setHint(`切成 <b>${O.den}</b> 块一样大的，拿走 <b>${O.num}</b> 块，就是 <b>${fracRead(O.num, O.den)}</b>。`);
    nextShopButton();
  }, 650);
}
function recogAnswer(btn, n, d) {
  const O = SHOP_ORDERS[G.idx];
  if (n === O.num && d === O.den) {
    $$('.choice', UI.choices).forEach(b => (b.disabled = true));
    btn.classList.add('right');
    Sound.good(); earnStar(); scene.confetti(scene.box.x, scene.box.y);
    scene.labels = [{ at: boxLabelAt, num: n, den: d, sizeF: 0.065, min: 16 }];
    showResult('ok', `对了！整盘切成 <b>${d}</b> 块一样大的，拿走 <b>${n}</b> 块，就是<span class="read">${fracRead(n, d)}</span>`);
    Voice.say(SAY.recogRight(n, d));
    setHint('');
    nextShopButton();
  } else {
    G.miss++; btn.classList.add('wrong'); btn.disabled = true; Sound.bad();
    const hint = d !== O.den ? SAY.recogWrongDen() : SAY.recogWrongNum();
    setHint(hint); Voice.say(hint);
  }
}
function isitAnswer(btn, v) {
  const O = SHOP_ORDERS[G.idx];
  $$('.choice', UI.choices).forEach(b => (b.disabled = true));
  const plate = scene.pieces;
  const right = v === O.answer;
  if (right) { btn.classList.add('right'); Sound.good(); earnStar(); }
  else { G.miss++; btn.classList.add('wrong'); Sound.bad(); const other = $$('.choice', UI.choices).find(b => b !== btn); other && other.classList.add('right'); }
  const read = fracRead(O.num, O.den);
  if (O.answer) {
    plate.forEach(p => { p.wob = 1; p.wobT = -Math.random() * 0.2; });
    scene.labels = plate.map(p => ({ at: pieceLabelAt(p), num: 1, den: O.den, sizeF: 0.05, min: 14 }));
    showResult(right ? 'ok' : 'bad', `${right ? '对了！' : '其实是的！'}${O.den} 块<b>一样大</b>，每一块都是<span class="read">${read}</span>`);
    Voice.say(SAY.isitYes(right, O.den, O.num));
    setHint('切成长条也可以，只要<b>一样大</b>！');
  } else {
    const big = plate.reduce((a, b) => (a.area > b.area ? a : b)), small = plate.reduce((a, b) => (a.area < b.area ? a : b));
    scene.clearHighlights(); scene.highlight(big, '#E0A374'); scene.highlight(small, '#7CC7AE');
    scene.labels = [
      { at: pieceLabelAt(big), text: '大', sizeF: 0.06, min: 16, color: '#7A3A15', edge: '#E0A374' },
      { at: pieceLabelAt(small), text: '小', sizeF: 0.06, min: 16, color: '#1F5C4E', edge: '#7CC7AE' },
    ];
    showResult(right ? 'ok' : 'bad', `${right ? '对了！' : '要小心哦！'}${plate.length} 块<b>不一样大</b>，所以不是<span class="read">${read}</span>`);
    Voice.say(SAY.isitNo(right, plate.length, O.num, O.den));
    setHint('分数的每一块，都要<b>一样大</b>。');
  }
  nextShopButton();
}
function nextShopButton() {
  const last = G.idx === SHOP_ORDERS.length - 1;
  setButtons({ main: () => (last ? finish() : startShop(G.idx + 1)), mainLabel: last ? '★ 看成绩' : '下一位客人 ›', mainClass: 'gold' });
}

/* —— 模式三：自由切 —— */
const FREE_FLAVOR = { circle: ['watermelon', 'mango'], square: ['pandan', 'kopi'], rect: ['rose', 'pandan'] };
let freeFlip = 0;
function startFree(shape = 'circle') {
  G.idx = 0; G.stars = [];
  UI.studs.innerHTML = '';
  const fl = FREE_FLAVOR[shape][freeFlip++ % 2];
  scene.setup({ shape, flavor: fl, seats: [], layout: 'free' });
  scene.cutEnabled = true; scene.pickEnabled = false;
  setTask(null, `想怎么切就怎么切！<br>切成一样大，看看是几分之几。`, SAY.freeTask());
  setHint('打开「帮手刀」，切线会自动对齐；关掉就完全照手画的切。');
  showResult(null); UI.choices.hidden = true; UI.freeTools.hidden = false;
  $$('.shape-btn', UI.freeTools).forEach(b => b.classList.toggle('on', b.dataset.shape === shape));
  scene.onCut = freeReport;
  setButtons({ reset: () => { scene.resetJelly(); showResult(null); scene.labels = []; }, resetLabel: '↺ 重来' });
}
function freeReport() {
  const plate = scene.pieces.filter(p => p.where === 'plate'), m = plate.length;
  const areas = plate.map(p => p.area), total = areas.reduce((a, b) => a + b, 0);
  const equal = Math.max(...areas) / Math.min(...areas) <= 1.12;
  if (equal && m <= 10) {
    scene.labels = plate.map(p => ({ at: pieceLabelAt(p), num: 1, den: m, sizeF: m > 4 ? 0.04 : 0.05, min: 13 }));
    showResult('ok', `${fracHTML(1, m, 'big-frac')}<span>${m} 块一样大！<br>每块是<span class="read">${fracRead(1, m)}</span></span>`);
  } else {
    scene.labels = [];
    const pct = areas.map(a => a / total);
    showResult('bad', `现在有 <b>${m}</b> 块，<b>有大有小</b>。<br>最大的差不多是最小的 <b>${(Math.max(...pct) / Math.min(...pct)).toFixed(1)}</b> 倍。`);
  }
}

/* —— 结算 —— */
function finish() {
  const total = G.stars.reduce((a, b) => a + b, 0), max = G.stars.length * 3;
  UI.endStars.innerHTML = G.stars.map((s, i) => `<span style="animation-delay:${i * 0.08}s">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span>`).join(' ');
  UI.endStars.style.fontSize = G.stars.length > 6 ? '26px' : '38px';
  UI.endTitle.textContent = endTitle(total, max);
  UI.endText.innerHTML = G.mode === 'share'
    ? `你帮 <b>${SHARE_LEVELS.length}</b> 盘燕菜分得公平公平！<br>一共得到 <b>${total}</b> 颗星。`
    : `今天招待了 <b>${SHOP_ORDERS.length}</b> 位客人！<br>一共得到 <b>${total}</b> 颗星。`;
  UI.end.hidden = false;
  Sound.good(); Voice.say(SAY.end(UI.endTitle.textContent, total));
  const shop = G.mode === 'shop';
  $('#endMore').hidden = !shop;
  const save = $('#endSave');
  save.hidden = true;
  if (shop && Player.name) {
    save.hidden = false; save.textContent = `正在把 ${Player.name} 的成绩存进排行榜…`;
    submitScore(total, max).then(r => {
      save.textContent = r
        ? `⭐ 已存进排行榜！${Player.name} 最好的成绩：${r.best}／${r.best_max} 颗星`
        : '（这次没能存上排行榜，可能是网络不稳；星星还是算数的）';
    });
  } else if (shop) {
    save.hidden = false; save.textContent = '（没有写名字，这次不上排行榜）';
  }
}

/* ───────────────────────── 班级名单与排行榜（Supabase） ───────────────────────── */
// 照 tahun1-mt-masa 的做法：名单用课堂点子铺共用的 ClassCode；成绩只能透过
// submit_tahun1_mt_pecahan_score 函数写入（kongsi-idea/supabase/migration-2026-09-29-*.sql）。
const Player = { rosterLoaded: false, roster: [], name: '', playCode: null, classLabel: '访客' };
const hasDB = () => typeof supabaseClient !== 'undefined';
function withTimeout(promise, ms) {
  // 教室网络常常卡住不回应，没有超时画面会一直停在「正在存」
  return Promise.race([promise, new Promise(res => setTimeout(() => res({ data: null, error: { message: 'timeout' } }), ms))]);
}
async function submitScore(stars, max) {
  if (!hasDB() || !Player.name) return null;
  try {
    const { data, error } = await withTimeout(supabaseClient.rpc('submit_tahun1_mt_pecahan_score', {
      p_play_code: Player.playCode, p_class_label: Player.classLabel, p_name: Player.name, p_stars: stars, p_max_stars: max,
    }), 9000);
    if (error) { console.warn('提交成绩失败', error); return null; }
    return data && data[0];
  } catch (e) { console.warn('提交成绩失败', e); return null; }
}
async function fetchBoard(scope) {
  if (!hasDB()) return null;
  try {
    let q = supabaseClient.from('tahun1_mt_pecahan_scores').select('name,class_label,stars,max_stars,play_code,updated_at');
    if (scope === 'class' && Player.playCode) q = q.eq('play_code', Player.playCode);
    const { data, error } = await withTimeout(q.limit(300), 9000);
    if (error) { console.warn('读取排行榜失败', error); return null; }
    return (data || []).sort((a, b) => (b.stars / b.max_stars - a.stars / a.max_stars) || (b.max_stars - a.max_stars) || (a.updated_at < b.updated_at ? -1 : 1)).slice(0, 30);
  } catch (e) { return null; }
}
async function loadRoster() {
  if (Player.rosterLoaded) return Player.roster;
  Player.rosterLoaded = true;
  try {
    if (typeof ClassCode !== 'undefined') {
      const list = await ClassCode.loadOrPrompt();
      Player.roster = Array.isArray(list) ? list : [];
    }
  } catch (e) { Player.roster = []; }
  return Player.roster;
}
function choosePlayer() {
  // 回传 Promise：选好名字（或访客）→ true；按「回首页」→ false
  return new Promise(async resolve => {
    const ov = $('#pickOverlay'), grid = $('#pickGrid'), form = $('#pickForm'), sub = $('#pickSub');
    ov.hidden = false; grid.innerHTML = ''; form.hidden = true; sub.textContent = '正在读取班级名单…';
    const done = ok => { ov.hidden = true; resolve(ok); };
    $('#btnPickGuest').onclick = () => { Player.name = ''; Player.playCode = null; Player.classLabel = '访客'; done(true); };
    $('#btnPickCancel').onclick = () => done(false);
    const roster = await loadRoster();
    if (roster.length) {
      const classes = new Set(roster.map(s => s.className));
      sub.textContent = `点你的名字${classes.size > 1 ? '' : `（${[...classes][0] || ''}）`}`;
      roster.forEach(st => {
        const b = document.createElement('button'); b.className = 'pick-name';
        b.innerHTML = `${st.seatNo != null ? `<small>${st.seatNo}</small>` : ''}<span></span>`;
        b.querySelector('span').textContent = st.nameZh || st.name || st.nameEn;
        b.onclick = () => {
          Sound.pick();
          Player.name = st.nameZh || st.name || st.nameEn; Player.playCode = st.playCode || null; Player.classLabel = st.className || '访客';
          done(true);
        };
        grid.appendChild(b);
      });
    } else {
      sub.textContent = hasDB() ? '没有班级代码也可以玩：写你的名字，就能上排行榜。' : '连不上排行榜，直接玩就好。';
      form.hidden = !hasDB();
      const inp = $('#pickName'); inp.value = '';
      form.onsubmit = e => {
        e.preventDefault();
        const n = inp.value.trim().slice(0, 20);
        if (!n) { inp.focus(); return; }
        Player.name = n; Player.playCode = null; Player.classLabel = '访客'; done(true);
      };
      if (!form.hidden) setTimeout(() => inp.focus(), 100);
    }
  });
}
async function openBoard() {
  const ov = $('#boardOverlay'), list = $('#boardList'), tabs = $$('#boardTabs button');
  ov.hidden = false;
  const hasClass = !!Player.playCode;
  tabs[0].disabled = !hasClass;
  let scope = hasClass ? 'class' : 'all';
  const render = async () => {
    tabs.forEach(t => t.classList.toggle('on', t.dataset.scope === scope));
    list.innerHTML = '<li class="empty">读取中…</li>';
    const rows = await fetchBoard(scope);
    if (rows === null) { list.innerHTML = '<li class="empty">连不上排行榜（可能是网络不稳），等一下再试。</li>'; return; }
    if (!rows.length) { list.innerHTML = '<li class="empty">还没有人上榜，快来当第一名！</li>'; return; }
    list.innerHTML = '';
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      if (Player.name && r.name === Player.name && r.play_code === Player.playCode) li.className = 'me';
      li.innerHTML = `<span class="rk">${i + 1}</span><span class="nm"></span><span class="st">★ ${r.stars}/${r.max_stars}</span>`;
      const nm = li.querySelector('.nm'); nm.textContent = r.name;
      if (scope === 'all') { const s = document.createElement('small'); s.textContent = r.class_label; nm.appendChild(s); }
      list.appendChild(li);
    });
  };
  tabs.forEach(t => (t.onclick = () => { if (!t.disabled) { scope = t.dataset.scope; render(); } }));
  $('#btnBoardClose').onclick = () => { ov.hidden = true; };
  render();
}

/* —— 入口 —— */
async function startMode(mode, { askPlayer = true } = {}) {
  if (mode === 'shop' && askPlayer) {
    const ok = await choosePlayer();
    if (!ok) { show('home'); return; }
  }
  G.mode = mode; G.stars = [];
  UI.modeTitle.textContent = { share: '分给朋友', shop: '燕菜铺开张', free: '自由切' }[mode];
  show('game');
  requestAnimationFrame(() => {
    if (mode === 'share') startShare(0);
    else if (mode === 'shop') startShop(0);
    else startFree('circle');
  });
}

$$('.mode-card').forEach(b => b.addEventListener('click', () => { Sound.ensure(); startMode(b.dataset.mode); }));
$$('[data-emoji]').forEach(el => el.appendChild(emojiEl(el.dataset.emoji, 46)));
$$('.shape-btn').forEach(b => b.addEventListener('click', () => startFree(b.dataset.shape)));
UI.btnMain.addEventListener('click', () => { Sound.ensure(); G.mainAction && G.mainAction(); });
UI.btnReset.addEventListener('click', () => { Sound.ensure(); G.resetAction && G.resetAction(); });
UI.btnSpeak.addEventListener('click', () => { const on = Voice.on; Voice.on = true; Voice.say(G.speakText, G.speakWho); Voice.on = on; });
$('#btnHome').addEventListener('click', () => { Voice.stop(); UI.end.hidden = true; show('home'); });
$('#btnEndHome').addEventListener('click', () => { UI.end.hidden = true; Voice.stop(); show('home'); });
$('#btnEndAgain').addEventListener('click', () => { UI.end.hidden = true; startMode(G.mode, { askPlayer: false }); });
$('#btnEndSwap').addEventListener('click', () => { UI.end.hidden = true; startMode(G.mode); });
$('#btnEndBoard').addEventListener('click', () => openBoard());
$('#btnHomeBoard').addEventListener('click', async () => { if (!Player.rosterLoaded && hasDB()) await loadRoster().then(r => { if (r.length) { Player.playCode = r[0].playCode; } }); openBoard(); });
UI.btnSnap.addEventListener('click', () => {
  scene.snap = !scene.snap; UI.btnSnap.setAttribute('aria-pressed', String(scene.snap));
  try { localStorage.setItem('pecahan-snap', scene.snap ? '1' : '0'); } catch (e) { /* 无痕模式 */ }
});
UI.btnSound.addEventListener('click', () => {
  Sound.on = !Sound.on; Voice.on = Sound.on; UI.btnSound.setAttribute('aria-pressed', String(Sound.on));
  if (!Sound.on) Voice.stop();
});
try { if (localStorage.getItem('pecahan-snap') === '0') { scene.snap = false; UI.btnSnap.setAttribute('aria-pressed', 'false'); } } catch (e) { /* 无痕模式 */ }

/* —— 首页燕菜 —— */
const hero = new Scene($('#heroCanvas'), { hero: true });
hero.setup({ shape: 'circle', flavor: 'watermelon', layout: 'center' });
hero.cutEnabled = false;
setInterval(() => { if (UI.home.classList.contains('is-active') && hero.pieces[0] && !(hero.pieces[0].wob > 0.2)) { hero.pieces[0].wob = 0.35; hero.pieces[0].wobT = 0; } }, 3200);

// 点子铺的「排行榜」按钮用 ?board=1 深链：直接打开排行榜（本班或全部）
try {
  if (new URLSearchParams(location.search).get('board') === '1') {
    (async () => {
      if (hasDB() && new URLSearchParams(location.search).get('code')) {
        const r = await loadRoster();
        if (r.length) Player.playCode = r[0].playCode;
      }
      openBoard();
    })();
  }
} catch (e) { /* 旧浏览器没有 URLSearchParams 就算了 */ }

// 测试用：暴露场景（不影响课堂使用）
window.__pecahan = { scene, hero, G, startMode, SHOP_ORDERS, SHARE_LEVELS, allVoiceLines, Player };
