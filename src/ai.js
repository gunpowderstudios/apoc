// Heuristic AI for empty seats. aiNext(s) -> {pl, cmd} | null.  Not clever - good enough to fill a table and expose rules problems.
import * as E from './engine.js';
const D = new Proxy({}, { get: (_, k) => E.D[k] });
const { RES, ALLRES } = E;

const chance = p => Math.random() < p;
function needValue(s, p, r) {
  if (r === 'ducttape') return 1.5;
  let v = 1;
  if (!p.bunker && p.res[r] < 1 && r !== 'ducttape') v = 5;
  if (r === 'food') v = Math.max(v, p.res.food < 3 ? 4 : p.res.food < 6 ? 2 : 0.3);
  if (r === 'meds' && p.health < 7) v = Math.max(v, 3);
  if (p.res[r] >= 5) v *= 0.3;
  return v;
}
const price = s => E.defc(s).buy;

function marketPlan(s, p) {
  const L = s.loc[p.node], pr = price(s);
  let coin = p.coin; const buy = {}, sell = {};
  const isSell = D.cfg.sellNodes.includes(p.node);
  let room = E.holdLimit(p) - E.resTotal(p);
  if (isSell) {   // sell clear surpluses when short of coin
    for (const r of ALLRES) { const keep = r === 'food' ? 4 : p.bunker ? 3 : 1; const extra = p.res[r] - keep; if (extra > 1 && coin < 6) { sell[r] = extra - 1; coin += sell[r]; room += sell[r]; } }
  }
  const list = []; for (const r of ALLRES) for (let i = 0; i < (L.res[r] || 0); i++) list.push([needValue(s, p, r), r]);
  list.sort((a, b) => b[0] - a[0]);
  let n = 0;
  for (const [v, r] of list) { if (coin >= pr && room > 0 && v >= 1.2) { buy[r] = (buy[r] || 0) + 1; coin -= pr; room--; n++; } }
  return { buy, sell, n, ns: Object.keys(sell).length };
}

function scoreNode(s, p, nodeId) {
  const n = D.node[nodeId], L = s.loc[nodeId], df = E.defc(s);
  let best = 0, what = null;
  if (n.kind !== 'building') {
    let v = 0; for (const r of ALLRES) v += (L.res[r] || 0) * needValue(s, p, r);
    if (L.coin) v += L.coin * 1.2;
    return { v: v * 0.9, what: 'pickup' };
  }
  if (nodeId === D.board.churchNode && L.coin) best = Math.max(best, L.coin * 1.2);
  if (nodeId === D.board.churchNode) { let v = 0; for (const r of ALLRES) v += (L.res[r] || 0) * needValue(s, p, r); best = Math.max(best, v * 0.9); }
  else {
    let v = 0, buyable = Math.floor(p.coin / df.buy); const toks = [];
    for (const r of ALLRES) for (let i = 0; i < (L.res[r] || 0); i++) toks.push(needValue(s, p, r));
    toks.sort((a, b) => b - a);
    for (let i = 0; i < Math.min(buyable, toks.length); i++) v += toks[i];
    if (v > best) { best = v; what = 'market'; }
    if (df.steal && !p.tagged && toks.length) { const sv = toks.slice(0, 3).reduce((a, b) => a + b, 0) * 0.55 - 1.2; if (sv > best) { best = sv; what = 'steal'; } }
    if (df.loot && toks.length && p.health >= 6) { const lv = toks.slice(0, 3).reduce((a, b) => a + b, 0) * 0.5 - 0.8; if (lv > best) { best = lv; what = 'loot'; } }
    if (D.cfg.sellNodes.includes(nodeId) && p.coin < 3 && ALLRES.some(r => p.res[r] > 3 + (r === 'food' ? 2 : 0))) { if (1.5 > best) { best = 1.5; what = 'market'; } }
  }
  if (n.acts.includes('dive') && p.health >= 4) { if (1.6 > best) { best = 1.6; what = 'dive'; } }
  if (n.acts.includes('burgle') && df.burgle && p.health >= 5) { if (2.4 > best) { best = 2.4; what = 'burgle'; } }
  if (n.acts.includes('buy') && p.coin >= 3) { const sh = E.shopList(s, p).filter(x => x.stock && x.price <= p.coin && wantItem(s, p, x.id)); if (sh.length) { const v = 2 + (p.bunker ? 0 : -1); if (v > best) { best = v; what = 'shop'; } } }
  if (n.acts.includes('gamble') && p.coin >= 5) { if (0.9 > best) { best = 0.9; what = 'gamble'; } }
  if (nodeId === D.board.barNode && !p.thug && p.coin >= 6 && s.thugsBar > 0) { if (1.8 > best) { best = 1.8; what = 'recruit'; } }
  if (nodeId === D.board.hospitalNode && p.health <= 4 && false) best = 0;
  if (n.acts.includes('trade') && !p.bunker) { const miss = RES.filter(r => p.res[r] < 1); const extra = ALLRES.filter(r => p.res[r] > 1); if (miss.length && extra.length) { if (3 > best) { best = 3; what = 'swap'; } } }
  return { v: best, what };
}
function wantItem(s, p, id) {
  if (E.ownsItem(p, id)) return id === 'knife' ? false : false;
  if (!p.bunker && E.defc(s).id === 'green' && p.coin < 6) return false;
  return ['pistol', 'rifle', 'knife', 'flashlight', 'bolt-cutters', 'kevlar-vest', 'chainsaw', 'bow'].includes(id);
}

