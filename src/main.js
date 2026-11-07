// APOC test table: lobby, game controller, UI. The engine (engine.js) holds all rules; this file only renders and sends commands.
import * as E from './engine.js';
import * as AI from './ai.js';
import { View2D, PREP_COL, pcol } from './view2d.js';
import { View3D } from './view3d.js';
import { VERSION } from './version.js';
import { HostNet, GuestNet } from './net.js';

const $ = s => document.querySelector(s);
const ICON = { food: 'food', knowhow: 'know-how', chem: 'chem', hardware: 'hardware', tech: 'tech', meds: 'meds', ducttape: 'duct-tape' };
const PREPS = ['jessica', 'sam', 'frost', 'naomi'];
const NAMES = ['Tim', 'Paul', 'Russ', 'Mike'];
const img = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let D, boardImg, icons = {}, V2, V3, view = '2d';
let S = null, mode = 'local', net = null, mySeat = null, peerSeat = new Map(), guestNames = new Map(), remoteSeats = new Set();
let paused = false, stepOnce = false, speed = 'normal', follow = localStorage.getItem('apoc-follow') !== '0', lastActorKey = null, followArmed = false;   // the camera starts on the straight C view and stays there until you move it
let hist = [], sbxMove = false, sbxTarget = 0, busy = false, modalFn = null, H = [], targets = {}, lastSeq = 0, aiRejects = 0, lobbyMode = 'solo', appUp = false, lastLogSeq = -1;

// ---------------------------------------------------------------- boot + lobby
// ---------------------------------------------------------------- password gate (casual privacy only: this is a static site)
const PW_HASH = 'd070e8c23b0d02da5198dae4c8b83c3670210edf6f42d9c846fafcaca2bea832';
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
async function gate() {
  try { if (localStorage.getItem('apoc-ok') === PW_HASH) return; } catch (e) {}
  $('#gate').hidden = false;
  await new Promise(ok => {
    $('#gateForm').onsubmit = async e => {
      e.preventDefault();
      if (await sha('apoc-gunpowder:' + $('#gatePw').value.trim()) === PW_HASH) { try { localStorage.setItem('apoc-ok', PW_HASH); } catch (e2) {} ok(); }
      else { $('#gateMsg').textContent = 'Wrong password.'; $('#gatePw').select(); }
    };
    $('#gatePw').focus();
  });
  $('#gate').hidden = true;
}

async function boot() {
  await gate(); $('#lobby').hidden = false;
  { const radio = new Audio('assets/sfx/radio-chatter.mp3'); let done = false;   // radio chatter on the start screen, played once (waits for the first click/key if the browser blocks autoplay)
    const go = () => { if (done) return; radio.play().then(() => { done = true; rm(); if (musicOn) music.play().catch(() => {}); }).catch(() => {}); };   // ambient music starts with the radio chatter and keeps going into the game
    const rm = () => { for (const ev of ['pointerdown', 'keydown']) window.removeEventListener(ev, go); };
    go(); for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, go); }
  const rd = n => fetch('data/' + n + '.json').then(r => r.json());
  const [board, items, news, preppers, config, adjacent] = await Promise.all(['board', 'items', 'news', 'preppers', 'config', 'adjacent'].map(rd));
  D = E.init({ board, items, news, preppers, config, adjacent });
  boardImg = await img('assets/board/board.jpg?v=161'); icons.coin = await img('assets/counters/prepcoin.webp');
  for (const [k, f] of Object.entries(ICON)) icons[k] = await img(`assets/counters/${f}.webp`);
  $('#verL').textContent = VERSION; buildSeats(); bindLobby();
}
const AI_GOALS = [['balanced', 'Balanced (plays like a human)'], ['weapons', 'First: collect weapons'], ['bunker', 'First: build a bunker'], ['craft', 'First: craft items only'], ['thug', 'First: recruit a thug'], ['food10', 'First: collect 10 food'], ['gamble', 'First: gamble at the casino'], ['steal', 'First: steal and loot'], ['scavenge', 'First: burgle and dumpster dive'], ['hoard', 'First: hoard 8 PrepCoin'], ['raid', 'First: raid a bunker']];
function buildSeats() {
  const types = lobbyMode === 'host' ? [['human', 'Human (this device)'], ['remote', 'Remote player'], ['ai', 'AI'], ['off', 'Empty']] : [['human', 'Human'], ['ai', 'AI'], ['off', 'Empty']];
  const old = [0, 1, 2, 3].map(i => $('#sn' + i) ? { n: $('#sn' + i).value, p: $('#sp' + i).value, t: $('#st' + i).value, g: $('#sg' + i).value } : null);
  $('#seats').innerHTML = [0, 1, 2, 3].map(i => `<div class="seat"><span class="dot" id="sd${i}" style="background:${PREP_COL[PREPS[i]]}"></span><input id="sn${i}" value="${NAMES[i]}">
    <select id="sp${i}">${PREPS.map(p => `<option value="${p}">${E.D.prepper[p].name}</option>`).join('')}</select>
    <select id="st${i}" class="ty">${types.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
    <select id="sg${i}" class="goal" title="AI player: what it tries to do first, then plays balanced">${AI_GOALS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>`).join('');
  [0, 1, 2, 3].forEach(i => {
    const o = old[i];
    $('#sp' + i).value = o ? o.p : PREPS[i];
    const dot = () => { $('#sd' + i).style.background = PREP_COL[$('#sp' + i).value]; }; $('#sp' + i).onchange = dot; dot();
    $('#st' + i).value = o && [...$('#st' + i).options].some(x => x.value === o.t) ? o.t : (i === 0 ? 'human' : i === 1 ? 'ai' : 'off');
    if (o) { $('#sn' + i).value = o.n; $('#sg' + i).value = o.g || 'balanced'; }
    const gl = () => { $('#sg' + i).style.display = $('#st' + i).value === 'ai' || ($('#st' + i).value === 'remote') ? '' : 'none'; }; $('#st' + i).onchange = gl; gl();
  });
}
function bindLobby() {
  document.querySelectorAll('#modeTabs button').forEach(b => b.onclick = () => {
    lobbyMode = b.dataset.m; document.querySelectorAll('#modeTabs button').forEach(x => x.classList.toggle('on', x === b));
    $('#seatsBox').hidden = lobbyMode === 'join'; $('#joinBox').hidden = lobbyMode !== 'join'; $('#hostInfo').hidden = lobbyMode !== 'host' || !net;
    $('#startBtn').textContent = lobbyMode === 'join' ? 'Join room' : lobbyMode === 'host' ? (net ? 'New game' : 'Open room') : 'New game';
    if (lobbyMode !== 'join') buildSeats();
  });
  $('#startBtn').onclick = onStart;
  const sv = readAutosave();
  if (sv) { $('#contBtn').hidden = false; $('#contBtn').textContent = `Continue saved game (round ${sv.S.round}, ${new Date(sv.savedAt).toLocaleString()})`; $('#contBtn').onclick = () => loadGame(sv); }
  $('#loadBtn').onclick = () => $('#loadFile').click();
  $('#loadFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { loadGame(JSON.parse(await f.text())); } catch (err) { lobbyMsg('Could not read that save file.'); } };
}
const lobbyMsg = t => { $('#lobbyMsg').textContent = t; };
function readSeats() {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const t = $('#st' + i).value; if (t === 'off') continue;
    let name = $('#sn' + i).value.trim() || NAMES[i];
    if (t === 'ai' && !/\(AI\)$/.test(name)) name += ' (AI)';
    out.push({ name, prepper: $('#sp' + i).value, ai: t === 'ai', type: t, color: i, goal: $('#sg' + i).value });
  }
  return out;
}
async function onStart() {
  try {
    if (lobbyMode === 'join') return await doJoin();
    const seats = readSeats();
    if (lobbyMode === 'host' && !net) return await openRoom();
    if (!seats.length) return lobbyMsg('Add at least one player.');
    if (new Set(seats.map(s => s.prepper)).size !== seats.length) return lobbyMsg('Each player needs a different prepper.');
    let guests = [...guestNames.keys()];
    const players = []; remoteSeats = new Set(); peerSeat = new Map();
    seats.forEach((s, i) => {
      let ai = s.ai, name = s.name;
      if (s.type === 'remote') { const g = guests.shift(); if (g) { peerSeat.set(g, i); name = guestNames.get(g); remoteSeats.add(i); } else { ai = true; name += ' (AI)'; } }
      players.push({ name, prepper: s.prepper, ai, goal: s.goal });
    });
    guests.forEach(g => peerSeat.set(g, -1));
    mode = lobbyMode === 'host' ? 'host' : 'local';
    const seedTxt = (new URLSearchParams(location.search).get('seed') || '').trim();   // hidden: ?seed=abc in the address for replaying a game
    S = E.createGame({ players, seed: seedTxt ? (+seedTxt || [...seedTxt].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)) : undefined, sandbox: $('#sandbox').checked });
    hist = []; enterApp(); afterChange(); runSetup();
  } catch (e) { console.error(e); lobbyMsg(String(e.message || e)); }
}
async function openRoom() {
  lobbyMsg('Opening room…'); net = new HostNet(); const code = await net.open();
  net.onJoin = (pid, name) => { guestNames.set(pid, name); $('#hostInfo').innerHTML = hostInfoHtml(code); if (S) { const seat = peerSeat.get(pid); net.send(pid, { state: E.publicView(S, seat ?? -1), seat: seat ?? -1 }); } };
  net.onLeave = pid => { guestNames.delete(pid); $('#hostInfo').innerHTML = hostInfoHtml(code); };
  net.onCmd = (pid, cmd) => { const seat = peerSeat.get(pid); if (seat === undefined || seat < 0) return; const r = hostExec(seat, cmd); if (!r.ok) net.send(pid, { err: r.error }); };
  $('#hostInfo').hidden = false; $('#hostInfo').innerHTML = hostInfoHtml(code);
  $('#startBtn').textContent = 'New game'; lobbyMsg('Share the room code, then Start. Unfilled remote seats become AI.');
}
const hostInfoHtml = code => `Room code: <b style="font-size:22px;letter-spacing:3px">${code}</b> &nbsp; Joined: ${[...guestNames.values()].map(esc).join(', ') || '(nobody yet)'}`;
async function doJoin() {
  const code = $('#joinCode').value.trim().toUpperCase(); if (!code) return lobbyMsg('Enter the room code.');
  lobbyMsg('Connecting…'); net = new GuestNet(); mode = 'guest';
  await net.join(code, $('#joinName').value.trim() || 'Guest', onGuestMsg, () => toast('Disconnected from host'));
  lobbyMsg('Connected. Waiting for the host to start…'); $('#startBtn').disabled = true;
}
function onGuestMsg(m) {
  if (m.err) return toast(m.err);
  if (m.state) { mySeat = m.seat; S = m.state; if (!appUp) enterApp(); render(); }
}

