'use strict';
/* Harbugotchi v1 – en manga-krabbe i lommen */

const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

const scene = $('#scene'), fxLayer = $('#fx'), sayEl = $('#say');
const KEY = 'harbugotchi-v1';
// ?speed=60 spoler tiden frem (til test)
const SPEED = Math.max(1, +new URLSearchParams(location.search).get('speed') || 1);

const STAGES = [
  { id: 'egg',   label: 'Æg',     at: 0 },
  { id: 'baby',  label: 'Baby',   at: 0.5 },
  { id: 'kid',   label: 'Barn',   at: 45 },
  { id: 'teen',  label: 'Teen',   at: 360 },
  { id: 'adult', label: 'Voksen', at: 1440 },
];
const FORMS = {
  pink:   { name: 'Lyserød drøm', hi: '#ffc2d4', mid: '#ff7fa3', lo: '#ff4f84', claw: '#ff3d78' },
  orange: { name: 'Solskin',      hi: '#ffe0a8', mid: '#ffa44f', lo: '#ff7a2e', claw: '#ff6a1f' },
  lilac:  { name: 'Lilla stjerne', hi: '#e6d9ff', mid: '#b69cff', lo: '#8f6bff', claw: '#7c55f5' },
};

/* ---------- state ---------- */
const fresh = () => ({
  v: 1, last: Date.now(), age: 0, stage: 0, taps: 0, name: '',
  hunger: 70, happy: 80, energy: 90, clean: 100, disc: 30,
  sick: 0, asleep: false, poop: 0, poopIn: 0,
  mis: 0, misCool: 600, care: 0, careN: 0, form: 'pink', snacks: 0, muted: false,
});
let s = load();

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.v === 1) return { ...fresh(), ...d };
  } catch (e) { /* ingen gemt data */ }
  return fresh();
}
function save() {
  s.last = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* privat tilstand */ }
}

/* ---------- krabben (pixel) ---------- */
const crabCv = $('#crabCv'), bgCv = $('#bgCv');
let frame = 0, blink = false, walking = false;
const fx = { mood: null, until: 0 };
const flashMood = (mood, ms = 2200) => { fx.mood = mood; fx.until = performance.now() + ms; render(); setTimeout(render, ms + 30); };

function currentMood() {
  if (s.stage === 0) return 'egg';
  if (fx.mood && fx.until > performance.now()) return fx.mood;
  if (s.asleep) return 'sleep';
  if (s.sick) return 'sick';
  if (s.mis > 0) return 'angry';
  if (s.hunger < 25) return 'hungry';
  if (s.energy < 15) return 'tired';
  if (s.clean < 25 || s.happy < 30) return 'sad';
  if (s.happy > 70) return 'happy';
  return 'neutral';
}
function drawCrabNow() {
  const mood = currentMood();
  if (s.stage === 0) { drawEgg(crabCv, Math.max(s.taps / 12, s.age / STAGES[1].at) > .3 ? Math.max(s.taps / 12, s.age / STAGES[1].at) : 0, frame); return; }
  const form = mood === 'sick' ? 'sick' : (s.stage >= 3 ? s.form : 'pink');
  drawCrab(crabCv, { stage: s.stage, form, mood, f: frame % 4, blink, walking });
}
setInterval(() => { frame++; drawCrabNow(); }, 260);
setInterval(() => { blink = true; drawCrabNow(); setTimeout(() => { blink = false; drawCrabNow(); }, 160); }, 4200);

// baggrund (pixel-gitter følger scenens størrelse)
let sceneFrame = 0, P = 5;
function layoutScene() {
  const w = scene.clientWidth;
  P = Math.max(3, Math.round(w / 72));
  document.documentElement.style.setProperty('--p', P + 'px');
  drawBg();
}
function drawBg() {
  drawScene(bgCv, Math.ceil(scene.clientWidth / P), Math.ceil(scene.clientHeight / P), sceneFrame);
}
setInterval(() => { sceneFrame ^= 1; drawBg(); }, 700);
addEventListener('resize', layoutScene);

// pixel-ikoner i knapper og statuslinjer
$$('[data-ic]').forEach(el => el.appendChild(iconCanvas(el.dataset.ic, +el.dataset.s || 3)));