export function choose(s, pd) {
  const p = s.players[pd.pl], ids = pd.options.map(o => o.id), has = id => ids.includes(id);
  switch (pd.kind) {
    case 'pickRes': case 'lootPick': {
      const list = ids.filter(i => i !== 'again');
      return list.sort((a, b) => needValue(s, p, b) - needValue(s, p, a))[0];
    }
    case 'lootAgain': return chance(pd.ctx.mode === 'steal' ? 0.25 : 0.2) ? 'again' : 'stop';
    case 'gambleNext': return s.ts.gamble && s.ts.gamble.pot >= 2 ? 'cash' : (chance(0.5) ? 'throw' : 'cash');
    case 'thugPay': return p.coin >= 3 ? 'coin' : p.res.food >= 3 ? 'food' : 'dismiss';
    case 'thugJob': return 'muscle';
    case 'offer': { for (const o of ['take', 'coin', 'food', 'tech']) if (has(o)) return o; return 'decline'; }
    case 'outbreak': return has('pay') ? 'pay' : ids[0];
    case 'crypto': return 'all';
    case 'contraband': return 'no';
    case 'fightDefend': return p.health <= 4 ? 'yield' : 'fight';
    case 'raidDefend': return has('trap') ? 'trap' : p.health >= 6 ? 'fight' : 'hide';
    case 'goHospital': return 'go';
    case 'hospitalCare': return 'care';
    case 'reroll': { const f = s.ts.dice; return (f.kind === 'night' && [3, 4].includes(f.face)) || (f.kind === 'day' && f.face <= 1 && false) ? 'reroll' : 'keep'; }
    case 'grabMeds': return ids[ids.length - 1];
    case 'robPick': return ids.sort((a, b) => (b === 'coin' ? 2 : 1) - (a === 'coin' ? 2 : 1))[0];
    default: return ids[0];
  }
}