// ---------------------------------------------------------------- save / load
const savePayload = () => ({ game: 'apoc', version: VERSION, savedAt: Date.now(), S });
function readAutosave() { try { const o = JSON.parse(localStorage.getItem('apoc-save')); return o && o.game === 'apoc' && o.S && o.S.players ? o : null; } catch (e) { return null; } }
function autosave() { if (mode !== 'local' || !S) return; try { localStorage.setItem('apoc-save', JSON.stringify(savePayload())); } catch (e) {} }
function saveFile() {
  if (mode === 'guest') return toast('Only the host can save the game');
  download(`apoc-save-r${S.round}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`, JSON.stringify(savePayload()));
}
function loadGame(o) {
  if (!o || o.game !== 'apoc' || !o.S || !o.S.players) return lobbyMsg('That is not an APOC save file.');
  mode = 'local'; remoteSeats = new Set(); peerSeat = new Map(); S = o.S; hist = []; lastLogSeq = -1; lastSeq = 0; rollInit = false;
  if (o.version && o.version !== VERSION) toast(`Save was made in ${o.version}; you are on ${VERSION}. Rules may differ.`);
  enterApp(); afterChange();
}

// ---------------------------------------------------------------- app shell
const music = new Audio('assets/sfx/ambient.mp3'); music.loop = true; music.volume = 0.35;
let musicOn = (() => { try { return localStorage.getItem('apoc-music') !== 'off'; } catch (e) { return true; } })();
function syncMusic() {
  const b = $('#bMusic'); if (b) b.textContent = musicOn ? '🔇 Music off' : '🎵 Music on';
  if (musicOn) music.play().catch(() => {}); else music.pause();
}
function toggleMusic() { musicOn = !musicOn; try { localStorage.setItem('apoc-music', musicOn ? 'on' : 'off'); } catch (e) {} syncMusic(); }
function enterApp() {
  $('#lobby').hidden = true; $('#app').hidden = false; appUp = true;
  document.title = 'APOC test table ' + VERSION; $('#ver').textContent = VERSION;
  { const tab = document.createElement('button'); tab.id = 'sideTab'; document.body.appendChild(tab);
    window.setSide = min => setSide(min, false); const setSide = (min, save = true) => { document.body.classList.toggle('sidemin', min); tab.textContent = min ? '◀ Info' : 'Info ▶'; tab.title = min ? 'Expand the info bar (players, log)' : 'Collapse the info bar'; if (save) try { localStorage.setItem('apoc-sidemin', min ? '1' : '0'); } catch (e) {} setTimeout(() => { window.dispatchEvent(new Event('resize')); if (V3) V3.fitAll(); }, 60); };
    tab.onclick = () => setSide(!document.body.classList.contains('sidemin'));
    setSide(localStorage.getItem('apoc-sidemin') !== '0'); }
  const toggleRes = () => { const off = !(V3 && V3.hideRes); if (V3) V3.setHideRes(off); $('#bRes').textContent = off ? '👁 Resources: off' : '👁 Resources: on'; $('#bRes').classList.toggle('on', off); };
  $('#bRes').onclick = toggleRes; window.toggleRes = toggleRes;
  $('#bFull').onclick = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {} };
  document.addEventListener('fullscreenchange', () => { document.body.classList.toggle('fs', !!document.fullscreenElement); $('#bFull').textContent = document.fullscreenElement ? '⛶ Exit full screen' : '⛶ Full screen'; setTimeout(() => { window.dispatchEvent(new Event('resize')); if (V3) V3.fitAll(); }, 250); });
  $('#bMusic').onclick = toggleMusic; syncMusic();   // ambient music while playing
  V2 = new View2D($('#cv'), D.board, boardImg, icons);
  V2.onClick = onBoardClick; V2.onHover = onHover; V2.onToken = onToken; V2.canDrag = canDrag2D; V2.onDragHover = onDragHover; V2.onDrop = onDrop;
  V2.loop(() => S, () => ({}));
  $('#roomTag').textContent = net && net.code ? 'Room ' + net.code : '';
  $('#bReset').onclick = () => { V2.fit(); V2.dirty = true; if (V3) V3.reset(); };
  $('#bGraph').onclick = cycleGraph;
  $('#bPause').onclick = togglePause; $('#bStep').onclick = () => { stepOnce = true; schedule(); }; $('#speed').onchange = () => { speed = $('#speed').value; };
  $('#bFollow').classList.toggle('on', follow); $('#bFollow').onclick = () => { follow = !follow; followArmed = true; try { localStorage.setItem('apoc-follow', follow ? '1' : '0'); } catch (e) {} $('#bFollow').classList.toggle('on', follow); if (!follow && V3) V3.fitAll(); lastActorKey = null; render(); };
  $('#bUndo').onclick = undo; $('#bLog').onclick = exportLog; $('#bSave').onclick = saveFile;
  $('#bRules').onclick = () => { modalFn = assumptionsModal; render(); };
  $('#bRulesTab').onclick = () => { modalFn = rulesModal; render(); };
  const ex = document.createElement('button'); ex.id = 'bExp'; ex.textContent = 'Export board.json'; ex.hidden = true; ex.onclick = exportBoard; $('header').insertBefore(ex, $('#bGraph'));
  document.addEventListener('click', e => {
    const z = e.target.closest('img[data-zoom]'); if (z) zoomCard(z.dataset.zoom);
  }, true);
  document.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b && H[+b.dataset.i]) H[+b.dataset.i](e); });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && modalFn) { modalFn = null; render(); } });
  $('#bUndo').hidden = mode === 'guest';
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && modalFn) { modalFn = null; render(); } });
  setView('3d');   // open in the 3D view by default
  window.apoc = { get S() { return S; }, get V3() { return V3; }, get targets() { return targets; }, click: onBoardClick, E, AI };   // handy for console debugging
}
// ---- tool icons (bottom right of the table) + keyboard shortcuts S / P / Z / R
function setTool(tool) {
  if (tool === 'rotate' && view === '2d') { V2.rotate(); return; }
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
  if (V3) V3.setTool(tool);
}
document.querySelectorAll('#tools button').forEach(b => b.onclick = () => setTool(b.dataset.tool));
let zoomStep = 0, zoomAt = 0;
window.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target.tagName || ''))) return;
  if (e.key.toLowerCase() === 'c' && V3 && !$('#app').hidden) { V3.fitAll(); return; }
  if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !$('#app').hidden) { togglePause(); return; }   // P = pause / resume the AI
  if (e.key.toLowerCase() === 'z' && V3 && S && !$('#app').hidden) {   // Z = zoom in on the active player's figure; press again to step through the other players' figures
    const n = S.players.length, a = S.players.findIndex(q => q.id === actor()), now = performance.now();
    zoomStep = now - zoomAt < 4000 ? (zoomStep + 1) % n : 0; zoomAt = now;
    const q = S.players[(a + zoomStep) % n]; if (!V3.followPawn(q.id, true)) V3.fitAll(); return;
  }
  if (e.key.toLowerCase() === 'x' && V3 && S && !$('#app').hidden) {   // X = zoom in on the active player's character card; press again to step through the other players' cards
    const n = S.players.length, a = S.players.findIndex(q => q.id === actor()), now = performance.now();
    zoomStep = now - zoomAt < 4000 ? (zoomStep + 1) % n : 0; zoomAt = now;
    V3.follow((a + zoomStep) % n, n); return;
  }
  if (e.key.toLowerCase() === 'h' && V3 && !$('#app').hidden) { window.toggleRes(); return; }   // H = hide / show the resources on the board
  if (e.key.toLowerCase() === 'n' && V3 && !$('#app').hidden) { V3.followNews(); return; }   // N = zoom to the three news event stands
  if (e.key.toLowerCase() === 'd' && V3 && !$('#app').hidden) { V3.followDefcon(); return; }   // D = zoom to the DEFCON chart
  const k = { s: 'select', r: 'rotate' }[e.key.toLowerCase()]; if (k && !$('#app').hidden) { setTool(k); }
});
function setView(v) {
  view = '3d'; $('#c2').hidden = true; $('#c3').hidden = false;
  if (v === '3d' && !V3) {
    V3 = window.V3 = new View3D($('#c3'), D.board, boardImg, icons); V3.preppers = E.D.prepper; V3.onClick = (id, pt) => { closePop(); onBoardClick(id, pt); }; V3.onNews = key => { if (key !== 'deck') cardUpSound(false); if (key === 'items') { modalFn = itemDeckModal; render(); return; } if (key === 'deck') return toast('The news deck: face-down until drawn'); newsView = { type: key, i: 0 }; modalFn = newsPileModal; render(); }; V3.onHeldHover = tgt => {
    if (!moveSel) return false;
    if (tgt.type === 'node') return tgt.id === moveSel.node ? 'same' : true;
    const q = S.players[tgt.id]; return !!q && (moveSel.r === 'coin' || E.holdLimit(q) - E.resTotal(q) >= 1);
  }; V3.onMat = (id, img) => { if (moveSel) dropOnMat(id); else if (img) zoomMat(id); }; V3.canAdjustHealth = true; V3.onHealth = (pid, hp) => {   // a health cube was dragged by hand: logged as a MANUAL ADJUSTMENT
    const c = { t: 'manualHealth', p: pid, n: hp };
    if (mode === 'guest') net.send({ cmd: c }); else runCmd(iAct() ? actor() : Math.max(0, S.players.findIndex((q, i) => mine(i))), c);
    V3.matSig = ''; render();
  };
  V3.onCard = img => { if (!moveSel) zoomCard(img); }; V3.onToken = onToken; V3.canDrag = pid => canDragPawn(pid); V3.onDragHover = onDragHover; V3.onDrop = onDrop; V3.pickBoard = (x, y) => V2.pick(x, y); V3.setTool('select');
    const f = t => { if (view === '3d') V3.frame(t); requestAnimationFrame(f); }; requestAnimationFrame(f);
  }
  if (v === '3d') { V3.resize(); } else { V2.resize(); }
  render();
}
function cycleGraph() {
  if (!V2.showGraph && !V2.edit) V2.showGraph = true;
  else if (V2.showGraph && !V2.edit) V2.edit = 'move';
  else { V2.showGraph = false; V2.edit = null; V2.sel = null; }
  $('#bGraph').textContent = V2.edit ? 'Graph: EDIT' : V2.showGraph ? 'Graph: on' : 'Graph'; $('#bExp').hidden = !V2.edit; V2.dirty = true;
}
function exportBoard() { download('board.json', JSON.stringify(D.board, null, 1)); toast('board.json downloaded. Send it to Claude to update the graph.'); }
function exportText() {   // readable game log as a text file
  const lines = [`APOC game log - ${VERSION} - ${new Date().toLocaleString()}`, `Players: ${S.players.map(p => `${p.name} (${E.D.prepper[p.prepper].name}${p.goal && p.goal !== 'balanced' ? ', goal: ' + p.goal : ''})`).join(', ')}`, S.over ? `Game over in round ${S.round}.` : `Round ${S.round} (game in progress)`, ''];
  captureLog(); for (const l of fullLog) lines.push(`[R${l.r}] ${l.t}`);
  download('apoc-game-log-' + Date.now() + '.txt', lines.join('\n'));
}
function exportLog() { download('apoc-game-' + Date.now() + '.json', JSON.stringify({ note: mode === 'guest' ? 'guest view' : 'full state', state: S, log: S.log }, null, 1)); }
function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: name.endsWith('.txt') ? 'text/plain' : 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function undo() {
  if (mode === 'guest' || !hist.length) return toast('Nothing to undo');
  S = JSON.parse(hist.pop()); afterChange();
}
let toastEl;
function toast(t) { if (!toastEl) { toastEl = document.createElement('div'); toastEl.style.cssText = 'position:fixed;left:50%;top:60px;transform:translateX(-50%);background:#b03a2e;color:#fff;padding:8px 14px;border-radius:8px;z-index:50;max-width:80vw'; document.body.appendChild(toastEl); } toastEl.textContent = t; toastEl.hidden = false; clearTimeout(toastEl.t); toastEl.t = setTimeout(() => (toastEl.hidden = true), 3500); }