/* ---------- lyd ---------- */
let ac;
function tone(freq, t0, dur, type = 'sine', vol = 0.07) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime + t0);
  g.gain.setValueAtTime(vol, ac.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + dur + 0.02);
}
const SFX = {
  happy: [[660, 0, .1], [880, .1, .12], [1100, .22, .16]],
  nom:   [[300, 0, .07, 'square'], [380, .12, .07, 'square'], [300, .24, .07, 'square']],
  sad:   [[440, 0, .2], [330, .2, .3]],
  angry: [[180, 0, .15, 'sawtooth'], [140, .15, .2, 'sawtooth']],
  pop:   [[900, 0, .06, 'triangle'], [1300, .05, .08, 'triangle']],
  bad:   [[200, 0, .18, 'square']],
  evolve:[[523, 0, .12], [659, .12, .12], [784, .24, .12], [1047, .36, .3]],
  alert: [[880, 0, .08], [880, .15, .08]],
  sleep: [[500, 0, .2], [400, .2, .2], [300, .4, .3]],
};
function sfx(name) {
  if (s.muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    SFX[name].forEach(([f, t, d, ty]) => tone(f, t, d, ty));
  } catch (e) { /* lyd er valgfri */ }
}

/* ---------- små hjælpere til scenen ---------- */
let sayTimer;
function say(text, ms = 2600) {
  sayEl.textContent = text; sayEl.classList.add('on');
  clearTimeout(sayTimer); sayTimer = setTimeout(() => sayEl.classList.remove('on'), ms);
}
function spawn(icon, cls = '', x, y) {
  const r = scene.getBoundingClientRect();
  const el = iconCanvas(icon, P);
  if (cls) el.classList.add(cls);
  el.style.left = (x ?? rnd(.3, .7) * r.width) + 'px';
  el.style.top = (y ?? rnd(.35, .6) * r.height) + 'px';
  el.style.setProperty('--dx', Math.round(rnd(-30, 30) / P) * P + 'px');
  fxLayer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}
const burst = (icon, n = 5) => { for (let i = 0; i < n; i++) setTimeout(() => spawn(icon), i * 110); };

// bobler i baggrunden
(function bubbles() {
  const wrap = $('#bubbles');
  for (let i = 0; i < 9; i++) {
    const b = document.createElement('b'), d = rnd(10, 22), z = Math.random() < .5;
    b.className = z ? 's' : '';
    b.style.cssText = `left:${Math.round(rnd(0, 96))}%;width:calc(var(--p)*${z ? 2 : 3});height:calc(var(--p)*${z ? 2 : 3});animation-duration:${d}s;animation-delay:${-rnd(0, d)}s`;
    wrap.appendChild(b);
  }
})();

/* ---------- spillogik ---------- */
const STAGE_LINES = {
  1: 'Hej verden! ', 2: 'Jeg er blevet større!', 3: 'Jeg er teenager nu ', 4: 'Jeg er voksen! Tak for alt ',
};

function hatch() {
  s.stage = 1; s.taps = 0; s.age = Math.max(s.age, STAGES[1].at);
  $('#flash').classList.add('go'); sfx('evolve');
  setTimeout(() => $('#flash').classList.remove('go'), 1200);
  if (!s.name) setTimeout(askName, 700);
}
function askName() {
  const sheet = $('#nameSheet'); sheet.hidden = false;
  $('#nameInput').focus();
}
$('#nameForm').addEventListener('submit', e => {
  e.preventDefault();
  s.name = $('#nameInput').value.trim() || 'Krabbi';
  $('#nameSheet').hidden = true; save(); render(); say(`Hej, jeg hedder ${s.name}! `, 3500); sfx('happy');
});

function evolve(to) {
  s.stage = to;
  if (to >= 3) {
    const avg = s.care / Math.max(1, s.careN);
    s.form = avg >= 62 ? 'pink' : avg >= 40 ? 'orange' : 'lilac';
  }
  $('#flash').classList.add('go'); sfx('evolve');
  setTimeout(() => $('#flash').classList.remove('go'), 1200);
  burst('star', 8);
  say(STAGE_LINES[to] || '', 4000);
}

