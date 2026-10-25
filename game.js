'use strict';
/* Harbugotchi v1 – en manga-krabbe i lommen */

const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

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

/* ---------- krabben (SVG) ---------- */
function eye(side, cx, cy) {
  const sx = side === 'l' ? 1 : -1; // brynenes retning spejles
  return `
  <g class="eye ${side}" transform="translate(${cx},${cy})">
    <g class="e-open">
      <ellipse rx="24" ry="26" fill="#fff" stroke="#3b2a6b" stroke-width="2.5"/>
      <g class="iris-g">
        <ellipse rx="17" ry="20" fill="url(#iris)"/>
        <ellipse rx="9" ry="12" cy="1" fill="#2a1b5e"/>
        <circle r="6.5" cx="-6" cy="-8" fill="#fff"/>
        <circle r="3.2" cx="7" cy="7" fill="#fff" opacity=".9"/>
        <circle r="1.7" cx="4" cy="-12" fill="#fff"/>
      </g>
      <path d="M-25,-6 Q0,-36 25,-6" stroke="#3b2a6b" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M${-25 * sx},-6 l${-6 * sx},-5" stroke="#3b2a6b" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g class="e-lid" clip-path="url(#ec)"><rect x="-26" y="-30" width="52" height="27" fill="var(--c-mid)"/><path d="M-26,-3 L26,-3" stroke="#3b2a6b" stroke-width="4"/></g>
    <path class="e-sleep" d="M-16,2 Q0,15 16,2" stroke="#3b2a6b" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path class="e-happy" d="M-16,8 Q0,-14 16,8" stroke="#3b2a6b" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path class="brow sad" d="M${-22 * sx},-33 L${8 * sx},-42" stroke="#3b2a6b" stroke-width="4" stroke-linecap="round"/>
    <path class="brow angry" d="M${-22 * sx},-41 L${8 * sx},-28" stroke="#3b2a6b" stroke-width="5" stroke-linecap="round"/>
    ${side === 'l' ? '<path class="tear" d="M-14,24 Q-20,36 -14,40 Q-8,36 -14,24Z" fill="#7fdcff" stroke="#fff" stroke-width="1.5"/>' : ''}
  </g>`;
}
function arm(side) {
  const m = side === 'l' ? 1 : -1;
  const x = v => 120 + (v - 120) * m;
  return `
  <g class="arm ${side}">
    <path d="M${x(62)},132 Q${x(38)},130 ${x(34)},108" stroke="var(--c-lo)" stroke-width="9" fill="none" stroke-linecap="round"/>
    <g transform="translate(${x(32)},98) rotate(${-14 * m})">
      <path d="M0,8 C-21,6 -26,-18 -10,-30 C-4,-25 -2,-19 0,-13 C2,-19 4,-25 10,-30 C26,-18 21,6 0,8Z"
            fill="var(--c-claw)" stroke="var(--c-lo)" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="-9" cy="-14" rx="4" ry="7" fill="#fff" opacity=".4" transform="rotate(15 -9 -14)"/>
    </g>
  </g>`;
}
function leg(side, i) {
  const m = side === 'l' ? 1 : -1;
  const x = v => 120 + (v - 120) * m;
  const P = [
    [`M${x(66)},152 Q${x(38)},150 ${x(32)},172`],
    [`M${x(72)},164 Q${x(48)},170 ${x(46)},190`],
    [`M${x(84)},174 Q${x(68)},186 ${x(68)},202`],
  ][i];
  return `<path class="leg ${(i + (m > 0 ? 0 : 1)) % 2 ? 'a' : 'b'}" d="${P}" stroke="var(--c-lo)" stroke-width="7.5" fill="none" stroke-linecap="round"/>`;
}
function crabMarkup() {
  return `
  <defs>
    <radialGradient id="body" cx="35%" cy="28%" r="85%">
      <stop offset="0" style="stop-color:var(--c-hi)"/><stop offset=".5" style="stop-color:var(--c-mid)"/><stop offset="1" style="stop-color:var(--c-lo)"/>
    </radialGradient>
    <linearGradient id="iris" x1="0" y1="-1" x2="0" y2="1">
      <stop offset="0" stop-color="#6a4cff"/><stop offset=".6" stop-color="#34b4ff"/><stop offset="1" stop-color="#6dffe0"/>
    </linearGradient>
    <clipPath id="ec"><ellipse rx="24" ry="26"/></clipPath>
    <clipPath id="mc"><path d="M-12,-4 Q0,22 12,-4 Z"/></clipPath>
  </defs>
  <ellipse cx="120" cy="204" rx="70" ry="7" fill="#000" opacity=".1"/>
  ${[0, 1, 2].map(i => leg('l', i) + leg('r', i)).join('')}
  ${arm('l')}${arm('r')}
  <ellipse cx="120" cy="138" rx="67" ry="47" fill="url(#body)" stroke="var(--c-lo)" stroke-width="3.5"/>
  <ellipse cx="90" cy="116" rx="20" ry="8" fill="#fff" opacity=".45" transform="rotate(-22 90 116)"/>
  <g fill="var(--c-lo)" opacity=".28"><circle cx="150" cy="170" r="4"/><circle cx="165" cy="154" r="3"/><circle cx="82" cy="172" r="3.5"/><circle cx="72" cy="156" r="2.5"/><circle cx="120" cy="176" r="3"/></g>
  <ellipse cx="72" cy="140" rx="12" ry="7" fill="#ff5c9a" opacity=".5"/>
  <ellipse cx="168" cy="140" rx="12" ry="7" fill="#ff5c9a" opacity=".5"/>
  <g class="hash" stroke="#ff3d7a" stroke-width="2.5" stroke-linecap="round" opacity=".7">
    <path d="M64,136 l-3,8 M72,134 l-3,9 M80,136 l-3,8 M160,136 l-3,8 M168,134 l-3,9 M176,136 l-3,8"/>
  </g>
  ${eye('l', 88, 78)}${eye('r', 152, 78)}
  <g transform="translate(120,146)" stroke="#6b1d45" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path class="m cat" d="M-12,-2 Q-6,9 0,-2 Q6,9 12,-2" stroke-width="3.5"/>
    <g class="m smile"><path d="M-12,-4 Q0,22 12,-4 Z" fill="#6b1d45" stroke-width="3"/><ellipse cy="8" rx="7" ry="5" fill="#ff7a9c" stroke="none" clip-path="url(#mc)"/></g>
    <path class="m sad" d="M-10,8 Q0,-6 10,8" stroke-width="3.5"/>
    <g class="m open"><ellipse cy="6" rx="9" ry="11" fill="#6b1d45" stroke="none"/><ellipse cy="12" rx="6" ry="4" fill="#ff7a9c" stroke="none"/></g>
    <path class="m angry" d="M-12,6 Q0,-4 12,6 M-8,3 l3,6 M8,3 l-3,6" stroke-width="3.5"/>
    <ellipse class="m o" cy="4" rx="4" ry="5" fill="#6b1d45" stroke="none"/>
  </g>
  <g class="bow" transform="translate(178,52) rotate(18)">
    <path d="M0,0 L-24,-14 L-24,14Z M0,0 L24,-14 L24,14Z" fill="#ffd93d" stroke="#f5a300" stroke-width="3" stroke-linejoin="round"/>
    <circle r="6" fill="#ff6fa5" stroke="#f5a300" stroke-width="2"/>
  </g>
  <g class="sweat"><path d="M40,52 Q32,68 40,74 Q48,68 40,52Z" fill="#7fdcff" stroke="#fff" stroke-width="2"/></g>`;
}
const crabSvg = $('#crabSvg');
crabSvg.innerHTML = crabMarkup();

