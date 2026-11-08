// Moveable 3D table view (Three.js). The board is modelled at true scale (metres).
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { PREP_COL } from './view2d.js';

// Player pieces: real figure height in metres (from the GLB file names: 40h/40h/38h/38h = mm)
const PIECE_H = { frost: 0.0399, jessica: 0.0386232, naomi: 0.038, sam: 0.038 };

const BOARD_W = 0.8;   // metres (800 mm). Height follows the artwork's aspect ratio.
const POOL_COINS = 30;   // PrepCoin that start in the pool
const RCOL = { food: 0x2eae4e, knowhow: 0x4f6d7a, chem: 0xf2d300, hardware: 0xf4f4f4, tech: 0xb3202a, meds: 0x1e9be0, ducttape: 0x9aa0a6 };

export class View3D {
  constructor(container, board, img, icons) {
    this.el = container; this.board = board; this.icons = icons;
    this.k = BOARD_W / board.width; this.H = board.height * this.k;
    this.nodes = Object.fromEntries(board.nodes.map(n => [n.id, n]));
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement); this.r = r;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x15171a);
    this.cam = new THREE.PerspectiveCamera(40, 1, 0.005, 6);
    this.cam.position.set(0, 1.15, 1.0); this.cam.lookAt(0, 0, 0.15);
    this.ctl = new OrbitControls(this.cam, r.domElement);
    this.ctl.addEventListener('start', () => { this.manual = true; this.fly = null; });   // you moved the camera yourself: the auto-follow leaves it alone until C or Z
    this.ctl.target.set(0, 0, 0.15); this.ctl.enableDamping = true; this.ctl.maxPolarAngle = Math.PI * 0.47; this.ctl.zoomToCursor = true; this.ctl.minDistance = 0.03; this.ctl.maxDistance = 2.6;
    this.ctl.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.ctl.update();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 0.85));
    const sun = new THREE.DirectionalLight(0xfff2dd, 3.4); sun.position.set(-0.4, 0.9, 0.5); sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096); sun.shadow.radius = 1; sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.0005; const sc = sun.shadow.camera; sc.left = -0.9; sc.right = 0.9; sc.top = 0.9; sc.bottom = -0.5; sc.near = 0.1; sc.far = 4; this.scene.add(sun);
    // table
    const table = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ color: 0x3b2e24, roughness: 0.9 }));
    table.rotation.x = -Math.PI / 2; table.position.y = -0.013; table.receiveShadow = true; this.scene.add(table);
    // board
    const tex = new THREE.CanvasTexture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = r.capabilities.getMaxAnisotropy();
    const top = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, this.H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.0001; top.receiveShadow = true; this.scene.add(top); this.top = top;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 0.006, 0.012, this.H + 0.006), new THREE.MeshStandardMaterial({ color: 0x1b1b1b }));
    slab.position.y = -0.0062; slab.castShadow = true; slab.receiveShadow = true; this.scene.add(slab);
    this.tokens = new THREE.Group(); this.scene.add(this.tokens);
    this.pawns = new THREE.Group(); this.scene.add(this.pawns);
    this.marks = new THREE.Group(); this.scene.add(this.marks);
    this.pawnMeshes = {}; this.sig = ''; this.markSig = '';
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2();
    this.texCache = {};
    this.tl = new THREE.TextureLoader(); this.texs = {}; this.labels = {}; this.furniture = new THREE.Group(); this.scene.add(this.furniture); this.mats = new THREE.Group(); this.scene.add(this.mats); this.piles = new THREE.Group(); this.scene.add(this.piles);
    this.furniture.position.y = this.mats.position.y = this.piles.position.y = -0.013;   // off-board things sit on the table top, not on the board's height
    this.buildFurniture();
    this.ctl.addEventListener('start', () => { this.fly = null; });
    this.bind(); this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    this.active = false;
  }
  piece(id) {
    this.pieces = this.pieces || {};
    return this.pieces[id] || (this.pieces[id] = new Promise(ok => {
      new GLTFLoader().load(`assets/models/${id}.glb`, g => {
        const root = g.scene, box = new THREE.Box3().setFromObject(root), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
        const k = PIECE_H[id] / sz.y, hold = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PREP_COL[id]), roughness: 0.45, metalness: 0.05 });
        root.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = true; o.receiveShadow = true; } });
        root.position.set(-c.x, -box.min.y, -c.z); hold.add(root); hold.scale.setScalar(k); const out = new THREE.Group(); out.add(hold); ok(out);
      }, undefined, () => ok(null));
    }));
  }
  w(n) { return [(n.x - this.board.width / 2) * this.k, (n.y - this.board.height / 2) * this.k]; }
  resize() { const rc = this.el.getBoundingClientRect(); this.r.setSize(rc.width, rc.height, false); this.r.domElement.style.width = '100%'; this.r.domElement.style.height = '100%'; this.cam.aspect = rc.width / Math.max(1, rc.height); this.cam.updateProjectionMatrix(); }
  bind() {
    const el = this.r.domElement; let down = null;
    // capture phase: decide about pawn dragging BEFORE OrbitControls sees the press
    el.addEventListener('pointerdown', e => {
      down = { x: e.clientX, y: e.clientY, moved: false };
      if (e.button === 0 && e.altKey) { this._leftWas = this.ctl.mouseButtons.LEFT; this.ctl.mouseButtons.LEFT = THREE.MOUSE.PAN; }   // Alt/Option + drag = pan too
      if (e.button === 0 && !e.altKey) this.pivotCentre();   // rotate around what is at the centre of the screen
      if (e.button !== 0) return;
      const h = this.hit(e);
      if (h && h.type === 'cube' && !this.heldG && this.canAdjustHealth) { const hc = h.mesh.userData.healthCube; this.cdrag = { ...hc, mesh: h.mesh, hp: null }; this.ctl.enabled = false; el.setPointerCapture(e.pointerId); }
      if (h && h.type === 'token' && this.editPiles && h.info && h.info.node !== undefined) { this.pdrag = { node: h.info.node, r: h.info.r }; this.ctl.enabled = false; el.setPointerCapture(e.pointerId); }
      if (h && h.type === 'pawn' && this.canDrag && this.canDrag(h.pid)) { this.drag = { pid: h.pid, mesh: this.pawnMeshes[h.pid], node: null }; this.ctl.enabled = false; el.setPointerCapture(e.pointerId); }
    }, true);
    el.addEventListener('pointermove', e => {
      if (this.heldG) { this.ndc(e); const pt = new THREE.Vector3(); if (this.ray.ray.intersectPlane(this.heldPlane, pt)) this.heldG.position.set(pt.x, 0.03, pt.z); el.style.cursor = 'grabbing'; this.updateDrop(e); }
      if (down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 5) down.moved = true;
      if (this.pdrag) {   // layout editor: dragging a whole pile of tokens on the board
        if (!down || !down.moved) return; const pt = this.boardPoint(e); if (!pt) return; const d = this.pdrag; d.bx = pt.bx; d.by = pt.by;
        for (const m of this.tokens.children) if (m.userData.tok && m.userData.tok.node === d.node && m.userData.tok.r === d.r) { m.position.x = pt.x; m.position.z = pt.z; }
        el.style.cursor = 'grabbing'; return;
      }
      if (this.cdrag) {   // sliding a health cube along its track
        if (!down || !down.moved) return; this.ndc(e);
        const pt = new THREE.Vector3(); if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.004), pt)) {
          const c = this.cdrag, fx = (pt.x - c.x) / 0.21 + 0.5, hp = Math.max(0, Math.min(10, Math.round(10 - (fx - 0.2805) / 0.0651)));
          c.hp = hp; c.mesh.position.x = c.x + ((0.2805 + (10 - hp) * 0.0651) - 0.5) * 0.21; c.mesh.position.y = c.y + 0.006;
        }
        el.style.cursor = 'grabbing'; return;
      }
      if (this.drag) {
        if (!down || !down.moved) return;
        const pt = this.boardPoint(e); if (!pt) return;
        this.drag.mesh.userData.free = true; this.drag.mesh.position.set(pt.x, 0.022, pt.z);
        const id = this.pickBoard ? this.pickBoard(pt.bx, pt.by) : null;
        if (id !== this.drag.node) { this.drag.node = id; if (this.onDragHover) this.onDragHover(id); }
        el.style.cursor = 'grabbing'; return;
      }
      if (e.buttons) return;
      const h = this.hit(e), key = h ? h.type + (h.id || h.pid || (h.info && (h.info.node || h.info.mat) + h.info.r)) : '';
      if (key !== this.hoverKey) {
        this.hoverKey = key;
        el.style.cursor = !h ? 'grab' : h.type === 'cube' ? 'grab' : h.type === 'token' ? 'pointer' : h.type === 'pawn' ? (this.canDrag && this.canDrag(h.pid) ? 'grab' : 'default') : (h.id && this.targets && this.targets[h.id] ? 'pointer' : 'grab');
      }
    });
    const up = e => {
      if (this._leftWas !== undefined) { this.ctl.mouseButtons.LEFT = this._leftWas; this._leftWas = undefined; }
      if (this.pdrag) {
        const d = this.pdrag; this.pdrag = null; this.ctl.enabled = true;
        if (down && down.moved && d.bx !== undefined) { down = null; this.layout = this.layout || {}; (this.layout[d.node] = this.layout[d.node] || {})[d.r] = [Math.round(d.bx), Math.round(d.by)]; if (this.onLayout) this.onLayout(this.layout); return; }
      }
      if (this.cdrag) {
        const c = this.cdrag; this.cdrag = null; this.ctl.enabled = true;
        if (down && down.moved && c.hp !== null) { down = null; if (this.onHealth) this.onHealth(c.pid, c.hp); return; }
        c.mesh.position.y = c.y;
      }
      if (this.drag) {
        const d = this.drag; this.drag = null; this.ctl.enabled = true; d.mesh.userData.free = false;
        if (down && down.moved) { down = null; if (this.onDrop) this.onDrop(d.pid, d.node); return; }
      }
      if (!down) return; const moved = down.moved; down = null;
      if (moved || e.button !== 0) return;
      const h = this.hit(e);
      if (h && h.type === 'token') { if (this.editPiles) { if (this.onPileClick && h.info && h.info.node !== undefined) this.onPileClick(h.info.node); return; } if (this.onToken) this.onToken({ ...h.info, cx: e.clientX, cy: e.clientY }); return; }
      if (h && h.type === 'news') { if (this.onNews) this.onNews(h.key); return; }
      if (h && h.type === 'mat') { if (this.onMat) this.onMat(h.matId, h.cardImg); return; }
      if (h && h.type === 'card') { if (this.onCard) this.onCard(h.img); return; }
      const id = h ? (h.type === 'board' ? h.id : h.type === 'pawn' ? this.pawnNode(h.pid) : null) : null;
      if (this.onClick) { const bp = this.boardPoint(e); this.onClick(id, bp ? { x: bp.bx, y: bp.by } : null); }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => { if (this.drag) { this.drag.mesh.userData.free = false; this.drag = null; this.ctl.enabled = true; } down = null; });
  }
  // drop-zone highlight while holding tokens: a translucent cover over the space / card under the pointer (green = can drop, red = can't, amber = put back)
  updateDrop(e) {
    const h = this.hit(e); let tgt = null;
    if (h) { if (h.type === 'board' && h.id) tgt = { type: 'node', id: h.id }; else if (h.type === 'mat') tgt = { type: 'mat', id: h.matId }; else if (h.type === 'token') tgt = h.info.mat !== undefined ? { type: 'mat', id: h.info.mat } : { type: 'node', id: h.info.node }; }
    const key = tgt ? tgt.type + tgt.id : ''; if (key === this.dropKey) return; this.dropKey = key;
    if (!tgt) return this.setDrop(null);
    const ok = this.onHeldHover ? this.onHeldHover(tgt) : true;
    let r;
    if (tgt.type === 'mat') { const n = this.nPlayers || 1; r = { x: this.matX(tgt.id, n), z: this.H / 2 + 0.03 + 0.0745, w: 0.22, d: 0.16 }; } else r = this.nodeRect(tgt.id);
    if (!r) return this.setDrop(null);
    const { x, z, w, d } = r;
    this.setDrop({ x, z, w, d, ok });
  }
  // the covered area of a board space (street strip, junction square, building square), in table metres
  nodeRect(id) {
    const nd = this.board.nodes.find(q => q.id === id); if (!nd) return null; let x, z, w, d;
    if (nd.seg) { const [x0, y0, x1, y1] = nd.seg; [x, z] = this.w({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }); const horiz = Math.abs(x1 - x0) >= Math.abs(y1 - y0); w = (horiz ? Math.abs(x1 - x0) : 64) * this.k; d = (horiz ? 64 : Math.abs(y1 - y0)) * this.k; }
    else { [x, z] = this.w(nd); const s = (nd.kind === 'building' ? 130 : 64) * this.k; w = d = s; if (nd.kind === 'building') z += 0.01; }
    return { x, z, w, d };
  }
  // glowing event area: pulses until the next turn
  setGlow(ids, color) {
    const key = (ids || []).join(',') + color; if (key === this.glowKey) return; this.glowKey = key;
    if (!this.glowG) { this.glowG = new THREE.Group(); this.scene.add(this.glowG); } this.glowG.clear(); this.glowMats = [];
    for (const id of ids || []) {
      const r = this.nodeRect(id); if (!r) continue;
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }), mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
      mesh.rotation.x = -Math.PI / 2; mesh.scale.set(r.w, r.d, 1); mesh.position.set(r.x, 0.005, r.z); mesh.renderOrder = 4; this.glowG.add(mesh); this.glowMats.push(m);
    }
  }
  setDrop(f) {
    if (!this.dropFx) { this.dropFx = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide })); this.dropFx.rotation.x = -Math.PI / 2; this.dropFx.renderOrder = 5; this.scene.add(this.dropFx); }
    this.dropFx.visible = !!f; if (!f) return;
    this.dropFx.material.color.set(f.ok === true ? 0x2ecc40 : f.ok === 'same' ? 0xffc107 : 0xe53935);
    this.dropFx.scale.set(f.w, f.d, 1); this.dropFx.position.set(f.x, 0.004, f.z);
  }
  // tokens held in the hand: a floating stack that follows the pointer until the next click
  setHeld(h) {
    if (this.heldG) { this.scene.remove(this.heldG); this.heldG = null; }
    this.dropKey = null; if (!h) { this.setDrop(null); return; }
    this.heldPlane = this.heldPlane || new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.0);
    const g = new THREE.Group(), geo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.0028, 20);
    for (let i = 0; i < Math.min(h.n, 14); i++) { const m = new THREE.Mesh(geo, this.tokenMat(h.r)); m.position.y = i * 0.003; m.castShadow = true; g.add(m); }
    g.position.set(0, 0.03, 0.3); this.scene.add(g); this.heldG = g;
  }
  pawnNode(pid) { const m = this.pawnMeshes[pid]; return m && m.userData.node; }
  ndc(e) { const rc = this.r.domElement.getBoundingClientRect(); this.mouse.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1); this.ray.setFromCamera(this.mouse, this.cam); }
  boardPoint(e) {
    this.ndc(e); const hit = this.ray.intersectObject(this.top)[0]; if (!hit) return null;
    return { x: hit.point.x, z: hit.point.z, bx: hit.point.x / this.k + this.board.width / 2, by: hit.point.z / this.k + this.board.height / 2 };
  }
  // what is under the pointer: a token pile, a player pawn, or the board
  hit(e) {
    this.ndc(e);
    const cand = [];
    const th = this.ray.intersectObjects([...this.tokens.children, ...this.mats.children], false).find(h => h.object.userData.tok && !(this.hideRes && h.object.parent === this.tokens)); if (th) cand.push({ d: th.distance, type: 'token', info: th.object.userData.tok });
    const nh = this.ray.intersectObjects(this.piles.children, false).find(h => h.object.userData.news); if (nh) cand.push({ d: nh.distance, type: 'news', key: nh.object.userData.news });
    const chh = this.ray.intersectObjects(this.mats.children, false).find(h => h.object.userData.healthCube); if (chh) cand.push({ d: chh.distance - 1e-4, type: 'cube', pid: chh.object.userData.healthCube.pid, mesh: chh.object });
    const mh = this.ray.intersectObjects(this.mats.children, false).find(h => h.object.userData.matId !== undefined); if (mh) cand.push({ d: mh.distance + 1e-5, type: 'mat', matId: mh.object.userData.matId, cardImg: mh.object.userData.cardImg });
    const fh = this.ray.intersectObjects(this.furniture.children, false).find(h => h.object.userData.cardImg); if (fh) cand.push({ d: fh.distance, type: 'card', img: fh.object.userData.cardImg });
    const ph = this.ray.intersectObjects(this.pawns.children, true)[0];
    if (ph) { let o = ph.object; while (o && o.userData.pid === undefined) o = o.parent; if (o) cand.push({ d: ph.distance, type: 'pawn', pid: o.userData.pid }); }
    const bh = this.ray.intersectObject(this.top)[0];
    if (bh) { const bx = bh.point.x / this.k + this.board.width / 2, by = bh.point.z / this.k + this.board.height / 2; cand.push({ d: bh.distance + 1e-6, type: 'board', id: this.pickBoard ? this.pickBoard(bx, by) : null }); }
    cand.sort((a, b) => a.d - b.d); return cand[0] || null;
  }
  tokenMat(r) {
    if (this.texCache[r]) return this.texCache[r];
    const im = this.icons[r]; let top; if (!RCOL[r]) RCOL[r] = 0xe8b100;   // 'coin'
    if (im) { const t = new THREE.CanvasTexture(im); t.colorSpace = THREE.SRGBColorSpace; top = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }); }
    else top = new THREE.MeshStandardMaterial({ color: RCOL[r] });
    const side = new THREE.MeshStandardMaterial({ color: RCOL[r], roughness: 0.6 });
    return this.texCache[r] = [side, top, side];
  }
  sync(s, ui) {
    this.syncTable(s);
    this.setGlow(s.glow ? s.glow.nodes : [], { nuclear: 0xffc107, pandemic: 0xff3b30, ai: 0x2e8bff }[s.glow && s.glow.type] || 0xffffff);
    // resource tokens
    const sig = JSON.stringify([Object.entries(s.loc).map(([k, v]) => [k, v.res, v.coin, v.at]), this.hide ? this.hide.size : -1, this.hl || null, this.layout || null]);
    if (sig !== this.sig) {
      this.sig = sig; this.tokens.clear();
      const geo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.0028, 20), coinMat = new THREE.MeshStandardMaterial({ color: 0xe8b100, metalness: 0.7, roughness: 0.3 });
      for (const n of this.board.nodes) {
        const L = s.loc[n.id]; if (!L || (this.hide && this.hide.has(n.id))) continue;
        const list = []; for (const r of Object.keys(RCOL)) for (let i = 0; i < (L.res[r] || 0); i++) list.push(r);
        const NUDGE = { drugs: [-20, 0], hardwarestore: [15, 0], bigstorage: [65, 0] }, nu = NUDGE[n.id] || [0, 0], [cx, cz] = L.at ? this.w({ x: L.at[0], y: L.at[1] }) : this.w({ x: n.x + nu[0], y: n.y + nu[1] });
        const F = 1;   // every resource token on the board is the same size (15 mm across, like the pool and player-card tokens)
        // one pile per resource type (stacked upwards); piles sit side by side so they never overlap
        const SP = 0.0175 * F, piles = [];
        for (const r of Object.keys(RCOL)) if (L.res[r]) piles.push({ r, c: L.res[r] });
        if (L.coin) piles.push({ coin: true, c: L.coin });
        const PER = { thrift: 2 }[n.id] || (piles.length > 6 ? 3 : 6), rowsN = Math.ceil(piles.length / PER);   // lots of piles (Big Storage at the start): rows of 3 so they stay inside the building
        const z0 = cz + (n.kind === 'building' ? 0.012 : 0.016) - (PER <= 3 ? (rowsN - 1) * SP / 2 : 0);
        piles.forEach((pl, i) => {
          const row = Math.floor(i / PER), colN = Math.min(PER, piles.length - row * PER), col = i % PER;
          let px = cx + (col - (colN - 1) / 2) * SP, pz = z0 + row * SP;   // default spot; a saved layout (data/tokenlayout.json or your sandbox edits) overrides it per pile
          const ov = this.layout && this.layout[n.id] && this.layout[n.id][pl.coin ? 'coin' : pl.r]; if (ov) [px, pz] = this.w({ x: ov[0], y: ov[1] });
          const hot = this.hl && this.hl.node === n.id && this.hl.r === (pl.coin ? 'coin' : pl.r);
          if (hot) { const ring = new THREE.Mesh(new THREE.RingGeometry(0.0095, 0.0125, 32), new THREE.MeshBasicMaterial({ color: 0xffeb3b, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(px, 0.0006, pz); this.tokens.add(ring); }
          for (let k = 0; k < pl.c; k++) {
            const m = new THREE.Mesh(geo, this.tokenMat(pl.coin ? 'coin' : pl.r)); m.scale.set(F, 1, F);
            m.position.set(px, 0.0015 + k * 0.003, pz); m.castShadow = true; m.userData.tok = { node: n.id, r: pl.coin ? 'coin' : pl.r }; this.tokens.add(m);
          }
        });
      }
    }
    // pawns
    const at = {}; s.players.forEach(p => (at[p.node] = at[p.node] || []).push(p));
    for (const p of s.players) {
      let m = this.pawnMeshes[p.id];
      if (!m) {
        m = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PREP_COL[p.prepper] || '#888'), roughness: 0.4 });
        const ph = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.03, 20), mat); ph.position.y = 0.015; m.add(ph);   // placeholder until the model loads
        const gc = new THREE.Color(PREP_COL[p.prepper] || '#fff'), glow = new THREE.Group();   // glowing base: shows which figure is the one to move
        const gm = () => new THREE.MeshBasicMaterial({ color: gc, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.0125, 0.0185, 40), gm()), halo = new THREE.Mesh(new THREE.CircleGeometry(0.0185, 40), gm());
        halo.material.opacity = 0.3; for (const o of [ring, halo]) { o.rotation.x = -Math.PI / 2; o.position.y = 0.0012; o.renderOrder = 5; glow.add(o); }
        glow.visible = false; m.userData.glow = glow; m.add(glow);
        this.piece(p.prepper).then(proto => { if (proto) { m.clear(); m.add(proto.clone()); m.add(glow); } });
        this.pawns.add(m); this.pawnMeshes[p.id] = m; m.userData.cur = new THREE.Vector3(); m.userData.first = true; m.userData.pid = p.id;
      }
      const list = at[p.node], i = list.indexOf(p), n = this.nodes[p.node], [cx, cz] = this.w(n);
      const a = (i / list.length) * Math.PI * 2, rr = list.length > 1 ? 0.012 : 0;
      m.userData.target = new THREE.Vector3(cx + Math.cos(a) * rr, 0, cz + Math.sin(a) * rr - 0.004); m.userData.node = p.node;
      if (m.userData.first) { m.position.copy(m.userData.target); m.userData.first = false; }
      m.userData.active = s.cur === p.id && !s.over && ((s.stage === 'turn' && s.ts && s.ts.step === 'prep' && s.ts.moves > 0 && s.ts.moveState !== 'done') || (s.stage === 'grab' && s.grab && s.grab.moves > 0));
      m.scale.setScalar(1);   // figures always show at their true height (the active player is marked on their card instead)
    }
    // move highlights
    const msig = Object.keys(ui.targets || {}).join(',') + '|' + (ui.hover || '');
    this.targets = ui.targets;
    if (msig !== this.markSig) {
      this.markSig = msig; this.marks.clear();
      const rg = new THREE.RingGeometry(0.011, 0.016, 28);
      for (const id of Object.keys(ui.targets || {})) {
        const t = ui.targets[id], n = this.nodes[id], [cx, cz] = this.w(n);
        const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: t.kind === 'subway' ? 0xff9800 : t.kind === 'act' ? 0xffd54f : 0x7cf29a, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
        m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.002, cz); this.marks.add(m);
      }
    }
  }
  tex(url) {
    if (!this.texs[url]) { const x = this.tl.load(url); x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 8; this.texs[url] = x; }
    return this.texs[url];
  }
  flat(w, d, url, x, y, z, extra = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: this.tex(url), roughness: 0.7, ...extra }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = true; return m;
  }
  numSprite(n) {   // small white count shown beside a token pile
    this.nums = this.nums || {}; const k = String(n); if (!this.nums[k]) {
      const c = document.createElement('canvas'); c.width = 96; c.height = 96; const g = c.getContext('2d');
      g.font = 'bold 78px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = '#000'; g.strokeText(k, 48, 52); g.fillStyle = '#fff'; g.fillText(k, 48, 52);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true })); sp.scale.set(0.016, 0.016, 1); sp.renderOrder = 11; this.nums[k] = sp;
    } return this.nums[k].clone();
  }
  label(text, color = '#fff') {
    const k = text + color; if (this.labels[k]) return this.labels[k].clone();
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    let fs = 54; g.font = `bold ${fs}px system-ui,sans-serif`; while (g.measureText(text).width > 470 && fs > 20) { fs -= 2; g.font = `bold ${fs}px system-ui,sans-serif`; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.lineJoin = 'round'; g.miterLimit = 2; g.strokeStyle = '#000'; g.strokeText(text, 256, 50); g.fillStyle = color; g.fillText(text, 256, 50);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true })); sp.scale.set(0.16, 0.03, 1); sp.renderOrder = 10;
    this.labels[k] = sp; return sp.clone();
  }
  // Table furniture: DEFCON countdown chart left of the board; news piles right of it.
  buildFurniture() {
    const hb = this.H / 2, W = BOARD_W / 2;
    this.chart = { w: 0.15, d: 0.15 * 866 / 400, x: -(W + 0.03 + 0.075), z: -hb + 0.142 + 0.06 + 0.15 * 866 / 400 / 2 };   // DEFCON chart sits below the item deck on the left
    const c = this.flat(this.chart.w, this.chart.d, 'assets/ui/countdown.jpg', this.chart.x, 0.0018, this.chart.z); c.userData.cardImg = 'assets/ui/countdown.jpg'; this.furniture.add(c);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(this.chart.w + 0.004, 0.0012, this.chart.d + 0.004), new THREE.MeshStandardMaterial({ color: 0x111111 })); edge.position.set(this.chart.x, 0.0004, this.chart.z); edge.receiveShadow = true; this.furniture.add(edge);
    const sideM = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }), topM = new THREE.MeshStandardMaterial({ map: this.tex('assets/counters/shtf.webp'), transparent: true, roughness: 0.4 }); this.defMark = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.004, 40), [sideM, topM, sideM]); this.defMark.rotation.y = Math.PI / 2; this.defMark.castShadow = true; this.furniture.add(this.defMark);
    { const lw = 0.19, ld = lw * 226 / 500, lx = 0.51, lz = this.H / 2 - ld / 2, lg = this.flat(lw, ld, 'assets/ui/logo.png', lx, 0.002, lz, { transparent: true }); lg.castShadow = false; lg.material = new THREE.MeshBasicMaterial({ map: this.tex('assets/ui/logo.png'), transparent: true }); this.furniture.add(lg); }   // game logo + copyright, right of the board, base level with the board's base
    const lb = this.label('DEFCON', '#ffd54f'); lb.position.set(this.chart.x, 0.03, this.chart.z + this.chart.d / 2 + 0.036); this.furniture.add(lb);
    // news + item piles in one row along the top edge of the board: face-down pack on the left, the turned-over papers spread to the right
    const tz = -(hb + 0.03 + 0.0955), x0 = -W + 0.0675, gap = 0.165;
    // thin dotted white outlines mark where the news cards are (or will be) laid
    { const cv = document.createElement('canvas'); cv.width = 270; cv.height = 382; const g = cv.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 3; g.setLineDash([4, 8]); g.lineCap = 'round'; g.strokeRect(6, 6, 258, 370);
      const tx = new THREE.CanvasTexture(cv); tx.anisotropy = 8; this.slotTex = tx; }
    this.newsPos = { deck: [x0, tz], ai: [x0 + gap, tz], pandemic: [x0 + 2 * gap, tz], nuclear: [x0 + 3 * gap, tz], items: [this.chart.x, -hb + 0.076] };   // item deck: top left, above the DEFCON chart
    for (const k of ['deck', 'ai', 'pandemic', 'nuclear']) { const [sx, sz] = this.newsPos[k]; const sl = new THREE.Mesh(new THREE.PlaneGeometry(0.1347 + 0.004, 0.191 + 0.004), new THREE.MeshBasicMaterial({ map: this.slotTex, transparent: true, opacity: 0.8, depthWrite: false })); sl.rotation.x = -Math.PI / 2; sl.position.set(sx, 0.0006, sz); sl.renderOrder = 1; this.furniture.add(sl); }
  }
  matX(i, n) { return (i - (n - 1) / 2) * 0.225; }
  syncTable(s) {
    const df = s.defcon, ys = [590, 440, 270, 78];   // pixel rows of the four DEFCON lights on the chart image (400x866)
    const fx = this.chart.x - this.chart.w / 2 + this.chart.w * (330 / 400), fz = this.chart.z - this.chart.d / 2 + this.chart.d * (ys[Math.min(3, df)] / 866);
    this.defMark.position.set(fx + 0.0, 0.004, fz + 0.0); this.defMark.scale.set(2.0, 1, 2.0); 
    // the POOL: resources on the table that are not in play (crafted-away, sold and lost resources come back here), in stacks of 5 on the right of the board
    const held = s.players.reduce((a, q) => a + (q.coin || 0), 0) + Object.values(s.loc || {}).reduce((a, L) => a + (L.coin || 0), 0);
    const sup = { ...(s.supply || {}), coin: Math.max(0, POOL_COINS - held) }, ssig = JSON.stringify(sup);   // PrepCoin pool: 30 on the table minus the coin players hold or have left on the board
    if (ssig !== this.ssig) {
      this.ssig = ssig; if (!this.pool) { this.pool = new THREE.Group(); this.pool.position.y = -0.013; this.scene.add(this.pool); } this.pool.clear();
      const W2 = BOARD_W / 2, hb2 = this.H / 2, x0 = W2 + 0.045, z0 = -hb2 + 0.09, geo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.0028, 20);
      const hd = this.label('RESOURCE POOL', '#fff'); hd.scale.set(0.15, 0.019, 1); hd.position.set(x0 + 0.075, 0.012, z0 - 0.05); this.pool.add(hd);
      [...Object.keys(RCOL).filter(k => k !== 'coin'), 'coin'].forEach((r, row) => {
        const n = sup[r] || 0, z = z0 + row * 0.042; const ns = this.numSprite(n); ns.position.set(x0, 0.012, z); this.pool.add(ns);
        for (let i = 0; i < n; i++) { const st = Math.floor(i / 5), h = i % 5; const m = new THREE.Mesh(geo, this.tokenMat(r)); m.position.set(x0 + 0.025 + st * 0.018, 0.0015 + h * 0.003, z); m.castShadow = true; this.pool.add(m); }
      });
    }
    // news piles
    const deckN = Array.isArray(s.newsDeck) ? s.newsDeck.length : s.newsDeck, itemN = (s.itemDeck || []).length;
    const psig = JSON.stringify([deckN, s.stand, s.spent, itemN]);
    if (psig !== this.psig) {
      this.psig = psig; this.piles.clear();
      const make = (key, n, topUrl, name) => {
        if (n <= 0) return;
        const [x, z] = this.newsPos[key], h = Math.max(0.001, n * 0.0007), side = new THREE.MeshStandardMaterial({ color: 0xe9e4d6 });
        const top = new THREE.MeshStandardMaterial({ map: this.tex(topUrl), roughness: 0.8 });
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.1347, h, 0.191), [side, side, top, side, side, side]); m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; m.userData.news = key; this.piles.add(m);
        const lb = this.label(`${name} ${n}`, '#fff'); lb.scale.set(0.13, 0.025, 1); lb.position.set(x, h + 0.012, z - 0.118); this.piles.add(lb);
      };
      make('deck', deckN, 'assets/news/back.jpg', 'DECK');
      if (itemN > 0) {   // face-down shuffled ITEM deck (portrait cards 63x88 mm, drawn bigger so it reads like the news piles)
        const [x, z] = this.newsPos.items, h = Math.max(0.001, itemN * 0.0007), side = new THREE.MeshStandardMaterial({ color: 0xe9e4d6 }), top = new THREE.MeshStandardMaterial({ map: this.tex('assets/items/back.jpg'), roughness: 0.8 });
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.0945, h, 0.132), [side, side, top, side, side, side]); m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; m.userData.news = 'items'; this.piles.add(m);
        const lb = this.label(`ITEMS ${itemN}`, '#fff'); lb.scale.set(0.13, 0.025, 1); lb.position.set(x, h + 0.012, z - 0.085); this.piles.add(lb);
      }
      for (const ty of ['ai', 'pandemic', 'nuclear']) { const a = s.stand[ty]; make(ty, a.length, a.length ? ((s.spent || []).includes(a[a.length - 1]) ? 'assets/news/back.jpg' : `assets/news/${a[a.length - 1]}.jpg`) : '', ty.toUpperCase()); }
      for (const ty of ['ai', 'pandemic', 'nuclear']) if (!s.stand[ty].length) { const [x, z] = this.newsPos[ty]; const lb = this.label(ty.toUpperCase(), '#9aa'); lb.scale.set(0.13, 0.025, 1); lb.position.set(x, 0.01, z); this.piles.add(lb); }
    }
    // player mats: character card (backpack side until bunker), resource piles and item cards
    const msig = JSON.stringify([s.players.map(p => [p.prepper, p.bunker, p.res, p.coin, p.health, p.busted, p.tagged, p.items.map(i => i.id + (i.broken ? 'x' : ''))]), this.flip || {}, s.cur, s.stage, s.pending && s.pending.pl]);
    if (msig !== this.matSig) {
      this.matSig = msig; this.mats.clear(); this.nPlayers = s.players.length; this.matItems = s.players.some(q => q.items.length > 0);
      const n = s.players.length, zc = this.H / 2 + 0.03 + 0.0745, SP = 0.03;
      s.players.forEach((p, i) => {
        const c0 = this.mats.children.length;
        const x = this.matX(i, n), art = (this.preppers && this.preppers[p.prepper] ? this.preppers[p.prepper].art : []), url = art[(this.flip && this.flip[p.id] !== undefined ? this.flip[p.id] : (p.bunker ? 1 : 0))] || art[0];
        const active = s.cur === p.id && s.stage === 'turn', fade = s.stage === 'turn' && !active, fx = fade ? { transparent: true, opacity: 0.5 } : {};   // players whose turn it is not are faded to 50%
        const col = new THREE.Color(PREP_COL[p.prepper] || '#888');
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.21 + 0.01, 0.002, 0.149 + 0.01), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: active ? 0.9 : 0.1, ...fx }));
        frame.position.set(x, 0.001, zc); frame.receiveShadow = true; this.mats.add(frame);
        if (url) { const cm = this.flat(0.21, 0.149, url, x, 0.0026, zc, fx); cm.userData.cardImg = url; this.mats.add(cm); }
        if (url) {   // health cube: sits on the card's health track (10 on the left down to 0 on the right) and moves as health changes
          const hp = Math.max(0, Math.min(10, p.health)), fx2 = 0.2805 + (10 - hp) * 0.0651, fz2 = 0.903, cs = 0.0105;
          const cube = new THREE.Mesh(new THREE.BoxGeometry(cs, cs, cs), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
          cube.position.set(x + (fx2 - 0.5) * 0.21, 0.0026 + cs / 2, zc + (fz2 - 0.5) * 0.149); cube.castShadow = true;
          const ed = new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: 0x111111 })); cube.add(ed);
          cube.userData.matId = p.id; cube.userData.cardImg = url; cube.userData.healthCube = { pid: p.id, x, zc, y: cube.position.y }; this.mats.add(cube);
        }
        const nm = this.label(p.name + (p.bunker ? '  (bunker)' : ''), '#' + col.getHexString()); nm.position.set(x, 0.012, zc - 0.0745 - 0.014); this.mats.add(nm);
        // busted tokens (1-2) / tagged token sit beside the name above the card; 3 busts = tagged
        { const tk = p.tagged ? [['tagged', 'tagged']] : Array.from({ length: p.busted || 0 }, () => ['busted']), bg = new THREE.CylinderGeometry(0.0085, 0.0085, 0.0028, 24);
          tk.forEach((t, k) => { const f = t[1] || t[0], tm = new THREE.MeshStandardMaterial({ map: this.tex('assets/counters/' + f + '.webp'), transparent: true, roughness: 0.5 }), sm = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
            const m = new THREE.Mesh(bg, [sm, tm, sm]); m.rotation.y = Math.PI / 2; m.position.set(x + 0.092 - k * 0.019, 0.0015, zc - 0.0745 - 0.014); m.castShadow = true; this.mats.add(m); }); }
        // resource piles
        const piles = []; for (const r of Object.keys(RCOL)) if (p.res[r]) piles.push({ r, c: p.res[r] }); if (p.coin) piles.push({ r: 'coin', c: p.coin });
        const geo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.0028, 20), pz = zc + 0.0745 + 0.02;
        piles.forEach((pl, k) => { for (let j = 0; j < pl.c; j++) { const m = new THREE.Mesh(geo, this.tokenMat(pl.r)); m.position.set(x + (k - (piles.length - 1) / 2) * SP, 0.0015 + j * 0.003, pz); m.castShadow = true; m.userData.tok = { mat: p.id, r: pl.r }; this.mats.add(m); }
          const nsp = this.numSprite(pl.c); nsp.position.set(x + (k - (piles.length - 1) / 2) * SP + 0.0125, 0.012, pz); this.mats.add(nsp); });
        // item cards, fanned out under the tokens
        const cw = 0.063, cd = 0.088, iz = pz + 0.016 + cd / 2, k = p.items.length, step = k > 1 ? Math.min(cw + 0.004, (0.21 - cw) / (k - 1)) : 0;
        p.items.forEach((it, j) => {
          const m = this.flat(cw, cd, it.id === 'hidden' ? 'assets/items/back.jpg' : `assets/items/${it.id}.jpg`, x + (j - (k - 1) / 2) * step, 0.0012 + j * 0.0004, iz, it.broken ? { color: 0x777777 } : {});
          if (it.id !== 'hidden') m.userData.cardImg = `assets/items/${it.id}.jpg`;
          this.mats.add(m);
        });
        for (let c = c0; c < this.mats.children.length; c++) { const o = this.mats.children[c]; if (o.userData.matId === undefined) o.userData.matId = p.id; }
      });
    }
  }
  // glide the camera to look down at a player's mat with the board still in shot
  // glide in on a player's figure (close, looking down at it); falls back to the mat if the figure isn't placed yet
  followPawn(pid, close) {
    this.manual = false;
    const m = this.pawnMeshes[pid], t = m && m.userData.target;
    if (!t) return false;
    const cam = close ? new THREE.Vector3(t.x, 0.195, t.z + 0.195) : new THREE.Vector3(t.x, 0.34, t.z + 0.2);   // Z: 30% closer and tilted in further
    this.flyTo(cam, new THREE.Vector3(t.x, 0, t.z), 900); return true;
  }
  follow(i, n) {   // look down at a player's character card (mat)
    this.manual = false;
    const x = this.matX(i, n), zc = this.H / 2 + 0.03 + 0.0745;
    const o = 0.03;   // zoomed out a little and nudged so the card sits above the event panels along the bottom
    this.flyTo(new THREE.Vector3(x, 0.36, zc + 0.2 + o), new THREE.Vector3(x, 0, zc + o), 900);
  }
  // N key: look down at the three event stands (AI, Pandemic, Nuclear) together
  setHideRes(on) { this.hideRes = !!on; this.tokens.visible = !on; }   // hide every resource pile on the board so the building names can be read
  followNews() {
    this.manual = false;
    const a = this.newsPos.ai, c = this.newsPos.nuclear, xc = (a[0] + c[0]) / 2, z = a[1], w = Math.abs(c[0] - a[0]) + 0.135 + 0.2;
    const hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * this.cam.aspect), d = Math.max(0.3, (w / 2) / Math.tan(hf / 2)), el = 1.1;
    this.flyTo(new THREE.Vector3(xc, Math.sin(el) * d, z + Math.cos(el) * d), new THREE.Vector3(xc, 0, z), 900);
  }
  // D key: look down at the DEFCON chart so the whole chart fills the view
  followDefcon() {
    this.manual = false;
    const c = this.chart, vf = THREE.MathUtils.degToRad(this.cam.fov / 2), hf = Math.atan(Math.tan(vf) * this.cam.aspect), el = 1.2;
    const d = Math.max(0.25, Math.max((c.d / 2 + 0.06) / Math.tan(vf), (c.w / 2 + 0.06) / Math.tan(hf)) * 1.1);
    this.flyTo(new THREE.Vector3(c.x, Math.sin(el) * d, c.z + Math.cos(el) * d), new THREE.Vector3(c.x, 0, c.z), 900);
  }
  followDice() {   // frame the dice landing area (and the throw from the mat) so the roll is always on screen
    this.manual = false;
    const vf = THREE.MathUtils.degToRad(this.cam.fov / 2), el = 1.05, d = Math.max(0.3, 0.2 / Math.tan(vf) * (this.cam.aspect < 1.2 ? 1.5 : 1));
    const t = new THREE.Vector3(0, 0, 0.08);
    this.flyTo(new THREE.Vector3(t.x, Math.sin(el) * d, t.z + Math.cos(el) * d), t, 600);
  }
  flyTo(pos, target, ms = 1200) { this.fly = { p0: this.cam.position.clone(), t0: this.ctl.target.clone(), p1: pos, t1: target, start: performance.now(), ms }; }
  // ---- physical dice: thrown from the player's mat, tumble and bounce across the table, land showing the rolled face
  // spec: [{set:'day'|'night'|'news'|'num', face:0..5}]
  rollDice(specs, seat, n) {
    const base = { day: 1, night: 7, news: 13, num: 25 };
    if (!this.dice) { this.dice = new THREE.Group(); this.scene.add(this.dice); }
    // dice from the same turn stay on the table side by side: news clears the table, day/night replace only the previous day/night die, anything else clears all
    const kind = specs[0].set;
    if (kind === 'news' || kind === 'num' || !this.rolling) { this.dice.clear(); this.rolling = []; }
    else { for (const d of this.rolling.filter(d => d.set === 'day' || d.set === 'night')) this.dice.remove(d.mesh); this.rolling = this.rolling.filter(d => d.set !== 'day' && d.set !== 'night'); }
    const SZ = 0.028, zc = this.H / 2 + 0.03 + 0.0745, x0 = this.matX(Math.min(seat, n - 1), n);
    const nrm = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    specs.forEach((sp, k) => {
      const mats = [0, 1, 2, 3, 4, 5].map(i => { const m = new THREE.MeshStandardMaterial({ roughness: 0.45 }); if (sp.set === 'news') m.color.set([0xff7a70, 0x6fb0ff, 0xffd54f][i] || 0xffffff);   // tint each news face with its event colour (pandemic red, AI blue, nuclear amber)
      const u = `assets/dice/f${String(base[sp.set] + i).padStart(2, '0')}.webp`; m.map = this.texs['d' + u] || (this.texs['d' + u] = this.tl.load(u)); m.map.colorSpace = THREE.SRGBColorSpace; return m; });
      const geo = new THREE.BoxGeometry(SZ, SZ, SZ), mesh = new THREE.Mesh(geo, mats); mesh.castShadow = true; mesh.receiveShadow = true; this.dice.add(mesh);
      // final orientation: slot `face` normal -> +Y, then a random spin about Y
      const fq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...nrm[sp.face]), new THREE.Vector3(0, 1, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28));
      const p0 = new THREE.Vector3(x0 + (k - (specs.length - 1) / 2) * 0.03, 0.05, zc - 0.05), p1 = new THREE.Vector3((kind === 'news' ? -0.04 : kind === 'num' ? 0.04 + k * 0.045 : 0.01) + (Math.random() - 0.5) * 0.01, SZ / 2, 0.04 + (Math.random() - 0.5) * 0.02);
      const axis = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
      this.rolling.push({ set: sp.set, mesh, fq, p0, p1, axis, spin: (7 + Math.random() * 4) * (Math.random() < .5 ? 1 : -1), t0: performance.now() + k * 90, ms: 1500 });
      mesh.position.copy(p0); mesh.visible = false;
    });
  }
  stepDice() {
    if (!this.rolling) return; const now = performance.now(), q = new THREE.Quaternion(), tmp = new THREE.Quaternion();
    for (const d of this.rolling) {
      const k = Math.max(0, Math.min(1, (now - d.t0) / d.ms)); d.mesh.visible = now >= d.t0; if (d.done) continue;
      const e = 1 - Math.pow(1 - k, 2.2), h = Math.abs(Math.sin(k * Math.PI * 2.6)) * 0.07 * Math.pow(1 - k, 1.5);
      d.mesh.position.lerpVectors(d.p0, d.p1, e); d.mesh.position.y = d.p1.y + h * (k < 1 ? 1 : 0);
      // spin decays to zero, finishing exactly on the target orientation
      tmp.setFromAxisAngle(d.axis, d.spin * Math.pow(1 - k, 2) * Math.PI); q.copy(d.fq).premultiply(tmp); d.mesh.quaternion.copy(q);
      if (k >= 1) { d.done = true; d.mesh.position.copy(d.p1); d.mesh.quaternion.copy(d.fq); }
    }
  }
  frame(t) {
    this.stepDice();
    for (const id in this.pawnMeshes) { const m = this.pawnMeshes[id]; if (m.userData.target && !m.userData.free) { m.position.lerp(m.userData.target, 0.18); } }
    for (const id in this.pawnMeshes) { const m = this.pawnMeshes[id], g = m.userData.glow; if (!g) continue; g.visible = !!m.userData.active; if (g.visible) { const k = 0.5 + 0.5 * Math.sin(t / 260); g.children[0].material.opacity = 0.45 + 0.5 * k; g.children[1].material.opacity = 0.15 + 0.3 * k; const em = 0.05 + 0.35 * k; m.traverse(o => { if (o.isMesh && o.material && o.material.emissive && !g.children.includes(o)) { o.material.emissive.set(g.children[0].material.color); o.material.emissiveIntensity = em; } }); } else if (m.userData.wasGlow) m.traverse(o => { if (o.isMesh && o.material && o.material.emissive && !g.children.includes(o)) o.material.emissiveIntensity = 0; }); m.userData.wasGlow = g.visible; }
    if (this.glowMats) { const o = 0.5 + 0.28 * Math.sin(t / 260); for (const m of this.glowMats) m.opacity = o; }
    this.marks.children.forEach((m, i) => { m.scale.setScalar(1 + 0.12 * Math.sin(t / 220 + i)); });
    if (this.fly) {
      const f = this.fly, k = Math.min(1, (performance.now() - f.start) / f.ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.cam.position.lerpVectors(f.p0, f.p1, e); this.ctl.target.lerpVectors(f.t0, f.t1, e); if (k >= 1) this.fly = null;
    }
    this.ctl.update(); this.updateHint(); this.r.render(this.scene, this.cam);
  }
  updateHint() {
    if (!this.hint) { const h = this.hint = document.createElement('div'); h.id = 'chint'; h.textContent = 'B  Board / Centre\nC  Card\nP  Piece\nR  Recipes\nF  Full screen\nN  News\nD  DEFCON\nSpace  Pause'; (this.r.domElement.parentElement.parentElement || document.body).appendChild(h); }
    const d = this.cam.position.distanceTo(this.ctl.target), far = !this.fitD || d < this.fitD * 0.8 || (this.fitT && this.ctl.target.distanceTo(this.fitT) > 0.08);
    if (!this._hintOn) { this._hintOn = true; this.hint.style.display = 'block'; }   // always shown, top right
    this.hint.style.opacity = far ? '1' : '0.7';
  }
  // C key: centre the whole scene (chart, news row, board, pool, player mats) so it fills 90% of the window
  fitBoard() {   // B: the board as large as the window allows, with a slight tilt
    this.manual = false;
    const el = 1.15, dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)), cam = this.cam.clone(), tg = new THREE.Vector3(0.0, 0, -0.005);
    const pts = []; for (const x of [-0.4, 0.4]) for (const z of [-0.2667, 0.2667]) pts.push(new THREE.Vector3(x, 0.01, z));
    let lo = 0.1, hi = 2;
    for (let i = 0; i < 24; i++) {
      const d = (lo + hi) / 2; cam.position.copy(tg).addScaledVector(dir, d); cam.lookAt(tg); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
      const fit = pts.every(v => { const q = v.clone().project(cam); return Math.abs(q.x) <= 0.98 && Math.abs(q.y) <= 0.98; });
      if (fit) hi = d; else lo = d;
    }
    this.flyTo(tg.clone().addScaledVector(dir, hi), tg, 900);
  }
  fitAll(hold) {
    this.manual = !!hold;   // C key passes hold: the auto-follow then leaves the zoomed-out view alone until Z / X / N / D
    const el = 0.9, az = 0, hx = -Math.sin(az), hz = Math.cos(az), dir = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)), cam = this.cam.clone(), tg = new THREE.Vector3(0.01, 0, -0.015);
    const pts = [], rect = (x0, x1, z0, z1, y = 0.03) => { for (const x of [x0, x1]) for (const z of [z0, z1]) pts.push(new THREE.Vector3(x, y, z)); };
    rect(-0.4, 0.4, -0.2667, 0.2667, 0.01);   // board
    rect(-0.585, -0.425, -0.065, 0.262, 0.01);  // DEFCON chart
    rect(-0.56, -0.45, -0.27, -0.12, 0.07);     // item deck
    rect(-0.4, 0.235, -0.49, -0.295, 0.03);     // news row
    rect(0.41, 0.61, 0.18, 0.28, 0.01);          // logo
    rect(0.415, 0.6, -0.245, 0.09, 0.02);       // pool
    { const n = this.nPlayers || 2, hx = ((n - 1) / 2) * 0.225 + 0.11; rect(-hx, hx, 0.285, this.matItems ? 0.575 : 0.5, 0.01); }   // player mats, their tokens and (if any) item cards
    const box = d => {   // projected bounding box of the whole scene for distance d (NDC)
      cam.position.copy(tg).addScaledVector(dir, d); cam.lookAt(tg); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const q of pts) { const v = q.clone().project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      return { x0, x1, y0, y1 };
    };
    // keep clear of the event panels along the bottom of the window (they sit over the canvas)
    const bar = document.querySelector('#evbar'), ch = this.r.domElement.getBoundingClientRect().height || 1;
    const ofs = 2 * (Math.max(bar ? bar.offsetHeight : 0, 120) + 16) / ch;   // always keep ~136px clear, so panels that arrive later never cover the cards
    let d = 1.5;
    for (let it = 0; it < 10; it++) {
      let lo = 0.3, hi = 4; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2, q = box(m); if (Math.max((q.x1 - q.x0) / 2, (q.y1 - q.y0) / 2 + ofs / 2) <= 0.9) hi = m; else lo = m; } d = hi;   // the larger side fills 90% of the window
      const q = box(d), cx = (q.x0 + q.x1) / 2, cy = (q.y0 + q.y1) / 2 - ofs / 2;   // then centre it evenly (a little higher when the event panels are showing)
      const half = d * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
      tg.x += Math.cos(az) * cx * half * this.cam.aspect; tg.z += Math.sin(az) * cx * half * this.cam.aspect;   // slide sideways along the screen
      tg.x -= hx * cy * half / Math.sin(el); tg.z -= hz * cy * half / Math.sin(el);                                 // and up/down the table
    }
    this.fitD = d; this.fitT = tg.clone();
    this.flyTo(tg.clone().addScaledVector(dir, d), tg, 800);
  }
  reset() { this.flyTo(new THREE.Vector3(0, 1.15, 1.0), new THREE.Vector3(0, 0, 0.15), 800); }
  // left-mouse tool: select (default: original mouse controls), pan, zoom (drag), rotate. Select keeps the original mouse: left-drag rotates, right-drag pans, wheel zooms; pieces and tokens are still picked up first.
  setTool(tool) {
    const M = THREE.MOUSE; this.tool = tool;
    this.ctl.mouseButtons = { LEFT: { select: M.ROTATE, pan: M.PAN, zoom: M.DOLLY, rotate: M.ROTATE }[tool], MIDDLE: M.DOLLY, RIGHT: M.PAN };
  }
  pivotCentre() { const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(0, 0), this.cam); const pt = new THREE.Vector3(); if (rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt) && pt.distanceTo(this.cam.position) < 3) this.ctl.target.copy(pt); }
  topDown() { this.cam.position.set(0, 0.95, 0.001); this.ctl.target.set(0, 0, 0); this.ctl.update(); }
}