/** Ét tidsskridt på dt sekunder. off = mens appen var lukket (mildere). */
function step(dt, off) {
  const m = dt / 60; s.age += m;
  if (s.stage === 0) { if (s.age >= STAGES[1].at || s.taps >= 12) hatch(); return; }
  const k = off ? 0.5 : 1;

  if (s.asleep) {
    s.energy += 2.6 * m;
    s.hunger -= 0.25 * m * k;
    s.clean -= 0.08 * m * k;
    if (s.energy >= 100) { s.energy = 100; wake(false); say('Godmorgen! ', 3000); }
  } else {
    s.hunger -= 0.8 * m * k;
    s.happy -= 0.5 * m * k;
    s.energy -= 0.45 * m * k;
    s.clean -= (0.25 + 0.5 * s.poop) * m * k;
    if (s.hunger < 25 || s.clean < 25 || s.energy < 15) s.happy -= 0.4 * m * k;
    if (s.sick) s.happy -= 0.6 * m * k;

    if (s.poopIn > 0 && (s.poopIn -= dt) <= 0) { s.poopIn = 0; if (s.poop < 3) s.poop++; }

    if (s.mis > 0) {
      s.mis -= dt;
      if (s.mis <= 0) { s.mis = 0; s.happy -= 5; s.disc -= 5; say('Hmpf. Ingen lagde mærke til mig…'); }
    } else if (!off && s.stage >= 2) {
      if ((s.misCool -= dt) <= 0) {
        s.mis = 120; s.misCool = rnd(600, 1500) * (1 + (50 - s.disc) / 100);
        say(pick(['Jeg gider IKKE! ', 'Boooring! Jeg driller!', 'Jeg gør hvad jeg vil!']));
        sfx('angry');
      }
    }
  }
  if (off) { s.hunger = Math.max(s.hunger, 15); s.happy = Math.max(s.happy, 20); s.clean = Math.max(s.clean, 15); if (!s.asleep) s.energy = Math.max(s.energy, 20); }

  // sygdom: snavs, sult eller for meget slik
  if (!s.sick && (s.clean < 20 || s.hunger < 5 || s.snacks > 4) && Math.random() < 1 - Math.exp(-dt / 1200)) {
    s.sick = 2; say('Av… jeg har det dårligt '); sfx('sad');
  }
  s.snacks = Math.max(0, s.snacks - m / 10);

  ['hunger', 'happy', 'energy', 'clean', 'disc'].forEach(k2 => s[k2] = clamp(s[k2]));
  s.care += (s.hunger + s.happy + s.clean) / 3 * m; s.careN += m;

  let st = 0; STAGES.forEach((x, i) => { if (s.age >= x.at) st = i; });
  if (st > s.stage) evolve(st);
}

function wake(grumpy) {
  s.asleep = false;
  if (grumpy) { s.happy = clamp(s.happy - 8); say('Zzz… hey! Jeg sov! '); flashMood('cry', 1800); }
}

/* ---------- handlinger ---------- */
const ready = () => {
  if (s.stage === 0) { say('Ægget skal bare have lidt tid…'); return false; }
  return true;
};
const needsWake = () => { if (s.asleep) { wake(true); sfx('sad'); return true; } return false; };

function feed(type) {
  if (!ready() || needsWake()) return;
  if (s.mis > 0) { say('Nej! Jeg vil ikke have mad!'); sfx('angry'); return; }
  if (type === 'meal' && s.hunger >= 92) { say('Jeg er helt mæt!'); return; }
  if (type === 'snack' && s.sick) { say('Jeg har ondt i maven…'); return; }
  if (type === 'meal') { s.hunger += 35; s.happy += 3; }
  else { s.hunger += 10; s.happy += 12; s.snacks++; }
  if (!s.poopIn) s.poopIn = rnd(300, 900);
  spawn(type === 'meal' ? 'fish' : 'candy', 'fall');
  setTimeout(() => { sfx('nom'); flashMood('eat', 1900); burst('star', 3); say(pick(['Nam nam!', 'Mmmm! ', 'Mums!'])); }, 600);
  clampAll(); render();
}

function cuddle(fromPet) {
  if (!ready()) return;
  if (s.asleep) { say('Shh… den sover '); return; }
  if (s.mis > 0) { s.disc = clamp(s.disc - 3); say('Hmph! Ikke nu!'); return; }
  s.happy += fromPet ? 1.2 : 9; clampAll();
  flashMood('love', 1600);
  if (!fromPet) { burst('heart', 5); say(pick(['Hihi! ', 'Jeg elsker dig!', 'Kram!'])); sfx('happy'); }
  render();
}

