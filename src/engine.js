// APOC pre-APOC rules engine. Pure, deterministic (seeded), JSON-serialisable state.
// Usage: init(data); const s = createGame({players:[...], seed}); dispatch(s, playerIdx, {t:'...'}).
// The host (or a single browser) owns the state; everything else is a view of it.

export const RES = ['food', 'knowhow', 'chem', 'hardware', 'tech', 'meds'];
export const ALLRES = [...RES, 'ducttape'];
export const RES_LABEL = { food: 'Food', knowhow: 'Know-how', chem: 'Chem', hardware: 'Hardware', tech: 'Tech', meds: 'Meds', ducttape: 'Duct tape' };
export const APOC_TYPES = ['ai', 'pandemic', 'nuclear'];
export let D = null;

// ------------------------------------------------------------------ setup
export function init(data) {
  D = { ...data };
  for (const n of data.board.nodes) { n.acts = n.acts || []; n.entrances = n.entrances || []; n.setup = n.setup || {}; }
  D.node = Object.fromEntries(data.board.nodes.map(n => [n.id, n]));
  D.adj = {};
  for (const n of data.board.nodes) D.adj[n.id] = [];
  for (const [a, b] of data.board.edges) { D.adj[a].push(b); D.adj[b].push(a); }
  D.item = Object.fromEntries(data.items.map(i => [i.id, i]));
  D.newsById = Object.fromEntries(data.news.map(n => [n.id, n]));
  D.prepper = Object.fromEntries(data.preppers.map(p => [p.id, p]));
  D.cfg = data.config;
  const VX = data.board.gridX;
  const HY = Object.values(data.board.gridY).map(a => a.reduce((x, y) => x + y, 0) / a.length);
  for (const n of data.board.nodes) {
    if (n.kind !== 'building') continue;
    let c = 0, r = 0;
    VX.forEach(x => { if (n.x > x) c++; });
    HY.forEach(y => { if (n.y > y) r++; });
    n.block = (n.acts.includes('park') || n.acts.includes('dive')) ? 'x_' + n.id : `${c}_${r}`;
  }
  // nodes "on or adjacent to the river" (bottom street row + buildings that open onto it)
  D.river = new Set();
  for (const n of data.board.nodes) {
    if (n.kind === 'street' && (n.id.startsWith('H3_'))) D.river.add(n.id);
    if (n.kind === 'intersection' && n.id.startsWith('I3')) D.river.add(n.id);
  }
  for (const n of data.board.nodes) if (n.kind === 'building' && n.entrances.some(e => D.river.has(e))) D.river.add(n.id);
  D.dumpsters = data.board.nodes.filter(n => n.acts && n.acts.includes('dive')).map(n => n.id);
  return D;
}

