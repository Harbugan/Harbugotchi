'use strict';
/* Pixel-art motor til Harbugotchi. Alt tegnes på et lille gitter og skaleres op med nearest-neighbour. */

const PAL = {
  '0': '#000000', '1': '#1d2b53', '2': '#7e2553', '3': '#008751', '4': '#ab5236', '5': '#5f574f', '6': '#c2c3c7',
  '7': '#fff1e8', '8': '#ff004d', '9': '#ffa300', a: '#ffec27', b: '#00e436', c: '#29adff', d: '#83769c', e: '#ff77a8',
  f: '#ffccaa', g: '#7ff0ff', h: '#2a62ff', i: '#ff9ac8',
  W: '#fff1e8', P: '#1d2b53', T: '#ff77a8', M: '#7e2553', R: '#ff004d',
};
const FORM_PAL = {
  pink:   { K: '#1d2b53', B: '#ff77a8', S: '#ff004d', H: '#fff1e8', C: '#ff004d' },
  orange: { K: '#1d2b53', B: '#ffa300', S: '#e8581c', H: '#ffec27', C: '#e8581c' },
  lilac:  { K: '#1d2b53', B: '#b98cff', S: '#7a4fd6', H: '#efe3ff', C: '#7a4fd6' },
  sick:   { K: '#1d2b53', B: '#9be564', S: '#3fae3a', H: '#e8ffb0', C: '#3fae3a' },
};

const mkGrid = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
function stamp(g, rows, x0, y0, flip = false) {
  rows.forEach((row, dy) => {
    const r = flip ? [...row].reverse() : [...row];
    r.forEach((ch, dx) => {
      const x = x0 + dx, y = y0 + dy;
      if (ch !== '.' && y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch;
    });
  });
}
const put = (g, x, y, ch) => { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch; };
function paint(ctx, g, pal = {}) {
  g.forEach((row, y) => row.forEach((ch, x) => {
    if (ch === '.') return;
    ctx.fillStyle = pal[ch] || PAL[ch]; ctx.fillRect(x, y, 1, 1);
  }));
}
function line(g, x0, y0, x1, y1, ch) { // Bresenham
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    put(g, x0, y0, ch);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/* ---------- krabbe-dele ---------- */
const EYE = {
  open: [
    '..KKKKK..',
    '.KhhhhhK.',
    'KhhWWhhhK',
    'KhhWWPPhK',
    'KhhhPPPcK',
    'KhhhPPPcK',
    'KchhPPgcK',
    '.KcgggcK.',
    '..KKKKK..'],
  closed: ['K.......K', '.KKKKKKK.'],
  happy: ['..KKKKK..', '.K.....K.', 'K.......K'],
};
const BROW = { sad: ['....KKK', 'KKKK...'], angry: ['KKKK...', '...KKKK'] };
const CLAW_BIG = [
  '.KKK...KKK.', 'KCCCK.KCCCK', 'KCHCK.KCCCK', 'KCCCKKKCCCK', 'KCCCCCCCCCK', '.KCCCCCCCK.', '..KKKKKKK..'];
const CLAW_SMALL = ['.KK.KK.', 'KCCKCCK', 'KCCKCCK', 'KCCCCCK', '.KKKKK.'];
const LEG = ['KSK', 'KSK', 'KSK', '.K.'];
const BOW = ['.KK.KK.', 'KaaKaaK', 'KaaOaaK', 'KaaKaaK', '.KK.KK.'];
const MOUTH = {
  cat:   ['K.KK.K', '.K..K.'],
  smile: ['KKKKKK', 'KMMMMK', '.KTTK.', '..KK..'],
  sad:   ['..KK..', '.K..K.'],
  open:  ['.KKKK.', 'KMMMMK', 'KMTTMK', 'KMTTMK', 'KMMMMK', '.KKKK.'],
  openS: ['.KKKK.', 'KMMMMK', '.KKKK.'],
  angry: ['K.K.K.', '.K.K.K'],
  o:     ['KK', 'KK'],
};
const STAGE_BODY = [null, { rx: 8, ry: 6, gap: 2, legs: 2, claw: CLAW_SMALL, bow: false },
  { rx: 11, ry: 7, gap: 2, legs: 3, claw: CLAW_SMALL, bow: false },
  { rx: 13, ry: 8, gap: 2, legs: 3, claw: CLAW_BIG, bow: true },
  { rx: 14, ry: 9, gap: 2, legs: 3, claw: CLAW_BIG, bow: true }];

function bodyShape(g, cx, cy, rx, ry) {
  const inside = (x, y) => ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1;
  const H = g.length, W = g[0].length, edge = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) {
    put(g, x, y, 'B');
    if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) edge.push([x, y]);
  }
  const shadeY = Math.floor(cy + ry * 0.55);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'B') {
    if (y > shadeY || (y === shadeY && (x + y) % 2)) g[y][x] = 'S';
  }
  edge.forEach(([x, y]) => put(g, x, y, 'K'));
  const hx = Math.round(cx - rx * .55), hy = Math.round(cy - ry * .45);
  [[0, 0], [1, 0], [2, 0], [0, 1]].forEach(([dx, dy]) => { if (g[hy + dy]?.[hx + dx] === 'B') put(g, hx + dx, hy + dy, 'H'); });
}

