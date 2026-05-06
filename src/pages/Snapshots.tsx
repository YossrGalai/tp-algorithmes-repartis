import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";

const C = {
  bg: "#faf9f6",
  paper: "#ffffff",
  ink: "#1a1a1a",
  soft: "#f0ede8",
  rule: "#e0dbd3",
  muted: "#8a8078",
  accent: "#e63946",
  gold: "#e9a621",
  teal: "#2a9d8f",
  violet: "#7b5ea7",
  sky: "#457b9d",
};

const NODE_COLORS = [C.accent, C.gold, C.teal, C.violet] as const;
const NODE_NAMES = ["P0", "P1", "P2", "P3"] as const;

type NodeState = "IDLE" | "INITIATOR" | "RECORDING" | "DONE";
type MarkerStatus = "in_transit" | "delivered";
type AppMsgStatus = "in_transit" | "recorded" | "delivered";

interface PNode { id: number; state: NodeState; localState: number | null; clock: number; markersReceived: number[]; channelState: Record<number, number[]>; }
interface MarkerMsg { id: string; from: number; to: number; status: MarkerStatus; }
interface AppMsg { id: string; from: number; to: number; value: number; status: AppMsgStatus; capturedBy?: number; }
interface LogEntry { id: string; processId: number; text: string; type: "init" | "marker_sent" | "local_snap" | "channel_snap" | "done" | "app_msg"; step: number; }
interface SimState { nodes: PNode[]; markers: MarkerMsg[]; appMsgs: AppMsg[]; log: LogEntry[]; step: number; globalSnapshotDone: boolean; }

function mkId() { return Math.random().toString(36).slice(2, 9); }
const N = 4;

function initSim(): SimState {
  return { nodes: Array.from({ length: N }, (_, i) => ({ id: i, state: "IDLE" as NodeState, localState: null, clock: Math.floor(Math.random() * 8) + 1, markersReceived: [], channelState: {} })), markers: [], appMsgs: [], log: [], step: 0, globalSnapshotDone: false };
}

function cloneNodes(nodes: PNode[]): PNode[] {
  return nodes.map(n => ({ ...n, markersReceived: [...n.markersReceived], channelState: Object.fromEntries(Object.entries(n.channelState).map(([k, v]) => [k, [...v]])) }));
}
function others(id: number) { return Array.from({ length: N }, (_, i) => i).filter(i => i !== id); }

function doInitiate(state: SimState, pid: number): SimState {
  if (state.nodes[pid].state !== "IDLE") return state;
  const nodes = cloneNodes(state.nodes); const p = nodes[pid]; p.state = "INITIATOR"; p.localState = p.clock;
  const newMarkers: MarkerMsg[] = others(pid).map(to => ({ id: mkId(), from: pid, to, status: "in_transit" as MarkerStatus }));
  const newLog: LogEntry[] = [
    { id: mkId(), processId: pid, type: "init", text: `P${pid} démarre l'instantané — enregistre état local (clk=${p.clock})`, step: state.step },
    { id: mkId(), processId: pid, type: "marker_sent", text: `P${pid} envoie MARKER sur tous les canaux sortants → ${others(pid).map(x => "P" + x).join(", ")}`, step: state.step },
  ];
  others(pid).forEach(from => { p.channelState[from] = []; });
  return { ...state, nodes, markers: [...state.markers, ...newMarkers], log: [...state.log, ...newLog], step: state.step + 1 };
}