const MOODS = {
  sleep:  { eyes: 'closed', mouth: 'o' },
  happy:  { eyes: 'open',   mouth: 'smile' },
  love:   { eyes: 'happy',  mouth: 'smile' },
  neutral:{ eyes: 'open',   mouth: 'cat' },
  hungry: { eyes: 'open',   mouth: 'open',  brow: 'sad' },
  sad:    { eyes: 'open',   mouth: 'sad',   brow: 'sad', tear: 1 },
  cry:    { eyes: 'open',   mouth: 'sad',   brow: 'sad', tear: 1 },
  angry:  { eyes: 'open',   mouth: 'angry', brow: 'angry' },
  eat:    { eyes: 'happy',  mouth: 'chomp' },
  tired:  { eyes: 'tired',  mouth: 'o' },
  sick:   { eyes: 'open',   mouth: 'sad',   brow: 'sad' },
};
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
const scene = $('#scene'), fxLayer = $('#fx'), sayEl = $('#say');
let sayTimer;
function say(text, ms = 2600) {
  sayEl.textContent = text; sayEl.classList.add('on');
  clearTimeout(sayTimer); sayTimer = setTimeout(() => sayEl.classList.remove('on'), ms);
}
function spawn(emoji, cls = '', x, y) {
  const r = scene.getBoundingClientRect();
  const el = document.createElement('span');
  el.textContent = emoji; if (cls) el.className = cls;
  el.style.left = (x ?? rnd(.3, .7) * r.width) + 'px';
  el.style.top = (y ?? rnd(.35, .6) * r.height) + 'px';
  el.style.setProperty('--dx', rnd(-30, 30) + 'px');
  fxLayer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}
