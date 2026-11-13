// Peer-to-peer multiplayer (PeerJS, host-authoritative). Host runs the engine; guests send commands and receive their own redacted view.
let loading;
function loadPeer() {
  if (window.Peer) return Promise.resolve();
  return loading || (loading = new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'vendor/peerjs.min.js'; s.onload = ok; s.onerror = () => bad(new Error('Could not load PeerJS')); document.head.appendChild(s); }));
}
const code = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const pid = c => 'apoc-gunpowder-' + c.toLowerCase();

export class HostNet {
  constructor() { this.conns = new Map(); this.onJoin = null; this.onLeave = null; this.onCmd = null; this.onChat = null; }
  async open() {
    await loadPeer();
    for (let i = 0; i < 5; i++) {
      try {
        this.code = code();
        await new Promise((ok, bad) => { this.peer = new window.Peer(pid(this.code)); this.peer.on('open', ok); this.peer.on('error', bad); });
        break;
      } catch (e) { if (i === 4) throw e; }
    }
    this.peer.on('connection', c => {
      c.on('data', m => {
        if (m.hello) { this.conns.set(c.peer, c); if (this.onJoin) this.onJoin(c.peer, m.hello.name || 'Guest'); }
        else if (m.cmd && this.onCmd) this.onCmd(c.peer, m.cmd);
        else if (m.chat && this.onChat) this.onChat(c.peer, m.chat);
      });
      c.on('close', () => { this.conns.delete(c.peer); if (this.onLeave) this.onLeave(c.peer); });
    });
    return this.code;
  }
  send(peerId, msg) { const c = this.conns.get(peerId); if (c && c.open) c.send(msg); }
  close() { try { this.peer.destroy(); } catch (e) {} }
}

export class GuestNet {
  async join(roomCode, name, onMsg, onClose) {
    await loadPeer();
    this.peer = new window.Peer();
    await new Promise((ok, bad) => { this.peer.on('open', ok); this.peer.on('error', bad); });
    this.conn = this.peer.connect(pid(roomCode.trim()), { reliable: true });
    await new Promise((ok, bad) => { this.conn.on('open', ok); this.peer.on('error', bad); setTimeout(() => bad(new Error('No host found for that code')), 12000); });
    this.conn.on('data', onMsg); this.conn.on('close', onClose);
    this.conn.send({ hello: { name } });
  }
  send(msg) { if (this.conn && this.conn.open) this.conn.send(msg); }
}
