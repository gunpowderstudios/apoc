// Moveable 3D table view (Three.js). The board is modelled at true scale (metres).
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { PREP_COL } from './view2d.js';

// Player pieces: real figure height in metres (from the GLB file names: 40h/40h/38h/38h = mm)
const PIECE_H = { frost: 0.040, jessica: 0.040, naomi: 0.038, sam: 0.038 };

const BOARD_W = 0.8;   // metres (800 mm). Height follows the artwork's aspect ratio.
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
    this.cam = new THREE.PerspectiveCamera(40, 1, 0.01, 6);
    this.cam.position.set(0, 1.15, 1.0); this.cam.lookAt(0, 0, 0.15);
    this.ctl = new OrbitControls(this.cam, r.domElement);
    this.ctl.target.set(0, 0, 0.15); this.ctl.enableDamping = true; this.ctl.maxPolarAngle = Math.PI * 0.47; this.ctl.minDistance = 0.12; this.ctl.maxDistance = 2.6;
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
    el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', e => {
      if (!down) return; const moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 5; down = null;
      if (moved || e.button !== 0) return;
      const id = this.pickAt(e); if (this.onClick) this.onClick(id);
    });
    el.addEventListener('pointermove', e => { if (e.buttons) return; const id = this.pickAt(e); if (id !== this.hover) { this.hover = id; el.style.cursor = id && this.targets && this.targets[id] ? 'pointer' : 'grab'; } });
  }
  pickAt(e) {
    const rc = this.r.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.cam);
    const hit = this.ray.intersectObject(this.top)[0]; if (!hit) return null;
    const bx = hit.point.x / this.k + this.board.width / 2, by = hit.point.z / this.k + this.board.height / 2;
    return this.pickBoard ? this.pickBoard(bx, by) : null;
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
    // resource tokens
    const sig = JSON.stringify([Object.entries(s.loc).map(([k, v]) => [k, v.res, v.coin])]);
    if (sig !== this.sig) {
      this.sig = sig; this.tokens.clear();
      const geo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.0028, 20), coinMat = new THREE.MeshStandardMaterial({ color: 0xe8b100, metalness: 0.7, roughness: 0.3 });
      for (const n of this.board.nodes) {
        const L = s.loc[n.id]; if (!L) continue;
        const list = []; for (const r of Object.keys(RCOL)) for (let i = 0; i < (L.res[r] || 0); i++) list.push(r);
        const [cx, cz] = this.w(n);
        // one pile per resource type (stacked upwards); piles sit side by side so they never overlap
        const SP = 0.0175, PER = 6, piles = [];
        for (const r of Object.keys(RCOL)) if (L.res[r]) piles.push({ r, c: L.res[r] });
        if (L.coin) piles.push({ coin: true, c: L.coin });
        const z0 = cz + (n.kind === 'building' ? 0.032 : 0.016);
        piles.forEach((pl, i) => {
          const row = Math.floor(i / PER), colN = Math.min(PER, piles.length - row * PER), col = i % PER;
          for (let k = 0; k < pl.c; k++) {
            const m = new THREE.Mesh(geo, pl.coin ? coinMat : this.tokenMat(pl.r));
            m.position.set(cx + (col - (colN - 1) / 2) * SP, 0.0015 + k * 0.003, z0 + row * SP); m.castShadow = true; this.tokens.add(m);
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
        this.piece(p.prepper).then(proto => { if (proto) { m.clear(); m.add(proto.clone()); } });
        this.pawns.add(m); this.pawnMeshes[p.id] = m; m.userData.cur = new THREE.Vector3(); m.userData.first = true;
      }
      const list = at[p.node], i = list.indexOf(p), n = this.nodes[p.node], [cx, cz] = this.w(n);
      const a = (i / list.length) * Math.PI * 2, rr = list.length > 1 ? 0.012 : 0;
      m.userData.target = new THREE.Vector3(cx + Math.cos(a) * rr, 0, cz + Math.sin(a) * rr - 0.004);
      if (m.userData.first) { m.position.copy(m.userData.target); m.userData.first = false; }
      m.scale.setScalar(s.cur === p.id && s.stage === 'turn' ? 1.25 : 1);
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
  label(text, color = '#fff') {
    const k = text + color; if (this.labels[k]) return this.labels[k].clone();
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.font = 'bold 54px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#000'; g.strokeText(text, 256, 50); g.fillStyle = color; g.fillText(text, 256, 50);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true })); sp.scale.set(0.16, 0.03, 1); sp.renderOrder = 10;
    this.labels[k] = sp; return sp.clone();
  }
  // Table furniture: DEFCON countdown chart left of the board; news piles right of it.
  buildFurniture() {
    const hb = this.H / 2, W = BOARD_W / 2;
    this.chart = { w: 0.1, d: 0.1 * 866 / 400, x: -(W + 0.03 + 0.05), z: -hb + 0.1 * 866 / 400 / 2 };
    const c = this.flat(this.chart.w, this.chart.d, 'assets/ui/countdown.jpg', this.chart.x, 0.0018, this.chart.z); this.furniture.add(c);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(this.chart.w + 0.004, 0.0012, this.chart.d + 0.004), new THREE.MeshStandardMaterial({ color: 0x111111 })); edge.position.set(this.chart.x, 0.0004, this.chart.z); edge.receiveShadow = true; this.furniture.add(edge);
    this.defMark = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 28), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x555555, roughness: 0.3 })); this.defMark.castShadow = true; this.furniture.add(this.defMark);
    const lb = this.label('DEFCON', '#ffd54f'); lb.position.set(this.chart.x, 0.03, this.chart.z + this.chart.d / 2 + 0.02); this.furniture.add(lb);
    this.newsPos = { deck: [W + 0.03 + 0.037, -hb + 0.0525], ai: [W + 0.03 + 0.037 + 0.087, -hb + 0.0525], pandemic: [W + 0.03 + 0.037, -hb + 0.0525 + 0.135], nuclear: [W + 0.03 + 0.037 + 0.087, -hb + 0.0525 + 0.135] };
  }
  matX(i, n) { return (i - (n - 1) / 2) * 0.225; }
  syncTable(s) {
    const df = s.defcon, ys = [590, 440, 270, 78];   // pixel rows of the four DEFCON lights on the chart image (400x866)
    const fx = this.chart.x - this.chart.w / 2 + this.chart.w * (330 / 400), fz = this.chart.z - this.chart.d / 2 + this.chart.d * (ys[Math.min(3, df)] / 866);
    this.defMark.position.set(fx + 0.0, 0.004, fz + 0.0); this.defMark.scale.set(1.9, 1, 1.9); this.defMark.material.opacity = 1;
    // news piles
    const deckN = Array.isArray(s.newsDeck) ? s.newsDeck.length : s.newsDeck;
    const psig = JSON.stringify([deckN, s.stand]);
    if (psig !== this.psig) {
      this.psig = psig; this.piles.clear();
      const make = (key, n, topUrl, name) => {
        if (n <= 0) return;
        const [x, z] = this.newsPos[key], h = Math.max(0.001, n * 0.0007), side = new THREE.MeshStandardMaterial({ color: 0xe9e4d6 });
        const top = new THREE.MeshStandardMaterial({ map: this.tex(topUrl), roughness: 0.8 });
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.074, h, 0.105), [side, side, top, side, side, side]); m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; this.piles.add(m);
        const lb = this.label(`${name} ${n}`, '#fff'); lb.scale.set(0.072, 0.0135, 1); lb.position.set(x, h + 0.012, z + 0.062); this.piles.add(lb);
      };
      make('deck', deckN, 'assets/news/back.jpg', 'DECK');
      for (const ty of ['ai', 'pandemic', 'nuclear']) { const a = s.stand[ty]; make(ty, a.length, a.length ? `assets/news/${a[a.length - 1]}.jpg` : '', ty.toUpperCase()); }
      for (const ty of ['ai', 'pandemic', 'nuclear']) if (!s.stand[ty].length) { const [x, z] = this.newsPos[ty]; const lb = this.label(ty.toUpperCase(), '#9aa'); lb.scale.set(0.072, 0.0135, 1); lb.position.set(x, 0.01, z); this.piles.add(lb); }
    }
    // player mats: character card (backpack side until bunker), resource piles and item cards
    const msig = JSON.stringify([s.players.map(p => [p.prepper, p.bunker, p.res, p.coin, p.items.map(i => i.id + (i.broken ? 'x' : ''))]), s.cur, s.stage, s.pending && s.pending.pl]);
    if (msig !== this.matSig) {
      this.matSig = msig; this.mats.clear();
      const n = s.players.length, zc = this.H / 2 + 0.03 + 0.0745, SP = 0.0185;
      s.players.forEach((p, i) => {
        const x = this.matX(i, n), art = (this.preppers && this.preppers[p.prepper] ? this.preppers[p.prepper].art : []), url = art[p.bunker ? 1 : 0] || art[0];
        const active = s.cur === p.id && s.stage === 'turn';
        const col = new THREE.Color(PREP_COL[p.prepper] || '#888');
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.21 + 0.01, 0.002, 0.149 + 0.01), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: active ? 0.9 : 0.1 }));
        frame.position.set(x, 0.001, zc); frame.receiveShadow = true; this.mats.add(frame);
        if (url) this.mats.add(this.flat(0.21, 0.149, url, x, 0.0026, zc));
        const nm = this.label(p.name + (p.bunker ? '  (bunker)' : ''), '#' + col.getHexString()); nm.position.set(x, 0.012, zc - 0.0745 - 0.014); this.mats.add(nm);
        // resource piles
        const piles = []; for (const r of Object.keys(RCOL)) if (p.res[r]) piles.push({ r, c: p.res[r] }); if (p.coin) piles.push({ r: 'coin', c: p.coin });
        const geo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.0028, 20), pz = zc + 0.0745 + 0.02;
        piles.forEach((pl, k) => { for (let j = 0; j < pl.c; j++) { const m = new THREE.Mesh(geo, this.tokenMat(pl.r)); m.position.set(x + (k - (piles.length - 1) / 2) * SP, 0.0015 + j * 0.003, pz); m.castShadow = true; this.mats.add(m); } });
        // item cards, fanned out under the tokens
        const cw = 0.063, cd = 0.088, iz = pz + 0.016 + cd / 2, k = p.items.length, step = k > 1 ? Math.min(cw + 0.004, (0.21 - cw) / (k - 1)) : 0;
        p.items.forEach((it, j) => {
          const m = this.flat(cw, cd, it.id === 'hidden' ? 'assets/items/back.jpg' : `assets/items/${it.id}.jpg`, x + (j - (k - 1) / 2) * step, 0.0012 + j * 0.0004, iz, it.broken ? { color: 0x777777 } : {});
          this.mats.add(m);
        });
      });
    }
  }
  // glide the camera to look down at a player's mat with the board still in shot
  follow(i, n) {
    const x = this.matX(i, n), tx = x * 0.8, tz = 0.2;
    this.flyTo(new THREE.Vector3(tx, 1.0, tz + 0.42), new THREE.Vector3(tx, 0, tz), 1400);
  }
  flyTo(pos, target, ms = 1200) { this.fly = { p0: this.cam.position.clone(), t0: this.ctl.target.clone(), p1: pos, t1: target, start: performance.now(), ms }; }
  frame(t) {
    for (const id in this.pawnMeshes) { const m = this.pawnMeshes[id]; if (m.userData.target) { m.position.lerp(m.userData.target, 0.18); } }
    this.marks.children.forEach((m, i) => { m.scale.setScalar(1 + 0.12 * Math.sin(t / 220 + i)); });
    if (this.fly) {
      const f = this.fly, k = Math.min(1, (performance.now() - f.start) / f.ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.cam.position.lerpVectors(f.p0, f.p1, e); this.ctl.target.lerpVectors(f.t0, f.t1, e); if (k >= 1) this.fly = null;
    }
    this.ctl.update(); this.r.render(this.scene, this.cam);
  }
  reset() { this.flyTo(new THREE.Vector3(0, 1.15, 1.0), new THREE.Vector3(0, 0, 0.15), 800); }
  topDown() { this.cam.position.set(0, 0.95, 0.001); this.ctl.target.set(0, 0, 0); this.ctl.update(); }
}