const burst = (emoji, n = 5) => { for (let i = 0; i < n; i++) setTimeout(() => spawn(emoji), i * 110); };

// bobler i baggrunden
(function bubbles() {
  const wrap = $('#bubbles');
  for (let i = 0; i < 12; i++) {
    const b = document.createElement('span'), d = rnd(8, 20), z = rnd(6, 20);
    b.style.cssText = `left:${rnd(0, 96)}%;width:${z}px;height:${z}px;animation-duration:${d}s;animation-delay:${-rnd(0, d)}s`;
    wrap.appendChild(b);
  }
})();

/* ---------- spillogik ---------- */
const STAGE_LINES = {
  1: 'Hej verden! 🦀', 2: 'Jeg er blevet større!', 3: 'Jeg er teenager nu 😎', 4: 'Jeg er voksen! Tak for alt 💖',
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
  $('#nameSheet').hidden = true; save(); render(); say(`Hej, jeg hedder ${s.name}! 💖`, 3500); sfx('happy');
});

function evolve(to) {
  s.stage = to;
  if (to >= 3) {
    const avg = s.care / Math.max(1, s.careN);
    s.form = avg >= 62 ? 'pink' : avg >= 40 ? 'orange' : 'lilac';
  }
  $('#flash').classList.add('go'); sfx('evolve');
  setTimeout(() => $('#flash').classList.remove('go'), 1200);
  burst('✨', 8);
  say(STAGE_LINES[to] || '✨', 4000);
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
    if (s.energy >= 100) { s.energy = 100; wake(false); say('Godmorgen! ☀️', 3000); }
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
        say(pick(['Jeg gider IKKE! 😤', 'Boooring! Jeg driller!', 'Jeg gør hvad jeg vil!']));
        sfx('angry');
      }
    }
  }
  if (off) { s.hunger = Math.max(s.hunger, 15); s.happy = Math.max(s.happy, 20); s.clean = Math.max(s.clean, 15); if (!s.asleep) s.energy = Math.max(s.energy, 20); }

  // sygdom: snavs, sult eller for meget slik
  if (!s.sick && (s.clean < 20 || s.hunger < 5 || s.snacks > 4) && Math.random() < 1 - Math.exp(-dt / 1200)) {
    s.sick = 2; say('Av… jeg har det dårligt 🤒'); sfx('sad');
  }
  s.snacks = Math.max(0, s.snacks - m / 10);

  ['hunger', 'happy', 'energy', 'clean', 'disc'].forEach(k2 => s[k2] = clamp(s[k2]));
  s.care += (s.hunger + s.happy + s.clean) / 3 * m; s.careN += m;

  let st = 0; STAGES.forEach((x, i) => { if (s.age >= x.at) st = i; });
  if (st > s.stage) evolve(st);
}

function wake(grumpy) {
  s.asleep = false;
  if (grumpy) { s.happy = clamp(s.happy - 8); say('Zzz… hey! Jeg sov! 😠'); flashMood('cry', 1800); }
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
  spawn(type === 'meal' ? '🍤' : '🍬', 'fall');
  setTimeout(() => { sfx('nom'); flashMood('eat', 1900); burst('💛', 3); say(pick(['Nam nam!', 'Mmmm! 😋', 'Mums!'])); }, 600);
  clampAll(); render();
}