// ---------------------------------------------------------------- game control
const actor = () => S.pending ? S.pending.pl : S.stage === 'grab' ? S.grab.order[S.grab.turn] : S.cur;
const mine = i => mode === 'guest' ? i === mySeat : (i >= 0 && !S.players[i].ai && !remoteSeats.has(i));
const iAct = () => !S.over && mine(actor());
let lastMe = 0;
function me() { if (mode === 'guest') return mySeat >= 0 ? mySeat : 0; const a = actor(); if (mine(a)) lastMe = a; else if (!mine(lastMe)) lastMe = S.players.findIndex((p, i) => mine(i)); return Math.max(0, lastMe); }

function runCmd(pl, cmd) {
  const snap = JSON.stringify(S); let r;
  if (cmd.t === 'path') { r = { ok: true }; let n = 0; for (const to of cmd.steps) { if (S.pending || S.over) break; r = E.dispatch(S, pl, { t: 'move', to }); if (!r.ok) break; n++; } if (n) r.ok = true; }
  else r = E.dispatch(S, pl, cmd);
  if (r.ok) { hist.push(snap); if (hist.length > 40) hist.shift(); }
  afterChange(); return r;
}
function hostExec(seat, cmd) { return runCmd(seat, cmd); }
// ---- table set-up: tokens are placed building by building, with a sound and a "Setting up..." bar
let setupHold = false;
function tick() {
  try {
    const ac = tick.ac || (tick.ac = new (window.AudioContext || window.webkitAudioContext)()), t0 = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(640 + Math.random() * 160, t0); o.frequency.exponentialRampToValueAtTime(180, t0 + 0.07);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + 0.1);
  } catch (e) {}
}
async function runSetup() {
  if (!V3 || !S || mode === 'guest') return;
  const ids = E.D.board.nodes.filter(n => { const L = S.loc[n.id]; return L && (L.coin || Object.values(L.res).some(v => v > 0)); }).map(n => n.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  setupHold = true; setView('3d'); V3.fitAll(); V3.hide = new Set(ids); render();
  const ov = $('#setup'), bar = $('#setupBar'); ov.hidden = false; bar.style.width = '0%';
  for (let i = 0; i < ids.length; i++) {
    await new Promise(r => setTimeout(r, 130));
    V3.hide.delete(ids[i]); tick(); bar.style.width = Math.round((i + 1) / ids.length * 100) + '%'; V3.sync(S, { targets });
  }
  await new Promise(r => setTimeout(r, 250));
  ov.hidden = true; V3.hide = null; setupHold = false; render(); schedule();
}
function doCmd(cmd) {
  if (setupHold) return { ok: false, error: 'Setting up…' };
  if (mode === 'guest') return net.send({ cmd });
  const r = runCmd(actor(), cmd); if (!r.ok) toast(r.error || 'Not allowed'); else tick(); return r;
}
function afterChange() {
  render(); broadcast(); autosave(); schedule();
}
function broadcast() { if (mode !== 'host' || !net) return; for (const [pid, seat] of peerSeat) net.send(pid, { state: E.publicView(S, seat), seat }); }
const DELAY = { slow: 2400, normal: 1100, fast: 350 };
function togglePause() {
  paused = !paused; $('#bPause').textContent = paused ? '▶ Resume' : '⏸ Pause'; $('#bPause').classList.toggle('on', paused); $('#bStep').hidden = !paused;
  $('#pausedTag').hidden = !paused; if (!paused) schedule();
}
function schedule() {
  if (setupHold) return;
  if (mode === 'guest' || busy || !S || S.over) return;
  if (paused && !stepOnce) return;
  if (!AI.next(S)) return;
  busy = true;
  const humanHere = S.players.some((p, i) => mine(i));
  setTimeout(() => {
    busy = false; if (!S || S.over) return;
    if (paused && !stepOnce) return;
    stepOnce = false;
    const a = AI.next(S); if (!a) return;
    const r = E.dispatch(S, a.pl, a.cmd);
    if (!r.ok) { if (++aiRejects > 60) { toast('AI is stuck (' + r.error + '). Use Export to send a log.'); return; } } else aiRejects = 0;
    afterChange();
  }, stepOnce ? 50 : DELAY[speed] * (humanHere ? 0.5 : 1));
}

// ---------------------------------------------------------------- board interaction
function updateTargets() {
  targets = {};
  if (!S || !iAct() || S.pending) return;
  const p = S.players[actor()];
  const grab = S.stage === 'grab';
  const left = grab ? S.grab.moves : (S.stage === 'turn' && S.ts.step === 'prep' && S.ts.moveState !== 'done' ? S.ts.moves : 0);
  if (S.sandbox && sbxMove) { for (const n of D.board.nodes) targets[n.id] = { kind: 'act', steps: [n.id] }; return; }
  if (left <= 0) return;
  const blocked = grab ? {} : S.ts.blocked || {};
  const seen = { [p.node]: { d: 0, steps: [] } }, q = [p.node];
  while (q.length) {
    const u = q.shift(), su = seen[u]; if (su.d >= left) continue;
    for (const v of E.D.adj[u]) if (!seen[v] && !blocked[v]) { seen[v] = { d: su.d + 1, steps: [...su.steps, v] }; q.push(v); }
  }
  for (const id in seen) if (id !== p.node) targets[id] = { kind: 'move', steps: seen[id].steps };
  for (const m of E.legalMoves(S, p)) if (m.subway) targets[m.to] = { kind: 'subway', steps: [m.to] }; else if (m.cutters) targets[m.to] = { kind: 'move', steps: [m.to] };
}
function onBoardClick(id, pt) {
  if (!S || !id) return;
  if (V2 && V2.edit) { V2.sel = id; V2.dirty = true; return; }
  if (moveSel) return void dropStack(id, pt);
  if (S.sandbox && sbxMove) return void doCmd({ t: 'sbxMove', to: id, p: sbxTarget });
  const t = targets[id]; if (!t) return;
  doCmd(t.steps.length === 1 ? { t: 'move', to: id } : { t: 'path', steps: t.steps });
}
// ---- drag a pawn to move (works in 2D and 3D): the drop spot is snapped to a board space and checked against the rules
function canDragPawn(pid) { return !!S && !S.over && iAct() && !S.pending && pid === actor() && Object.keys(targets).length > 0; }
function canDrag2D(wx, wy) {
  if (!S || !canDragPawn(actor())) return null;
  const p = S.players[actor()], n = E.D.node[p.node]; V2.ghostColor = pcol(p);
  return Math.hypot(n.x - wx, (n.y - 22) - wy) < 48 ? p.id : null;
}
function onDragHover(id) {
  const tip = $('#tip'); if (!id) { tip.textContent = 'Drop on a space to move there'; return; }
  const t = targets[id], nm = E.D.node[id].name || id;
  tip.textContent = t ? `${nm}: ${t.steps.length} move${t.steps.length > 1 ? 's' : ''}${t.kind === 'subway' ? ' (subway, 1 coin)' : ''}` : `${nm}: can't reach`;
  if (V2) { V2.hover = id; V2.dirty = true; }
}
function onDrop(pid, id) {
  closePop();
  if (!id || !targets[id]) {
    const left = S.stage === 'grab' ? S.grab.moves : S.ts && S.ts.moves;
    toast(!id ? 'Dropped off the map: the piece goes back' : left > 0 ? `You can't reach ${E.D.node[id].name || id} (you have ${left} moves; only roads, junctions and doors connect)` : 'No moves left');
    render(); return;
  }
  onBoardClick(id);
}

// ---- click a token pile: choose how many, then move them to/from your player area
let moveSel = null;
function endHold() { moveSel = null; if (V3) { V3.hl = null; V3.setHeld(null); } }
function cancelMove() { if (moveSel) { endHold(); render(); } }
function dropStack(id, pt) {
  const m = moveSel; if (!id) return toast('Click on the board or a character card');
  if (id === m.node) { endHold(); tick(); return render(); }
  const r = doCmd({ t: 'moveStack', from: m.node, to: id, r: m.r, n: m.n, x: pt && pt.x, y: pt && pt.y });
  if (r && r.ok !== false) endHold();
}
function dropOnMat(pid) {
  const m = moveSel; const r = doCmd({ t: 'moveStack', from: m.node, r: m.r, n: m.n, mat: pid });
  if (r && r.ok !== false) endHold();
}
function closePop() { const p = $('#pop'); if (p) p.hidden = true; }
function onToken(info) {
  if (!S || S.over) return; closePop();
  if (moveSel) return info.mat !== undefined ? dropOnMat(info.mat) : dropStack(info.node, null);
  const myTurn = iAct() && !S.pending;
  if (!myTurn && info.mat !== undefined) return toast(S.pending ? 'Make the pending decision first' : 'It is not your turn');
  if (S.pending && info.mat === undefined && !iAct()) return;
  const p = S.players[actor()], label = E.RES_LABEL[info.r] || (info.r === 'coin' ? 'PrepCoin' : info.r);
  const ic = info.r === 'coin' ? 'assets/counters/prepcoin.webp' : `assets/counters/${ICON[info.r]}.webp`;
  const room = E.holdLimit(p) - E.resTotal(p), done = () => { closePop(); };
  const pop = $('#pop'); let html = '', acts = [];
  const qtySel = (max, id = 'popQty') => `<select id="${id}">${Array.from({ length: Math.max(1, max) }, (_, i) => `<option>${i + 1}</option>`).join('')}</select>`;
  const spot = (info.mat !== undefined) ? null : E.D.node[info.node], mineMat = info.mat === p.id;
  if (info.mat !== undefined) {   // one of your own piles: sell
    const have = info.r === 'coin' ? p.coin : p.res[info.r], A = E.actionsAt(S, p), canSell = E.D.cfg.sellNodes.includes(p.node) && A.some(a => a.a === 'market');
    if (info.mat !== p.id) return toast(`That is ${S.players[info.mat].name}'s pile`);
    if (info.r === 'coin') return toast(`You have ${p.coin} PrepCoin`);
    html = `<h4><img src="${ic}">${esc(label)} <span class="note">you have ${have}</span></h4>`;
    if (canSell) { html += `<div class="row">Sell ${qtySel(have)} for ${E.defc(S).sell} PrepCoin each</div><div class="row"><button class="primary" id="popGo">Sell</button></div>`; acts = [() => { const n = +$('#popQty').value; doCmd({ t: 'market', sell: { [info.r]: n } }); done(); }]; }
    else html += `<div class="note">You can only sell at a place with a sell icon (e.g. the Pawn Shop), and you need an action.</div>`;
  } else {
    const L = S.loc[info.node], count = info.r === 'coin' ? L.coin : L.res[info.r], away = !myTurn || p.node !== info.node;
    const freeSpot = spot.kind !== 'building' || info.node === E.D.board.churchNode;
    html = `<h4><img src="${ic}">${esc(label)} <span class="note">${count} at ${esc(spot.name || info.node)}</span></h4>`;
    if (away) html += `<div class="note">${myTurn ? `Move to ${esc(spot.name || info.node)} to take these.` : 'You can only take tokens on your own turn.'}</div>`;
    else if (info.r === 'coin') {
      if (freeSpot) { html += `<div class="row"><button class="primary" id="popGo">Take all ${count} coin</button></div>`; acts = [() => { doCmd({ t: 'pickupCoin' }); done(); }]; }
      else html += '<div class="note">Not available to take here.</div>';
    } else if (freeSpot) {
      const max = Math.min(count, room);
      if (max < 1) html += `<div class="note">Your backpack is full (${E.resTotal(p)}/${E.holdLimit(p)}).</div>`;
      else { html += `<div class="row">Pick up ${qtySel(max)} <span class="note">of ${count}</span></div><div class="row"><button class="primary" id="popGo">Pick up</button></div>`; acts = [() => { const n = +$('#popQty').value; for (let i = 0; i < n; i++) doCmd({ t: 'pickup', r: info.r }); done(); }]; }
    } else {
      const A = E.actionsAt(S, p), price = E.marketPrice(S), canBuy = A.some(a => a.a === 'market');
      if (canBuy) {
        const max = Math.min(count, room, Math.floor(p.coin / price));
        html += `<div class="note">Belongs to the location: buy at ${price} PrepCoin each (uses an action), or take it by crime.</div>`;
        if (max >= 1) { html += `<div class="row">Buy ${qtySel(max)} <span class="note">of ${count}</span></div><div class="row"><button class="primary" id="popGo">Buy</button></div>`; acts.push(() => { const n = +$('#popQty').value; doCmd({ t: 'market', buy: { [info.r]: n } }); done(); }); }
        else html += `<div class="note">You can't afford or carry any (${p.coin} coin, room ${room}).</div>`;
        for (const a of A.filter(x => ['steal', 'loot'].includes(x.a))) { html += `<div class="row"><button id="popA${acts.length}">${esc(a.label)}</button></div>`; const k = a.a; acts.push(() => { doCmd({ t: k }); done(); }); }
      } else html += `<div class="note">${S.ts && S.ts.actions <= 0 ? 'No actions left this turn.' : 'Nothing to do with these right now.'}</div>`;
    }
  }
  if (info.mat === undefined) { const cnt = info.r === 'coin' ? S.loc[info.node].coin : S.loc[info.node].res[info.r]; html += `<div class="row"><b>Move / take with the mouse:</b></div><div class="row">Hold ${qtySel(cnt, 'holdQty')} of ${cnt} <button id="popMove">Pick up</button></div><div class="note">Then click a space to put them down, or your character card to keep them.</div>`; }
  html += `<div class="row"><button id="popX">Cancel</button></div>`;
  pop.innerHTML = html; pop.hidden = false;
  const go = $('#popGo'); if (go) go.onclick = acts[0];
  acts.forEach((f, i) => { const b = $('#popA' + i); if (b) b.onclick = f; });
  $('#popX').onclick = closePop;
  const mv = $('#popMove'); if (mv) { const hq = $('#holdQty'); hq.value = hq.options[hq.options.length - 1].value; mv.onclick = () => { moveSel = { node: info.node, r: info.r, n: +hq.value }; if (V3) { V3.hl = { node: info.node, r: info.r }; V3.setHeld(moveSel); } tick(); closePop(); toast(`Holding ${moveSel.n}: click a space to put them down, or your character card to keep them (Esc cancels)`); render(); }; }
  const w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, info.cx + 12)) + 'px'; pop.style.top = Math.max(8, Math.min(innerHeight - h - 8, info.cy - 20)) + 'px';
}
window.addEventListener('keydown', e => { if (e.key === 'Escape') { closePop(); cancelMove(); } });