function scold() {
  if (!ready() || needsWake()) return;
  if (s.mis > 0) {
    s.mis = 0; s.disc += 18; s.happy -= 4; clampAll();
    say('Undskyld… jeg skal nok være sød'); flashMood('sad', 2500); sfx('sad');
    if (navigator.vibrate) navigator.vibrate(60);
  } else {
    s.happy -= 14; clampAll();
    say('Buhuu! Hvad har jeg gjort?! '); flashMood('cry', 2800); sfx('sad');
  }
  render();
}

function clean() {
  if (!ready() || needsWake()) return;
  if (!s.poop && s.clean > 90) { say('Jeg er allerede ren!'); return; }
  s.poop = 0; s.clean = 100; s.happy += 4; clampAll();
  spawn('bubbles', 'sweep'); burst('star', 4); sfx('pop'); say('Pip pip, så frisk! '); render();
}

function medicine() {
  if (!ready() || needsWake()) return;
  if (!s.sick) { say('Jeg er ikke syg!'); return; }
  s.sick--; sfx('happy'); burst('star', 2);
  say(s.sick ? 'Bleh! Endnu en dosis…' : 'Uh, jeg har det meget bedre! '); render();
}

function sleepToggle() {
  if (!ready()) return;
  if (s.asleep) { wake(s.energy < 60); render(); return; }
  if (s.energy >= 98) { say('Jeg er slet ikke træt!'); return; }
  s.asleep = true; sfx('sleep'); say('Godnat ', 1800); render();
}

function info() {
  const mins = Math.floor(s.age), d = Math.floor(mins / 1440), h = Math.floor(mins % 1440 / 60), mm = mins % 60;
  const avg = Math.round(s.care / Math.max(1, s.careN));
  const rows = [
    ['Alder', `${d ? d + ' d ' : ''}${h} t ${mm} min`],
    ['Trin', STAGES[s.stage].label],
    ['Opdragelse', ''.repeat(Math.round(s.disc / 20)) + ''.repeat(5 - Math.round(s.disc / 20))],
    ['Pleje (snit)', avg + '%'],
  ];
  if (s.stage >= 3) rows.push(['Udseende', FORMS[s.form].name]);
  $('#infoTitle').textContent = s.name || 'Ægget';
  $('#infoList').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  $('#infoSheet').hidden = false;
}

const clampAll = () => ['hunger', 'happy', 'energy', 'clean', 'disc'].forEach(k => s[k] = clamp(s[k]));

/* ---------- minispil: fang bobler ---------- */
function bubbleCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 11; c.className = 'px';
  const x = c.getContext('2d'), g = mkGrid(11, 11);
  stamp(g, ['...77777...', '..7.....7..', '.7.......7.', '7...ggg...7', '7..g.....7.'.slice(0, 11), '7.........7', '7.........7', '7.........7', '.7.......7.', '..7.....7..', '...77777...'], 0, 0);
  [[2, 3], [2, 2], [3, 2]].forEach(([a, b]) => put(g, a + 1, b + 1, 'W'));
  paint(x, g, FORM_PAL.pink);
  c.style.width = c.style.height = '66px';
  return c;
}
function play() {
  if (!ready() || needsWake()) return;
  if (s.sick) { say('Jeg er for syg til at lege…'); return; }
  if (s.mis > 0) { say('Jeg gider ikke lege!'); return; }
  if (s.energy < 25) { say('Jeg er for træt '); return; }

  const game = $('#game'), field = $('#gameField');
  let score = 0, left = 15, over = false;
  const scoreEl = $('#gameScore'), timeEl = $('#gameTime');
  game.hidden = false; field.innerHTML = ''; scoreEl.textContent = 0; timeEl.textContent = left;

  const spawnB = () => {
    if (over) return;
    const bad = Math.random() < 0.22, b = bad ? iconCanvas('jelly', 7) : bubbleCanvas();
    b.classList.add('b');
    b.style.left = rnd(4, 80) + '%'; b.style.animationDuration = rnd(2.6, 4.2) + 's';
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); if (over || b.dataset.hit) return; b.dataset.hit = 1;
      const r = field.getBoundingClientRect(), br = b.getBoundingClientRect();
      const p = document.createElement('div'); p.className = 'pop';
      p.style.left = (br.left - r.left + 16) + 'px'; p.style.top = (br.top - r.top) + 'px';
      p.textContent = bad ? '-2' : '+1'; field.appendChild(p); setTimeout(() => p.remove(), 800);
      score = Math.max(0, score + (bad ? -2 : 1)); scoreEl.textContent = score;
      sfx(bad ? 'bad' : 'pop'); if (bad && navigator.vibrate) navigator.vibrate(40);
      b.remove();
    });
    b.addEventListener('animationend', () => b.remove());
    field.appendChild(b);
  };
  const spawner = setInterval(spawnB, 480);
  const clock = setInterval(() => {
    timeEl.textContent = --left;
    if (left > 0) return;
    over = true; clearInterval(spawner); clearInterval(clock);
    const gain = Math.min(45, score * 3);
    s.happy += gain; s.energy -= 15; s.hunger -= 8; clampAll();
    const stars = score >= 14 ? '***' : score >= 8 ? '**' : '*';
    const end = document.createElement('div'); end.className = 'end';
    end.innerHTML = `<div>${stars}</div><div>${score} BOBLER!</div><button>FÆRDIG</button>`;
    end.querySelector('button').onclick = () => {
      game.hidden = true; render();
      if (score >= 8) { flashMood('love', 2500); burst('heart', 5); say('Det var SÅ sjovt! '); sfx('happy'); }
      else say('Hihi, det var okay!');
    };
    field.appendChild(end);
  }, 1000);
}