/** Tegner krabben på et 46x38-gitter. o: {stage, form, mood, f, blink} */
function drawCrab(cv, o) {
  const W = 46, H = 38, st = STAGE_BODY[o.stage] || STAGE_BODY[4];
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), g = mkGrid(W, H);
  const m = o.mood, f = o.f;
  const hop = m === 'happy' || m === 'love' || m === 'eat';
  const bob = hop ? [0, 2, 3, 2][f] : m === 'sleep' ? [0, 0, 1, 1][f] : m === 'sad' || m === 'tired' || m === 'hungry' ? 0 : [0, 0, 1, 1][f];
  const dy = -bob + (m === 'sad' || m === 'tired' || m === 'sick' ? 1 : 0);
  const dx = m === 'angry' ? [-1, 1, -1, 1][f] : 0;
  const cx = 23 + dx, ry = st.ry, rx = st.rx, cy = 31 - ry + dy;
  const top = Math.round(cy - ry), ex0 = 23 - 9 - st.gap / 2 + dx, ey = top - 5;

  // ben (bag kroppen). Gå-animation: hvert andet ben løftes
  const walking = o.walking;
  for (let i = 0; i < st.legs; i++) {
    const off = Math.round(rx * (0.2 + 0.32 * i));
    const lift = walking && (i + f) % 2 ? -1 : 0;
    stamp(g, LEG, Math.round(cx - off - 3 - (st.legs === 2 ? 1 : 0)), 31 + lift, false);
    stamp(g, LEG, Math.round(cx + off + (st.legs === 2 ? 1 : 0)), 31 + lift, false);
  }
  // arme + kløer
  const big = st.claw === CLAW_BIG, cw = st.claw[0].length, ch = st.claw.length;
  const upDy = hop ? [-2, 0, -2, 0][f] : m === 'angry' ? [-2, 0, -2, 0][f] : m === 'sad' || m === 'tired' || m === 'sleep' ? 3 : [0, 0, -1, 0][f];
  [-1, 1].forEach(side => {
    const cdy = side === 1 && !hop && m !== 'angry' ? [0, -1, 0, 0][f] : upDy;
    const clx = Math.round(cx + side * (rx + (big ? 3 : 2))) - (cw >> 1);
    const cly = Math.round(cy - 1) - ch + cdy;
    const ax = clx + (cw >> 1), ay = cly + ch - 1;
    const bx = Math.round(cx + side * rx * .8), by = Math.round(cy + 1);
    line(g, ax - 1, ay, bx - 1, by, 'K'); line(g, ax + 1, ay, bx + 1, by, 'K'); line(g, ax, ay, bx, by, 'C');
    stamp(g, st.claw, clx, cly);
  });
  bodyShape(g, cx, cy, rx, ry);

  // øjne
  const eyeAt = x => {
    const kind = o.blink && m !== 'sleep' ? 'closed' : MOODS_EYES[m] || 'open';
    stamp(g, EYE.open, x, ey);
    if (kind === 'open') return;
    // øjenlåg: samme klump som øjet, men i kropsfarve
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (g[ey + r]?.[x + c] && g[ey + r][x + c] !== 'K' && g[ey + r][x + c] !== '.') g[ey + r][x + c] = 'B';
    if (kind === 'closed') stamp(g, EYE.closed, x, ey + 5);
    else if (kind === 'happy') stamp(g, EYE.happy, x, ey + 3);
    else if (kind === 'tired') { stamp(g, EYE.open, x, ey); for (let r = 1; r <= 3; r++) for (let c = 1; c < 8; c++) if (g[ey + r][x + c] !== 'K' || r === 3) put(g, x + c, ey + r, r === 3 ? 'K' : 'B'); }
  };
  const exL = ex0, exR = ex0 + 9 + st.gap;
  eyeAt(exL); eyeAt(exR);
  const brow = MOODS_BROW[m];
  if (brow) {
    stamp(g, BROW[brow], exL + 1, ey - (brow === 'angry' ? 1 : 2));
    stamp(g, BROW[brow], exR + 1, ey - (brow === 'angry' ? 1 : 2), true);
  }
  if (m === 'sad' || m === 'cry') { const ty = ey + 9 + (f % 3); put(g, exL + 2, ty, 'g'); put(g, exL + 2, ty + 1, 'c'); }

  // blush + mund
  const by2 = ey + 9;
  [exL - 1, exR + 8 - 1].forEach(x => { put(g, x, by2 + 1, 'R'); put(g, x + 1, by2 + 1, 'R'); put(g, x + 2, by2 + 1, 'R'); put(g, x + 1, by2, 'R'); });
  let mouth = MOODS_MOUTH[m] || 'cat';
  if (mouth === 'chomp') mouth = f % 2 ? 'openS' : 'smile';
  if (mouth === 'o' && f > 1) mouth = 'o';
  const mm = MOUTH[mouth];
  stamp(g, mm, 23 - (mm[0].length >> 1) + dx, by2 + 1);

  if (st.bow) stamp(g, BOW, exR + 6, ey - 4);
  if (m === 'sick') { put(g, 9, ey + 1, 'g'); put(g, 8, ey + 2, 'g'); put(g, 9, ey + 2, 'c'); put(g, 10, ey + 2, 'g'); put(g, 9, ey + 3, 'c'); }

  // skygge
  ctx.fillStyle = 'rgba(29,43,83,.35)';
  const sw = rx * 2 + 4; ctx.fillRect(23 - (sw >> 1), 35, sw, 1); ctx.fillRect(23 - (sw >> 1) + 2, 36, sw - 4, 1);
  paint(ctx, g, FORM_PAL[o.form] || FORM_PAL.pink);
}
const MOODS_EYES = { sleep: 'closed', love: 'happy', eat: 'happy', tired: 'tired' };
const MOODS_BROW = { hungry: 'sad', sad: 'sad', cry: 'sad', sick: 'sad', angry: 'angry' };
const MOODS_MOUTH = { sleep: 'o', tired: 'o', happy: 'smile', love: 'smile', eat: 'chomp', neutral: 'cat', hungry: 'open', sad: 'sad', cry: 'sad', sick: 'sad', angry: 'angry' };