function onHover(id) {
  const tip = $('#tip'); if (!id || !S) { tip.textContent = ''; return; }
  const n = E.D.node[id], L = S.loc[id], parts = [n.name || id];
  const res = L ? Object.entries(L.res).filter(([, c]) => c).map(([r, c]) => `${c}× ${E.RES_LABEL[r]}`) : []; if (res.length) parts.push(res.join(', ')); if (L && L.coin) parts.push(L.coin + ' coin');
  const here = S.players.filter(p => p.node === id).map(p => p.name); if (here.length) parts.push('here: ' + here.join(', '));
  tip.textContent = parts.join(' · ');
}

// ---------------------------------------------------------------- rendering
function btn(label, fn, o = {}) { H.push(fn); return `<button data-i="${H.length - 1}" ${o.dis ? 'disabled' : ''} class="${o.cls || ''}" title="${esc(o.title || '')}">${label}</button>`; }
const chip = (r, n) => `<span class="chip" title="${E.RES_LABEL[r]}"><img src="assets/counters/${ICON[r]}.webp">${n}</span>`;
const chips = res => E.ALLRES.filter(r => res[r] > 0).map(r => chip(r, res[r])).join('') || '<span class="note">nothing</span>';
const itemImg = id => id === 'DUCT' ? 'assets/counters/duct-tape.webp' : id === 'hidden' ? 'assets/items/back.jpg' : `assets/items/${id}.jpg`;