function cuddle(fromPet) {
  if (!ready()) return;
  if (s.asleep) { say('Shh… den sover 💤'); return; }
  if (s.mis > 0) { s.disc = clamp(s.disc - 3); say('Hmph! Ikke nu!'); return; }
  s.happy += fromPet ? 1.2 : 9; clampAll();
  flashMood('love', 1600);
  if (!fromPet) { burst('💖', 5); say(pick(['Hihi! 💕', 'Jeg elsker dig!', 'Kram!'])); sfx('happy'); }
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
    say('Buhuu! Hvad har jeg gjort?! 😭'); flashMood('cry', 2800); sfx('sad');
  }
  render();
}

function clean() {
  if (!ready() || needsWake()) return;
  if (!s.poop && s.clean > 90) { say('Jeg er allerede ren!'); return; }
  s.poop = 0; s.clean = 100; s.happy += 4; clampAll();
  spawn('🫧', 'sweep'); burst('✨', 4); sfx('pop'); say('Pip pip, så frisk! 🫧'); render();
}

function medicine() {
  if (!ready() || needsWake()) return;
  if (!s.sick) { say('Jeg er ikke syg!'); return; }
  s.sick--; sfx('happy'); burst('💊', 2);
  say(s.sick ? 'Bleh! Endnu en dosis…' : 'Uh, jeg har det meget bedre! 💖'); render();
}

function sleepToggle() {
  if (!ready()) return;
  if (s.asleep) { wake(s.energy < 60); render(); return; }
  if (s.energy >= 98) { say('Jeg er slet ikke træt!'); return; }
  s.asleep = true; sfx('sleep'); say('Godnat 🌙', 1800); render();
}

function info() {
  const mins = Math.floor(s.age), d = Math.floor(mins / 1440), h = Math.floor(mins % 1440 / 60), mm = mins % 60;
  const avg = Math.round(s.care / Math.max(1, s.careN));
  const rows = [
    ['Alder', `${d ? d + ' d ' : ''}${h} t ${mm} min`],
    ['Trin', STAGES[s.stage].label],
    ['Opdragelse', '⭐'.repeat(Math.round(s.disc / 20)) + '☆'.repeat(5 - Math.round(s.disc / 20))],
    ['Pleje (snit)', avg + '%'],
  ];
  if (s.stage >= 3) rows.push(['Udseende', FORMS[s.form].name]);
  $('#infoTitle').textContent = s.name || 'Ægget';
  $('#infoList').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  $('#infoSheet').hidden = false;
}

const clampAll = () => ['hunger', 'happy', 'energy', 'clean', 'disc'].forEach(k => s[k] = clamp(s[k]));

/* ---------- minispil: fang bobler ---------- */
function play() {
  if (!ready() || needsWake()) return;
  if (s.sick) { say('Jeg er for syg til at lege…'); return; }
  if (s.mis > 0) { say('Jeg gider ikke lege!'); return; }
  if (s.energy < 25) { say('Jeg er for træt 😴'); return; }

  const game = $('#game'), field = $('#gameField');
  let score = 0, left = 15, over = false;
  const scoreEl = $('#gameScore'), timeEl = $('#gameTime');
  game.hidden = false; field.innerHTML = ''; scoreEl.textContent = 0; timeEl.textContent = left;

  const spawnB = () => {
    if (over) return;
    const bad = Math.random() < 0.22, b = document.createElement('div');
    b.className = 'b' + (bad ? ' bad' : ''); b.textContent = bad ? '🪼' : '';
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
    const stars = score >= 14 ? '🌟🌟🌟' : score >= 8 ? '🌟🌟' : '🌟';
    const end = document.createElement('div'); end.className = 'end';
    end.innerHTML = `<div>${stars}</div><div>${score} bobler!</div><button>Færdig</button>`;
    end.querySelector('button').onclick = () => {
      game.hidden = true; render();
      if (score >= 8) { flashMood('love', 2500); burst('💖', 5); say('Det var SÅ sjovt! 🎉'); sfx('happy'); }
      else say('Hihi, det var okay!');
    };
    field.appendChild(end);
  }, 1000);
}

