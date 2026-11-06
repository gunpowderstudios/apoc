// Moveable 3D table view (Three.js). The board is modelled at true scale (metres).
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { PCOL } from './view2d.js';

const BOARD_W = 0.8;   // metres (800 mm). Height follows the artwork's aspect ratio.
const RCOL = { food: 0x2eae4e, knowhow: 0x4f6d7a, chem: 0xf2d300, hardware: 0xf4f4f4, tech: 0xb3202a, meds: 0x1e9be0, ducttape: 0x9aa0a6 };

export class View3D {
  constructor(container, board, img, icons) {
    this.el = container; this.board = board; this.icons = icons;
    this.k = BOARD_W / board.width; this.H = board.height * this.k;
    this.nodes = Object.fromEntries(board.nodes.map(n => [n.id, n]));
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement); this.r = r;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x15171a);
    this.cam = new THREE.PerspectiveCamera(40, 1, 0.01, 6);
    this.cam.position.set(0, 0.62, 0.62); this.cam.lookAt(0, 0, 0);
    this.ctl = new OrbitControls(this.cam, r.domElement);
    this.ctl.target.set(0, 0, 0); this.ctl.enableDamping = true; this.ctl.maxPolarAngle = Math.PI * 0.47; this.ctl.minDistance = 0.12; this.ctl.maxDistance = 1.8;
    this.ctl.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.ctl.update();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.5));
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.2); sun.position.set(-0.4, 0.9, 0.5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -0.6; sc.right = 0.6; sc.top = 0.5; sc.bottom = -0.5; sc.near = 0.1; sc.far = 3; this.scene.add(sun);
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
    this.bind(); this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    this.active = false;
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
    const im = this.icons[r]; let top;
    if (im) { const t = new THREE.CanvasTexture(im); t.colorSpace = THREE.SRGBColorSpace; top = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }); }
    else top = new THREE.MeshStandardMaterial({ color: RCOL[r] });
    const side = new THREE.MeshStandardMaterial({ color: RCOL[r], roughness: 0.6 });
    return this.texCache[r] = [side, top, side];
  }
  sync(s, ui) {
    // resource tokens
    const sig = JSON.stringify([Object.entries(s.loc).map(([k, v]) => [k, v.res, v.coin])]);
    if (sig !== this.sig) {
      this.sig = sig; this.tokens.clear();
      const geo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.0028, 20);
      for (const n of this.board.nodes) {
        const L = s.loc[n.id]; if (!L) continue;
        const list = []; for (const r of Object.keys(RCOL)) for (let i = 0; i < (L.res[r] || 0); i++) list.push(r);
        const [cx, cz] = this.w(n);
        const byType = {}; list.forEach(r => (byType[r] = (byType[r] || 0) + 1));
        let col = 0;
        for (const [r, c] of Object.entries(byType)) {
          for (let i = 0; i < c; i++) { const m = new THREE.Mesh(geo, this.tokenMat(r)); m.position.set(cx - 0.02 + col * 0.0165, 0.0014 + i * 0.003, cz + (n.kind === 'building' ? 0.03 : 0.012)); m.castShadow = true; this.tokens.add(m); }
          col++;
        }
        if (L.coin) { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe8b100, metalness: 0.7, roughness: 0.3 })); m.position.set(cx + 0.03, 0.0014, cz - 0.03); this.tokens.add(m); }
      }
    }
    // pawns
    const at = {}; s.players.forEach(p => (at[p.node] = at[p.node] || []).push(p));
    for (const p of s.players) {
      let m = this.pawnMeshes[p.id];
      if (!m) {
        m = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PCOL[p.id % 4]), roughness: 0.4 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.004, 24), mat); base.position.y = 0.002;
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.03, 24), mat); body.position.y = 0.019;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 20, 16), mat); head.position.y = 0.04;
        [base, body, head].forEach(x => { x.castShadow = true; m.add(x); });
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
  frame(t) {
    for (const id in this.pawnMeshes) { const m = this.pawnMeshes[id]; if (m.userData.target) { m.position.lerp(m.userData.target, 0.18); } }
    this.marks.children.forEach((m, i) => { m.scale.setScalar(1 + 0.12 * Math.sin(t / 220 + i)); });
    this.ctl.update(); this.r.render(this.scene, this.cam);
  }
  reset() { this.cam.position.set(0, 0.62, 0.62); this.ctl.target.set(0, 0, 0); this.ctl.update(); }
  topDown() { this.cam.position.set(0, 0.95, 0.001); this.ctl.target.set(0, 0, 0); this.ctl.update(); }
}