/* ---------- rendering ---------- */
function render() {
  $('#crabWrap').dataset.stage = STAGES[s.stage].id;
  $('#nameLabel').textContent = (s.name || 'Harbugotchi').toUpperCase();
  $('#stageLabel').textContent = STAGES[s.stage].label.toUpperCase() + (s.stage >= 3 ? ' · ' + FORMS[s.form].name.toUpperCase() : '');

  $$('.stat').forEach(el => {
    const v = s[el.dataset.k], bar = $('.bar', el);
    if (!bar.children.length) bar.innerHTML = '<b></b>'.repeat(10);
    const lit = Math.ceil(v / 10);
    [...bar.children].forEach((c, i) => c.classList.toggle('on', i < lit));
    bar.className = 'bar' + (v < 25 ? ' low' : v < 55 ? ' mid' : '');
    el.classList.toggle('low', s.stage > 0 && v < 25);
  });

  scene.classList.toggle('dark', s.asleep);
  $('#sleepBtn').innerHTML = s.asleep ? '' : '';
  const sb = $('#sleepBtn'); sb.replaceChildren();
  const ic = document.createElement('i'); ic.appendChild(iconCanvas(s.asleep ? 'sun' : 'moon', 3));
  sb.append(ic, s.asleep ? 'VÅGN' : 'SOV');

  const alert = $('#alert'), need = s.mis > 0 || (s.stage > 0 && !s.asleep && (s.hunger < 25 || s.clean < 25 || s.sick));
  alert.hidden = !need;
  if (need && !alert.firstChild) alert.appendChild(iconCanvas('bang', P));

  const poops = $('#poops');
  if (poops.children.length !== s.poop) {
    poops.replaceChildren();
    for (let i = 0; i < s.poop; i++) {
      const p = iconCanvas('poop', P); p.style.left = [8, 74, 42][i] + '%'; poops.appendChild(p);
    }
  }
  $$('#actions button').forEach(b => { if (b.dataset.act !== 'info') b.disabled = s.stage === 0; });
  $('#soundBtn').textContent = s.muted ? 'OFF' : 'ON';
  drawCrabNow();
}

/* ---------- loop ---------- */
function tick() {
  const now = Date.now();
  const dt = Math.max(0, (now - s.last) / 1000) * SPEED;
  if (dt > 8 * SPEED) catchUp(dt); else step(dt, false);
  s.last = now; render();
}
function catchUp(total) {
  total = Math.min(total, 72 * 3600);
  const wasMis = s.mis; s.mis = 0;
  for (let d = total; d > 0; d -= 60) step(Math.min(d, 60), true);
  if (!wasMis) s.mis = 0;
  if (total > 600 && s.stage > 0) setTimeout(() => say(s.asleep ? 'Zzz…' : 'Du er tilbage! ', 3500), 400);
}

setInterval(tick, 1000);
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => document.hidden ? save() : tick());
addEventListener('pagehide', save);