const diceSnd = new Audio('assets/sfx/dice.mp3'); let lastRollKey = null, rollInit = false;
function throwDice(r) {
  let sp = null;
  if (r.kind === 'day' || r.kind === 'night' || r.kind === 'news') sp = [{ set: r.kind, face: r.face }];
  else if (r.kind === 'risk') sp = [{ set: 'num', face: Math.max(0, Math.min(5, (r.value || 1) - 1)) }];
  else if (r.kind === 'fight') sp = [r.a, r.d].map(x => ({ set: 'num', face: Math.max(0, Math.min(5, ((x && x.r) || 1) - 1)) }));
  if (sp) V3.rollDice(sp, r.pl, S.players.length);
}
function rollSound() {
  const k = S.lastRoll ? (S.lastRoll.rn || JSON.stringify(S.lastRoll)) : null;   // one throw per roll: keyed on the roll itself, not on the log length
  if (rollInit && k && k !== lastRollKey) { try { diceSnd.currentTime = 0; diceSnd.play().catch(() => {}); } catch (e) {} }
  if (rollInit && k && k !== lastRollKey && V3) throwDice(S.lastRoll);
  lastRollKey = k; rollInit = true;
}
let fullLog = [];   // every log line of the current game (the engine trims its own log at 600 lines)
function captureLog() {
  const top = S.log.length ? S.log[S.log.length - 1].n : 0;
  while (fullLog.length && fullLog[fullLog.length - 1].n > top) fullLog.pop();   // undo / new game
  const last = fullLog.length ? fullLog[fullLog.length - 1].n : 0;
  for (const l of S.log) if (l.n > last) fullLog.push({ n: l.n, t: l.t, r: S.round });
}
function render() {
  if (!S) return;
  captureLog();
  rollSound();
  H = []; updateTargets();
  renderStatus(); renderPlayers(); renderTurn(); renderSandbox(); renderLog(); renderHand(); renderBanner(); renderNewsPanel(); renderEventBanner(); renderCraftBtn(); renderTurnBar(); renderModal();
  if (V2) { V2.targets = targets; V2.dirty = true; }
  if (V3 && view === '3d') {
    V3.sync(S, { targets });
    const ap = S.players.find(p => p.id === actor()), key = S.over ? 'over' : S.stage + ':' + actor() + ':' + (ap && ap.node);
    if (follow && key !== lastActorKey && !S.over && !(lastActorKey === null && !followArmed)) setTimeout(() => { if (V3.manual) return; if (!V3.followPawn(actor())) V3.follow(S.players.findIndex(p => p.id === actor()), S.players.length); }, 60);
    lastActorKey = key; followArmed = true;
  }
}
function renderStatus() {
  const df = E.defc(S);
  $('#status').innerHTML = `<div>Round <b>${S.round}</b> · <span class="defc ${df.id}">${df.name}</span> <span class="note">buy ${df.buy} · sell ${df.sell} · ${[df.steal && 'steal', df.loot && 'loot', df.burgle && 'burgle'].filter(Boolean).join('/') || 'no crime'}${df.hospital ? '' : ' · hospital closed'}</span></div>
  <div class="note">Stand: ${['ai', 'pandemic', 'nuclear'].map(t => `${t} ${S.stand[t].length}/5`).join(' · ')} · Thugs in bar ${S.thugsBar} · Busted tokens ${S.bustedLeft}</div>
  <div class="res">${E.ALLRES.map(r => chip(r, S.supply[r])).join('')}<span class="note">supply</span></div>`;
}
function renderPlayers() {
  $('#players').innerHTML = S.players.map(p => {
    const pr = E.D.prepper[p.prepper], cur = actor() === p.id && !S.over;
    return `<div class="pl ${cur ? 'cur' : ''}" style="--c:${pcol(p)}">
      <div class="av">${esc(p.name[0])}</div><div>
      <div>${btn(`<b>${esc(p.name)}</b> <span class="note">${pr.name} the ${pr.role}</span>`, () => { modalFn = () => prepperModal(p.id); render(); }, { cls: 'lnk' })}
      ${p.bunker ? ' 🏠' : ''}${p.tagged ? ' 🏷️' : ''}${p.busted ? ` 🚔×${p.busted}` : ''}${p.thug ? ` 🥊${p.thug.job || ''}` : ''}${p.node === E.D.board.hospitalNode && p.admitted ? ' 🏥' : ''}</div>
      <div><span class="hp"><i style="width:${p.health * 10}%"></i></span> ❤ ${p.health}/10 · <img src="assets/counters/prepcoin.webp" height="14" style="vertical-align:-2px"> ${p.coin} · 📍 ${esc(E.D.node[p.node].name || p.node)}</div>
      <div class="res">${chips(p.res)}</div></div></div>`;
  }).join('');
  document.querySelectorAll('.lnk').forEach(b => { b.style.cssText = 'background:none;border:0;padding:0;text-align:left'; });
}
function renderTurn() {
  const el = $('#turn'); let h = '';
  if (S.over) { el.innerHTML = '<h3>Game over</h3>'; return; }
  const a = actor(), pa = S.players[a], mineNow = iAct();
  if (S.stage === 'grab') {
    const g = S.grab;
    h += `<h3>PANIC GRAB: ${esc(pa.name)}</h3><div class="note">Moves left ${g.moves}. Click a highlighted space to move; grab resources where you stand (max 2 per building).</div>`;
    if (mineNow && !S.pending) {
      const L = S.loc[pa.node]; h += '<div class="btns">' + E.ALLRES.filter(r => L.res[r] > 0).map(r => btn(`Grab ${E.RES_LABEL[r]} (${L.res[r]})`, () => doCmd({ t: 'grab', r }))).join('') + btn('End grab', () => doCmd({ t: 'endTurn' })) + '</div>';
    }
    el.innerHTML = h; return;
  }
  const ts = S.ts;
  h += `<h3>${esc(pa.name)}'s turn <span class="note">(${E.D.prepper[pa.prepper].name})</span></h3>`;
  if (S.lastRoll) h += `<div class="note">Last roll – ${esc(S.players[S.lastRoll.pl].name)}: ${esc(rollText(S.lastRoll))}</div>`;
  if (!mineNow) { el.innerHTML = h + `<div class="note">${S.pending ? 'Waiting for ' + esc(S.players[S.pending.pl].name) + ' to decide…' : 'Waiting for ' + esc(pa.name) + '…'}</div>`; return; }
  if (S.pending) { el.innerHTML = h + '<div class="note">Decision needed.</div>' + (S.sandbox ? sandboxPanel() : ''); return; }
  if (ts.step === 'eat') {
    h += `<div class="btns">${btn('🍽 Eat (1 food)', () => doCmd({ t: 'eat' }), { cls: 'primary' })}</div><div class="note">Press when you are ready. No food = lose 1 health.</div>`;
  } else if (ts.step === 'news') {
    h += `<div class="btns">${btn('📰 Draw the news', () => doCmd({ t: 'drawNews' }), { cls: 'primary' })}</div><div class="note">Draw a newspaper card for this turn.</div>`;
  } else if (ts.step === 'newsroll') {
    h += `<div class="btns">${btn('📰 Roll the NEWS dice', () => doCmd({ t: 'rollNews' }), { cls: 'primary' })}</div><div class="note">Read the news card, then roll. Only a matching face (nuclear / pandemic / AI) makes the event happen; fake news does nothing.</div>`;
  } else if (ts.step === 'roll') {
    const noNight = pa.tagged || E.nightBlocked(S);
    h += `<div class="btns">${btn('☀ Roll DAY dice', () => doCmd({ t: 'roll', kind: 'day' }), { cls: 'primary' })}${btn('🌙 Roll NIGHT dice', () => doCmd({ t: 'roll', kind: 'night' }), { dis: noNight, title: noNight ? 'Tagged or curfew: day dice only' : '' })}</div>`;
    h += '<div class="note">Day = safer. Night = more moves, more risk.</div>';
  } else if (ts.step === 'prep') {
    h += `<div>Moves <b>${ts.moves}</b> · Actions <b>${ts.actions}</b> ${ts.moveState === 'done' ? '<span class="note">(movement finished)</span>' : ''}</div><div class="btns">`;
    for (const x of E.actionsAt(S, pa)) h += btn(esc(x.label), () => actionClick(x.a, pa));
    
    const L = S.loc[pa.node], freeSpot = E.D.node[pa.node].kind !== 'building' || pa.node === E.D.board.churchNode;
    if (freeSpot) for (const r of E.ALLRES) if (L.res[r] > 0) h += btn(`Pick up ${E.RES_LABEL[r]}`, () => doCmd({ t: 'pickup', r }));
    if (freeSpot && L.coin > 0) h += btn(`Pick up ${L.coin} coin`, () => doCmd({ t: 'pickupCoin' }));
    if (pa.res.meds > 0 && pa.health < 10) h += btn('💊 Use MEDS (+1)', () => doCmd({ t: 'heal' }));
    if (E.hasItem(pa, 'bow') && !ts.hunted) h += btn('🏹 Hunt', () => doCmd({ t: 'hunt' }));
    if (pa.items.some(i => i.id === 'moonshine' && !i.broken)) h += btn('🥃 Drink moonshine', () => doCmd({ t: 'moonshine' }));
    if (pa.thug && pa.thug.job === 'thief' && !ts.thiefUsed) h += btn('🥷 Thief: take a resource', () => { modalFn = () => tokenPicker('Your thief steals which resource?', (node, r) => doCmd({ t: 'thief', node, r })); render(); });
    if (pa.thug && pa.thug.job === 'bouncer') h += btn('🛡 Post bouncer (1 coin)', () => { modalFn = buildingPicker; render(); });
    h += '</div><div class="btns">' + btn('End turn ▶', () => doCmd({ t: 'endTurn' }), { cls: 'primary' }) + '</div>';
  } else h += '<div class="note">…</div>';
  el.innerHTML = h;
}
function rollText(r) {
  if (r.kind === 'day' || r.kind === 'night') return E.diceText(r.kind, r.face) + ` (${r.kind})`;
  if (r.kind === 'risk') return `risk die ${r.value}${r.mod ? (r.mod > 0 ? '+' : '') + r.mod : ''} = ${r.total} (${r.why})`;
  if (r.kind === 'news') return `news dice: ${r.sym}`;
  if (r.kind === 'fight') return 'combat ' + JSON.stringify([r.a, r.d]).replace(/"/g, '');
  return r.kind;
}
function actionClick(a, p) {
  if (a === 'market') { mk = { buy: {}, sell: {} }; modalFn = marketModal; return render(); }
  if (a === 'shop') { modalFn = shopModal; return render(); }
  if (a === 'swap') { sw = { give: {}, get: {} }; modalFn = swapModal; return render(); }
  if (a === 'fight' || a === 'raid') {
    const list = S.players.filter(q => q.id !== p.id && (a === 'fight' ? q.node === p.node : q.bunker));
    if (list.length === 1) return doCmd({ t: a, target: list[0].id });
    modalFn = () => box(`<h2>${a === 'fight' ? 'Fight which prepper?' : 'Raid whose bunker?'}</h2><div class="btns">${list.map(q => btn(esc(q.name), () => { modalFn = null; doCmd({ t: a, target: q.id }); })).join('')}</div>${closeBtn()}`);
    return render();
  }
  if (a === 'drone') { modalFn = () => tokenPicker('Drone: take which resource?', (node, r) => { modalFn = null; doCmd({ t: 'drone', node, r }); }); return render(); }
  doCmd({ t: a });
}
// ---- big event pop-up for the human player: bad things that happen to you (busted, robbed, damage...) are shown large, and stay up (the game pauses) until you click / Esc / Enter
let popSeq = null, popPaused = false;
function eventPopup() {
  const last = S.log.length ? S.log[S.log.length - 1].n : 0;
  if (popSeq === null || last < popSeq) { popSeq = last; return; }
  const fresh = S.log.filter(l => l.n > popSeq); popSeq = last;
  const humans = S.players.map((q, i) => ({ q, i })).filter(x => mine(x.i));
  if (!fresh.length || !humans.length || S.players.every(q => q.ai)) return;
  const BAD = /BUSTED|TAGGED|caught|SHOT|loses|robbed|damage|rushed to the hospital|hospital is closed|BOOBY|busts|0 HEALTH/;
  for (const { q, i } of humans) {
    const mineL = fresh.filter(l => l.pl === i || l.t.includes(q.name));
    if (!mineL.some(l => BAD.test(l.t))) continue;
    const head = mineL.some(l => /TAGGED/.test(l.t)) ? 'TAGGED!' : mineL.some(l => /BUSTED|caught/.test(l.t)) ? 'BUSTED!' : mineL.some(l => /SHOT|BOOBY|damage|HEALTH|hospital/.test(l.t)) ? 'OUCH!' : 'BAD NEWS';
    let o = $('#evpop'); if (!o) { o = document.createElement('div'); o.id = 'evpop'; o.onclick = () => closeEvPop(); document.body.appendChild(o); }
    o.innerHTML = `<div class="evbox"><div class="evh">${esc(head)}</div>${mineL.map(l => `<div class="evl">${esc(l.t)}</div>`).join('')}<div class="evok">Click, Esc or Enter to continue</div></div>`;
    o.hidden = false; cardUpSound(false); if (!paused) { popPaused = true; togglePause(); }   // the game waits until you've read it
    return;
  }
}
function closeEvPop() { const o = $('#evpop'); if (o && !o.hidden) { o.hidden = true; if (popPaused) { popPaused = false; if (paused) togglePause(); } return true; } return false; }
function renderLog() {
  eventPopup();
  const el = $('#log'), last = S.log.length ? S.log[S.log.length - 1].n : 0;
  if (last === lastLogSeq) return; lastLogSeq = last;
  const m = me(); el.innerHTML = S.log.slice(-120).map((l, i, a) => `<div class="${l.pl === m ? 'me' : ''}${i === a.length - 1 ? ' cur' : ''}">${esc(l.t)}</div>`).join(''); el.scrollTop = el.scrollHeight;
}
function renderHand() {
  const p = S.players[me()], el = $('#hand'); if (!p) return;
  const items = p.items;
  el.innerHTML = `<div class="note" style="flex:none">${esc(p.name)}'s items${p.itemCount !== undefined ? '' : ''}:</div>` + (items.length ? items.map(i => `<div class="itm ${i.broken ? 'broken' : ''}" data-i="${H.push(() => { modalFn = () => itemModal(p.id, i.uid); render(); }) - 1}" title="${i.id === 'hidden' ? 'hidden' : esc(E.D.item[i.id].name)}"><img src="${itemImg(i.id)}">${i.tokens !== undefined && i.tokens !== null ? `<span class="tk">${i.tokens}</span>` : ''}</div>`).join('') : '<span class="note">none</span>');
}
let shownNews = new Set(), bannerUntil = 0, bannerHtml = '';
const newsSnd = new Audio('assets/sfx/breaking-news.mp3'), eventSnd = new Audio('assets/sfx/event.mp3'); let firedShown = null; let newsShown = null, newsClosed = null;
let newsView = null;
function itemDeckModal() {
  const cnt = {}; for (const c of S.itemDeck) cnt[c.id] = (cnt[c.id] || 0) + 1;
  const rows = E.D.items.map(it => `<div style="width:92px;text-align:center;opacity:${cnt[it.id] ? 1 : .35}"><img class="zm" data-zoom="${it.img}" src="${it.img}" style="width:92px;border-radius:5px"><div style="font-size:12px">${esc(it.name)}</div><b>x${cnt[it.id] || 0}</b></div>`).join('');
  return `<div style="max-width:760px"><div style="font-weight:700;font-size:18px;margin-bottom:6px">ITEM DECK: ${S.itemDeck.length} cards, shuffled face down</div>
    <div class="note" style="margin-bottom:8px">Craft an item (pay its recipe) or buy one at a shop to take that card from the deck. Dumpsters and events take the top card.</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:60vh;overflow:auto">${rows}</div><div class="btns" style="margin-top:10px">${closeBtn()}</div></div>`;
}
function newsPileModal() {
  const ids = S.stand[newsView.type]; if (!ids.length) return null;
  const i = Math.max(0, Math.min(ids.length - 1, newsView.i)), c = E.D.newsById[ids[ids.length - 1 - i]], nm = { nuclear: 'NUCLEAR', ai: 'AI', pandemic: 'PANDEMIC' }[c.type];
  return `<div class="npile" style="display:flex;gap:14px;align-items:flex-start"><img src="${c.img}" style="height:calc(88vh - 28px);max-width:62vw;object-fit:contain;border-radius:8px">
    <div class="t-${c.type} evbox" style="max-width:300px"><div class="ev" style="display:flex;gap:8px;align-items:center"><img src="assets/ui/ev-${c.type}.png" style="width:48px;height:48px"><div style="font-weight:700;color:#ffd54f">${nm} EVENT</div></div>
    <div style="font-size:18px;font-weight:600;margin:8px 0">${esc(c.text || 'Not yet designed')}</div>
    <div class="note">${esc(c.title)}. Card ${i + 1} of ${ids.length} in the ${nm} pile (newest first).${(S.spent || []).includes(c.id) ? ' <b>Already triggered: turned over.</b>' : ''}</div>
    <div class="btns" style="margin-top:10px">${ids.length > 1 ? btn('◀ Newer', () => { newsView.i = i - 1; render(); }, { dis: i === 0 }) + btn('Older ▶', () => { newsView.i = i + 1; render(); }, { dis: i >= ids.length - 1 }) : ''}${closeBtn()}</div></div></div>`;
}
const TURN_STEPS = ['Eat / Pay Thugs', 'Draw News', 'Roll News Dice', 'Roll Day/Night to Move', 'M.A.A.M', 'End Turn'];
const TURN_TIPS = ['', '', '', '', 'Move or action, action or move (including craft)', ''];
let dayPick = false;
function renderTurnBar() {
  return;   // the top turn strip is removed: the right-hand panel does the same job
  const el = $('#turnbar'); if (!S || S.over || setupHold) { el.innerHTML = ''; return; }
  const pa = S.players[actor()], me = iAct() && !S.pending && !pa.ai; let now;
  if (S.stage === 'grab') now = 4;
  else { const st = S.ts && S.ts.step; now = { begin: 0, begin2: 0, eat: 0, thug: 0, news: 1, newsroll: 2, roll: 3, prep: 4, endturn: 5 }[st] ?? 0; }
  const step = S.ts && S.ts.step, goStep = S.stage === 'grab' ? -1 : step === 'eat' ? 0 : step === 'news' ? 1 : step === 'newsroll' ? 2 : step === 'roll' ? 3 : -1;
  const endGo = me && step === 'prep';
  if (goStep !== 3) dayPick = false;
  el.style.setProperty('--c', pcol(pa));
  const noNight = pa.tagged || E.nightBlocked(S);
  el.innerHTML = `<div class="who">${esc(pa.name)}${pa.ai ? ' (AI)' : ''}</div>` + (S.stage === 'grab' ? `<div class="st now"><b>!</b>PANIC GRAB: move and grab (${S.grab ? S.grab.moves : 0} moves left)</div>`
    : TURN_STEPS.map((l, i) => {
      const go = me && (i === goStep || (i === 5 && endGo));
      const pick = i === 3 && dayPick && go ? `<div class="pick"><button data-d="day">☀ Day</button><button data-d="night" ${noNight ? 'disabled title="Tagged or curfew: day dice only"' : ''}>🌙 Night</button></div>` : '';
      return `<div class="st ${i < now ? 'done' : i === now ? 'now' : ''} ${go ? 'go' : ''}" data-step="${i}"${TURN_TIPS[i] ? ` title="${TURN_TIPS[i]}"` : ''}><b>${i < now ? '✓' : i + 1}</b>${l}${go && i !== 3 ? '<span class="clk">click</span>' : go && !dayPick ? '<span class="clk">click</span>' : ''}${pick}</div>`;
    }).join(''));
  el.querySelectorAll('.st.go').forEach(c => c.onclick = e => {
    const i = +c.dataset.step, d = e.target.closest('button[data-d]');
    if (d) { dayPick = false; return void doCmd({ t: 'roll', kind: d.dataset.d }); }
    if (i === 0) doCmd({ t: 'eat' }); else if (i === 1) doCmd({ t: 'drawNews' }); else if (i === 2) doCmd({ t: 'rollNews' });
    else if (i === 3) { dayPick = !dayPick; renderTurnBar(); } else if (i === 5) doCmd({ t: 'endTurn' });
  });
}
// A drawn news paper comes up big in the middle of the table until it is closed (x, click or Esc); the event info of each pile stays along the bottom until a newer paper covers it.
function closeNewsBig() { const o = $('#newsbig'); if (o && !o.hidden) { o.hidden = true; newsClosed = newsShown; return true; } return false; }
window.addEventListener('keydown', e => { if ((e.key === 'f' || e.key === 'F') && zoomFlipId !== null) { const z = $('#zoom'); if (z && !z.hidden) { z.querySelector('.flipbtn').click(); return; } } if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || '')) { $('#bFull').click(); return; } if ((e.key === 'Escape' || e.key === 'Enter') && closeEvPop()) return; if (e.key !== 'Escape') return; if (closeApoc()) return; const z = $('#zoom'); if (z && !z.hidden) { z.hidden = true; return; } closeNewsBig(); });
const sirenSnd = new Audio('assets/sfx/siren.mp3'); let apocShownKey = null;
function closeApoc() { const o = $('#apocbig'); if (o && !o.hidden) { o.hidden = true; try { sirenSnd.pause(); } catch (e) {} return true; } return false; }
function renderApocBig() {   // the APOC event has triggered: big message on screen + siren
  let o = $('#apocbig'); if (!o) { o = document.createElement('div'); o.id = 'apocbig'; o.hidden = true; o.onclick = () => closeApoc(); document.body.appendChild(o); }
  if (!S || !S.apocEvent) { apocShownKey = null; o.hidden = true; return; }
  if (apocShownKey === S.apocEvent) return; apocShownKey = S.apocEvent;
  const nm = { ai: 'AI', pandemic: 'PANDEMIC', nuclear: 'NUCLEAR' }[S.apocEvent] || String(S.apocEvent).toUpperCase();
  o.className = 't-' + S.apocEvent; o.hidden = false;
  o.innerHTML = `<img src="assets/ui/ev-${S.apocEvent}.png"><div class="a1">THE APOC EVENT HAS TRIGGERED</div><div class="a2">${nm} APOCALYPSE</div><div class="a3">Click or press Esc to close</div>`;
  try { sirenSnd.currentTime = 0; sirenSnd.play().catch(() => {}); } catch (e) {}
}
function renderNewsPanel() {
  renderApocBig();
  let big = $('#newsbig'); if (!big) { big = document.createElement('div'); big.id = 'newsbig'; big.hidden = true; big.onclick = () => closeNewsBig(); $('#boardWrap').appendChild(big); }
  let bar = $('#evbar'); if (!bar) { bar = document.createElement('div'); bar.id = 'evbar'; $('#boardWrap').appendChild(bar); }
  if (!S || S.over || setupHold) { big.hidden = true; bar.innerHTML = ''; return; }
  const nw = S.ts && S.ts.news, c = nw && E.D.newsById[nw.id];
  if (c) {
    const key = nw.id + ':' + S.round + ':' + S.cur;
    if (newsShown !== key) { if (newsShown !== null) { try { newsSnd.currentTime = 0; newsSnd.play().catch(() => {}); } catch (e) {} } newsShown = key; newsClosed = null; cardUpSound(false); if (S.players.every(q => q.ai)) { const k0 = key; setTimeout(() => { if (newsShown === k0) closeNewsBig(); }, 3000); }   // all-AI game: show the paper for 3 seconds then close
      big.innerHTML = `<img src="${c.img}"><button class="x" title="Close (Esc)">×</button><div class="hint">Click or press Esc to close</div>`; big.hidden = false; }
    if (nw.fired && firedShown !== key) { firedShown = key; try { eventSnd.currentTime = 0; eventSnd.play().catch(() => {}); } catch (e) {} }
  } else big.hidden = true;
  // event info panels along the bottom: the newest paper of each type, until a newer one covers it
  const nm = { nuclear: 'NUCLEAR', ai: 'AI', pandemic: 'PANDEMIC' }, spent = S.spent || [];
  bar.innerHTML = ['ai', 'pandemic', 'nuclear'].map(ty => {
    const ids = S.stand[ty]; if (!ids.length) return '<div class="evp-empty"></div>';
    const cd = E.D.newsById[ids[ids.length - 1]], used = spent.includes(cd.id), flash = S.glow && S.glow.card === cd.id;
    return `<div class="evp t-${ty} ${used ? 'used' : ''} ${flash ? 'flash' : ''}"><img src="assets/ui/ev-${ty}.png"><div><div class="evh">${nm[ty]} EVENT${used ? ' - TURNED OVER' : ''}</div><div class="evt">${esc(cd.text || 'Not yet designed')}</div></div></div>`;
  }).join('');
}
let evbClosed = null;
function renderEventBanner() {
  let b = $('#evbanner'); if (!b) { b = document.createElement('div'); b.id = 'evbanner'; document.body.appendChild(b); }
  const g = S && !S.over && S.glow, c = g && E.D.newsById[g.card], key = g && g.card + ':' + S.round;
  if (!c || (g.nodes && g.nodes.length) || evbClosed === key) { b.hidden = true; return; }
  b.className = 't-' + c.type; b.hidden = false;
  b.innerHTML = `<b>EVENT</b> ${esc(c.text || '')}<button class="x" title="Dismiss">×</button>`;
  b.querySelector('.x').onclick = () => { evbClosed = key; b.hidden = true; };
}
function renderBanner() {
  const nl = S.log.filter(l => l.n > lastSeq); if (lastSeq === 0) { lastSeq = S.log.length ? S.log[S.log.length - 1].n : 0; } else if (nl.length) {
    lastSeq = nl[nl.length - 1].n;
    for (const l of nl) {
      if (false) {}
      else if (/DEFCON|SHTF|escalat/i.test(l.t)) { bannerHtml = `<div><b>${esc(l.t)}</b></div>`; bannerUntil = Date.now() + 8000; }
    }
    clearTimeout(renderBanner.t); renderBanner.t = setTimeout(() => { $('#banner').innerHTML = ''; }, 9000);
  }
  if (Date.now() < bannerUntil) $('#banner').innerHTML = bannerHtml;
}