function drawEgg(cv, crack, f) {
  const W = 46, H = 38; cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), g = mkGrid(W, H), cx = 23, cy = 18;
  ctx.translate(0, 4);
  const inside = (x, y) => { const ry = y + .5 < cy ? 15 : 12; return ((x + .5 - cx) / 11) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1; };
  const edge = [];
  for (let y = 0; y < 32; y++) for (let x = 0; x < W; x++) if (inside(x, y)) {
    put(g, x, y, (x - y * .3 > 25 || y > 26) ? '6' : '7');
    if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) edge.push([x, y]);
  }
  [[17, 12, 'e'], [27, 17, 'c'], [20, 22, 'a'], [29, 25, 'd'], [16, 18, 'b'], [24, 9, 'a']].forEach(([x, y, c]) => { put(g, x, y, c); put(g, x + 1, y, c); put(g, x, y + 1, c); put(g, x + 1, y + 1, c); });
  [[17, 8], [17, 9], [18, 10]].forEach(([x, y]) => put(g, x, y, '7'));
  edge.forEach(([x, y]) => put(g, x, y, '1'));
  if (crack > 0) { const pts = [[16, 15], [18, 17], [20, 15], [22, 18], [24, 15], [26, 18], [28, 16]]; for (let i = 0; i < Math.min(pts.length - 1, 1 + crack * 6 | 0); i++) line(g, ...pts[i], ...pts[i + 1], '1'); }
  paint(ctx, g);
  ctx.fillStyle = 'rgba(29,43,83,.35)'; ctx.fillRect(13, 32, 20, 1); ctx.fillRect(15, 33, 16, 1);
}