// småsnak og opmærksomhed
setInterval(() => {
  if (s.stage === 0 || s.asleep || fx.until > performance.now() || !$('#game').hidden) return;
  if (s.sick) return say('Jeg har det dårligt…');
  if (s.hunger < 25) { sfx('alert'); return say(pick(['Jeg er SÅ sulten!', 'Mad… tak…', 'Min mave knurrer '])); }
  if (s.energy < 15) return say('Jeg er træt… kan du slukke lyset?');
  if (s.clean < 25 || s.poop >= 2) return say('Det lugter… ');
  if (s.happy < 30) return say(pick(['Jeg føler mig ensom…', 'Kan vi lege?']));
  if (Math.random() < .5) say(pick(['La la la ', 'Sideways er bedst!', 'Se mine kløer! ', 'Jeg elsker bobler', s.name ? `${s.name} er glad!` : 'Hej!']), 2200);
}, 18000);

// krabber går sidelæns
setInterval(() => {
  if (s.stage === 0 || s.asleep || s.mis > 0) return;
  const w = $('#crabWrap'), slide = $('#crabSlide');
  const max = Math.max(20, scene.clientWidth * .22);
  slide.style.transform = `translateX(${rnd(-max, max)}px)`;
  w.classList.add('walking'); setTimeout(() => w.classList.remove('walking'), 1600);
}, 6000);

/* ---------- input ---------- */
const crabWrap = $('#crabWrap');
let petting = null, petDist = 0;
crabWrap.addEventListener('pointerdown', e => {
  if (s.stage === 0) {
    s.taps++; sfx('pop'); crabWrap.animate([{ transform: 'rotate(-5deg)' }, { transform: 'rotate(5deg)' }, { transform: 'none' }], 220);
    if (s.taps >= 12) { step(0, false); }
    render(); return;
  }
  petting = { x: e.clientX, y: e.clientY }; petDist = 0;
  crabWrap.setPointerCapture(e.pointerId);
});
crabWrap.addEventListener('pointermove', e => {
  if (!petting) return;
  petDist += Math.hypot(e.clientX - petting.x, e.clientY - petting.y);
  petting = { x: e.clientX, y: e.clientY };
  if (petDist > 70) {
    petDist = 0; cuddle(true);
    const r = scene.getBoundingClientRect(); spawn('heart', '', e.clientX - r.left, e.clientY - r.top);
    sfx('happy');
  }
});
const endPet = e => {
  if (petting && petDist < 8 && s.stage > 0) { // et lille tryk = et pip
    if (s.asleep) say('Zzz…'); else { say(pick(['Hihi!', 'Det kilder!', 'Pip!'])); flashMood('happy', 900); }
  }
  petting = null;
};
crabWrap.addEventListener('pointerup', endPet);
crabWrap.addEventListener('pointercancel', () => petting = null);

$('#actions').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  ({
    feed: () => { if (ready() && !needsWake()) $('#foodSheet').hidden = false; },
    cuddle: () => cuddle(false), play, sleep: sleepToggle,
    scold, clean, medicine, info,
  })[b.dataset.act]();
});
$('#foodSheet').addEventListener('click', e => {
  const f = e.target.closest('[data-food]');
  if (f || e.target.closest('[data-close]') || e.target.id === 'foodSheet') $('#foodSheet').hidden = true;
  if (f) feed(f.dataset.food);
});
$('#infoSheet').addEventListener('click', e => {
  if (e.target.closest('[data-close]') || e.target.id === 'infoSheet') $('#infoSheet').hidden = true;
});
$('#resetBtn').addEventListener('click', () => {
  if (confirm('Start forfra med et nyt æg? Din krabbe forsvinder.')) { s = fresh(); save(); location.reload(); }
});
$('#soundBtn').addEventListener('click', () => { s.muted = !s.muted; sfx('happy'); render(); });

/* ---------- start ---------- */
(function boot() {
  const away = (Date.now() - s.last) / 1000 * SPEED;
  if (away > 8) catchUp(away);
  s.last = Date.now();
  layoutScene();
  render();
  if (s.stage > 0 && !s.name) askName();
  if (s.stage === 0) say('Et æg! Tryk på det for at hjælpe det ud ', 4500);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

window.harbu = { get s() { return s; }, step, render, flashMood, hatch, evolve, say };