function rnd(s) {
  s.rng = (s.rng + 0x6D2B79F5) | 0;
  let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const d6 = s => 1 + Math.floor(rnd(s) * 6);
function shuffle(s, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function createGame(opts) {
  const cfg = D.cfg;
  const s = {
    v: 1, rng: (opts.seed ?? (Date.now() & 0x7fffffff)) | 0, log: [], players: [], cur: 0, round: 1,
    defcon: 0, panic: [], stand: { ai: [], pandemic: [], nuclear: [] }, offers: [], pid: 0,
    pending: null, queue: [], sandbox: !!opts.sandbox, over: null, stage: 'turn', ts: null, grab: null,
    supply: { ...cfg.supply }, bustedLeft: cfg.busted, thugsBar: cfg.thugs, bunkerBonusTaken: false,
    loc: {}, itemDeck: [], newsDeck: [], endTimes: { yellow: [], orange: [] }, uid: 0, lastRoll: null, seq: 0,
  };
  for (const n of D.board.nodes) {
    s.loc[n.id] = { res: {}, coin: 0, items: [] };
    if (n.setup) for (const [r, c] of Object.entries(n.setup)) { s.loc[n.id].res[r] = c; s.supply[r] -= c; }
  }
  for (const it of D.items) for (let i = 0; i < cfg.itemCopies; i++) s.itemDeck.push({ uid: ++s.uid, id: it.id });
  shuffle(s, s.itemDeck);
  const reg = D.news.filter(n => !n.endTimes).map(n => n.id);
  s.newsDeck = shuffle(s, reg);
  for (const n of D.news) if (n.endTimes) s.endTimes[n.endTimes].push(n.id);
  opts.players.forEach((pl, i) => {
    const p = {
      id: i, name: pl.name, ai: !!pl.ai, prepper: pl.prepper, node: D.board.startNode, health: cfg.maxHealth, bunker: false,
      res: Object.fromEntries(ALLRES.map(r => [r, 0])), coin: cfg.startCoin, items: [], busted: 0, tagged: false,
      thug: null, admitted: false, carePending: false, moon: false, askedHospital: false, standee: null,
    };
    s.players.push(p);
    gain(s, p, 'food', cfg.startFood);
  });
  const humans = s.players.filter(p => !p.ai);   // humans always go first (random among them)
  s.cur = humans.length ? humans[Math.floor(rnd(s) * humans.length)].id : Math.floor(rnd(s) * s.players.length);
  logm(s, `Game starts. ${s.players[s.cur].name} goes first.`);
  beginTurn(s);
  advance(s);
  return s;
}

// ------------------------------------------------------------------ helpers
export const cur = s => s.players[s.cur];
export function logm(s, text, pl = null) { s.log.push({ n: ++s.seq, t: text, pl }); if (s.log.length > 600) s.log.splice(0, 100); }
export const defc = s => D.cfg.defcon[s.defcon];
export const nameOf = (s, i) => s.players[i].name;
export function resTotal(p) { return ALLRES.reduce((a, r) => a + p.res[r], 0); }
export function holdLimit(p) { if (p.bunker) return Infinity; return D.cfg.backpack + (hasItem(p, 'shopping-cart') ? 10 : 0); }
export function hasItem(p, id) { return p.items.some(i => i.id === id && !i.broken); }
export function ownsItem(p, id) { return p.items.some(i => i.id === id); }
export function gain(s, p, r, n) {
  const amt = Math.max(0, Math.min(n, s.supply[r], holdLimit(p) - resTotal(p)));
  s.supply[r] -= amt; p.res[r] += amt;
  if (amt < n) logm(s, `${p.name} could only take ${amt} of ${n} ${RES_LABEL[r]} (supply/limit).`);
  return amt;
}
export function spend(s, p, r, n) { p.res[r] -= n; s.supply[r] += n; }
export function afford(p, cost) { return Object.entries(cost).every(([r, n]) => p.res[r] >= n); }
function activeEffects(s) {
  const out = new Set();
  for (const t of APOC_TYPES) { const top = s.stand[t][s.stand[t].length - 1]; if (top) out.add(D.newsById[top].effect); }
  return out;
}
export const hospitalOpen = s => defc(s).hospital && !activeEffects(s).has('hospitalClosed');
export const subwayOpen = s => !activeEffects(s).has('subwayClosed');
export const nightBlocked = s => activeEffects(s).has('curfew');
function sectorOf(nodeId) { return D.node[nodeId].sector; }
const WEST = ['NW', 'WC', 'SW'], EAST = ['NE', 'EC', 'SE'];

function takeCard(s, id) {
  const i = s.itemDeck.findIndex(c => c.id === id);
  if (i < 0) return null;
  const c = s.itemDeck.splice(i, 1)[0];
  shuffle(s, s.itemDeck);
  return c;
}
function giveCard(s, p, card, broken = false) { p.items.push({ uid: card.uid, id: card.id, broken, tokens: 0 }); }
export function stockOf(s, id) { return s.itemDeck.filter(c => c.id === id).length; }
function drawTop(s, { notBunker = false, not = [] } = {}) {
  const skipped = [];
  let found = null;
  while (s.itemDeck.length) {
    const c = s.itemDeck.shift();
    const it = D.item[c.id];
    if ((notBunker && it.needsBunker) || not.includes(c.id)) { skipped.push(c); continue; }
    found = c; break;
  }
  s.itemDeck.push(...skipped); shuffle(s, s.itemDeck);
  return found;
}

export function mods(s, p, kind) {
  const KINDS = {
    steal: ['steal'], loot: ['loot'], burgle: ['steal', 'burgle', 'salv'], dive: ['steal', 'scavenge', 'salv'],
    raid: ['steal', 'raid'], combat: ['combat', 'marks'],
  }[kind];
  let m = 0;
  const night = s.ts && s.ts.dayKind === 'night';
  for (const it of p.items) {
    if (it.broken) continue;
    const def = D.item[it.id];
    if (def.bonus) for (const k of KINDS) if (def.bonus[k]) m += def.bonus[k];
    if (def.flashlight && night && ['burgle', 'dive', 'raid'].includes(kind)) m += 1;
  }
  if (p.prepper === 'frost') {
    if (kind === 'combat' && p.items.some(i => !i.broken && D.item[i.id].gun)) m += 1;
    if (kind === 'burgle' || kind === 'dive') m += 1;
  }
  if (kind === 'combat' && p.thug && p.thug.job === 'muscle') m += 1;
  return m;
}

// ------------------------------------------------------------------ prompts
function ask(s, { pl, kind, title, options, ctx = {}, auto = false }) {
  s.queue.push({ id: ++s.pid, pl, kind, title, options, ctx, auto });
}
const opt = (id, label, extra = {}) => ({ id, label, ...extra });
function pump(s) {
  while (!s.pending && s.queue.length) {
    const h = s.queue.shift();
    if (h.auto) RESOLVE[h.kind](s, h, h.options[0].id); else s.pending = h;
  }
}

// ------------------------------------------------------------------ damage / health
function hurt(s, p, n, why = '') {
  if (n <= 0) return 0;
  if (p.moon) { logm(s, `${p.name}'s moonshine numbs ${n} damage${why ? ' (' + why + ')' : ''}.`); return 0; }
  const kv = p.items.find(i => i.id === 'kevlar-vest' && !i.broken);
  if (kv) {
    kv.tokens++;
    logm(s, `${p.name}'s Kevlar Vest blocks the damage${why ? ' (' + why + ')' : ''} (${kv.tokens}/4).`);
    if (kv.tokens >= 4) { p.items.splice(p.items.indexOf(kv), 1); s.itemDeck.push({ uid: kv.uid, id: kv.id }); shuffle(s, s.itemDeck); logm(s, `${p.name}'s Kevlar Vest is spent and goes back in the deck.`); }
    return 0;
  }
  p.health = Math.max(0, p.health - n);
  logm(s, `${p.name} loses ${n} HEALTH${why ? ' (' + why + ')' : ''} -> ${p.health}.`, p.id);
  if (p.health === 0) hospitalCheck(s, p);
  return n;
}
function heal(s, p, n) { p.health = Math.min(D.cfg.maxHealth, p.health + n); if (p.health > 0) p.askedHospital = false; }
function hospitalCheck(s, p) {
  if (p.health > 0 || p.askedHospital || p.node === D.board.hospitalNode) return;
  p.askedHospital = true;
  if (!hospitalOpen(s)) { logm(s, `${p.name} is at 0 HEALTH and the hospital is closed.`); return; }
  ask(s, { pl: p.id, kind: 'goHospital', title: `${p.name} is at 0 HEALTH. Go to the hospital?`, options: [opt('go', 'Go to the hospital (turn ends)'), opt('stay', 'Stay out there')] });
}

// ------------------------------------------------------------------ resolving prompts
const RESOLVE = {};
RESOLVE.goHospital = (s, pd, o) => {
  const p = s.players[pd.pl];
  if (o === 'go') {
    p.node = D.board.hospitalNode; p.admitted = true;
    logm(s, `${p.name} is rushed to the hospital.`, p.id);
    if (s.stage === 'turn' && s.cur === p.id && s.ts.step === 'prep') s.ts.forceEnd = true;
  }
};
RESOLVE.hospitalCare = (s, pd, o) => {
  const p = s.players[pd.pl];
  if (o === 'care') { heal(s, p, 10); p.carePending = true; logm(s, `${p.name} receives professional care and spends the turn in hospital.`, p.id); s.ts.skipPrep = true; p.admitted = false; }
  else {
    const r = d6(s); heal(s, p, r); logm(s, `${p.name} drinks hand sanitizer (rolled ${r}): health ${p.health}.`, p.id);
    p.admitted = false; p.node = 'H1_3';
    hurt(s, p, 1, 'hand sanitizer');
    if (p.health === 0) { p.askedHospital = true; }
  }
};
RESOLVE.thugPay = (s, pd, o) => {
  const p = s.players[pd.pl];
  if (o === 'food') spend(s, p, 'food', 1); else if (o === 'coin') p.coin -= 1;
  else { p.thug = null; s.thugsBar++; logm(s, `${p.name} lets their thug go.`, p.id); }
};
RESOLVE.thugJob = (s, pd, o) => {
  const p = s.players[pd.pl];
  if (!p.thug) return;
  p.thug.job = o;
  if (o === 'bouncer' && p.thug.post) {
    if (p.coin >= 1) { p.coin -= 1; logm(s, `${p.name} pays 1 PREPCOIN to keep the bouncer posted.`); }
    else { p.thug.post = null; logm(s, `${p.name} cannot pay: the bouncer goes home.`); }
  } else if (o !== 'bouncer') p.thug.post = null;
};
RESOLVE.pickRes = (s, pd, o) => {   // generic "choose a resource" -> applies pd.ctx.then
  const p = s.players[pd.pl];
  THEN[pd.ctx.then](s, p, o, pd.ctx);
};
const THEN = {};
THEN.found = (s, p, r) => { gain(s, p, r, 1); logm(s, `${p.name} finds 1 ${RES_LABEL[r]}.`, p.id); };
THEN.robbed = (s, p, r) => { if (p.res[r] > 0) { spend(s, p, r, 1); logm(s, `${p.name} is robbed of 1 ${RES_LABEL[r]}.`, p.id); } };
THEN.loseOne = THEN.robbed;
THEN.diveCan = (s, p, r) => { gain(s, p, r, 1); logm(s, `${p.name} opens a mystery can: 1 ${RES_LABEL[r]}.`, p.id); };
THEN.burgle4 = (s, p, r) => { gain(s, p, r, 1); logm(s, `${p.name} finds 1 ${RES_LABEL[r]} in the house.`, p.id); };
THEN.burgle5 = (s, p, r, ctx) => { gain(s, p, r, 1); if (ctx.n > 1) pickRes(s, p, 'burgle5', 'Second pick from the padlocked containers', ALLRES.filter(x => x !== 'ducttape'), { n: ctx.n - 1 }); };
THEN.drone = (s, p, r, ctx) => { takeFromLoc(s, p, ctx.node, r); logm(s, `${p.name}'s drone grabs 1 ${RES_LABEL[r]} from ${D.node[ctx.node].name}.`, p.id); s.ts.droneUsed = true; };
THEN.thief = (s, p, r, ctx) => { takeFromLoc(s, p, ctx.node, r); logm(s, `${p.name}'s thug steals 1 ${RES_LABEL[r]} from ${D.node[ctx.node].name}.`, p.id); s.ts.thiefUsed = true; };
THEN.trade = (s, p, r, ctx) => { /* handled by cmd */ };
function pickRes(s, p, then, title, list, ctx = {}) {
  const options = list.map(r => opt(r, RES_LABEL[r]));
  ask(s, { pl: p.id, kind: 'pickRes', title, options, ctx: { then, ...ctx } });
}
function takeFromLoc(s, p, nodeId, r) {
  const L = s.loc[nodeId];
  if (!L.res[r]) return false;
  if (resTotal(p) >= holdLimit(p)) return false;
  L.res[r]--; p.res[r]++; return true;
}

// ---- steal / loot loop
function lootRoll(s, p, mode) {
  const L = s.loc[p.node];
  const r = d6(s), m = mods(s, p, mode), total = r + m;
  logm(s, `${p.name} rolls ${r}${m ? ' +' + m : ''} to ${mode}.`, p.id);
  s.lastRoll = { pl: p.id, kind: 'risk', value: r, mod: m, total, why: mode };
  if (total >= 3) {
    const avail = RES.concat(['ducttape']).filter(x => L.res[x] > 0);
    if (!avail.length) return;
    ask(s, { pl: p.id, kind: 'lootPick', title: `Success! ${mode === 'steal' ? 'Steal' : 'Loot'} which resource?`, options: avail.map(x => opt(x, `${RES_LABEL[x]} (${L.res[x]})`)), ctx: { mode } });
  } else if (mode === 'steal') {
    arrest(s, p);
  } else {
    // shot by the owner
    const lost = s.ts.looted || [];
    for (const x of lost) { p.res[x]--; L.res[x] = (L.res[x] || 0) + 1; }
    s.ts.looted = [];
    logm(s, `${p.name} is SHOT by the owner! Loses everything looted this action.`, p.id);
    hurt(s, p, 2, 'shot');
    if (p.health > 0) {
      const ds = D.dumpsters.map(id => [id, Math.hypot(D.node[id].x - D.node[p.node].x, D.node[id].y - D.node[p.node].y)]).sort((a, b) => a[1] - b[1])[0][0];
      p.node = ds; logm(s, `${p.name} crawls into the nearest dumpster.`, p.id);
    }
    s.ts.forceEnd = true;
  }
}
RESOLVE.lootPick = (s, pd, o) => {
  const p = s.players[pd.pl], L = s.loc[p.node];
  if (!takeFromLoc(s, p, p.node, o)) { logm(s, `${p.name} can't carry any more.`); return; }
  s.ts.looted = (s.ts.looted || []).concat([o]);
  logm(s, `${p.name} ${pd.ctx.mode === 'steal' ? 'steals' : 'loots'} 1 ${RES_LABEL[o]}.`, p.id);
  const left = ALLRES.some(x => L.res[x] > 0);
  if (left && resTotal(p) < holdLimit(p)) ask(s, { pl: p.id, kind: 'lootAgain', title: 'Push your luck?', options: [opt('again', 'Go again'), opt('stop', 'Stop here')], ctx: pd.ctx });
  else s.ts.looted = [];
};
RESOLVE.lootAgain = (s, pd, o) => { if (o === 'again') lootRoll(s, s.players[pd.pl], pd.ctx.mode); else s.ts.looted = []; };
function arrest(s, p) {
  logm(s, `${p.name} is BUSTED!`, p.id);
  p.node = D.board.policeNode;
  if (p.coin >= 2) { p.coin -= 2; logm(s, `${p.name} pays a 2 PREPCOIN fine.`); }
  else {
    const have = ALLRES.filter(r => p.res[r] > 0).sort((a, b) => p.res[b] - p.res[a]);
    let n = 0;
    for (const r of have) { while (p.res[r] > 0 && n < 2) { p.res[r]--; s.loc[D.board.churchNode].res[r] = (s.loc[D.board.churchNode].res[r] || 0) + 1; n++; } }
    if (n === 0) { p.coin += 2; logm(s, `The Police Chief gives ${p.name} 2 PREPCOIN gate money.`); }
    else logm(s, `${p.name} does community service: ${n} resource(s) left at the church.`);
  }
  if (s.bustedLeft > 0) { s.bustedLeft--; p.busted++; }
  if (p.busted >= 3) { p.tagged = true; s.bustedLeft += 2; p.busted = 0; logm(s, `${p.name} is TAGGED: day dice only, no stealing.`, p.id); }
  s.ts.forceEnd = true;
}

// ---- dumpster / burgle tables
function doDive(s, p) {
  const r = d6(s), m = mods(s, p, 'dive'), t = Math.max(1, Math.min(6, r + m));
  s.lastRoll = { pl: p.id, kind: 'risk', value: r, mod: m, total: t, why: 'dumpster dive' };
  logm(s, `${p.name} dives: rolled ${r}${m ? ' +' + m : ''}.`, p.id);
  if (t === 1) hurt(s, p, 2, 'rats');
  else if (t === 2) logm(s, 'The garbage truck already came. Nothing.');
  else if (t === 3) pickRes(s, p, 'diveCan', 'Mystery can: Food or Chem?', ['food', 'chem']);
  else if (t === 4) { gain(s, p, 'ducttape', 1); logm(s, `${p.name} finds duct tape.`); }
  else if (t === 5) { gain(s, p, 'food', 2); logm(s, `${p.name} finds 2 food.`); }
  else {
    const c = drawTop(s, { not: ['med-lab', 'hydroponics-lab', 'boat'] });
    if (c) { giveCard(s, p, c, true); logm(s, `${p.name} finds a BROKEN ${D.item[c.id].name}. (Fix it with 1 duct tape.)`, p.id); }
  }
}
function doBurgle(s, p) {
  const r = d6(s), m = mods(s, p, 'burgle'), t = Math.max(1, Math.min(6, r + m));
  s.lastRoll = { pl: p.id, kind: 'risk', value: r, mod: m, total: t, why: 'burgle' };
  logm(s, `${p.name} burgles: rolled ${r}${m ? ' +' + m : ''}.`, p.id);
  if (t === 1) hurt(s, p, 2, 'shot by the owner');
  else if (t === 2) { logm(s, 'Alarm triggered! No loot; back to the street.'); p.node = D.node[p.node].entrances[0]; }
  else if (t === 3) { gain(s, p, 'food', 2); logm(s, `${p.name} finds 2 food in the fridge.`); }
  else if (t === 4) pickRes(s, p, 'burgle4', 'Find 1 resource of your choice', RES);
  else if (t === 5) {
    if (hasItem(p, 'bolt-cutters')) pickRes(s, p, 'burgle5', 'Padlocked containers: take 2 resources', RES, { n: 2 });
    else { gain(s, p, 'hardware', 1); logm(s, `${p.name} takes 1 hardware.`); }
  } else {
    const c = drawTop(s, { notBunker: true });
    if (c) { giveCard(s, p, c); logm(s, `${p.name} finds a ${D.item[c.id].name}!`, p.id); }
  }
}

// ---- gambling
function gambleThrow(s, p) {
  const g = s.ts.gamble; g.n++;
  const need = [2, 3, 4, 4, 6][g.n - 1];
  const win = [1, 1, 2, 3, 4][g.n - 1], church = [0, 0, 1, 1, 2][g.n - 1];
  const r = d6(s); s.lastRoll = { pl: p.id, kind: 'risk', value: r, mod: 0, total: r, why: 'gamble' };
  if (r >= need) {
    g.pot += win; s.loc[D.board.churchNode].coin += church;
    logm(s, `${p.name} throws ${r} (needed ${need}+): pot ${g.pot}${church ? `, ${church} to the church` : ''}.`, p.id);
    if (g.n >= 5) { p.coin += g.pot; logm(s, `${p.name} cashes out ${g.pot}.`); s.ts.gamble = null; }
    else ask(s, { pl: p.id, kind: 'gambleNext', title: `Pot is ${g.pot}. Throw again (need ${[2, 3, 4, 4, 6][g.n]}+) or cash out?`, options: [opt('throw', 'Throw again'), opt('cash', `Cash out ${g.pot}`)] });
  } else {
    logm(s, `${p.name} throws ${r} (needed ${need}+) and busts! Loses the pot, takes 1 food.`, p.id);
    gain(s, p, 'food', 1); s.ts.gamble = null;
  }
}
RESOLVE.gambleNext = (s, pd, o) => {
  const p = s.players[pd.pl], g = s.ts.gamble;
  if (o === 'cash') { p.coin += g.pot; logm(s, `${p.name} cashes out ${g.pot} PREPCOIN.`, p.id); s.ts.gamble = null; }
  else gambleThrow(s, p);
};

// ---- combat
function combatRoll(s, p, tag) {
  const r = d6(s), m = mods(s, p, 'combat');
  return { r, m, total: r + m, nat1: r === 1, name: p.name, id: p.id, tag };
}
function resolveCombat(s, a, d, { forced = true, raid = false } = {}) {
  const ra = combatRoll(s, a), rd = combatRoll(s, d);
  logm(s, `FIGHT! ${a.name} ${ra.r}${ra.m ? '+' + ra.m : ''} vs ${d.name} ${rd.r}${rd.m ? '+' + rd.m : ''}.`);
  s.lastRoll = { pl: a.id, kind: 'fight', a: ra, d: rd };
  if (ra.nat1 && rd.nat1) { hurt(s, a, 1, 'fumble'); hurt(s, d, 1, 'fumble'); return { winner: null }; }
  let win = null;
  if (ra.nat1) win = d; else if (rd.nat1) win = a;
  else if (ra.total > rd.total) win = a; else if (rd.total > ra.total) win = d;
  if (!win) { logm(s, 'A tie. Nobody is hurt.'); return { winner: null }; }
  const lose = win === a ? d : a;
  const dmg = Math.max((ra.nat1 || rd.nat1) ? 1 : 0, Math.min(3, Math.abs(ra.total - rd.total)));
  logm(s, `${win.name} wins and ${lose.name} takes ${dmg} damage.`, win.id);
  const hit = hurt(s, lose, dmg, 'combat');
  if (hit > 0 && lose.prepper === 'naomi' && lose.bunker) { stealAny(s, lose, win, 'detention'); }
  return { winner: win, loser: lose, dmg };
}
function stealAny(s, from, to, why) {  // `to` loses one resource (Naomi's Detention)
  const have = ALLRES.filter(r => to.res[r] > 0).sort((a, b) => to.res[b] - to.res[a]);
  if (have.length) { spend(s, to, have[0], 1); logm(s, `DETENTION! ${to.name} loses 1 ${RES_LABEL[have[0]]}.`); }
}
function robOptions(from) {
  const opts = [];
  if (!from.bunker) for (const r of ALLRES) if (from.res[r] > 0) opts.push(r);
  if (from.coin > 0) opts.push('coin');
  return opts;
}
function robTake(s, from, to, pick) {
  if (pick === 'coin') { from.coin--; to.coin++; logm(s, `${to.name} takes 1 PREPCOIN from ${from.name}.`); }
  else if (resTotal(to) < holdLimit(to)) { from.res[pick]--; to.res[pick]++; logm(s, `${to.name} takes 1 ${RES_LABEL[pick]} from ${from.name}.`); }
}
function robOne(s, from, to) {      // `to` takes 1 resource or coin from `from` (not from a bunker)
  const opts = robOptions(from);
  if (!opts.length) return;
  if (to.ai) { robTake(s, from, to, opts.includes('coin') && from.coin > 1 ? 'coin' : [...opts].sort((a, b) => (from.res[b] || 0) - (from.res[a] || 0))[0]); return; }
  ask(s, { pl: to.id, kind: 'robPick', title: `Take 1 from ${from.name}:`, options: opts.map(r => opt(r, r === 'coin' ? `PREPCOIN (${from.coin})` : `${RES_LABEL[r]} (${from.res[r]})`)), ctx: { from: from.id } });
}
RESOLVE.robPick = (s, pd, o) => robTake(s, s.players[pd.ctx.from], s.players[pd.pl], o);
function adjacentOpen(s, nodeId) {
  return D.adj[nodeId].filter(n => D.node[n].kind !== 'building');
}
RESOLVE.fightDefend = (s, pd, o) => {
  const a = s.players[pd.ctx.a], d = s.players[pd.pl];
  if (o === 'yield') {
    logm(s, `${d.name} yields and cowers before ${a.name}.`);
    robOne(s, d, a);
    const adj = adjacentOpen(s, d.node);
    if (adj.length) d.node = adj[Math.floor(rnd(s) * adj.length)];
  } else {
    const res = resolveCombat(s, a, d);
    if (res.winner) {
      robOne(s, res.loser, res.winner);
      const adj = adjacentOpen(s, res.loser.node);
      if (adj.length) res.loser.node = adj[Math.floor(rnd(s) * adj.length)];
    }
  }
};
RESOLVE.raidDefend = (s, pd, o) => {
  const a = s.players[pd.ctx.a], d = s.players[pd.pl];
  if (o === 'fight') {
    const res = resolveCombat(s, a, d);
    if (res.winner === a) { logm(s, `${a.name} overpowers the bunker defences!`); raidTake(s, a, d, 3); }
    else logm(s, 'The raid fails.');
  } else if (o === 'trap') {
    payTrap(s, d);
    logm(s, `BOOBY TRAP! ${a.name} loses their eyebrows and 2 HEALTH and steals nothing.`);
    hurt(s, a, 2, 'booby trap');
  } else raidTake(s, a, d, 3);
};
function trapCost(p) {  // what it takes to arm a booby trap (null if impossible)
  const need = ['moonshine', 'camping-stove'].filter(i => !hasItem(p, i));
  const subs = p.prepper === 'sam' && p.bunker ? need.length * 2 : (need.length ? Infinity : 0);
  if (p.res.hardware < 1) return null;
  if (need.length && p.res.knowhow < subs) return null;
  return { missing: need, kh: need.length * 2 };
}
export function canTrap(p) { return !!trapCost(p); }
function payTrap(s, d) {
  const c = trapCost(d);
  spend(s, d, 'hardware', 1);
  for (const id of ['moonshine', 'camping-stove']) { const i = d.items.findIndex(x => x.id === id && !x.broken); if (i >= 0) { const [c2] = d.items.splice(i, 1); s.itemDeck.push({ uid: c2.uid, id: c2.id }); } }
  if (c.kh) spend(s, d, 'knowhow', c.kh);
  shuffle(s, s.itemDeck);
}
function raidTake(s, a, d, n) {
  for (let i = 0; i < n; i++) {
    const have = ALLRES.filter(r => d.res[r] > 0).sort((x, y) => d.res[y] - d.res[x]);
    if (!have.length || resTotal(a) >= holdLimit(a)) break;
    d.res[have[0]]--; a.res[have[0]]++;
    logm(s, `${a.name} takes 1 ${RES_LABEL[have[0]]} from ${d.name}'s bunker.`);
  }
}

// ---- offers (first prepper to reach a node)
RESOLVE.offer = (s, pd, o) => {
  const p = s.players[pd.pl], of = pd.ctx.offer;
  if (o === 'decline') return;
  if (of.kind === 'item') {
    if (o === 'coin') p.coin -= 1; else if (o === 'tech') spend(s, p, 'tech', 1); else if (o === 'food') spend(s, p, 'food', 1);
    else if (o === 'tech2') spend(s, p, 'tech', 2);
    const c = takeCard(s, of.item);
    if (c) { giveCard(s, p, c); logm(s, `${p.name} acquires a ${D.item[of.item].name}.`, p.id); }
  } else if (of.kind === 'free') {
    const c = drawTop(s); if (c) { giveCard(s, p, c); logm(s, `${p.name} takes the top item: ${D.item[c.id].name}.`, p.id); }
  }
};
function onEnter(s, p) {
  const here = p.node;
  const i = s.offers.findIndex(o => o.nodes.includes(here));
  if (i >= 0) {
    const of = s.offers.splice(i, 1)[0];
    const options = [];
    if (of.cost.coin && p.coin >= 1) options.push(opt('coin', `Pay ${of.cost.coin} PREPCOIN`));
    if (of.cost.tech && p.res.tech >= of.cost.tech) options.push(opt(of.cost.tech === 2 ? 'tech2' : 'tech', `Pay ${of.cost.tech} TECH`));
    if (of.cost.food && p.res.food >= 1) options.push(opt('food', `Pay ${of.cost.food} FOOD`));
    if (of.kind === 'free') options.push(opt('take', 'Take it'));
    if (options.length) { options.push(opt('decline', 'No thanks')); ask(s, { pl: p.id, kind: 'offer', title: of.text, options, ctx: { offer: of } }); }
    else logm(s, `${p.name} arrives first at ${D.node[here].name} but cannot meet the price (${of.text}).`);
  }
  if (here === D.board.churchNode) {
    const L = s.loc[here];
    if (L.coin > 0) { p.coin += L.coin; logm(s, `${p.name} collects ${L.coin} PREPCOIN from the church collection plate.`, p.id); L.coin = 0; }
  }
  if (here === D.board.startNode) {
    if (p.prepper === 'jessica' && !s.ts.forager) { s.ts.forager = true; gain(s, p, 'food', 1); logm(s, 'Jessica forages 1 food in the park.', p.id); }
    if (hasItem(p, 'camping-stove') && !s.ts.stove) { s.ts.stove = true; gain(s, p, 'food', 1); logm(s, `${p.name}'s camping stove: +1 food in the park.`, p.id); }
  }
}

// ------------------------------------------------------------------ news
const EVT = {
  westCombat(s, p) { for (const q of s.players) if (WEST.includes(sectorOf(q.node))) { const c = combatRoll(s, q); if (c.total < 4) { logm(s, `${q.name} rolls ${c.r}${c.m ? '+' + c.m : ''}: caught in the panic.`); hurt(s, q, 2, 'west side panic'); } else logm(s, `${q.name} rolls ${c.total}: slips away.`); } },
  strayDog(s, p) { const r = d6(s); logm(s, `Stray dog: ${p.name} rolls ${r}.`); if (r <= 2) hurt(s, p, 1, 'dog bite'); else if (p.res.food >= 1 && stockOf(s, 'dog') > 0) ask(s, { pl: p.id, kind: 'offer', title: 'Spend 1 FOOD to tame and keep the dog?', options: [opt('food', 'Spend 1 food'), opt('decline', 'Leave it')], ctx: { offer: { kind: 'item', item: 'dog', cost: { food: 1 } } } }); },
  contrabandMeds(s, p) { if (resTotal(p) >= 2) ask(s, { pl: p.id, kind: 'contraband', title: 'Swap 2 resources for 3 MEDS?', options: [opt('yes', 'Swap'), opt('no', 'No')] }); },
  offerStabVest(s) { s.offers.push({ nodes: ['pawn'], kind: 'item', item: 'kevlar-vest', cost: { coin: 1, tech: 1 }, text: 'Stab vest: pay 1 PREPCOIN or 1 TECH to acquire a Kevlar Vest?' }); },
  cryptoSoars(s) { for (const q of s.players) if (q.res.tech > 0) { const n = q.res.tech; const options = [opt('all', `Exchange ${n} TECH for ${2 * n} PREPCOIN`), opt('none', 'Keep tech')]; ask(s, { pl: q.id, kind: 'crypto', title: 'Crypto price soars!', options }); } },
  hospitalClosed() { }, curfew() { }, subwayClosed() { },
  offerHazmat(s) { s.offers.push({ nodes: ['bar'], kind: 'item', item: 'hazmat-suit', cost: { food: 1 }, text: 'Hazmat suit for 1 FOOD?' }); },
  eastTech(s) { for (const q of s.players) if (EAST.includes(sectorOf(q.node)) && q.res.tech > 0) { spend(s, q, 'tech', 1); logm(s, `${q.name} loses 1 TECH to rioters.`); } },
  outbreak(s) { for (const q of s.players) { if (q.res.meds > 0) ask(s, { pl: q.id, kind: 'outbreak', title: 'Airborne outbreak!', options: [opt('pay', 'Pay 1 MEDS'), opt('hurt', 'Lose 2 HEALTH')] }); else hurt(s, q, 2, 'outbreak'); } },
  devalue(s) { for (const q of s.players) { const l = Math.min(2, q.coin); q.coin -= l; logm(s, `${q.name} loses ${l} PREPCOIN.`); } },
  offerSolar(s) { s.offers.push({ nodes: ['steel'], kind: 'item', item: 'solar-panel', cost: { tech: 2 }, text: 'Swap 2 TECH for a Solar Panel?' }); },
  riverPollution(s) { for (const q of s.players) if (D.river.has(q.node)) { if (q.res.meds > 0) ask(s, { pl: q.id, kind: 'outbreak', title: 'Powerplant pollution!', options: [opt('pay', 'Pay 1 MEDS'), opt('hurt', 'Lose 1 HEALTH')], ctx: { dmg: 1 } }); else hurt(s, q, 1, 'pollution'); } },
  brewBeer(s, p) { gain(s, p, 'food', 2); gain(s, p, 'knowhow', 2); },
  bugOut(s, p) { const r = d6(s); logm(s, `Bug-out test: ${p.name} rolls ${r}.`); if (p.res.knowhow > 0) { spend(s, p, 'knowhow', 1); logm(s, `${p.name} loses 1 KNOW-HOW.`); } },
  bagsBurst(s) { placeOnStreet(s, 'H2_0', 'meds', 2); placeOnStreet(s, 'H1_4', 'food', 3); },
  techOffOn(s) { for (const q of s.players) if (q.res.tech > 0 && q.res.knowhow < 2) { spend(s, q, 'tech', 1); logm(s, `${q.name} loses 1 TECH.`); } },
  blackout(s) { for (const q of s.players) if (!hasItem(q, 'flashlight') && resTotal(q) > 0) loseOneRes(s, q); },
  hardDrives(s) { place(s, 'pawn', 'tech', 3); },
  cryptoGeek(s) { place(s, 'boatyard', 'tech', 3); s.loc.boatyard.coin += 3; },
  aidPackage(s) { for (const r of ALLRES) place(s, 'trainstation', r, 1); },
  drunk(s, p) { if (p.res.tech > 0) spend(s, p, 'tech', 1); hurt(s, p, 1, 'drunk'); },
  thugsAsleep(s) { for (const q of s.players) if (q.thug && resTotal(q) > 0) loseOneRes(s, q); },
  chemWaste(s) { for (const q of s.players) if (sectorOf(q.node) === 'C') hurt(s, q, 2, 'chemical waste'); },
  brainBoil(s) { for (const q of s.players) { const r = d6(s); logm(s, `${q.name} rolls ${r}.`); if (r <= 2) hurt(s, q, 2, 'brain boil'); else gain(s, q, 'knowhow', 1); } },
  offerDive(s) { s.offers.push({ nodes: D.dumpsters, kind: 'free', cost: {}, text: 'First to a dumpster takes the top ITEM card.' }); },
  none() { },
};
function place(s, node, r, n) { const a = Math.min(n, s.supply[r]); s.supply[r] -= a; s.loc[node].res[r] = (s.loc[node].res[r] || 0) + a; logm(s, `${a} ${RES_LABEL[r]} placed at ${D.node[node].name}.`); }
function placeOnStreet(s, node, r, n) { place(s, node, r, n); }
function loseOneRes(s, q) {
  const have = ALLRES.filter(r => q.res[r] > 0);
  if (!have.length) return;
  if (q.ai || have.length === 1) { have.sort((a, b) => q.res[b] - q.res[a]); spend(s, q, have[0], 1); logm(s, `${q.name} loses 1 ${RES_LABEL[have[0]]}.`); }
  else pickRes(s, q, 'loseOne', 'Lose 1 resource: which?', have);
}
RESOLVE.contraband = (s, pd, o) => {
  const p = s.players[pd.pl]; if (o !== 'yes') return;
  let n = 0; const have = ALLRES.filter(r => p.res[r] > 0).sort((a, b) => p.res[b] - p.res[a]);
  for (const r of have) while (p.res[r] > 0 && n < 2) { spend(s, p, r, 1); n++; }
  gain(s, p, 'meds', 3); logm(s, `${p.name} swaps 2 resources for 3 MEDS.`, p.id);
};
RESOLVE.crypto = (s, pd, o) => { const p = s.players[pd.pl]; if (o === 'all') { const n = p.res.tech; spend(s, p, 'tech', n); p.coin += 2 * n; logm(s, `${p.name} cashes in ${n} TECH for ${2 * n} PREPCOIN.`, p.id); } };
RESOLVE.outbreak = (s, pd, o) => { const p = s.players[pd.pl]; if (o === 'pay') { spend(s, p, 'meds', 1); logm(s, `${p.name} pays 1 MEDS.`); } else hurt(s, p, pd.ctx.dmg || 2, 'outbreak'); };

function doNews(s, p) {
  const ts = s.ts;
  const id = s.newsDeck.shift();
  if (!id) { logm(s, 'The news deck is empty.'); ts.news = null; ts.step = 'roll'; return; }
  const card = D.newsById[id];
  ts.news = { id, type: card.type, sym: null };
  logm(s, `NEWS: "${card.title}" (${card.type.toUpperCase()}). Roll the news dice to see if the event happens.`, p.id);
  s.stand[card.type].push(id);
  if (s.stand[card.type].length >= 5) ts.escalate = card.type;
  ts.step = 'newsroll';   // pause: read the card, then roll the news dice
}
// The news dice (3 fake news faces + nuclear / pandemic / AI): the card's event only happens if the face matches the card's type.
function rollNews(s, p) {
  const ts = s.ts, card = D.newsById[ts.news.id];
  const face = Math.floor(rnd(s) * 6), sym = D.cfg.newsDie[face];
  ts.news.sym = sym;
  s.lastRoll = { pl: p.id, kind: 'news', face, sym, card: card.id };
  logm(s, `News dice: ${sym === 'fake' ? 'FAKE NEWS' : sym.toUpperCase()}.`, p.id);
  // a matching face triggers the event of the newest card of that type that is out on the table (this turn's card or an earlier one)
  const top = sym !== 'fake' && s.stand[sym].length ? D.newsById[s.stand[sym][s.stand[sym].length - 1]] : null;
  if (top) {
    ts.news.fired = top.id;
    if (top.effect !== 'none') { logm(s, `EVENT! ${top.title} - ${top.text}`, p.id); EVT[top.effect](s, p, top); }
    else logm(s, 'Event: (not yet designed).');
  }
  ts.step = 'roll';
}
function escalate(s, type) {
  s.defcon++; s.panic.push(type);
  logm(s, `DEFCON rises to ${defc(s).id.toUpperCase()}! ${type.toUpperCase()} token placed on the Panic Index.`);
  for (const t of APOC_TYPES) { s.newsDeck.push(...s.stand[t]); s.stand[t] = []; }
  s.offers = [];
  if (s.defcon === 1) for (const q of s.players) { if (q.tagged) { q.tagged = false; s.bustedLeft++; logm(s, `${q.name}'s TAGGED token is discarded.`); } }
  const lvl = ['green', 'yellow', 'orange'][s.defcon];
  if (s.endTimes[lvl]) s.newsDeck.push(...s.endTimes[lvl]);
  shuffle(s, s.newsDeck);
  if (s.defcon >= 3) triggerApoc(s);
}

// ------------------------------------------------------------------ turn flow
function beginTurn(s) {
  const p = cur(s);
  s.stage = 'turn';
  s.ts = { step: 'begin', moves: 0, actions: 1, moveState: 'none', dayKind: null, usedHeal: false, looted: [], blocked: {}, escalate: null, forceEnd: false, skipPrep: false, fought: false, raided: false, forager: false, stove: false, hunted: false, thiefUsed: false, droneUsed: false, crafted: false, shop: null, chemFree: false, rerolled: false, startNode: p.node };
  p.moonNext = false;
}
export function advance(s) {
  for (let guard = 0; guard < 80; guard++) {
    pump(s);
    if (s.pending || s.over) return;
    if (s.stage === 'grab') { advanceGrab(s); if (s.pending || s.stage === 'grab' || s.over) return; continue; }
    const p = cur(s), ts = s.ts;
    if (ts.forceEnd && ts.step === 'prep') ts.step = 'endturn';
    switch (ts.step) {
      case 'begin': {
        p.moon = false;
        if (p.node === D.board.hospitalNode && p.admitted) {
          ask(s, { pl: p.id, kind: 'hospitalCare', title: 'Hospital: how do you want to be treated?', options: [opt('care', 'Professional medical care (full health, but you spend this turn here)'), opt('sanitizer', 'Drink hand sanitizer (free: roll, then lose 1 HEALTH)')] });
          ts.step = 'begin2'; break;
        }
        ts.step = 'begin2'; break;
      }
      case 'begin2': {
        if (p.carePending) { p.carePending = false; p.node = 'H1_3'; logm(s, `${p.name} leaves the hospital onto Oak Tree Drive, feeling brave.`); }
        if (hasItem(p, 'bed') && p.bunker && p.health > 0) { heal(s, p, 1); }
        if (p.bunker) {
          if (hasItem(p, 'med-lab')) gain(s, p, 'meds', 1);
          if (hasItem(p, 'hydroponics-lab')) gain(s, p, 'food', 2);
        }
        if (p.health === 0 && p.node !== D.board.hospitalNode && !ts.skipPrep) {
          if (p.res.meds === 0) { p.health = 1; ts.skipPrep = true; logm(s, `${p.name} spends the turn resting (lying down) and regains 1 HEALTH.`, p.id); }
          else if (p.ai) { spend(s, p, 'meds', 1); heal(s, p, 1); }
        }
        ts.step = 'eat'; break;
      }
      case 'eat': {
        if (p.res.food >= 1) { spend(s, p, 'food', 1); logm(s, `${p.name} eats 1 food.`, p.id); }
        else { logm(s, `${p.name} has nothing to eat.`, p.id); hurt(s, p, 1, 'hunger'); }
        ts.step = 'thug'; break;
      }
      case 'thug': {
        if (p.thug) {
          const opts = [];
          if (p.res.food >= 1) opts.push(opt('food', 'Pay 1 food'));
          if (p.coin >= 1) opts.push(opt('coin', 'Pay 1 PREPCOIN'));
          opts.push(opt('dismiss', 'Let the thug go'));
          ask(s, { pl: p.id, kind: 'thugPay', title: 'Keep your thug?', options: opts });
          ask(s, { pl: p.id, kind: 'thugJob', title: 'Choose your thug\'s job this turn', options: [opt('muscle', 'MUSCLE: +1 to combat'), opt('thief', 'THIEF: free action, take 1 resource from any location'), opt('bouncer', 'BOUNCER: guard a location entrance (1 PREPCOIN/turn)')] });
        }
        ts.step = 'news'; break;
      }
      case 'news': {
        if (!p.thug) { /* nothing */ }
        doNews(s, p); break;
      }
      case 'roll': {
        if (ts.skipPrep) { ts.step = 'endturn'; break; }
        if (p.health === 0 && p.node === D.board.hospitalNode) { ts.step = 'endturn'; break; }
        return;
      }
      case 'newsroll': return;
      case 'prep': return;
      case 'endturn': {
        endTurn(s); if (s.stage === 'grab' || s.over) { continue; }
        break;
      }
      default: return;
    }
  }
}
function endTurn(s) {
  const p = cur(s), ts = s.ts;
  if (p.prepper === 'jessica' && p.node === D.board.startNode) { gain(s, p, 'food', ts.forager ? 1 : 2); logm(s, 'Jessica ends her turn in the park: more food.', p.id); }
  if (ts.escalate) escalate(s, ts.escalate);
  if (s.stage === 'grab' || s.over) return;
  s.cur = (s.cur + 1) % s.players.length;
  if (s.cur === 0) s.round++;
  beginTurn(s);
}

// ------------------------------------------------------------------ Apoc: panic grab
function triggerApoc(s) {
  const cnt = {}; for (const t of s.panic) cnt[t] = (cnt[t] || 0) + 1;
  let ev = s.panic[0]; for (const [t, c] of Object.entries(cnt)) if (c >= 2) ev = t;
  s.apocEvent = ev;
  logm(s, `*** SHTF! The ${ev.toUpperCase()} event is triggered. ***`);
  if (ev === 'nuclear') for (const q of s.players) if (!q.bunker) { q.health = 1; logm(s, `${q.name} has no bunker: HEALTH drops to 1.`); }
  for (const q of s.players) { q.thug = null; q.busted = 0; q.tagged = false; q.coin = 0; }
  s.thugsBar = D.cfg.thugs;
  for (const id in s.loc) s.loc[id].coin = 0;
  s.stage = 'grab';
  s.grab = { phase: 'meds', i: 0, order: [], turn: 0, moves: 0, grabbed: {}, bf: [] };
  s.pending = null; s.queue = [];
  s.players.forEach(q => { if (q.health < D.cfg.maxHealth && q.res.meds > 0) ask(s, { pl: q.id, kind: 'grabMeds', title: 'PANIC GRAB: spend MEDS to regain health before turn order is set', options: [...Array(Math.min(q.res.meds, D.cfg.maxHealth - q.health) + 1).keys()].map(n => opt(String(n), n === 0 ? 'Keep my meds' : `Spend ${n} MEDS (+${n} HEALTH)`)) }); });
}
RESOLVE.grabMeds = (s, pd, o) => { const q = s.players[pd.pl], n = +o; if (n) { spend(s, q, 'meds', n); heal(s, q, n); logm(s, `${q.name} spends ${n} MEDS before the panic.`); } };
function advanceGrab(s) {
  const g = s.grab;
  if (g.phase === 'meds') {
    const order = s.players.map(q => ({ q, r: d6(s) })).sort((a, b) => b.q.health - a.q.health || resTotal(a.q) - resTotal(b.q) || b.r - a.r);
    g.order = order.map(o => o.q.id); g.phase = 'move'; g.turn = 0; startGrabTurn(s);
    logm(s, `Panic Grab order: ${g.order.map(i => s.players[i].name).join(', ')}.`);
  }
}
function startGrabTurn(s) {
  const g = s.grab; const q = s.players[g.order[g.turn]];
  g.moves = 2 * q.health; g.grabbed = {};
  s.cur = q.id;
  logm(s, `PANIC GRAB: ${q.name} has ${g.moves} moves.`);
}
function endGrabTurn(s) {
  const g = s.grab, q = s.players[g.order[g.turn]];
  const here = s.players.filter(x => x.node === q.node);
  if (here.length > 1 && D.node[q.node].kind === 'building' && !g.bf.includes(q.node)) {
    g.bf.push(q.node);
    let top = null, win = null;
    for (let tries = 0; tries < 8; tries++) {
      const rs = here.map(x => { const c = combatRoll(s, x); return { x, c, t: c.nat1 ? -1 : c.total }; });
      top = Math.max(...rs.map(r => r.t));
      const w = rs.filter(r => r.t === top);
      logm(s, `BLACK FRIDAY at ${D.node[q.node].name}: ${rs.map(r => `${r.x.name} ${r.c.r}${r.c.m ? '+' + r.c.m : ''}`).join(', ')}`);
      if (top < 0) { win = null; break; }
      if (w.length === 1) { win = w[0].x; break; }
    }
    if (win) { const others = here.filter(x => x !== win && resTotal(x) > 0); if (others.length) { const v = others[0]; const have = ALLRES.filter(r => v.res[r] > 0).sort((a, b) => v.res[b] - v.res[a])[0]; if (resTotal(win) < holdLimit(win)) { v.res[have]--; win.res[have]++; logm(s, `${win.name} muscles 1 ${RES_LABEL[have]} off ${v.name}.`); } } }
  }
  g.turn++;
  if (g.turn >= g.order.length) {
    for (const id in s.loc) s.loc[id].res = {};
    s.over = { reason: 'apoc', event: s.apocEvent };
    s.stage = 'over';
    logm(s, `The board is cleared. Open the ${s.apocEvent.toUpperCase()} MISSION PACK. (End of the pre-APOC test game.)`);
  } else startGrabTurn(s);
}

// ------------------------------------------------------------------ queries for UI / AI
export function canStep(s, p, to) {
  if (!D.adj[p.node].includes(to)) return false;
  return true;
}
export function movesLeft(s) { return s.stage === 'grab' ? s.grab.moves : s.ts.moves; }
export function legalMoves(s, p) {
  if (s.over || s.pending) return [];
  const out = [];
  if (s.stage === 'grab') { if (s.grab.moves > 0) for (const n of D.adj[p.node]) out.push({ to: n }); return out; }
  const ts = s.ts;
  if (ts.step !== 'prep' || ts.moves <= 0 || ts.moveState === 'done') return out;
  for (const n of D.adj[p.node]) out.push({ to: n });
  // bolt cutters / parkour: building to building in same block
  const here = D.node[p.node];
  if (here.kind === 'building' && (hasItem(p, 'bolt-cutters') || p.prepper === 'sam')) {
    for (const n of D.board.nodes) if (n.kind === 'building' && n.id !== here.id && n.block === here.block) out.push({ to: n.id, cutters: true });
  }
  // subway
  if (D.node[p.node].subway && subwayOpen(s) && p.coin >= 1) for (const st of D.board.subway) if (st !== p.node) out.push({ to: st, subway: true });
  return out.filter(m => !ts.blocked[m.to]);
}
export function actionsAt(s, p) {   // list of available action descriptors at the current node
  if (s.over || s.pending || s.stage !== 'turn' || s.ts.step !== 'prep') return [];
  const ts = s.ts, n = D.node[p.node], df = defc(s), out = [];
  if (ts.actions <= 0) return out;
  const L = s.loc[p.node];
  const isB = n.kind === 'building';
  const hasTok = isB && ALLRES.some(r => L.res[r] > 0);
  const isSell = D.cfg.sellNodes.includes(p.node);
  if ((hasTok && !['church'].includes(p.node)) || isSell) out.push({ a: 'market', label: 'Buy / sell resources' });
  if (hasTok && df.steal && !p.tagged && p.node !== 'church') out.push({ a: 'steal', label: 'Steal' });
  if (hasTok && df.loot && p.node !== 'church') out.push({ a: 'loot', label: 'Loot' });
  if (n.acts.includes('buy')) out.push({ a: 'shop', label: 'Buy items' });
  if (n.acts.includes('burgle') && df.burgle) out.push({ a: 'burgle', label: 'Burgle this residence' });
  if (n.acts.includes('dive')) out.push({ a: 'dive', label: 'Dumpster dive' });
  if (n.acts.includes('gamble') && p.coin >= 1) out.push({ a: 'gamble', label: 'Gamble (1 PREPCOIN)' });
  if (D.cfg.tradeNodes.includes(p.node)) out.push({ a: 'swap', label: 'Trade resources' });
  if (!p.bunker && canBuild(p)) out.push({ a: 'build', label: 'Build your bunker' });
  if (!ts.raided && s.players.some(q => q.id !== p.id && q.bunker)) out.push({ a: 'raid', label: 'Raid a bunker' });
  if (!p.thug && s.thugsBar > 0 && p.coin >= 2 && p.res.food >= 1 && (p.node === D.board.barNode || hasItem(p, 'walkie-talkie'))) out.push({ a: 'recruit', label: 'Recruit a thug (2 PREPCOIN + 1 FOOD)' });
  if (!ts.fought && s.players.some(q => q.id !== p.id && q.node === p.node)) out.push({ a: 'fight', label: 'Fight a prepper here' });
  if (hasItem(p, 'drone') && p.bunker && !ts.droneUsed) out.push({ a: 'drone', label: 'Launch drone (take 1 resource anywhere)' });
  return out;
}
export function canBuild(p) {
  const need = RES.filter(r => p.res[r] < 1);
  if (need.length === 0) return true;
  return need.length === 1 && p.res.ducttape >= 1;
}
export function craftable(s, p) {
  const out = [];
  for (const it of D.items) {
    if (stockOf(s, it.id) === 0) continue;
    if (it.needsBunker && !p.bunker) continue;
    if (it.mustOwn && !it.mustOwn.every(m => ownsItem(p, m))) continue;
    const cost = craftCost(s, p, it);
    if (!afford(p, cost.cost)) continue;
    out.push({ id: it.id, cost: cost.cost, note: cost.note });
  }
  return out;
}
export function craftCost(s, p, it) {
  const cost = {}; let note = '';
  for (const r of it.recipe) cost[r.r] = (cost[r.r] || 0) + 1;
  if (p.prepper === 'frost' && p.bunker && it.id === 'rifle') { cost.knowhow = Math.max(0, (cost.knowhow || 0) - 1); note = 'Gunsmith'; }
  if (p.prepper === 'jessica' && p.bunker && it.id === 'hydroponics-lab') { cost.chem = Math.max(0, (cost.chem || 0) - 1); note = 'Green Queen'; }
  if (p.prepper === 'naomi' && !s.ts.chemFree && cost.chem && p.res.chem < cost.chem) { cost.chem--; note = 'Chemistry 101'; }
  for (const k of Object.keys(cost)) if (!cost[k]) delete cost[k];
  return { cost, note };
}
export function marketPrice(s) { return defc(s).buy; }
export function shopList(s, p) { return (D.cfg.shops[p.node] || []).map(([id, price]) => ({ id, price, stock: id === 'DUCT' ? s.supply.ducttape : stockOf(s, id), name: id === 'DUCT' ? 'Duct tape' : D.item[id].name })); }
export function reachable(s, p, maxDist = 12) {   // BFS for the UI/AI: node -> {dist, path}
  const dist = { [p.node]: 0 }, prev = {}; const q = [p.node];
  while (q.length) {
    const u = q.shift(); if (dist[u] >= maxDist) continue;
    for (const v of D.adj[u]) if (dist[v] === undefined) { dist[v] = dist[u] + 1; prev[v] = u; q.push(v); }
  }
  return { dist, prev };
}
export function pathTo(s, from, to) {
  const dist = { [from]: 0 }, prev = {}; const q = [from];
  while (q.length) { const u = q.shift(); if (u === to) break; for (const v of D.adj[u]) if (dist[v] === undefined) { dist[v] = dist[u] + 1; prev[v] = u; q.push(v); } }
  if (dist[to] === undefined) return null;
  const path = []; let c = to; while (c !== from) { path.unshift(c); c = prev[c]; }
  return path;
}
export function totalMoves(s, p) {
  return D.cfg.baseMoves + (p.prepper === 'naomi' ? 1 : 0) + (hasItem(p, 'town-map') ? 2 : 0);
}

// ------------------------------------------------------------------ commands
function err(msg) { return { ok: false, error: msg }; }
const OK = { ok: true };

export function dispatch(s, pl, cmd) {
  if (s.over) return err('Game over');
  // prompts
  if (cmd.t === 'choose') {
    if (!s.pending) return err('Nothing to choose');
    if (s.pending.pl !== pl && !s.sandbox) return err('Not your decision');
    const pd = s.pending;
    if (!pd.options.some(o => o.id === cmd.o)) return err('Bad option');
    s.pending = null;
    RESOLVE[pd.kind](s, pd, cmd.o);
    advance(s);
    return OK;
  }
  if (s.pending) return err('A decision is pending');
  if (cmd.t === 'moveStack') return moveStack(s, pl, cmd);
  if (cmd.t.startsWith('sbx')) return sandbox(s, pl, cmd);
  if (s.stage === 'grab') return grabCmd(s, pl, cmd);
  if (s.cur !== pl && !s.sandbox) return err('Not your turn');
  const r = turnCmd(s, cur(s), cmd);
  advance(s);
  return r;
}

// Table tool: pick up some (or all) of a stack of one token type and put it down on another space, or on a player's card (it is then theirs).
function moveStack(s, pl, cmd) {
  const A = s.loc[cmd.from]; if (!A) return err('Pick a stack');
  const have = cmd.r === 'coin' ? A.coin : (A.res[cmd.r] || 0);
  const n = Math.min(have, Math.max(1, cmd.n || have)); if (!n) return err('Nothing to move');
  const who = s.players[pl] ? s.players[pl].name : 'Player', lab = cmd.r === 'coin' ? 'PrepCoin' : RES_LABEL[cmd.r], from = D.node[cmd.from].name || cmd.from;
  if (cmd.mat !== undefined) {   // dropped on a character card: into that prepper's inventory
    const p = s.players[cmd.mat]; if (!p) return err('No such player');
    let take = n;
    if (cmd.r !== 'coin') take = Math.min(n, Math.max(0, holdLimit(p) - resTotal(p)));
    if (take < 1) return err(`${p.name}'s backpack is full`);
    if (cmd.r === 'coin') { A.coin -= take; p.coin += take; } else { A.res[cmd.r] -= take; if (!A.res[cmd.r]) delete A.res[cmd.r]; p.res[cmd.r] += take; }
    logm(s, `${who} puts ${take} ${lab} from ${from} on ${p.name}'s card.`, pl);
    return OK;
  }
  const B = s.loc[cmd.to]; if (!B || cmd.from === cmd.to) return err('Pick a different space');
  if (cmd.r === 'coin') { A.coin -= n; B.coin += n; } else { A.res[cmd.r] -= n; if (!A.res[cmd.r]) delete A.res[cmd.r]; B.res[cmd.r] = (B.res[cmd.r] || 0) + n; }
  if (cmd.x !== undefined && D.node[cmd.to].kind !== 'building') B.at = [Math.round(cmd.x), Math.round(cmd.y)]; else delete B.at;
  logm(s, `${who} moves ${n} ${lab} from ${from} to ${D.node[cmd.to].name || cmd.to}.`, pl);
  return OK;
}
function sandbox(s, pl, cmd) {
  if (!s.sandbox) return err('Sandbox is off');
  const p = cmd.p !== undefined ? s.players[cmd.p] : cur(s);
  if (cmd.t === 'sbxMove') { p.node = cmd.to; onEnter(s, p); }
  else if (cmd.t === 'sbxGive') { p.res[cmd.r] += cmd.n; s.supply[cmd.r] -= cmd.n; }
  else if (cmd.t === 'sbxCoin') p.coin += cmd.n;
  else if (cmd.t === 'sbxHealth') p.health = Math.max(0, Math.min(10, cmd.n));
  else if (cmd.t === 'sbxItem') { const c = takeCard(s, cmd.id); if (c) giveCard(s, p, c); }
  else if (cmd.t === 'sbxDefcon') { s.defcon = Math.max(0, Math.min(2, cmd.n)); }
  else if (cmd.t === 'sbxMoves') { s.ts.moves = cmd.n; s.ts.actions = Math.max(s.ts.actions, 1); s.ts.moveState = 'none'; }
  else if (cmd.t === 'sbxApoc') { s.panic = ['ai', 'ai', 'nuclear'].slice(0, 3); s.defcon = 2; escalate(s, 'ai'); }
  else return err('Unknown sandbox command');
  advance(s);
  return OK;
}

function grabCmd(s, pl, cmd) {
  const g = s.grab, q = s.players[g.order[g.turn]];
  if (g.phase !== 'move') return err('Not ready');
  if (q.id !== pl && !s.sandbox) return err('Not your turn');
  if (cmd.t === 'move') {
    if (g.moves <= 0) return err('No moves left');
    if (!D.adj[q.node].includes(cmd.to)) return err('Not adjacent');
    q.node = cmd.to; g.moves--;
    if (D.node[cmd.to].kind === 'building') g.grabbed[cmd.to] = g.grabbed[cmd.to] || 0;
    // free grab from streets happens via 'grab' too
    return OK;
  }
  if (cmd.t === 'grab') {
    const L = s.loc[q.node];
    if (!L.res[cmd.r]) return err('None there');
    if ((g.grabbed[q.node] || 0) >= 2 && D.node[q.node].kind === 'building') return err('Max 2 per location');
    if (resTotal(q) >= holdLimit(q)) return err('Full');
    L.res[cmd.r]--; q.res[cmd.r]++; g.grabbed[q.node] = (g.grabbed[q.node] || 0) + 1;
    logm(s, `${q.name} grabs 1 ${RES_LABEL[cmd.r]}.`);
    return OK;
  }
  if (cmd.t === 'endTurn') { endGrabTurn(s); advance(s); return OK; }
  return err('Not allowed during the panic grab');
}

function turnCmd(s, p, cmd) {
  const ts = s.ts;
  const df = defc(s);
  if (ts.step === 'newsroll') {
    if (cmd.t === 'rollNews') { rollNews(s, p); return OK; }
    return err('Roll the news dice first');
  }
  const free = ['craft', 'scrap', 'fix', 'heal', 'pickup', 'pickupCoin', 'pickupItem', 'hunt', 'thief', 'postThug', 'moonshine', 'dropThug'];
  if (ts.step === 'roll') {
    if (cmd.t === 'roll') {
      const kind = cmd.kind;
      if (kind === 'night' && (p.tagged || nightBlocked(s))) return err(p.tagged ? 'You are tagged: day dice only' : 'Curfew: no night-time movement');
      rollPhase3(s, p, kind);
      return OK;
    }
    if (!free.includes(cmd.t) && cmd.t !== 'sbx') return err('Roll the day or night dice first');
  }
  if (ts.step !== 'prep' && ts.step !== 'roll') return err('Wait');
  switch (cmd.t) {
    case 'endTurn': if (ts.step === 'roll') return err('Roll first'); ts.step = 'endturn'; return OK;
    case 'move': return doMove(s, p, cmd.to);
    case 'craft': return doCraft(s, p, cmd.id);
    case 'scrap': return doScrap(s, p, cmd.uid);
    case 'fix': {
      const it = p.items.find(i => i.uid === cmd.uid && i.broken);
      if (!it) return err('Nothing to fix'); if (p.res.ducttape < 1) return err('Need duct tape');
      spend(s, p, 'ducttape', 1); it.broken = false; logm(s, `${p.name} fixes the ${D.item[it.id].name} with duct tape.`, p.id); return OK;
    }
    case 'heal': {
      if (p.res.meds < 1) return err('No meds'); if (p.health >= 10) return err('Already healthy');
      if (s.players.some(q => q.id !== p.id && q.node === p.node)) return err('Not while another prepper is here');
      spend(s, p, 'meds', 1); heal(s, p, 1); logm(s, `${p.name} uses 1 MEDS: health ${p.health}.`, p.id); return OK;
    }
    case 'pickup': {   // free pick-up of resources on streets/intersections or at the church
      const L = s.loc[p.node];
      const freeSpot = D.node[p.node].kind !== 'building' || p.node === D.board.churchNode;
      if (!freeSpot) return err('Those belong to the location owner: buy, steal or loot them');
      if (!L.res[cmd.r]) return err('None there'); if (resTotal(p) >= holdLimit(p)) return err('You cannot carry any more');
      L.res[cmd.r]--; p.res[cmd.r]++; logm(s, `${p.name} picks up 1 ${RES_LABEL[cmd.r]}.`, p.id); return OK;
    }
    case 'pickupCoin': { const L = s.loc[p.node]; if (L.coin < 1) return err('No coin here'); p.coin += L.coin; logm(s, `${p.name} picks up ${L.coin} PREPCOIN.`, p.id); L.coin = 0; return OK; }
    case 'pickupItem': { const L = s.loc[p.node]; const i = L.items.findIndex(c => c.uid === cmd.uid); if (i < 0) return err('No item'); const [c] = L.items.splice(i, 1); giveCard(s, p, c); return OK; }
    case 'hunt': {
      if (!hasItem(p, 'bow') || ts.hunted) return err('Cannot hunt'); ts.hunted = true;
      const r = d6(s); logm(s, `${p.name} hunts: rolled ${r}.`, p.id); if (r <= 2) gain(s, p, 'food', 1); return OK;
    }
    case 'thief': {
      if (!p.thug || p.thug.job !== 'thief' || ts.thiefUsed) return err('Not available');
      const L = s.loc[cmd.node]; if (!L || !L.res[cmd.r]) return err('Nothing there');
      takeFromLoc(s, p, cmd.node, cmd.r); ts.thiefUsed = true; logm(s, `${p.name}'s thug steals 1 ${RES_LABEL[cmd.r]} from ${D.node[cmd.node].name}.`, p.id); return OK;
    }
    case 'postThug': {
      if (!p.thug || p.thug.job !== 'bouncer') return err('No bouncer');
      if (p.coin < 1) return err('Need 1 PREPCOIN'); const nd = D.node[cmd.node]; if (!nd || nd.kind !== 'building') return err('Pick a building');
      p.coin -= 1; p.thug.post = cmd.node; logm(s, `${p.name}'s thug stands guard at ${nd.name}.`, p.id); return OK;
    }
    case 'moonshine': {
      const it = p.items.find(i => i.id === 'moonshine' && !i.broken); if (!it) return err('No moonshine');
      p.items.splice(p.items.indexOf(it), 1); s.itemDeck.push({ uid: it.uid, id: it.id }); shuffle(s, s.itemDeck);
      p.moon = true; logm(s, `${p.name} drinks the moonshine: ignores all health loss until their next turn.`, p.id); return OK;
    }
  }
  if (ts.step !== 'prep') return err('Roll first');
  switch (cmd.t) {
    case 'market': return doMarket(s, p, cmd);
    case 'buyItem': return doBuyItem(s, p, cmd.id);
    case 'steal': case 'loot': {
      if (ts.actions <= 0) return err('No actions left');
      const mode = cmd.t; const A = actionsAt(s, p); if (!A.some(a => a.a === mode)) return err('Not possible here');
      ts.actions--; ts.moveState = ts.moveState === 'moving' ? 'done' : ts.moveState; ts.looted = [];
      lootRoll(s, p, mode); return OK;
    }
    case 'burgle': case 'dive': case 'gamble': case 'build': case 'recruit': case 'drone': case 'swap': case 'raid': case 'fight': case 'shop':
      return doAction(s, p, cmd);
  }
  return err('Unknown command');
}

function finishMove(s) { const ts = s.ts; if (ts.moveState === 'moving') ts.moveState = 'done'; }
function useAction(s, p, a) {
  const ts = s.ts;
  const A = actionsAt(s, p);
  if (!A.some(x => x.a === a)) return false;
  if (ts.actions <= 0) return false;
  ts.actions--; finishMove(s); return true;
}

function doMove(s, p, to) {
  const ts = s.ts;
  if (ts.moves <= 0) return err('No moves left');
  if (ts.moveState === 'done') return err('Movement cannot be split around an action (move then act, or act then move)');
  const opts = legalMoves(s, p).find(m => m.to === to);
  if (!opts) return err('You cannot go there');
  for (const q of s.players) {
    if (q.id !== p.id && q.thug && q.thug.job === 'bouncer' && q.thug.post === to) {
      const c = combatRoll(s, p);
      logm(s, `${p.name} must get past ${q.name}'s bouncer at ${D.node[to].name}: rolls ${c.r}${c.m ? '+' + c.m : ''}.`, p.id);
      if (!c.nat1 && c.total >= 5) { logm(s, 'The bouncer is beaten and goes back to the bar.'); q.thug = null; s.thugsBar++; }
      else { logm(s, 'The bouncer beats them up.'); ts.moves--; ts.moveState = 'moving'; hurt(s, p, 2, 'bouncer'); ts.blocked[to] = true; return OK; }
      break;
    }
  }
  if (opts.subway) { p.coin -= 1; logm(s, `${p.name} pays 1 PREPCOIN and takes the subway to ${D.node[to].name}.`, p.id); }
  if (opts.cutters) logm(s, `${p.name} cuts through to ${D.node[to].name}.`, p.id);
  ts.moves--; ts.moveState = 'moving';
  p.node = to;
  onEnter(s, p);
  return OK;
}

function rollPhase3(s, p, kind) {
  const ts = s.ts;
  ts.dayKind = kind;
  const base = totalMoves(s, p);
  ts.baseMoves = base;
  const face = Math.floor(rnd(s) * 6);
  ts.dice = { kind, face };
  s.lastRoll = { pl: p.id, kind, face };
  const canReroll = (kind === 'night' && hasItem(p, 'flashlight')) || (kind === 'day' && p.prepper === 'jessica');
  if (canReroll) ask(s, { pl: p.id, kind: 'reroll', title: `${kind === 'day' ? 'Day' : 'Night'} dice: ${diceText(kind, face)}. Re-roll?`, options: [opt('keep', 'Keep it'), opt('reroll', 'Re-roll' + (kind === 'day' ? ' (must keep the new result)' : ''))] });
  ask(s, { pl: p.id, kind: 'applyDice', title: 'dice', options: [opt('ok', 'ok')], ctx: {}, auto: true });
}
export function diceText(kind, face) {
  const f = (kind === 'day' ? D.cfg.dayDie : D.cfg.nightDie)[face];
  const m = { food: n => `+${n} food`, foodcoin: n => `+${n} food & PREPCOIN`, moves: n => `+${n} moves`, found: n => `found ${n} resource`, bitten: n => `BITTEN! -${n} health`, robbed: n => `ROBBED! -${n} resource`, action: n => `+${n} action` };
  return m[f[0]](f[1]);
}
RESOLVE.reroll = (s, pd, o) => {
  if (o === 'reroll') { s.ts.dice.face = Math.floor(rnd(s) * 6); s.ts.rerolled = true; logm(s, `Re-rolled: ${diceText(s.ts.dice.kind, s.ts.dice.face)}.`); s.lastRoll = { pl: pd.pl, kind: s.ts.dice.kind, face: s.ts.dice.face }; }
};
RESOLVE.applyDice = (s, pd) => {
  const p = cur(s), ts = s.ts, { kind, face } = ts.dice;
  const f = (kind === 'day' ? D.cfg.dayDie : D.cfg.nightDie)[face];
  logm(s, `${p.name} rolls the ${kind.toUpperCase()} dice: ${diceText(kind, face)}.`, p.id);
  ts.moves = ts.baseMoves;
  switch (f[0]) {
    case 'food': gain(s, p, 'food', f[1]); break;
    case 'foodcoin': gain(s, p, 'food', 1); p.coin += 1; break;
    case 'moves': ts.moves += f[1]; break;
    case 'found': pickRes(s, p, 'found', 'Night dice: find 1 resource - which?', RES); break;
    case 'bitten': hurt(s, p, 1, 'bitten'); break;
    case 'robbed': { const have = ALLRES.filter(r => p.res[r] > 0); if (have.length) { if (p.ai || have.length === 1) { have.sort((a, b) => p.res[b] - p.res[a]); spend(s, p, have[0], 1); logm(s, `${p.name} is robbed of 1 ${RES_LABEL[have[0]]}.`); } else pickRes(s, p, 'robbed', 'Robbed! Lose 1 resource - which?', have); } break; }
    case 'action': ts.actions += 1; break;
  }
  ts.step = 'prep';
};

// ---- actions
function doAction(s, p, cmd) {
  const ts = s.ts, a = cmd.t;
  const A = actionsAt(s, p);
  if (ts.actions <= 0) return err('No actions left');
  if (!A.some(x => x.a === a)) return err('That action is not available here');
  // validate arguments before spending the action
  let target = null;
  if (a === 'fight') { target = s.players[cmd.target]; if (!target || target.node !== p.node || target.id === p.id) return err('Pick a prepper in your space'); }
  if (a === 'raid') { target = s.players[cmd.target]; if (!target || !target.bunker || target.id === p.id) return err('Pick a prepper with a bunker'); }
  if (a === 'drone') { if (!cmd.node || !cmd.r || !s.loc[cmd.node] || !s.loc[cmd.node].res[cmd.r]) return err('Pick a resource to grab'); if (resTotal(p) >= holdLimit(p)) return err('Full'); }
  if (a === 'swap') {
    const giveN = Object.values(cmd.give || {}).reduce((x, y) => x + y, 0), getN = Object.values(cmd.get || {}).reduce((x, y) => x + y, 0);
    if (giveN !== getN || giveN === 0) return err('Swap the same number of resources');
    for (const [r, n] of Object.entries(cmd.give)) if (p.res[r] < n) return err('You do not have those');
    for (const [r, n] of Object.entries(cmd.get)) if (s.supply[r] < n) return err('Not in the supply');
  }
  if (a === 'build' && !canBuild(p)) return err('Missing resources');
  ts.actions--; finishMove(s);
  if (a === 'shop') { ts.shop = p.node; logm(s, `${p.name} browses the shop.`); return OK; }
  if (a === 'burgle') { doBurgle(s, p); return OK; }
  if (a === 'dive') { doDive(s, p); return OK; }
  if (a === 'gamble') { p.coin -= 1; ts.gamble = { n: 0, pot: 0 }; gambleThrow(s, p); return OK; }
  if (a === 'build') {
    p.bunker = true; logm(s, `${p.name} BUILDS A BUNKER! Home sweet home.`, p.id);
    if (!s.bunkerBonusTaken) { s.bunkerBonusTaken = true; const c = drawTop(s); if (c) { giveCard(s, p, c); logm(s, `Bunker bonus: ${p.name} receives a ${D.item[c.id].name}.`, p.id); } }
    return OK;
  }
  if (a === 'recruit') { p.coin -= 2; spend(s, p, 'food', 1); s.thugsBar--; p.thug = { job: 'muscle', post: null }; logm(s, `${p.name} recruits a thug.`, p.id); return OK; }
  if (a === 'drone') { takeFromLoc(s, p, cmd.node, cmd.r); ts.droneUsed = true; logm(s, `${p.name}'s drone takes 1 ${RES_LABEL[cmd.r]} from ${D.node[cmd.node].name}.`, p.id); return OK; }
  if (a === 'swap') {
    for (const [r, n] of Object.entries(cmd.give)) spend(s, p, r, n);
    for (const [r, n] of Object.entries(cmd.get)) gain(s, p, r, n);
    logm(s, `${p.name} swaps resources.`, p.id); return OK;
  }
  if (a === 'fight') {
    ts.fought = true; logm(s, `${p.name} starts a FIGHT with ${target.name}!`, p.id);
    ask(s, { pl: target.id, kind: 'fightDefend', title: `${p.name} attacks you! Yield or fight?`, options: [opt('yield', 'Yield (they take 1 and push you away)'), opt('fight', 'Fight back')], ctx: { a: p.id } });
    return OK;
  }
  if (a === 'raid') {
    ts.raided = true;
    const r = d6(s), m = mods(s, p, 'raid'); s.lastRoll = { pl: p.id, kind: 'risk', value: r, mod: m, total: r + m, why: 'raid' };
    logm(s, `${p.name} searches for ${target.name}'s bunker: rolled ${r}${m ? ' +' + m : ''}.`, p.id);
    if (r + m >= 5) {
      logm(s, `${p.name} FINDS the bunker!`);
      const options = [opt('fight', 'Come out fighting'), opt('hide', 'Stay hidden (they take up to 3 resources)')];
      if (canTrap(target)) options.push(opt('trap', 'Stay hidden and trigger the BOOBY TRAP'));
      ask(s, { pl: target.id, kind: 'raidDefend', title: `${p.name} has found your bunker!`, options, ctx: { a: p.id } });
    } else logm(s, 'The bunker stays hidden.');
    return OK;
  }
  return err('?');
}

function doMarket(s, p, cmd) {
  const ts = s.ts; const A = actionsAt(s, p);
  if (!A.some(x => x.a === 'market')) return err('No market here');
  const L = s.loc[p.node], price = marketPrice(s), isSell = D.cfg.sellNodes.includes(p.node);
  const buy = cmd.buy || {}, sell = cmd.sell || {};
  const nSell = Object.values(sell).reduce((a, b) => a + b, 0), nBuy = Object.values(buy).reduce((a, b) => a + b, 0);
  if (!nSell && !nBuy) return err('Nothing selected');
  if (nSell && !isSell) return err('You cannot sell here');
  for (const [r, n] of Object.entries(sell)) if (p.res[r] < n) return err('You do not have that to sell');
  for (const [r, n] of Object.entries(buy)) if ((L.res[r] || 0) < n) return err('Not enough there');
  if (p.coin + nSell < nBuy * price) return err(`Not enough PREPCOIN (price ${price} each)`);
  if (resTotal(p) - nSell + nBuy > holdLimit(p)) return err('You cannot carry that much');
  ts.actions--; finishMove(s);
  for (const [r, n] of Object.entries(sell)) { spend(s, p, r, n); p.coin += n; }
  for (const [r, n] of Object.entries(buy)) { L.res[r] -= n; p.res[r] += n; p.coin -= n * price; }
  logm(s, `${p.name} ${nBuy ? `buys ${nBuy}` : ''}${nBuy && nSell ? ' and ' : ''}${nSell ? `sells ${nSell}` : ''} at ${D.node[p.node].name}.`, p.id);
  return OK;
}
function doBuyItem(s, p, id) {
  const ts = s.ts;
  const shop = (D.cfg.shops[p.node] || []).find(x => x[0] === id);
  if (!shop) return err('Not sold here');
  if (ts.shop !== p.node) { if (!useAction(s, p, 'shop')) return err('No action available'); ts.shop = p.node; }
  const price = shop[1];
  if (p.coin < price) return err('Not enough PREPCOIN');
  if (id === 'DUCT') { if (s.supply.ducttape < 1) return err('Out of stock'); if (resTotal(p) >= holdLimit(p)) return err('Full'); p.coin -= price; gain(s, p, 'ducttape', 1); logm(s, `${p.name} buys duct tape.`, p.id); return OK; }
  const c = takeCard(s, id);
  if (!c) return err('Out of stock');
  p.coin -= price; giveCard(s, p, c); logm(s, `${p.name} buys a ${D.item[id].name} for ${price}.`, p.id);
  return OK;
}
function doCraft(s, p, id) {
  const it = D.item[id]; if (!it) return err('Unknown item');
  if (stockOf(s, id) === 0) return err('That item is out of stock (all copies in play)');
  if (it.needsBunker && !p.bunker) return err('Requires a bunker');
  if (it.mustOwn && !it.mustOwn.every(m => ownsItem(p, m))) return err('You must own: ' + it.mustOwn.map(m => D.item[m].name).join(', '));
  const { cost, note } = craftCost(s, p, it);
  if (!afford(p, cost)) return err('Missing resources');
  for (const [r, n] of Object.entries(cost)) spend(s, p, r, n);
  if (note === 'Chemistry 101') s.ts.chemFree = true;
  const c = takeCard(s, id); giveCard(s, p, c);
  logm(s, `${p.name} crafts a ${it.name}${note ? ' (' + note + ')' : ''}.`, p.id);
  return OK;
}
function doScrap(s, p, uid) {
  const i = p.items.findIndex(x => x.uid === uid); if (i < 0) return err('No such item');
  const it = D.item[p.items[i].id];
  const back = {}; for (const r of it.recipe) if (!r.x) back[r.r] = (back[r.r] || 0) + 1;
  for (const [r, n] of Object.entries(back)) if (s.supply[r] < n) return err('Not enough ' + RES_LABEL[r] + ' in the supply yet');
  const [c] = p.items.splice(i, 1);
  s.itemDeck.push({ uid: c.uid, id: c.id }); shuffle(s, s.itemDeck);
  for (const [r, n] of Object.entries(back)) gain(s, p, r, n);
  if (p.prepper === 'sam') gain(s, p, 'knowhow', 1);
  logm(s, `${p.name} scraps the ${it.name}.`, p.id);
  return OK;
}

// ------------------------------------------------------------------ views
export function publicView(s, forPl) {   // strip hidden information for a remote player
  const v = JSON.parse(JSON.stringify(s));
  for (const p of v.players) {
    if (p.id !== forPl) { p.itemCount = p.items.length; p.items = p.items.map(i => ({ uid: i.uid, id: 'hidden', broken: i.broken, tokens: i.tokens })); }
  }
  v.itemDeck = v.itemDeck.map(c => ({ uid: 0, id: c.id })); v.newsDeck = v.newsDeck.length; v.rng = 0;
  v.endTimes = { yellow: v.endTimes.yellow.length, orange: v.endTimes.orange.length };
  return v;
}
export function summary(s) {
  return s.players.map(p => ({ name: p.name, prepper: p.prepper, health: p.health, bunker: p.bunker, coin: p.coin, resources: resTotal(p), items: p.items.length }));
}