// ---------------------------------------------------------------- modals
const closeBtn = () => btn('Close', () => { modalFn = null; render(); });
const box = html => html;
function renderModal() {
  const m = $('#modal'), b = $('#modalBox'); let html = null;
  if (S.over) html = gameOverModal();
  else if (S.pending && mine(S.pending.pl)) html = promptModal(S.pending);
  else if (modalFn) html = modalFn();
  if (html == null) { m.hidden = true; return; }
  m.hidden = false; b.innerHTML = html;
}
function promptModal(pd) {
  const nm = S.players[pd.pl].name, recent = S.log.slice(-8).filter(l => l.pl === pd.pl || l.t.startsWith(nm)).slice(-3).map(l => `<div class="note">${esc(l.t)}</div>`).join('');
  return `<h2>${esc(S.players[pd.pl].name)}: ${esc(pd.title)}</h2>${recent}<div class="btns">${pd.options.map(o => btn(esc(o.label), () => doCmd({ t: 'choose', o: o.id }))).join('')}</div>`;
}
function gameOverModal() {
  const rows = E.summary(S).map(r => `<tr><td>${esc(r.name)}</td><td>${r.prepper}</td><td>${r.health}</td><td>${r.bunker ? 'yes' : 'no'}</td><td>${r.coin}</td><td>${r.resources}</td><td>${r.items}</td></tr>`).join('');
  return `<h2>Pre-APOC game over</h2><p>${esc(S.over.reason === 'apoc' ? `SHTF! Open the ${String(S.over.event).toUpperCase()} Mission Pack. The board has been cleared by the Panic Grab.` : JSON.stringify(S.over))}</p>
  <table class="tbl"><tr><th>Player</th><th>Prepper</th><th>HP</th><th>Bunker</th><th>Coin</th><th>Res</th><th>Items</th></tr>${rows}</table>
  <div class="btns">${btn('Download game log (.txt)', exportText)}${btn('Export log (JSON)', exportLog)}${btn('Play again', () => location.reload())}${btn('Look at the board', () => { modalFn = null; S.over && (S._seen = 1); $('#modal').hidden = true; })}</div>`;
}
function prepperModal(id) {
  const p = S.players[id], pr = E.D.prepper[p.prepper];
  return `<h2>${pr.name} the ${pr.role} <span class="note">(${esc(p.name)})</span></h2><div class="grid" style="grid-template-columns:1fr 1fr">${pr.art.map(a => `<img src="${a}" style="width:100%;border-radius:6px">`).join('')}</div>
  <p><b>Skills:</b></p>${pr.skills.map(k => `<div>• ${esc(k.text)}</div>`).join('')}<p><b>Bunker skills:</b></p>${(pr.bunkerSkills || []).map(k => `<div>• ${esc(k.text)}</div>`).join('')}<div class="btns">${closeBtn()}</div>`;
}
function itemModal(pid, uid) {
  const p = S.players[pid], it = p.items.find(i => i.uid === uid); if (!it) return null;
  if (it.id === 'hidden') return `<h2>Hidden</h2><div class="btns">${closeBtn()}</div>`;
  const d = E.D.item[it.id], can = iAct() && !S.pending && pid === actor() && S.stage === 'turn';
  const back = {}; for (const r of d.recipe) if (!r.x) back[r.r] = (back[r.r] || 0) + 1;
  return `<h2>${esc(d.name)} ${it.broken ? '(broken)' : ''}</h2><div style="display:flex;gap:12px;flex-wrap:wrap"><img src="${d.img}" style="width:220px;border-radius:8px"><div style="flex:1;min-width:200px"><p>${esc(d.text || '')}</p>
  <p class="note">Recipe: ${d.recipe.map(r => esc(E.RES_LABEL[r.r]) + (r.x ? ' (used up)' : '')).join(', ')}</p><p class="note">Scrap returns: ${chips(back)}</p>${it.tokens != null ? `<p>Tokens: ${it.tokens}</p>` : ''}</div></div>
  <div class="btns">${btn('♻ Scrap', () => { modalFn = null; doCmd({ t: 'scrap', uid }); }, { dis: !can })}${it.broken ? btn('🩹 Fix with duct tape', () => { modalFn = null; doCmd({ t: 'fix', uid }); }, { dis: !can || p.res.ducttape < 1 }) : ''}${closeBtn()}</div>`;
}
let craftTab = 'craft';
const craftOk = () => !!(S && !S.over && iAct() && !S.pending && S.stage === 'turn' && S.ts && ['eat', 'news', 'newsroll', 'roll', 'prep'].includes(S.ts.step));
function craftModal() {
  const p = S.players[actor()], ok = craftOk(), ts = S.ts, can = new Map(E.craftable(S, p).map(c => [c.id, c]));
  const tab = (id, l) => btn(l, () => { craftTab = id; render(); }, { cls: craftTab === id ? 'primary' : '' });
  let body;
  if (craftTab === 'craft') {
    body = `<div class="note" style="margin-bottom:6px">${ts && ts.crafted ? '<b>You have already crafted this turn.</b>' : 'You may craft ONE item this turn, at any point.'}</div><div class="grid">${E.D.items.map(it => {
      const c = can.get(it.id), stock = E.stockOf(S, it.id), rc = {}; it.recipe.forEach(r => { rc[r.r] = (rc[r.r] || 0) + 1; });
      return `<div class="tile ${c ? '' : 'dis'}"><img class="zm" data-zoom="${it.img}" src="${it.img}"><div><b>${esc(it.name)}</b> <span class="note">x${stock} left</span></div><div class="res" style="justify-content:center">${chips(c ? c.cost : rc)}</div>${c && c.note ? `<div class="note">${esc(c.note)}</div>` : ''}${it.needsBunker ? '<div class="note">needs bunker</div>' : ''}${it.mustOwn ? `<div class="note">you must own: ${esc(it.mustOwn.map(m => E.D.item[m].name).join(' + '))}</div>` : ''}${btn('Craft', () => doCmd({ t: 'craft', id: it.id }), { dis: !c || !ok })}</div>`;
    }).join('')}</div>`;
  } else {
    body = `<div class="note" style="margin-bottom:6px">${ts && ts.scrapped ? '<b>You have already recycled an item this turn.</b>' : 'You may recycle ONE item this turn, at any point. You get back its resources except the last one, which is lost.'}</div><div class="grid">${p.items.length ? p.items.map(i => {
      const d = E.D.item[i.id], back = {}; for (const r of d.recipe) if (!r.x) back[r.r] = (back[r.r] || 0) + 1;
      return `<div class="tile"><img class="zm" data-zoom="${d.img}" src="${d.img}"><div><b>${esc(d.name)}</b>${i.broken ? ' <span class="note">(broken)</span>' : ''}</div><div class="res" style="justify-content:center">${Object.keys(back).length ? chips(back) : '<span class="note">nothing returned</span>'}</div>${btn('Recycle', () => doCmd({ t: 'scrap', uid: i.uid }), { dis: !ok || (ts && ts.scrapped) })}</div>`;
    }).join('') : '<div class="note">You have no items to recycle.</div>'}</div>`;
  }
  return `<h2>APOC Recipe Book <span class="note">(${esc(p.name)} has ${chips(p.res)})</span></h2><div class="btns" style="margin-bottom:8px">${tab('craft', '🔧 Craft')}${tab('scrap', '♻ Recycle')}</div>${body}<div class="btns">${closeBtn()}</div>`;
}
const cardSnd = new Audio('assets/sfx/card-up.mp3');
function cardUpSound(wasShown) { if (wasShown) return; try { cardSnd.currentTime = 0; cardSnd.play().catch(() => {}); } catch (e) {} }   // sound when a card is enlarged (not when just flipping it)
function zoomMat(id) {   // character card on the table: shown big with a Flip button (backpack side <-> bunker side)
  const p = S.players[id], pr = E.D.prepper[p.prepper]; if (!pr) return;
  V3.flip = V3.flip || {}; const side = V3.flip[id] !== undefined ? V3.flip[id] : (p.bunker ? 1 : 0);
  let o = $('#zoom'); if (!o) { o = document.createElement('div'); o.id = 'zoom'; o.onclick = () => { o.hidden = true; }; document.body.appendChild(o); }
  cardUpSound(!o.hidden);
  o.innerHTML = `<img class="flipin" src="${pr.art[side] || pr.art[0]}"><button class="flipbtn">Flip to ${side ? 'BACKPACK' : 'BUNKER'} side (F)</button>`; o.hidden = false;
  o.querySelector('.flipbtn').onclick = e => { e.stopPropagation(); V3.flip[id] = side ? 0 : 1; V3.matSig = null; zoomMat(id); };
  zoomFlipId = id;
}
let zoomFlipId = null;
function zoomCard(src) {   zoomFlipId = null;   // any face-up card clicked on the table or in a list: show it big in the centre of the screen; click to close
  let o = $('#zoom'); if (!o) { o = document.createElement('div'); o.id = 'zoom'; o.onclick = () => { o.hidden = true; }; document.body.appendChild(o); }
  cardUpSound(!o.hidden); o.innerHTML = `<img src="${src}">`; o.hidden = false;
}
function renderCraftBtn() {
  let b = $('#craftbtn'); if (!b) { b = document.createElement('button'); b.id = 'craftbtn'; b.onclick = () => { modalFn = craftModal; render(); }; $('#boardWrap').appendChild(b); }
  const show = !setupHold && craftOk() && !S.players[actor()].ai; b.hidden = !show; if (!show) return;
  const ts = S.ts; b.innerHTML = `APOC Recipe Book<small>Craft${ts.crafted ? ' ✓' : ''} - Recycle${ts.scrapped ? ' ✓' : ''}</small>`;
}
function shopModal() {
  const p = S.players[actor()];
  return `<h2>${esc(E.D.node[p.node].name)} <span class="note">you have ${p.coin} coin</span></h2><div class="grid">${E.shopList(S, p).map(x => `<div class="tile ${x.stock ? '' : 'dis'}"><img src="${itemImg(x.id)}" style="${x.id === 'DUCT' ? 'width:60px' : ''}"><div><b>${esc(x.name)}</b></div><div class="note">${x.price} coin · ${x.stock} in stock</div>${btn('Buy', () => doCmd({ t: 'buyItem', id: x.id }), { dis: !x.stock || p.coin < x.price })}</div>`).join('')}</div><div class="note">The first purchase uses your action; more from the same shop are free.</div><div class="btns">${closeBtn()}</div>`;
}
let mk = { buy: {}, sell: {} }, sw = { give: {}, get: {} };
function stepper(obj, r, max) { return `<span class="stepper">${btn('−', () => { obj[r] = Math.max(0, (obj[r] || 0) - 1); render(); })}<b>${obj[r] || 0}</b>${btn('+', () => { obj[r] = Math.min(max, (obj[r] || 0) + 1); render(); })}</span>`; }
function marketModal() {
  const p = S.players[actor()], L = S.loc[p.node], price = E.marketPrice(S), isSell = E.D.cfg.sellNodes.includes(p.node);
  const nb = Object.values(mk.buy).reduce((a, b) => a + b, 0), ns = Object.values(mk.sell).reduce((a, b) => a + b, 0);
  const rows = E.ALLRES.filter(r => L.res[r] > 0 || (isSell && p.res[r] > 0)).map(r => `<tr><td>${chip(r, '')} ${E.RES_LABEL[r]}</td><td>${L.res[r] > 0 ? `Buy (${L.res[r]} here @ ${price}) ${stepper(mk.buy, r, L.res[r])}` : ''}</td><td>${isSell && p.res[r] > 0 ? `Sell (you have ${p.res[r]}) ${stepper(mk.sell, r, p.res[r])}` : ''}</td></tr>`).join('');
  return `<h2>${esc(E.D.node[p.node].name)} market</h2><div class="note">Buying costs ${price} each; selling gives ${E.defc(S).sell}. You have ${p.coin} coin and carry ${E.resTotal(p)}/${E.holdLimit(p) === Infinity ? '∞' : E.holdLimit(p)}.</div>
  <table class="tbl">${rows}</table><p>Buying ${nb} (−${nb * price}) · selling ${ns} (+${ns})</p><div class="btns">${btn('Confirm', () => { const r = doCmd({ t: 'market', buy: clean(mk.buy), sell: clean(mk.sell) }); if (!r || r.ok) { modalFn = null; render(); } }, { cls: 'primary', dis: !nb && !ns })}${closeBtn()}</div>`;
}
const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v > 0));
function swapModal() {
  const p = S.players[actor()];
  const g = Object.values(sw.give).reduce((a, b) => a + b, 0), t = Object.values(sw.get).reduce((a, b) => a + b, 0);
  const rows = E.ALLRES.map(r => `<tr><td>${chip(r, '')} ${E.RES_LABEL[r]}</td><td>Give ${p.res[r] > 0 ? stepper(sw.give, r, p.res[r]) : '–'}</td><td>Take (supply ${S.supply[r]}) ${S.supply[r] > 0 ? stepper(sw.get, r, S.supply[r]) : '–'}</td></tr>`).join('');
  return `<h2>Trade resources with the supply</h2><div class="note">Giving ${g}, taking ${t}.</div><table class="tbl">${rows}</table><div class="btns">${btn('Confirm trade', () => { const r = doCmd({ t: 'swap', give: clean(sw.give), get: clean(sw.get) }); if (!r || r.ok) { modalFn = null; render(); } }, { cls: 'primary', dis: !g || !t })}${closeBtn()}</div>`;
}
function tokenPicker(title, fn) {
  const rows = D.board.nodes.filter(n => S.loc[n.id] && E.ALLRES.some(r => S.loc[n.id].res[r] > 0)).map(n => `<tr><td>${esc(n.name || n.id)}</td><td class="res">${E.ALLRES.filter(r => S.loc[n.id].res[r] > 0).map(r => btn(`${E.RES_LABEL[r]} ×${S.loc[n.id].res[r]}`, () => fn(n.id, r))).join('')}</td></tr>`).join('');
  return `<h2>${esc(title)}</h2><table class="tbl">${rows || '<tr><td>No resources on the board.</td></tr>'}</table><div class="btns">${closeBtn()}</div>`;
}
function buildingPicker() {
  return `<h2>Post your bouncer at which building?</h2><div class="btns">${D.board.nodes.filter(n => n.kind === 'building').map(n => btn(esc(n.name || n.id), () => { modalFn = null; doCmd({ t: 'postThug', node: n.id }); })).join('')}</div><div class="btns">${closeBtn()}</div>`;
}
// Rules tab: RULES_LOG.md rendered as collapsible sections (one per ## heading)
let rulesMd = null;
const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
function mdToSections(md) {
  const secs = []; let cur = null, list = null, tbl = null;
  const close = () => { if (cur) { if (list) { cur.h += `</${list}>`; list = null; } if (tbl) { cur.h += '</table>'; tbl = null; } } };
  for (const raw of md.split('\n')) {
    const l = raw.trimEnd();
    if (/^# /.test(l) || /^What the game does/.test(l) || /^Format:/.test(l)) { continue; }
    let m;
    if ((m = l.match(/^## (.*)/))) { close(); cur = { t: m[1], h: '' }; secs.push(cur); continue; }
    if (!cur) continue;
    if ((m = l.match(/^### (.*)/))) { close(); cur.h += `<h4>${inl(m[1])}</h4>`; continue; }
    if (/^\|/.test(l)) { if (/^\|[-| ]+\|$/.test(l)) continue; const cells = l.split('|').slice(1, -1).map(c => c.trim()); if (!tbl) { close(); cur.h += '<table class="rtbl">'; tbl = 1; cur.h += '<tr>' + cells.map(c => `<th>${inl(c)}</th>`).join('') + '</tr>'; } else cur.h += '<tr>' + cells.map(c => `<td>${inl(c)}</td>`).join('') + '</tr>'; continue; }
    if (tbl) { cur.h += '</table>'; tbl = null; }
    if ((m = l.match(/^- (.*)/))) { if (list !== 'ul') { close(); cur.h += '<ul>'; list = 'ul'; } cur.h += `<li>${inl(m[1])}</li>`; continue; }
    if ((m = l.match(/^\d+\. (.*)/))) { if (list !== 'ol') { close(); cur.h += '<ol>'; list = 'ol'; } cur.h += `<li>${inl(m[1])}</li>`; continue; }
    if (!l.trim()) { if (list) { cur.h += `</${list}>`; list = null; } continue; }
    if (list) { cur.h += `</${list}>`; list = null; }
    cur.h += `<p>${inl(l)}</p>`;
  }
  close(); return secs;
}
function rulesModal() {
  if (rulesMd === null) { rulesMd = ''; fetch('RULES_LOG.md?v=' + Date.now()).then(r => r.text()).then(t => { rulesMd = t; render(); }).catch(() => { rulesMd = 'Could not load the rules.'; render(); }); }
  const secs = rulesMd ? mdToSections(rulesMd) : [];
  return `<div style="max-width:760px"><h2>Rules so far <span class="note">(${esc(VERSION)})</span></h2><div class="rules">${secs.length ? secs.map((s, i) => `<details ${i === 0 ? 'open' : ''}><summary>${inl(s.t)}</summary>${s.h}</details>`).join('') : esc(rulesMd || 'Loading…')}</div><div class="btns">${closeBtn()}</div></div>`;
}
let assumptions = null;
function assumptionsModal() {
  if (assumptions === null) { assumptions = ''; fetch('ASSUMPTIONS.md').then(r => r.text()).then(t => { assumptions = t; render(); }); }
  return `<h2>Assumptions &amp; open questions</h2><div style="white-space:pre-wrap;font-size:13px">${esc(assumptions || 'Loading…')}</div><div class="btns">${closeBtn()}</div>`;
}

// ---------------------------------------------------------------- sandbox panel
function sandboxPanel() {   // compact test tools, shown in the side bar (own box under the turn panel)
  const t = Math.min(sbxTarget, S.players.length - 1), p = S.players[t];
  const mini = (label, fn, o = {}) => btn(label, fn, o);
  return `<details open class="sbx"><summary>🧪 Sandbox tools</summary>
  <div class="sr"><span class="sl">Player</span>${S.players.map(q => mini(esc(q.name), () => { sbxTarget = q.id; render(); }, { cls: q.id === t ? 'on' : '' })).join('')}</div>
  <div class="sr"><span class="sl">Resources</span><div class="sg">${E.ALLRES.map(r => `<span class="sc"><img src="assets/counters/${ICON[r]}.webp" title="${E.RES_LABEL[r]}"><b>${p.res[r]}</b>${mini('−', () => doCmd({ t: 'sbxGive', p: t, r, n: -1 }), { dis: p.res[r] < 1 })}${mini('+', () => doCmd({ t: 'sbxGive', p: t, r, n: 1 }))}</span>`).join('')}</div></div>
  <div class="sr"><span class="sl">Quick</span>${mini('+3 coin', () => doCmd({ t: 'sbxCoin', p: t, n: 3 }))}${mini('+1 HP', () => doCmd({ t: 'sbxHealth', p: t, n: p.health + 1 }))}${mini('−1 HP', () => doCmd({ t: 'sbxHealth', p: t, n: p.health - 1 }))}${mini('+4 moves', () => doCmd({ t: 'sbxMoves', n: 4 }))}</div>
  <div class="sr"><span class="sl">DEFCON</span>${[0, 1, 2].map(i => mini(['Green', 'Yellow', 'Orange'][i], () => doCmd({ t: 'sbxDefcon', n: i }), { cls: S.defcon === i ? 'on' : '' })).join('')}${mini('Trigger APOC', () => doCmd({ t: 'sbxApoc' }))}</div>
  <div class="sr"><span class="sl">Move</span>${mini(sbxMove ? '✔ click board' : 'Teleport…', () => { sbxMove = !sbxMove; render(); }, { cls: sbxMove ? 'on' : '' })}</div>
  <div class="sr"><span class="sl">Item</span><select id="sbxItem">${E.D.items.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select>${mini('Give', () => doCmd({ t: 'sbxItem', p: t, id: $('#sbxItem').value }))}</div></details>`;
}
let sbxKeep = null;
function renderSandbox() {
  const el = $('#sbx'); if (!el) return;
  if (!S || !S.sandbox) { el.innerHTML = ''; return; }
  if (document.activeElement && document.activeElement.id === 'sbxItem') return;   // don't rebuild while the item list is open
  const sel = sbxKeep; el.innerHTML = sandboxPanel(); const si = $('#sbxItem'); if (si && sel) si.value = sel; if (si) si.onchange = () => { sbxKeep = si.value; };
  if (!renderSandbox.opened) { renderSandbox.opened = true; if (window.setSide) window.setSide(false); }   // sandbox games open the side bar once
}

boot().catch(e => { document.body.insertAdjacentHTML('afterbegin', `<pre style="color:#f88;padding:12px">${esc(e.stack || e)}</pre>`); });