function doDeliverMarker(state: SimState, markerId: string): SimState {
  const marker = state.markers.find(m => m.id === markerId);
  if (!marker || marker.status === "delivered") return state;
  const nodes = cloneNodes(state.nodes); const receiver = nodes[marker.to];
  const newLog: LogEntry[] = []; const newMarkers: MarkerMsg[] = [];
  const isFirstMarker = receiver.state === "IDLE";
  if (isFirstMarker) {
    receiver.state = "RECORDING"; receiver.localState = receiver.clock;
    newLog.push({ id: mkId(), processId: receiver.id, type: "local_snap", text: `P${receiver.id} reçoit 1er MARKER de P${marker.from} → enregistre état local (clk=${receiver.clock})`, step: state.step });
    others(receiver.id).forEach(from => { if (from !== marker.from && !(from in receiver.channelState)) receiver.channelState[from] = []; });
    receiver.markersReceived.push(marker.from);
    newLog.push({ id: mkId(), processId: receiver.id, type: "channel_snap", text: `P${receiver.id} ferme canal P${marker.from}→P${receiver.id} (état canal = vide)`, step: state.step });
    others(receiver.id).forEach(to => newMarkers.push({ id: mkId(), from: receiver.id, to, status: "in_transit" }));
    newLog.push({ id: mkId(), processId: receiver.id, type: "marker_sent", text: `P${receiver.id} relaie MARKER → ${others(receiver.id).map(x => "P" + x).join(", ")}`, step: state.step });
  } else {
    if (!receiver.markersReceived.includes(marker.from)) {
      receiver.markersReceived.push(marker.from);
      const captured = receiver.channelState[marker.from] || [];
      newLog.push({ id: mkId(), processId: receiver.id, type: "channel_snap", text: `P${receiver.id} reçoit MARKER de P${marker.from} → ferme canal (${captured.length} msg capturé${captured.length > 1 ? "s" : ""})`, step: state.step });
    }
  }
  const allClosed = receiver.markersReceived.length === N - 1 && others(receiver.id).every(f => receiver.markersReceived.includes(f));
  if (allClosed && receiver.state !== "DONE") { receiver.state = "DONE"; newLog.push({ id: mkId(), processId: receiver.id, type: "done", text: `✓ P${receiver.id} a un instantané local complet — tous les canaux clôturés`, step: state.step }); }
  const updatedMarkers = state.markers.map(m => m.id === markerId ? { ...m, status: "delivered" as MarkerStatus } : m);
  const globalSnapshotDone = nodes.every(n => n.state === "DONE" || n.state === "INITIATOR") && nodes.filter(n => n.state === "INITIATOR" || n.state === "DONE").length === N;
  return { ...state, nodes, markers: [...updatedMarkers, ...newMarkers], log: [...state.log, ...newLog], step: state.step + 1, globalSnapshotDone };
}

function doSendAppMsg(state: SimState, from: number, to: number): SimState {
  const nodes = cloneNodes(state.nodes); const sender = nodes[from];
  if (sender.state === "IDLE") return state;
  const value = sender.clock + Math.floor(Math.random() * 5) + 1; sender.clock = value;
  return { ...state, nodes, appMsgs: [...state.appMsgs, { id: mkId(), from, to, value, status: "in_transit" }], log: [...state.log, { id: mkId(), processId: from, type: "app_msg", text: `P${from} → P${to} : message applicatif val=${value}`, step: state.step }], step: state.step + 1 };
}

function doDeliverAppMsg(state: SimState, msgId: string): SimState {
  const msg = state.appMsgs.find(m => m.id === msgId);
  if (!msg || msg.status === "delivered") return state;
  const nodes = cloneNodes(state.nodes); const receiver = nodes[msg.to]; const newLog: LogEntry[] = [];
  const shouldCapture = (receiver.state === "RECORDING" || receiver.state === "INITIATOR") && !receiver.markersReceived.includes(msg.from);
  if (shouldCapture) {
    if (!receiver.channelState[msg.from]) receiver.channelState[msg.from] = [];
    receiver.channelState[msg.from].push(msg.value);
    newLog.push({ id: mkId(), processId: receiver.id, type: "channel_snap", text: `P${receiver.id} capture msg de P${msg.from} dans l'état du canal (val=${msg.value})`, step: state.step });
  } else {
    receiver.clock = Math.max(receiver.clock, msg.value) + 1;
    newLog.push({ id: mkId(), processId: receiver.id, type: "app_msg", text: `P${receiver.id} reçoit msg de P${msg.from} normalement (val=${msg.value})`, step: state.step });
  }
  return { ...state, nodes, appMsgs: state.appMsgs.map(m => m.id === msgId ? { ...m, status: (shouldCapture ? "recorded" : "delivered") as AppMsgStatus } : m), log: [...state.log, ...newLog], step: state.step + 1 };
}