export function next(s) {
  if (s.over) return null;
  if (s.pending) { const p = s.players[s.pending.pl]; return p.ai ? { pl: p.id, cmd: { t: 'choose', o: choose(s, s.pending) } } : null; }
  if (s.stage === 'grab') return grabNext(s);
  const p = E.cur(s); if (!p.ai) return null;
  const ts = s.ts;
  ts.aiFail = ts.aiFail || [];
  const C = cmd => ({ pl: p.id, cmd });
  if (ts.step === 'eat') return C({ t: 'eat' });
  if (ts.step === 'news') return C({ t: 'drawNews' });
  if (ts.step === 'newsroll') return C({ t: 'rollNews' });
  if (ts.step === 'roll') {
    const night = !p.tagged && !E.nightBlocked(s) && p.health >= 6 && chance(0.4);
    return C({ t: 'roll', kind: night ? 'night' : 'day' });
  }
  if (ts.step !== 'prep') return null;
  const ok = key => !ts.aiFail.includes(key);
  const fail = key => { ts.aiFail.push(key); };
  // ---- free actions
  if (p.health <= 5 && p.res.meds > 0 && p.health < 10 && !s.players.some(q => q.id !== p.id && q.node === p.node) && ok('heal' + p.res.meds)) { fail('heal' + p.res.meds); return C({ t: 'heal' }); }
  for (const it of p.items) if (it.broken && p.res.ducttape > 0 && ok('fix' + it.uid)) { fail('fix' + it.uid); return C({ t: 'fix', uid: it.uid }); }
  const L = s.loc[p.node], isFree = D.node[p.node].kind !== 'building' || p.node === D.board.churchNode;
  if (isFree && E.resTotal(p) < E.holdLimit(p)) { const r = ALLRES.filter(r => L.res[r] > 0).sort((a, b) => needValue(s, p, b) - needValue(s, p, a))[0]; if (r && ok('pick' + p.node + r + L.res[r])) { fail('pick' + p.node + r + L.res[r]); return C({ t: 'pickup', r }); } }
  if (L.coin > 0 && isFree && ok('coin' + p.node)) { fail('coin' + p.node); return C({ t: 'pickupCoin' }); }
  if (p.thug && p.thug.job === 'thief' && !ts.thiefUsed && ok('thief')) {
    let bn = null, br = null, bv = 0;
    for (const n of D.board.nodes) for (const r of ALLRES) if (s.loc[n.id].res[r] > 0) { const v = needValue(s, p, r); if (v > bv) { bv = v; bn = n.id; br = r; } }
    fail('thief'); if (bn) return C({ t: 'thief', node: bn, r: br });
  }
  if (E.hasItem(p, 'bow') && !ts.hunted) return C({ t: 'hunt' });
  // crafting
  const craftPick = pickCraft(s, p);
  if (craftPick && ok('craft' + craftPick)) { fail('craft' + craftPick); return C({ t: 'craft', id: craftPick }); }
  // ---- main actions
  const A = E.actionsAt(s, p);
  if (ts.actions > 0 && A.length) {
    if (A.some(a => a.a === 'build') && ok('build')) { fail('build'); return C({ t: 'build' }); }
    const sc = scoreNode(s, p, p.node);
    if (sc.v > 0.8 && sc.what && ok('act' + sc.what + p.node) && A.some(a => a.a === sc.what || (sc.what === 'shop' && a.a === 'shop'))) {
      fail('act' + sc.what + p.node);
      if (sc.what === 'market') { const pl = marketPlan(s, p); if (pl.n || pl.ns) return C({ t: 'market', buy: pl.buy, sell: pl.sell }); }
      else if (sc.what === 'shop') {
        const sh = E.shopList(s, p).filter(x => x.stock && x.price <= p.coin && wantItem(s, p, x.id)).sort((a, b) => b.price - a.price)[0];
        if (sh) return C({ t: 'buyItem', id: sh.id });
      } else if (sc.what === 'swap') {
        const miss = RES.filter(r => p.res[r] < 1), extra = ALLRES.filter(r => p.res[r] > 1 && r !== 'ducttape')[0];
        if (miss.length && extra && E.D.cfg) return C({ t: 'swap', give: { [extra]: 1 }, get: { [miss[0]]: 1 } });
      } else if (sc.what === 'recruit') return C({ t: 'recruit' });
      else return C({ t: sc.what });
    }
    // stuck: fight someone if strong
    if (A.some(a => a.a === 'fight') && p.health >= 8 && chance(0.15) && ok('fight')) { fail('fight'); const t = s.players.find(q => q.id !== p.id && q.node === p.node); return C({ t: 'fight', target: t.id }); }
    if (A.some(a => a.a === 'raid') && p.health >= 7 && chance(0.2) && ok('raid')) { fail('raid'); const t = s.players.find(q => q.id !== p.id && q.bunker); return C({ t: 'raid', target: t.id }); }
  }
  // ---- movement
  const mv = E.legalMoves(s, p);
  if (mv.length && ts.moves > 0) {
    if (!ts.aiTarget || ts.aiTarget === p.node || !ok('t' + ts.aiTarget)) ts.aiTarget = pickTarget(s, p);
    const tgt = ts.aiTarget;
    if (tgt && tgt !== p.node) {
      const path = E.pathTo(s, p.node, tgt);
      if (path) {
        let step = path[0];
        if (!mv.some(m => m.to === step)) { const sw = mv.find(m => m.subway && path.includes(m.to)); step = sw ? sw.to : null; }
        if (step && mv.some(m => m.to === step)) return C({ t: 'move', to: step });
      }
      fail('t' + tgt); ts.aiTarget = null;
    }
  }
  return C({ t: 'endTurn' });
}
function pickTarget(s, p) {
  const ts = s.ts, { dist } = E.reachable(s, p, 14);
  let best = null, bv = 0.7;
  const reach = Math.max(1, ts.moves);
  for (const [id, d] of Object.entries(dist)) {
    if (d === 0 || ts.aiFail.includes('t' + id)) continue;
    if (ts.moveState === 'done') continue;
    const sc = scoreNode(s, p, id); if (!sc.what && !(D.node[id].kind !== 'building')) continue;
    const v = sc.v / (1 + Math.max(0, d - reach) * 0.7 + d * 0.12);
    if (v > bv) { bv = v; best = id; }
  }
  if (!best) { // wander towards the market with the most stuff
    let bn = null, bs = 0; for (const n of D.board.nodes) if (n.kind === 'building') { const t = ALLRES.reduce((a, r) => a + (s.loc[n.id].res[r] || 0), 0); const d = dist[n.id]; if (d !== undefined && d > 0 && t / (1 + d) > bs) { bs = t / (1 + d); bn = n.id; } }
    best = bn;
  }
  return best;
}
function pickCraft(s, p) {
  const prio = p.bunker ? ['bed', 'solar-panel', 'hydroponics-lab', 'med-lab', 'rifle', 'pistol', 'flashlight', 'knife', 'bolt-cutters', 'kevlar-vest', 'shopping-cart', 'town-map'] : ['knife', 'town-map'];
  const bunkerNeed = p.bunker ? [] : RES.filter(r => p.res[r] < 1);
  for (const id of prio) {
    if (E.ownsItem(p, id) && !['solar-panel'].includes(id)) continue;
    if (E.ownsItem(p, id)) continue;
    if (!E.craftable(s, p).some(c => c.id === id)) continue;
    const it = D.item[id]; const cost = E.craftCost(s, p, it).cost;
    if (!p.bunker) { // never spend what the bunker needs
      let ok = true; for (const r of RES) { const after = p.res[r] - (cost[r] || 0); if (after < 1) ok = false; }
      if (!ok) continue;
    }
    if (p.res.food - (cost.food || 0) < 2) continue;
    return id;
  }
  return null;
}
function grabNext(s) {
  const g = s.grab; if (g.phase !== 'move') return null;
  const p = s.players[g.order[g.turn]]; if (!p.ai) return null;
  const C = cmd => ({ pl: p.id, cmd });
  const L = s.loc[p.node];
  if (E.resTotal(p) < E.holdLimit(p) && (g.grabbed[p.node] || 0) < 2 || D.node[p.node].kind !== 'building') {
    const r = ALLRES.filter(r => L.res[r] > 0).sort((a, b) => needValue(s, p, b) - needValue(s, p, a))[0];
    if (r && E.resTotal(p) < E.holdLimit(p) && ((g.grabbed[p.node] || 0) < 2 || D.node[p.node].kind !== 'building')) return C({ t: 'grab', r });
  }
  if (g.moves > 0) {
    const { dist } = E.reachable(s, p, g.moves);
    let best = null, bv = 0;
    for (const [id, d] of Object.entries(dist)) {
      if (d === 0) continue; const nn = D.node[id];
      let v = 0; const toks = []; for (const r of ALLRES) for (let i = 0; i < (s.loc[id].res[r] || 0); i++) toks.push(needValue(s, p, r));
      toks.sort((a, b) => b - a); v = toks.slice(0, nn.kind === 'building' ? 2 : 6).reduce((a, b) => a + b, 0);
      v = v / (1 + d * 0.15); if (v > bv) { bv = v; best = id; }
    }
    if (best) { const path = E.pathTo(s, p.node, best); if (path) return C({ t: 'move', to: path[0] }); }
  }
  return C({ t: 'endTurn' });
}