/* ---------- rendering ---------- */
function applyForm() {
  const f = FORMS[s.stage >= 3 ? s.form : 'pink'];
  const r = document.documentElement.style;
  r.setProperty('--c-hi', f.hi); r.setProperty('--c-mid', f.mid); r.setProperty('--c-lo', f.lo); r.setProperty('--c-claw', f.claw);
}

function render() {
  const mood = currentMood();
  const wrap = $('#crabWrap');
  wrap.dataset.stage = STAGES[s.stage].id;
  applyForm();
  $('#nameLabel').textContent = s.name || 'Harbugotchi';
  $('#stageLabel').textContent = STAGES[s.stage].label;

  if (s.stage === 0) {
    wrap.style.setProperty('--crack', clamp(Math.max(s.age / STAGES[1].at, s.taps / 12), 0, 1) > .35 ? 1 : 0);
    $('#eggSvg').style.setProperty('--crack', s.taps > 3 || s.age > 12 / 60 ? 1 : 0);
    $('#crack').style.opacity = s.taps > 3 || s.age > 0.2 ? 1 : 0;
  } else {
    const d = MOODS[mood] || MOODS.neutral;
    crabSvg.dataset.mood = mood;
    crabSvg.dataset.eyes = d.eyes; crabSvg.dataset.mouth = d.mouth;
    crabSvg.dataset.brow = d.brow || 'none'; crabSvg.dataset.tear = d.tear || 0;
  }

  $$('.stat').forEach(el => {
    const v = s[el.dataset.k];
    const b = $('b', el); b.style.width = v + '%'; b.style.background = `hsl(${Math.round(v * 1.15)} 85% 55%)`;
    el.classList.toggle('low', s.stage > 0 && v < 25);
  });

  scene.classList.toggle('dark', s.asleep);
  $('#sleepBtn').innerHTML = s.asleep ? '<span>☀️</span>Vågn' : '<span>🌙</span>Sov';
  $('#alert').hidden = !(s.mis > 0 || (s.stage > 0 && !s.asleep && (s.hunger < 25 || s.clean < 25 || s.sick)));
  $('#statusIcon').textContent = s.sick ? '🤒' : '';

  const poops = $('#poops');
  if (poops.children.length !== s.poop) {
    poops.innerHTML = '';
    for (let i = 0; i < s.poop; i++) {
      const p = document.createElement('span'); p.textContent = '💩';
      p.style.left = [10, 78, 44][i] + '%'; poops.appendChild(p);
    }
  }
  $$('#actions button').forEach(b => { if (b.dataset.act !== 'info') b.disabled = s.stage === 0; });
  $('#soundBtn').textContent = s.muted ? '🔇' : '🔊';
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
  if (total > 600 && s.stage > 0) setTimeout(() => say(s.asleep ? 'Zzz…' : 'Du er tilbage! 🥹', 3500), 400);
}

setInterval(tick, 1000);
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => document.hidden ? save() : tick());
addEventListener('pagehide', save);

// småsnak og opmærksomhed
setInterval(() => {
  if (s.stage === 0 || s.asleep || fx.until > performance.now() || !$('#game').hidden) return;
  if (s.sick) return say('Jeg har det dårligt…');
  if (s.hunger < 25) { sfx('alert'); return say(pick(['Jeg er SÅ sulten!', 'Mad… tak…', 'Min mave knurrer 🍤'])); }
  if (s.energy < 15) return say('Jeg er træt… kan du slukke lyset?');
  if (s.clean < 25 || s.poop >= 2) return say('Det lugter… 🫧');
  if (s.happy < 30) return say(pick(['Jeg føler mig ensom…', 'Kan vi lege?']));
  if (Math.random() < .5) say(pick(['La la la ♪', 'Sideways er bedst!', 'Se mine kløer! ✌️', 'Jeg elsker bobler', s.name ? `${s.name} er glad!` : 'Hej!']), 2200);
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
    const r = scene.getBoundingClientRect(); spawn('💕', '', e.clientX - r.left, e.clientY - r.top);
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
  render();
  if (s.stage > 0 && !s.name) askName();
  if (s.stage === 0) say('Et æg! Tryk på det for at hjælpe det ud 🥚', 4500);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

window.harbu = { get s() { return s; }, step, render, flashMood, hatch, evolve, say };