/* ---------- ikoner ---------- */
const ICONS = {
  fish: ['...KKKK.....', '.KK9999KK..K', 'K9KW99999KKK', 'K999999999.K', '.KK9999KK.KK', '...KKKK....K'],
  candy: ['K...KKK...K', 'KK.KeWeK.KK', '.KKKeeeKKK.', 'KK.KeeeK.KK', 'K...KKK...K'],
  heart: ['.KK...KK.', 'K88KKK88K', 'KW8888888K'.slice(0,9), 'K8888888K', '.K88888K.', '..K888K..', '...K8K...', '....K....'],
  balloon: ['.KKKKK.', 'KeeWeeK', 'KeWeeeK', 'KeeeeeK', 'KeeeeeK', '.KeeeK.', '..KeK..', '...K...', '...K...', '..K....'],
  moon: ['...KKKK..', '..KaaaaK.', '.KaaKKKK.', '.KaaK....', '.KaaK....', '.KaaKKKK.', '..KaaaaK.', '...KKKK..'],
  sun: ['....a....', '.a..a..a.', '..aaaaa..', '.aaaaaaa.', 'aaaaaaaaa', '.aaaaaaa.', '..aaaaa..', '.a..a..a.', '....a....'],
  bang: ['.KKKK.', 'K8888K', 'K8W88K', 'K8888K', 'K8888K', '.K88K.', '..KK..', '.K88K.', '.K88K.', '..KK..'],
  bubbles: ['..KKK....', '.KgWgK...', 'KggggcK..', 'KgggcK.KK', '.KKKK.KWgK', '.....KggcK', '......KKK.'],
  pill: ['.KKKKKKKKK.', 'K88W8KaaaaK', 'K8888KaaaaK', 'K8888KaaaaK', '.KKKKKKKKK.'],
  info: ['.KKKKKKK.', 'KhhhhhhhK', 'KhhWWWhhK', 'KhhhhhWhK', 'KhhhWWhhK', 'KhhhWhhhK', 'KhhhhhhhK', 'KhhhWhhhK', '.KKKKKKK.'],
  bolt: ['...KKK.', '..KaaK.', '.KaaK..', 'KaaaaKK', '.KKaaK.', '...KaK.', '..KaK..', '..KK...'],
  poop: ['....K....', '...K4K...', '..K444K..', '..K4f4K..', '.K44444K.', 'K4444444K', 'KKKKKKKKK'],
  jelly: ['..KKKKK..', '.KiiiiiK.', 'KiiWiiiiK', 'KiiiiiiiK', 'KKKKKKKKK', '.K.K.K.K.', '.K.K.K.K.', '..K...K..'],
  star: ['..a..', '..a..', 'aaaaa', '..a..', '..a..'],
  zed: ['WWWW', '..W.', '.W..', 'WWWW'],
  shell: ['..KKK..', '.KfffK.', 'KfKfKfK', 'KffKffK', '.KKKKK.'],
  starfish: ['...K...', '..K9K..', 'KK999KK', '.K999K.', 'K99K99K', 'KKK.KKK'],
};
const iconCache = {};
function iconCanvas(name, scale = 3) {
  const rows = ICONS[name], c = document.createElement('canvas');
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  c.width = w; c.height = h; c.className = 'px';
  const ctx = c.getContext('2d'), g = mkGrid(w, h); stamp(g, rows, 0, 0);
  paint(ctx, g, FORM_PAL.pink);
  c.style.width = w * scale + 'px'; c.style.height = h * scale + 'px';
  return c;
}

