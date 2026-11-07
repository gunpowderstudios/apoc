// Headless simulation: node tools/sim.mjs [games] [players] [seed]
import fs from 'node:fs';
import * as E from '../src/engine.js';
import * as AI from '../src/ai.js';
const rd = f => JSON.parse(fs.readFileSync(new URL('../data/' + f, import.meta.url)));
E.init({ board: rd('board.json'), items: rd('items.json'), news: rd('news.json'), preppers: rd('preppers.json'), config: rd('config.json'), adjacent: rd('adjacent.json') });
const games = +process.argv[2] || 5, np = +process.argv[3] || 4, seed0 = +process.argv[4] || 1;
const chars = ['jessica', 'sam', 'frost', 'naomi'];
let stats = { done: 0, stuck: 0, errors: {}, rounds: [], cmdErr: {} };
for (let g = 0; g < games; g++) {
  const s = E.createGame({ seed: seed0 + g, players: Array.from({ length: np }, (_, i) => ({ name: 'AI' + (i + 1), prepper: chars[i % 4], ai: true })) });
  let steps = 0, last = '';
  try {
    while (!s.over && steps < 20000) {
      const a = AI.next(s);
      if (!a) { stats.stuck++; console.log('STUCK game', g, 'stage', s.stage, 'step', s.ts && s.ts.step, 'pending', s.pending && s.pending.kind, 'cur', s.cur); break; }
      const r = E.dispatch(s, a.pl, a.cmd);
      if (!r.ok) { const k = a.cmd.t + ':' + r.error; stats.cmdErr[k] = (stats.cmdErr[k] || 0) + 1; if (stats.cmdErr[k] > 400) { console.log('LOOP', k); break; } }
      steps++;
    }
  } catch (e) { stats.errors[e.message] = (stats.errors[e.message] || 0) + 1; console.log('EXC game', g, e.stack.split('\n').slice(0, 4).join('\n')); }
  if (s.over) { stats.done++; stats.rounds.push(s.round); }
  if (process.env.VERBOSE) console.log(s.log.slice(-40).map(l => l.t).join('\n'));
  console.log(`game ${g}: over=${!!s.over} round=${s.round} defcon=${s.defcon} steps=${steps} ev=${s.apocEvent || '-'}  ${JSON.stringify(E.summary(s).map(x => x.name + ':' + x.health + '/' + x.resources + '/' + x.items + (x.bunker ? 'B' : '')))}`);
}
console.log(JSON.stringify(stats));
