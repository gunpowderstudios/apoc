// Top-down 2D board: canvas with pan/zoom, node picking and token drawing.
const RC = { food: '#2eae4e', knowhow: '#4f6d7a', chem: '#f2d300', hardware: '#f4f4f4', tech: '#b3202a', meds: '#1e9be0', ducttape: '#9aa0a6' };
export const PREP_COL = { naomi: '#e53935', jessica: '#1e88e5', frost: '#43a047', sam: '#8e44ad' };   // red / blue / green / purple
export const pcol = p => PREP_COL[p.prepper] || '#888';

export class View2D {
  constructor(canvas, board, img, icons) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.board = board; this.img = img; this.icons = icons;
    this.nodes = Object.fromEntries(board.nodes.map(n => [n.id, n]));
    this.z = 1; this.ox = 0; this.oy = 0; this.rot = 0;
    this.hover = null; this.hi = new Set(); this.targets = {}; this.showGraph = false; this.edit = null; this.sel = null; this.anim = {};
    this.bind(); this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
  }
  resize() {
    const r = this.c.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    this.c.width = Math.max(10, r.width * dpr); this.c.height = Math.max(10, r.height * dpr); this.c.style.width = r.width + 'px'; this.c.style.height = r.height + 'px';
    this.dpr = dpr; this.fit(); this.dirty = true;
  }
  fit() {
    const w = this.c.width, h = this.c.height, W = this.board.width, H = this.board.height;
    const sw = this.rot % 2 ? H : W, sh = this.rot % 2 ? W : H;
    this.base = Math.min(w / sw, h / sh) * 0.98; this.z = 1; this.ox = 0; this.oy = 0;
  }
  rotate() { this.rot = (this.rot + 2) % 4; this.dirty = true; }
  // world(board px) <-> screen
  toScreen(x, y) {
    let dx = x - this.board.width / 2, dy = y - this.board.height / 2;
    if (this.rot === 2) { dx = -dx; dy = -dy; }
    const k = this.base * this.z;
    return [this.c.width / 2 + this.ox + dx * k, this.c.height / 2 + this.oy + dy * k];
  }
  toWorld(sx, sy) {
    const k = this.base * this.z;
    let dx = (sx - this.c.width / 2 - this.ox) / k, dy = (sy - this.c.height / 2 - this.oy) / k;
    if (this.rot === 2) { dx = -dx; dy = -dy; }
    return [dx + this.board.width / 2, dy + this.board.height / 2];
  }
  bind() {
    const c = this.c; let drag = null, moved = false;
    c.addEventListener('wheel', e => {
      e.preventDefault(); const r = c.getBoundingClientRect(), sx = (e.clientX - r.left) * this.dpr, sy = (e.clientY - r.top) * this.dpr;
      const [wx, wy] = this.toWorld(sx, sy); const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      this.z = Math.max(0.6, Math.min(6, this.z * f));
      const [nx, ny] = this.toScreen(wx, wy); this.ox += sx - nx; this.oy += sy - ny; this.dirty = true;
    }, { passive: false });
    c.addEventListener('pointerdown', e => {
      if (!this.edit && this.canDrag) { const r0 = c.getBoundingClientRect(); const [qx, qy] = this.toWorld((e.clientX - r0.left) * this.dpr, (e.clientY - r0.top) * this.dpr); const pid = this.canDrag(qx, qy); if (pid != null) { this.dragP = { pid, wx: qx, wy: qy, x: e.clientX, y: e.clientY, moved: false }; c.setPointerCapture(e.pointerId); return; } }
      drag = { x: e.clientX, y: e.clientY, ox: this.ox, oy: this.oy }; moved = false; c.setPointerCapture(e.pointerId); if (this.edit) { const r = c.getBoundingClientRect(); const [wx, wy] = this.toWorld((e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr); this.sel = this.pick(wx, wy); this.dirty = true; } });
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect();
      if (this.dragP) {
        const d = this.dragP; if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 5) d.moved = true;
        if (d.moved) { [d.wx, d.wy] = this.toWorld((e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr); const h = this.pick(d.wx, d.wy); if (h !== d.node) { d.node = h; if (this.onDragHover) this.onDragHover(h); } c.style.cursor = 'grabbing'; this.dirty = true; }
        return;
      }
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; if (moved && !(this.edit && this.sel)) { this.ox = drag.ox + dx * this.dpr; this.oy = drag.oy + dy * this.dpr; this.dirty = true; } }
      const [wx, wy] = this.toWorld((e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr);
      const h = this.pick(wx, wy); if (h !== this.hover) { this.hover = h; this.dirty = true; c.style.cursor = h && (this.targets[h] || this.edit) ? 'pointer' : 'grab'; if (this.onHover) this.onHover(h); }
      if (this.edit === 'move' && drag && this.sel && moved) { const n = this.nodes[this.sel]; n.x = Math.round(wx); n.y = Math.round(wy); this.dirty = true; }
    });
    c.addEventListener('pointerup', e => {
      if (this.dragP) {
        const d = this.dragP; this.dragP = null; this.dirty = true;
        if (d.moved) { if (this.onDrop) this.onDrop(d.pid, d.node); return; }
        const r1 = c.getBoundingClientRect(); const [qx, qy] = this.toWorld((e.clientX - r1.left) * this.dpr, (e.clientY - r1.top) * this.dpr);
        if (this.onClick) this.onClick(this.pick(qx, qy), qx, qy); return;
      }
      const was = drag; drag = null;
      if (!moved && was) { const r = c.getBoundingClientRect(); const [wx, wy] = this.toWorld((e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr); const hk = (this.hits || []).find(h => Math.hypot(h.x - wx, h.y - wy) < h.rad); if (hk && this.onToken) { this.onToken({ node: hk.node, r: hk.r, cx: e.clientX, cy: e.clientY }); return; } const id = this.pick(wx, wy); if (this.onClick) this.onClick(id, wx, wy); }
    });
  }
  pick(wx, wy) {
    let best = null, bd = 1e9;
    for (const n of this.board.nodes) {
      const d = Math.hypot(n.x - wx, n.y - wy), lim = n.kind === 'building' ? 70 : n.kind === 'intersection' ? 55 : 45;
      let dd = d;
      if (n.kind === 'street' && n.seg) { const [x0, y0, x1, y1] = n.seg; const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy; const t = L ? Math.max(0, Math.min(1, ((wx - x0) * dx + (wy - y0) * dy) / L)) : 0; dd = Math.hypot(wx - (x0 + t * dx), wy - (y0 + t * dy)) + 8; }
      const sc = dd - (n.kind === 'intersection' ? 40 : n.kind === 'building' ? 30 : 0);   // junction and building markers win over the road running through them (so clicking the S subway ring never picks the street beside it)
      if (dd < lim && sc < bd) { bd = sc; best = n.id; }
    }
    return best;
  }
  draw(s, ui = {}) {
    const ctx = this.ctx, k = this.base * this.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#16181b'; ctx.fillRect(0, 0, this.c.width, this.c.height);
    ctx.save();
    ctx.translate(this.c.width / 2 + this.ox, this.c.height / 2 + this.oy);
    ctx.scale(k * (this.rot === 2 ? -1 : 1), k * (this.rot === 2 ? -1 : 1));
    ctx.translate(-this.board.width / 2, -this.board.height / 2);
    ctx.drawImage(this.img, 0, 0, this.board.width, this.board.height);
    if (this.showGraph || this.edit) this.drawGraph(ctx);
    // highlighted destinations
    for (const id of Object.keys(this.targets)) {
      const n = this.nodes[id], t = this.targets[id];
      ctx.save(); ctx.globalAlpha = id === this.hover ? 0.9 : 0.55; ctx.fillStyle = t.kind === 'subway' ? '#ff9800' : t.kind === 'act' ? '#ffd54f' : '#7cf29a';
      this.shape(ctx, n, true); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.9; this.shape(ctx, n, false); ctx.stroke(); ctx.restore();
    }
    if (this.hover && this.nodes[this.hover]) { ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.9; this.shape(ctx, this.nodes[this.hover], false); ctx.stroke(); ctx.restore(); }
    if (s) { this.drawTokens(ctx, s, ui); }
    if (this.dragP && this.dragP.moved) { const d = this.dragP; ctx.save(); ctx.globalAlpha = 0.9; ctx.translate(d.wx, d.wy); ctx.fillStyle = this.ghostColor || '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.shadowColor = '#000'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(0, -34, 22, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-26, 12); ctx.quadraticCurveTo(0, -40, 26, 12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  shape(ctx, n, fill) {
    ctx.beginPath();
    if (n.kind === 'street' && n.seg) { const [x0, y0, x1, y1] = n.seg; const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; const L = Math.hypot(x1 - x0, y1 - y0); const a = Math.atan2(y1 - y0, x1 - x0); ctx.save(); ctx.translate(mx, my); ctx.rotate(a); const w = Math.min(L, 460) * 0.5; ctx.roundRect(-w, -26, 2 * w, 52, 26); ctx.restore(); }
    else if (n.kind === 'building') ctx.arc(n.x, n.y, 44, 0, 7);
    else ctx.arc(n.x, n.y, 34, 0, 7);
  }
  drawGraph(ctx) {
    ctx.save(); ctx.lineWidth = 4;
    for (const [a, b] of this.board.edges) { const A = this.nodes[a], B = this.nodes[b]; ctx.strokeStyle = (A.kind === 'building' || B.kind === 'building') ? 'rgba(255,80,200,.8)' : 'rgba(80,220,255,.55)'; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }
    for (const n of this.board.nodes) {
      ctx.fillStyle = n.kind === 'building' ? '#ff4fc8' : n.kind === 'intersection' ? '#ffe14f' : '#4fd2ff'; ctx.strokeStyle = this.sel === n.id ? '#fff' : '#000'; ctx.lineWidth = this.sel === n.id ? 6 : 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.kind === 'building' ? 16 : 11, 0, 7); ctx.fill(); ctx.stroke();
      if (n.kind === 'building' || this.edit) { ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeText(n.id, n.x + 18, n.y - 14); ctx.fillText(n.id, n.x + 18, n.y - 14); }
    }
    ctx.restore();
  }
  drawTokens(ctx, s, ui) {
    this.hits = [];
    // resource tokens at locations
    for (const n of this.board.nodes) {
      const L = s.loc[n.id]; if (!L) continue;
      const list = []; for (const r of Object.keys(RC)) for (let i = 0; i < (L.res[r] || 0); i++) list.push(r);
      const extra = n.kind === 'building' ? 0 : 0;
      if (!list.length && !L.coin && !(L.items && L.items.length)) continue;
      const per = 6, sz = 17; let bx = n.x - Math.min(list.length, per) * sz * 0.5 + sz * 0.5, by = n.y + (n.kind === 'building' ? 52 : 24);
      list.forEach((r, i) => { const x = bx + (i % per) * sz, y = by + Math.floor(i / per) * (sz - 2); this.token(ctx, r, x, y, sz * 0.52, n.kind === 'building'); this.hits.push({ x, y, node: n.id, r, rad: sz * 0.62 }); });
      if (L.coin) { ctx.fillStyle = '#e8b100'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x - 30, n.y - 38, 14, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#000'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(L.coin, n.x - 30, n.y - 32); this.hits.push({ x: n.x - 30, y: n.y - 38, node: n.id, r: 'coin', rad: 16 }); }
    }
    // bouncers
    for (const p of s.players) if (p.thug && p.thug.post && this.nodes[p.thug.post]) { const n = this.nodes[p.thug.post]; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = pcol(p); ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeText('\u{1F6E1}', n.x + 40, n.y - 20); ctx.fillText('\u{1F6E1}', n.x + 40, n.y - 20); }
    // pawns
    const at = {}; for (const p of s.players) (at[p.node] = at[p.node] || []).push(p);
    for (const [nid, ps] of Object.entries(at)) {
      const n = this.nodes[nid]; if (!n) continue;
      ps.forEach((p, i) => {
        const a = (i / ps.length) * Math.PI * 2 - Math.PI / 2, rr = ps.length > 1 ? 24 : 0;
        const x = n.x + Math.cos(a) * rr, y = n.y + Math.sin(a) * rr - 10;
        const cur = s.cur === p.id && s.stage === 'turn';
        ctx.save(); ctx.translate(x, y);
        if (cur) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 24; }
        ctx.fillStyle = pcol(p); ctx.strokeStyle = '#fff'; ctx.lineWidth = cur ? 6 : 4;
        ctx.beginPath(); ctx.arc(0, -22, 17, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-19, 18); ctx.quadraticCurveTo(0, -26, 19, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
        ctx.strokeText(p.name.slice(0, 1).toUpperCase(), 0, 12); ctx.fillText(p.name.slice(0, 1).toUpperCase(), 0, 12);
        ctx.restore();
      });
    }
  }
  token(ctx, r, x, y, rad, big) {
    const im = this.icons[r];
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
    if (im) { ctx.drawImage(im, x - rad * 1.15, y - rad * 1.15, rad * 2.3, rad * 2.3); }
    else { ctx.fillStyle = RC[r]; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  loop(getState, getUi) { const f = () => { if (this.dirty || this.always) { this.dirty = false; this.draw(getState(), getUi()); } requestAnimationFrame(f); }; f(); }
}