// ─── Network SVG ──────────────────────────────────────────────────────────────
function NetworkDiagram({ nodes, markers, appMsgs }: { nodes: PNode[]; markers: MarkerMsg[]; appMsgs: AppMsg[] }) {
  const W = 520, H = 220;
  const cx = W / 2, cy = H / 2, rx = 185, ry = 74;
  const pos = nodes.map((_, i) => ({ x: cx + rx * Math.cos((2 * Math.PI * i) / N - Math.PI / 2), y: cy + ry * Math.sin((2 * Math.PI * i) / N - Math.PI / 2) }));
  const stateStroke: Record<NodeState, string> = { IDLE: C.rule, INITIATOR: C.gold, RECORDING: C.sky, DONE: C.teal };
  const stateFill: Record<NodeState, string> = { IDLE: C.soft, INITIATOR: "#fff8ec", RECORDING: "#eef5fb", DONE: "#edfaf7" };
  const pm = markers.filter(m => m.status === "in_transit");
  const pa = appMsgs.filter(m => m.status === "in_transit" || m.status === "recorded");

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <defs>
        {[["mrk", C.gold], ["app", C.sky], ["rec", C.violet]].map(([id, col]) => (
          <marker key={id} id={`a-${id}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M1,1 L7,4 L1,7 Z" fill={col} />
          </marker>
        ))}
      </defs>
      {nodes.map((_, i) => nodes.map((_, j) => j > i ? (
        <line key={`e${i}${j}`} x1={pos[i].x} y1={pos[i].y} x2={pos[j].x} y2={pos[j].y} stroke={C.rule} strokeWidth={1.5} strokeDasharray="4 5" />
      ) : null))}
      {pm.map(m => {
        const f = pos[m.from], t = pos[m.to], dx = t.x - f.x, dy = t.y - f.y, len = Math.sqrt(dx * dx + dy * dy), nx = dx / len, ny = dy / len, off = 30;
        const mx = (f.x + nx * off + t.x - nx * (off + 6)) / 2, my = (f.y + ny * off + t.y - ny * (off + 6)) / 2;
        return (
          <g key={m.id}>
            <line x1={f.x + nx * off} y1={f.y + ny * off} x2={t.x - nx * (off + 6)} y2={t.y - ny * (off + 6)} stroke={C.gold} strokeWidth={2.5} markerEnd="url(#a-mrk)" strokeDasharray="6 3">
              <animate attributeName="stroke-dashoffset" from="18" to="0" dur="0.5s" repeatCount="indefinite" />
            </line>
            <rect x={mx - 17} y={my - 9} width={34} height={16} rx={4} fill={C.gold} />
            <text x={mx} y={my + 5} textAnchor="middle" fontSize={8} fill="#fff" fontFamily="'DM Mono', monospace" fontWeight="700">MRK</text>
          </g>
        );
      })}
      {pa.map(m => {
        const f = pos[m.from], t = pos[m.to], dx = t.x - f.x, dy = t.y - f.y, len = Math.sqrt(dx * dx + dy * dy), nx = dx / len, ny = dy / len, off = 30;
        const col = m.status === "recorded" ? C.violet : C.sky, mEnd = m.status === "recorded" ? "url(#a-rec)" : "url(#a-app)";
        const mx = (f.x + nx * (off + 4) + t.x - nx * (off + 6)) / 2, my = (f.y + ny * (off + 4) + t.y - ny * (off + 6)) / 2;
        return (
          <g key={m.id}>
            <line x1={f.x + nx * (off + 4)} y1={f.y + ny * (off + 4)} x2={t.x - nx * (off + 6)} y2={t.y - ny * (off + 6)} stroke={col} strokeWidth={1.5} strokeDasharray="4 3" markerEnd={mEnd}>
              <animate attributeName="stroke-dashoffset" from="14" to="0" dur="0.75s" repeatCount="indefinite" />
            </line>
            <text x={mx} y={my - 4} textAnchor="middle" fontSize={8.5} fill={col} fontFamily="'DM Mono', monospace">{m.value}</text>
          </g>
        );
      })}
      {nodes.map((p, i) => {
        const { x, y } = pos[i], col = NODE_COLORS[i], sf = stateFill[p.state], ss = stateStroke[p.state];
        const active = p.state === "DONE" || p.state === "INITIATOR";
        return (
          <g key={p.id}>
            {active && <circle cx={x} cy={y} r={32} fill="none" stroke={col} strokeWidth={1} opacity={0.25}><animate attributeName="r" values="28;38;28" dur="2.2s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.3;0;0.3" dur="2.2s" repeatCount="indefinite" /></circle>}
            <circle cx={x} cy={y} r={28} fill={sf} stroke={ss} strokeWidth={2.5} />
            <circle cx={x} cy={y} r={28} fill={col} opacity={0.07} />
            <text x={x} y={y - 5} textAnchor="middle" fontSize={14} fontWeight="900" fill={col} fontFamily="'Playfair Display', serif">{NODE_NAMES[i]}</text>
            <text x={x} y={y + 9} textAnchor="middle" fontSize={8} fill={C.muted} fontFamily="'DM Mono', monospace">clk:{p.clock}</text>
            {p.localState !== null && <text x={x} y={y + 20} textAnchor="middle" fontSize={7.5} fill={C.teal} fontFamily="'DM Mono', monospace">s:{p.localState}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Node Card ─────────────────────────────────────────────────────────────────
const STATE_LABEL: Record<NodeState, string> = { IDLE: "Inactif", INITIATOR: "Initiateur", RECORDING: "Enregistrement", DONE: "Terminé" };
const STATE_COL: Record<NodeState, string> = { IDLE: C.muted, INITIATOR: C.gold, RECORDING: C.sky, DONE: C.teal };

function NodeCard({ node, onInitiate, onSendTo }: { node: PNode; onInitiate: () => void; onSendTo: (to: number) => void }) {
  const col = NODE_COLORS[node.id], sc = STATE_COL[node.state];
  const isDone = node.state === "DONE", isIdle = node.state === "IDLE";
  const isRecording = node.state === "RECORDING" || node.state === "INITIATOR";
  const progress = isRecording ? (node.markersReceived.length / (N - 1)) * 100 : isDone ? 100 : 0;

  return (
    <div style={{ background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 18, overflow: "hidden", boxShadow: isDone ? `0 8px 30px ${col}18` : "0 2px 10px rgba(0,0,0,0.05)", transition: "all 0.3s", flex: "1 1 200px", minWidth: 190, maxWidth: 250 }}>
      <div style={{ height: 5, background: `linear-gradient(90deg, ${col}, ${col}77)` }} />
      <div style={{ padding: "15px 17px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: `${col}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900, color: col, fontFamily: "'Playfair Display', serif" }}>{NODE_NAMES[node.id]}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: C.ink, fontFamily: "'DM Sans', sans-serif" }}>Processus {node.id}</div>
              <div style={{ fontSize: 9, color: sc, fontWeight: 600, marginTop: 1, fontFamily: "'DM Sans', sans-serif" }}>{STATE_LABEL[node.state]}</div>
            </div>
          </div>
          {isDone && <span style={{ color: C.teal, fontSize: 16 }}>✓</span>}
        </div>

        <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
          {[{ k: "Clk", v: node.clock, c: C.ink }, { k: "Snap", v: node.localState ?? "–", c: node.localState !== null ? C.teal : C.muted }, { k: "Mrk", v: `${node.markersReceived.length}/${N - 1}`, c: C.sky }].map(({ k, v, c }) => (
            <div key={k} style={{ flex: 1, textAlign: "center", background: C.soft, borderRadius: 9, padding: "7px 3px" }}>
              <div style={{ fontSize: 7, color: C.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, marginBottom: 3, textTransform: "uppercase" }}>{k}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: "'Playfair Display', serif" }}>{v}</div>
            </div>
          ))}
        </div>

        {(isRecording || isDone) && (
          <div style={{ background: C.soft, borderRadius: 4, height: 4, overflow: "hidden", marginBottom: 11 }}>
            <div style={{ width: `${progress}%`, height: "100%", background: `linear-gradient(90deg, ${sc}, ${col})`, borderRadius: 4, transition: "width 0.4s" }} />
          </div>
        )}

        {Object.keys(node.channelState).length > 0 && (
          <div style={{ marginBottom: 11 }}>
            {Object.entries(node.channelState).map(([from, msgs]) => (
              <div key={from} style={{ fontSize: 8.5, color: C.violet, background: "#f7f3ff", border: `1px solid ${C.violet}28`, borderRadius: 6, padding: "3px 8px", marginBottom: 3, display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace" }}>
                <span>ch P{from}→P{node.id}</span>
                <span style={{ color: node.markersReceived.includes(Number(from)) ? C.teal : C.gold }}>[{msgs.length > 0 ? msgs.join(", ") : "∅"}]{node.markersReceived.includes(Number(from)) ? " ✓" : " …"}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {isIdle && <button onClick={onInitiate} style={{ background: col, color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: `0 4px 12px ${col}45`, transition: "all 0.2s" }}>▶ Initier l'instantané</button>}
          {isRecording && <div style={{ textAlign: "center", fontSize: 9, color: sc, fontStyle: "italic", padding: "4px 0", fontFamily: "'DM Sans', sans-serif" }}>Enregistrement en cours…</div>}
          {isDone && <div style={{ textAlign: "center", fontSize: 9, color: C.teal, fontWeight: 700, padding: "4px 0", fontFamily: "'DM Sans', sans-serif" }}>Instantané local complet ✓</div>}
          {!isIdle && (
            <div style={{ paddingTop: 7, borderTop: `1px solid ${C.rule}` }}>
              <div style={{ fontSize: 8, color: C.muted, marginBottom: 5, fontFamily: "'DM Mono', monospace" }}>Envoyer vers :</div>
              <div style={{ display: "flex", gap: 4 }}>
                {others(node.id).map(tid => (
                  <button key={tid} onClick={() => onSendTo(tid)} style={{ flex: 1, background: `${NODE_COLORS[tid]}12`, border: `1.5px solid ${NODE_COLORS[tid]}45`, borderRadius: 8, color: NODE_COLORS[tid], padding: "5px 3px", fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}>P{tid}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const LOG_ICON: Record<string, string> = { init: "🎯", marker_sent: "▶", local_snap: "📸", channel_snap: "📦", done: "✓", app_msg: "✉️" };

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Snapshots() {
  const [sim, setSim] = useState<SimState>(initSim);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [sim.log.length]);
  const pm = sim.markers.filter(m => m.status === "in_transit");
  const pa = sim.appMsgs.filter(m => m.status === "in_transit" || m.status === "recorded");
  const handle = useCallback(<T extends unknown[]>(fn: (s: SimState, ...a: T) => SimState, ...args: T) => setSim(s => fn(s, ...args)), []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600;700&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:hover { filter: brightness(1.1) !important; transform: translateY(-2px) !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: ${C.rule}; border-radius: 4px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>

        {/* ── Left Sidebar ── */}
        <aside style={{ width: 230, background: C.paper, borderRight: `1px solid ${C.rule}`, padding: "28px 22px", display: "flex", flexDirection: "column", gap: 28, position: "sticky", top: 0, height: "100vh", overflowY: "auto", flexShrink: 0 }}>
          <div>
            <Link to="/" style={{ fontSize: 10, color: C.muted, textDecoration: "none", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: 5, marginBottom: 26 }}>← retour</Link>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>Algorithme</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.ink, fontFamily: "'Playfair Display', serif", lineHeight: 1.2 }}>Chandy–<br />Lamport</div>
            <div style={{ width: 36, height: 3, background: C.accent, borderRadius: 2, margin: "12px 0 14px" }} />
            <p style={{ fontSize: 10, color: C.muted, lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" }}>Instantané global distribué avec messages MARKER sur 4 processus.</p>
          </div>

          {/* System status */}
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>Statut</div>
            {[["Processus", N], ["Étape actuelle", sim.step], ["En transit", pm.length + pa.length], ["Snapshot", sim.globalSnapshotDone ? "✓ Complet" : "En cours…"]].map(([k, v]) => (
              <div key={k as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: C.soft, borderRadius: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Sans', sans-serif" }}>{k}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: sim.globalSnapshotDone && k === "Snapshot" ? C.teal : C.ink, fontFamily: "'DM Mono', monospace" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>Légende</div>
            {[["Inactif", C.muted], ["Initiateur", C.gold], ["Enregistrement", C.sky], ["Terminé", C.teal], ["MARKER", C.gold], ["MSG applicatif", C.sky], ["MSG capturé", C.violet]].map(([l, col]) => (
              <div key={l as string} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: col as string, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Sans', sans-serif" }}>{l}</span>
              </div>
            ))}
          </div>

          {/* Scenario guide */}
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>Scénario guidé</div>
            {[["1", C.accent, "Cliquez P0 → Initier l'instantané"], ["2", C.gold, "Avant les markers, envoyez un MSG vers P1"], ["3", C.sky, "Délivrez les MARKERs un à un"], ["4", C.violet, "Délivrez un MSG après MARKER → capturé"], ["5", C.teal, "Terminez → snapshot global cohérent"]].map(([n, col, t]) => (
              <div key={n as string} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: col as string, color: "#fff", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>{n}</div>
                <span style={{ fontSize: 9, color: C.muted, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{t as string}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main area ── */}
        <main style={{ flex: 1, padding: "32px 28px 64px", overflowY: "auto" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 9, color: C.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 5 }}>SYS.DISTRIBUÉ / SNAPSHOT / INTERACTIVE</div>
              <h1 style={{ fontSize: 38, fontWeight: 900, color: C.ink, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>Simulation</h1>
              <div style={{ marginTop: 10, display: "flex", gap: 7 }}>
                {["4 Nœuds", "Marker Protocol", "Chandy–Lamport '85"].map(tag => (
                  <span key={tag} style={{ fontSize: 9, color: C.muted, background: C.soft, borderRadius: 20, padding: "3px 10px", fontFamily: "'DM Mono', monospace" }}>{tag}</span>
                ))}
              </div>
            </div>
            <button onClick={() => setSim(initSim())} style={{ background: C.paper, border: `1.5px solid ${C.rule}`, borderRadius: 11, color: C.muted, padding: "10px 20px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, transition: "all 0.2s" }}>⟳ Réinitialiser</button>
          </div>

          {/* Done banner */}
          {sim.globalSnapshotDone && (
            <div style={{ background: `${C.teal}10`, border: `1.5px solid ${C.teal}45`, borderRadius: 14, padding: "14px 22px", marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 26 }}>🎉</span>
              <div>
                <div style={{ fontWeight: 700, color: C.teal, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Instantané global cohérent terminé</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>Tous les processus ont clôturé leurs canaux — l'union forme un état global consistant.</div>
              </div>
            </div>
          )}

          {/* ── TOP ROW: Network left, Queue right ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, marginBottom: 18 }}>
            {/* Network */}
            <div style={{ background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 18, padding: "20px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, fontFamily: "'DM Sans', sans-serif" }}>Topologie réseau</div>
                <div style={{ fontSize: 9, color: C.muted, fontFamily: "'DM Mono', monospace", display: "flex", gap: 12 }}>
                  <span>markers <b style={{ color: C.gold }}>{pm.length}</b></span>
                  <span>msgs <b style={{ color: C.sky }}>{pa.length}</b></span>
                </div>
              </div>
              <NetworkDiagram nodes={sim.nodes} markers={sim.markers} appMsgs={sim.appMsgs} />
            </div>

            {/* Queue */}
            <div style={{ background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 18, padding: "20px 22px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, fontFamily: "'DM Sans', sans-serif" }}>File d'attente</div>
                {pm.length + pa.length > 0 && <span style={{ background: C.accent, color: "#fff", borderRadius: 20, padding: "2px 9px", fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{pm.length + pa.length}</span>}
              </div>
              {pm.length + pa.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>Aucun message en transit</div>
              ) : (
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {pm.map(m => (
                    <div key={m.id} onClick={() => handle(doDeliverMarker, m.id)} style={{ display: "flex", alignItems: "center", gap: 11, background: `${C.gold}0c`, border: `1px solid ${C.gold}35`, borderRadius: 12, padding: "11px 14px", cursor: "pointer", marginBottom: 7, transition: "all 0.15s" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${C.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>▶</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, fontFamily: "'DM Sans', sans-serif" }}>MARKER</div>
                        <div style={{ fontSize: 9, color: C.muted, fontFamily: "'DM Mono', monospace", marginTop: 1 }}>P{m.from} → P{m.to}</div>
                      </div>
                      <div style={{ background: C.gold, color: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 8, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>DÉLIVRER</div>
                    </div>
                  ))}
                  {pa.map(m => {
                    const col = m.status === "recorded" ? C.violet : C.sky;
                    return (
                      <div key={m.id} onClick={() => handle(doDeliverAppMsg, m.id)} style={{ display: "flex", alignItems: "center", gap: 11, background: `${col}0c`, border: `1px solid ${col}35`, borderRadius: 12, padding: "11px 14px", cursor: "pointer", marginBottom: 7, transition: "all 0.15s" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${col}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✉️</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: col, fontFamily: "'DM Sans', sans-serif" }}>{m.status === "recorded" ? "MSG (capturé)" : "MSG"}</div>
                          <div style={{ fontSize: 9, color: C.muted, fontFamily: "'DM Mono', monospace", marginTop: 1 }}>P{m.from} → P{m.to} · val={m.value}</div>
                        </div>
                        <div style={{ background: col, color: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 8, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>DÉLIVRER</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Process Cards ── */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
            {sim.nodes.map(node => (
              <NodeCard key={node.id} node={node} onInitiate={() => handle(doInitiate, node.id)} onSendTo={to => handle(doSendAppMsg, node.id, to)} />
            ))}
          </div>

          {/* ── Event Log + Algorithm Steps side by side ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Log */}
            <div style={{ background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 18, padding: "20px 22px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }}>Journal des événements</div>
              {sim.log.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: C.muted, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>Initiez l'algorithme pour commencer…</div>
              ) : (
                <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                  {sim.log.map((entry, idx) => (
                    <div key={entry.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "7px 10px", borderRadius: 8, fontSize: 10, background: idx === sim.log.length - 1 ? `${NODE_COLORS[entry.processId]}0c` : "transparent", borderLeft: `3px solid ${NODE_COLORS[entry.processId]}` }}>
                      <span style={{ fontSize: 8, color: C.muted, minWidth: 20, fontFamily: "'DM Mono', monospace", paddingTop: 1 }}>{String(idx + 1).padStart(2, "0")}</span>
                      <span style={{ fontSize: 12 }}>{LOG_ICON[entry.type]}</span>
                      <span style={{ color: NODE_COLORS[entry.processId], fontWeight: 700, minWidth: 20, fontFamily: "'DM Mono', monospace" }}>P{entry.processId}</span>
                      <span style={{ color: C.ink, flex: 1, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{entry.text}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>

            {/* Algorithm steps stacked */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { n: "01", t: "Initiation", c: C.gold, d: "L'initiateur enregistre son état local et envoie un MARKER sur tous ses canaux sortants." },
                { n: "02", t: "Frontière", c: C.sky, d: "Au 1er MARKER reçu, un processus enregistre son état local et relaie les markers." },
                { n: "03", t: "État des canaux", c: C.violet, d: "Les messages arrivant avant le MARKER du canal sont capturés dans l'état du canal." },
                { n: "04", t: "Cohérence globale", c: C.teal, d: "Quand tous les canaux ont reçu un MARKER, l'instantané local est complet." },
              ].map(({ n, t, c, d }) => (
                <div key={n} style={{ background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 14, padding: "14px 18px", borderLeft: `4px solid ${c}`, display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: `${c}30`, fontFamily: "'Playfair Display', serif", lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{n}</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>{t}</div>
                    <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