/* ---------- baggrund ---------- */
const BANDS = ['#8be4ff', '#5fcfff', '#3bb9ff', '#29a1f5', '#1f86e0', '#1b6cc4'];
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; }

function drawScene(cv, w, h, frame) {
  if (cv._bg?.w !== w || cv._bg?.h !== h) {
    const bg = document.createElement('canvas'); bg.width = w; bg.height = h;
    const x = bg.getContext('2d'), rand = rng(7), sandTop = Math.floor(h * 0.8);
    for (let y = 0; y < h; y++) for (let px = 0; px < w; px++) {
      if (y >= sandTop) continue;
      const t = y / sandTop * (BANDS.length - 1), i = Math.min(BANDS.length - 2, Math.floor(t)), fr = t - i;
      let c = fr * 16 > BAYER[y % 4][px % 4] ? i + 1 : i;
      if (y < sandTop * 0.75 && (px * 2 + y) % 26 < 3) c = Math.max(0, c - 1); // lysstråler
      x.fillStyle = BANDS[c]; x.fillRect(px, y, 1, 1);
    }
    for (let px = 0; px < w; px++) {
      const edge = sandTop + Math.round(Math.sin(px * 0.22) * 1.3);
      for (let y = edge; y < h; y++) {
        x.fillStyle = y === edge ? '#fff1e8' : y < edge + 5 ? ((px + y) % 2 ? '#ffd27a' : '#ffe49b') : (px + y) % 2 ? '#ffd27a' : '#f2b95e';
        x.fillRect(px, y, 1, 1);
      }
    }
    for (let i = 0; i < w * 0.5; i++) {
      const px = Math.floor(rand() * w), y = sandTop + 4 + Math.floor(rand() * (h - sandTop - 4));
      x.fillStyle = rand() > .5 ? '#c98a3c' : '#fff1e8'; x.fillRect(px, y, 1, 1);
    }
    const sg = mkGrid(w, h);
    stamp(sg, ICONS.shell, Math.floor(w * 0.24), sandTop + 6); stamp(sg, ICONS.starfish, Math.floor(w * 0.78), sandTop + 7);
    paint(x, sg, FORM_PAL.pink); 
    cv._bg = { w, h, img: bg, sandTop };
  }
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), { img, sandTop } = cv._bg;
  ctx.drawImage(img, 0, 0);
  const weeds = [[0.06, 16, '#00e436', '#008751'], [0.12, 11, '#b8f26b', '#3fae3a'], [0.9, 14, '#00e436', '#008751'], [0.95, 9, '#ff77a8', '#ff004d']];
  weeds.forEach(([fx, hh, c1, c2]) => {
    const bx = Math.floor(w * fx);
    for (let j = 0; j < hh; j++) {
      const sway = Math.round(Math.sin(j * 0.5 + frame * 2.4) * (j / hh) * 1.6);
      ctx.fillStyle = c1; ctx.fillRect(bx + sway, sandTop + 4 - j, 2, 1);
      ctx.fillStyle = c2; ctx.fillRect(bx + sway + 2, sandTop + 4 - j, 1, 1);
    }
  });
}
