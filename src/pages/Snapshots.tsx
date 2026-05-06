import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import type { CSSProperties } from "react";

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#ffffff",
  surface: "#f8fafc",
  card: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  accent: "#818cf8",
  green: "#34d399",
  amber: "#f59e0b",
  red: "#f87171",
  purple: "#f472b6",
  cyan: "#fb923c",
};

const NODE_COLORS = ["#818cf8", "#f472b6", "#fb923c", "#34d399"] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type NodeState = "IDLE" | "INITIATOR" | "RECORDING" | "DONE";
type MarkerStatus = "in_transit" | "delivered";
type AppMsgStatus = "in_transit" | "recorded" | "delivered";

interface PNode {
  id: number;
  state: NodeState;
  localState: number | null; // recorded local state (clock value)
  clock: number;
  markersReceived: number[]; // which channels (from) have received marker
  channelState: Record<number, number[]>; // from → messages captured
}

interface MarkerMsg {
  id: string;
  from: number;
  to: number;
  status: MarkerStatus;
}

interface AppMsg {
  id: string;
  from: number;
  to: number;
  value: number;
  status: AppMsgStatus;
  capturedBy?: number; // process that captured it in channel state
}

interface LogEntry {
  id: string;
  processId: number;
  text: string;
  type: "init" | "marker_sent" | "local_snap" | "channel_snap" | "done" | "app_msg";
  step: number;
}

interface SimState {
  nodes: PNode[];
  markers: MarkerMsg[];
  appMsgs: AppMsg[];
  log: LogEntry[];
  step: number;
  globalSnapshotDone: boolean;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function mkId() {
  return Math.random().toString(36).slice(2, 9);
}

const N = 4;

function initSim(): SimState {
  return {
    nodes: Array.from({ length: N }, (_, i) => ({
      id: i,
      state: "IDLE" as NodeState,
      localState: null,
      clock: Math.floor(Math.random() * 8) + 1,
      markersReceived: [],
      channelState: {},
    })),
    markers: [],
    appMsgs: [],
    log: [],
    step: 0,
    globalSnapshotDone: false,
  };
}

function cloneNodes(nodes: PNode[]): PNode[] {
  return nodes.map((n) => ({
    ...n,
    markersReceived: [...n.markersReceived],
    channelState: Object.fromEntries(
      Object.entries(n.channelState).map(([k, v]) => [k, [...v]])
    ),
  }));
}

function others(id: number) {
  return Array.from({ length: N }, (_, i) => i).filter((i) => i !== id);
}

// ─── Operations ───────────────────────────────────────────────────────────────

/** Step 1: initiator records local state + sends markers on all outgoing channels */
function doInitiate(state: SimState, pid: number): SimState {
  if (state.nodes[pid].state !== "IDLE") return state;
  const nodes = cloneNodes(state.nodes);
  const p = nodes[pid];
  p.state = "INITIATOR";
  p.localState = p.clock;

  const newMarkers: MarkerMsg[] = others(pid).map((to) => ({
    id: mkId(),
    from: pid,
    to,
    status: "in_transit" as MarkerStatus,
  }));

  const newLog: LogEntry[] = [
    {
      id: mkId(),
      processId: pid,
      type: "init",
      text: `P${pid} démarre l'instantané — enregistre état local (clk=${p.clock})`,
      step: state.step,
    },
    {
      id: mkId(),
      processId: pid,
      type: "marker_sent",
      text: `P${pid} envoie MARKER sur tous les canaux sortants → ${others(pid).map((x) => "P" + x).join(", ")}`,
      step: state.step,
    },
  ];

  // All incoming channels start empty recording
  others(pid).forEach((from) => {
    p.channelState[from] = [];
  });

  return {
    ...state,
    nodes,
    markers: [...state.markers, ...newMarkers],
    log: [...state.log, ...newLog],
    step: state.step + 1,
  };
}

/** Deliver a marker from the transit list */
function doDeliverMarker(state: SimState, markerId: string): SimState {
  const marker = state.markers.find((m) => m.id === markerId);
  if (!marker || marker.status === "delivered") return state;

  const nodes = cloneNodes(state.nodes);
  const receiver = nodes[marker.to];
  const newLog: LogEntry[] = [];
  const newMarkers: MarkerMsg[] = [];

  const isFirstMarker = receiver.state === "IDLE";

  if (isFirstMarker) {
    // Record own local state, start recording all other incoming channels, relay markers
    receiver.state = "RECORDING";
    receiver.localState = receiver.clock;
    newLog.push({
      id: mkId(),
      processId: receiver.id,
      type: "local_snap",
      text: `P${receiver.id} reçoit 1er MARKER de P${marker.from} → enregistre état local (clk=${receiver.clock})`,
      step: state.step,
    });
    // Start recording all incoming channels except from marker sender
    others(receiver.id).forEach((from) => {
      if (from !== marker.from && !(from in receiver.channelState)) {
        receiver.channelState[from] = [];
      }
    });
    // Close channel from marker sender
    receiver.markersReceived.push(marker.from);
    newLog.push({
      id: mkId(),
      processId: receiver.id,
      type: "channel_snap",
      text: `P${receiver.id} ferme canal P${marker.from}→P${receiver.id} (état canal = vide)`,
      step: state.step,
    });
    // Relay markers
    others(receiver.id).forEach((to) => {
      newMarkers.push({ id: mkId(), from: receiver.id, to, status: "in_transit" });
    });
    newLog.push({
      id: mkId(),
      processId: receiver.id,
      type: "marker_sent",
      text: `P${receiver.id} relaie MARKER → ${others(receiver.id).map((x) => "P" + x).join(", ")}`,
      step: state.step,
    });
  } else {
    // Subsequent marker: close channel recording
    if (!receiver.markersReceived.includes(marker.from)) {
      receiver.markersReceived.push(marker.from);
      const captured = receiver.channelState[marker.from] || [];
      newLog.push({
        id: mkId(),
        processId: receiver.id,
        type: "channel_snap",
        text: `P${receiver.id} reçoit MARKER de P${marker.from} → ferme canal (${captured.length} msg capturé${captured.length > 1 ? "s" : ""})`,
        step: state.step,
      });
    }
  }

  // Check if all channels have received their marker
  const allClosed =
    receiver.markersReceived.length === N - 1 &&
    others(receiver.id).every((f) => receiver.markersReceived.includes(f));

  if (allClosed && receiver.state !== "DONE") {
    receiver.state = "DONE";
    newLog.push({
      id: mkId(),
      processId: receiver.id,
      type: "done",
      text: `✓ P${receiver.id} a un instantané local complet — tous les canaux clôturés`,
      step: state.step,
    });
  }

  const updatedMarkers = state.markers.map((m) =>
    m.id === markerId ? { ...m, status: "delivered" as MarkerStatus } : m
  );

  // Check global done
  const updatedNodes = nodes;
  const globalSnapshotDone =
    updatedNodes.every((n) => n.state === "DONE" || n.state === "INITIATOR") &&
    updatedNodes.filter((n) => n.state === "INITIATOR" || n.state === "DONE").length === N;

  return {
    ...state,
    nodes,
    markers: [...updatedMarkers, ...newMarkers],
    log: [...state.log, ...newLog],
    step: state.step + 1,
    globalSnapshotDone,
  };
}

/** Send an app message (normal data message in transit) */
function doSendAppMsg(state: SimState, from: number, to: number): SimState {
  const nodes = cloneNodes(state.nodes);
  const sender = nodes[from];
  if (sender.state === "IDLE") return state; // snapshot not started, nothing to capture
  const value = sender.clock + Math.floor(Math.random() * 5) + 1;
  sender.clock = value;

  const msg: AppMsg = { id: mkId(), from, to, value, status: "in_transit" };
  const logEntry: LogEntry = {
    id: mkId(),
    processId: from,
    type: "app_msg",
    text: `P${from} → P${to} : message applicatif val=${value}`,
    step: state.step,
  };

  return {
    ...state,
    nodes,
    appMsgs: [...state.appMsgs, msg],
    log: [...state.log, logEntry],
    step: state.step + 1,
  };
}

/** Deliver an application message */
function doDeliverAppMsg(state: SimState, msgId: string): SimState {
  const msg = state.appMsgs.find((m) => m.id === msgId);
  if (!msg || msg.status === "delivered") return state;

  const nodes = cloneNodes(state.nodes);
  const receiver = nodes[msg.to];
  const newLog: LogEntry[] = [];

  // If receiver is RECORDING and hasn't received marker from sender yet → capture
  const shouldCapture =
    (receiver.state === "RECORDING" || receiver.state === "INITIATOR") &&
    !receiver.markersReceived.includes(msg.from);

  if (shouldCapture) {
    if (!receiver.channelState[msg.from]) receiver.channelState[msg.from] = [];
    receiver.channelState[msg.from].push(msg.value);
    newLog.push({
      id: mkId(),
      processId: receiver.id,
      type: "channel_snap",
      text: `P${receiver.id} capture msg de P${msg.from} dans l'état du canal (val=${msg.value})`,
      step: state.step,
    });
  } else {
    receiver.clock = Math.max(receiver.clock, msg.value) + 1;
    newLog.push({
      id: mkId(),
      processId: receiver.id,
      type: "app_msg",
      text: `P${receiver.id} reçoit msg de P${msg.from} normalement (val=${msg.value})`,
      step: state.step,
    });
  }

  const updatedMsgs = state.appMsgs.map((m) =>
    m.id === msgId
      ? { ...m, status: (shouldCapture ? "recorded" : "delivered") as AppMsgStatus }
      : m
  );

  return {
    ...state,
    nodes,
    appMsgs: updatedMsgs,
    log: [...state.log, ...newLog],
    step: state.step + 1,
  };
}

// ─── SVG Network ─────────────────────────────────────────────────────────────
function NetworkSVG({
  nodes,
  markers,
  appMsgs,
}: {
  nodes: PNode[];
  markers: MarkerMsg[];
  appMsgs: AppMsg[];
}) {
  const size = 280;
  const cx = 140, cy = 140, r = 95;
  const pos = nodes.map((_, i) => ({
    x: cx + r * Math.cos((2 * Math.PI * i) / N - Math.PI / 4),
    y: cy + r * Math.sin((2 * Math.PI * i) / N - Math.PI / 4),
  }));

  const pendingMarkers = markers.filter((m) => m.status === "in_transit");
  const pendingApp = appMsgs.filter((m) => m.status === "in_transit" || m.status === "recorded");

  const stateColors: Record<NodeState, string> = {
    IDLE: C.muted,
    INITIATOR: C.amber,
    RECORDING: C.accent,
    DONE: C.green,
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <defs>
        <marker id="mrkr-marker" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L7,3.5 z" fill={C.amber} />
        </marker>
        <marker id="mrkr-app" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L7,3.5 z" fill={C.cyan} />
        </marker>
        <marker id="mrkr-rec" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L7,3.5 z" fill={C.purple} />
        </marker>
      </defs>

      {/* edges */}
      {nodes.map((_, i) =>
        nodes.map((_, j) =>
          j > i ? (
            <line
              key={`e-${i}-${j}`}
              x1={pos[i].x} y1={pos[i].y}
              x2={pos[j].x} y2={pos[j].y}
              stroke={C.border} strokeWidth={1.5} strokeDasharray="4 3"
            />
          ) : null
        )
      )}

      {/* pending markers */}
      {pendingMarkers.map((m) => {
        const f = pos[m.from], t = pos[m.to];
        const dx = t.x - f.x, dy = t.y - f.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / len, ny = dy / len, off = 22;
        return (
          <g key={m.id}>
            <line
              x1={f.x + nx * off} y1={f.y + ny * off}
              x2={t.x - nx * (off + 5)} y2={t.y - ny * (off + 5)}
              stroke={C.amber} strokeWidth={2.5} strokeDasharray="5 3"
              markerEnd="url(#mrkr-marker)"
            >
              <animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.6s" repeatCount="indefinite" />
            </line>
            <text
              x={(f.x + nx * off + t.x - nx * (off + 5)) / 2}
              y={(f.y + ny * off + t.y - ny * (off + 5)) / 2 - 6}
              fontSize={8} fill={C.amber} textAnchor="middle" fontWeight="800" fontFamily="monospace"
            >▶ MARKER</text>
          </g>
        );
      })}

      {/* pending app messages */}
      {pendingApp.map((m) => {
        const f = pos[m.from], t = pos[m.to];
        const dx = t.x - f.x, dy = t.y - f.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / len, ny = dy / len, off = 22;
        const col = m.status === "recorded" ? C.purple : C.cyan;
        const mEnd = m.status === "recorded" ? "url(#mrkr-rec)" : "url(#mrkr-app)";
        return (
          <g key={m.id}>
            <line
              x1={f.x + nx * (off + 4)} y1={f.y + ny * (off + 4)}
              x2={t.x - nx * (off + 5)} y2={t.y - ny * (off + 5)}
              stroke={col} strokeWidth={1.5} strokeDasharray="4 2"
              markerEnd={mEnd}
            >
              <animate attributeName="stroke-dashoffset" from="12" to="0" dur="0.9s" repeatCount="indefinite" />
            </line>
            <text
              x={(f.x + nx * (off + 4) + t.x - nx * (off + 5)) / 2}
              y={(f.y + ny * (off + 4) + t.y - ny * (off + 5)) / 2 + 12}
              fontSize={7} fill={col} textAnchor="middle" fontFamily="monospace"
            >val={m.value}</text>
          </g>
        );
      })}

      {/* nodes */}
      {nodes.map((p, i) => {
        const { x, y } = pos[i];
        const col = NODE_COLORS[i];
        const sc = stateColors[p.state];
        const isDone = p.state === "DONE" || p.state === "INITIATOR";
        return (
          <g key={p.id}>
            {isDone && (
              <circle cx={x} cy={y} r={25} fill={`${sc}15`} stroke={sc} strokeWidth={1} strokeDasharray="3 2">
                <animate attributeName="r" values="20;27;20" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={x} cy={y} r={20} fill="#0f172a" stroke={sc} strokeWidth={2.5} />
            <text
              x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize={11} fontWeight="800" fill={col} fontFamily="monospace"
            >P{i}</text>
            <text x={x} y={y + 32} textAnchor="middle" fontSize={7} fill={sc} fontWeight="700">
              {p.state}
            </text>
            <text x={x} y={y + 41} textAnchor="middle" fontSize={7} fill={C.muted} fontFamily="monospace">
              clk:{p.clock}
            </text>
            {p.localState !== null && (
              <text x={x} y={y + 50} textAnchor="middle" fontSize={7} fill={C.green} fontFamily="monospace">
                snap:{p.localState}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Process Card ─────────────────────────────────────────────────────────────
const STATE_LABEL: Record<NodeState, string> = {
  IDLE: "Inactif",
  INITIATOR: "Initiateur",
  RECORDING: "Enregistrement",
  DONE: "Terminé",
};
const STATE_COL: Record<NodeState, string> = {
  IDLE: C.muted,
  INITIATOR: C.amber,
  RECORDING: C.accent,
  DONE: C.green,
};

function NodeCard({
  node,
  onInitiate,
  onSendTo,
}: {
  node: PNode;
  onInitiate: () => void;
  onSendTo: (to: number) => void;
}) {
  const color = NODE_COLORS[node.id];
  const sc = STATE_COL[node.state];
  const isDone = node.state === "DONE";
  const isIdle = node.state === "IDLE";
  const isRecording = node.state === "RECORDING" || node.state === "INITIATOR";
  const snapProgress = isRecording
    ? (node.markersReceived.length / (N - 1)) * 100
    : isDone ? 100 : 0;

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${sc}`,
      borderRadius: 16,
      padding: "16px 18px",
      width: 210,
      boxSizing: "border-box",
      boxShadow: isDone ? `0 0 18px ${C.green}22` : `0 8px 24px #00000040`,
      transition: "all 0.3s ease",
      position: "relative",
      overflow: "hidden",
    }}>
      {isDone && (
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(circle at top right, ${C.green}0a, transparent 60%)`,
          pointerEvents: "none",
        }} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: `${color}18`, border: `2px solid ${color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color, fontFamily: "monospace",
        }}>P{node.id}</div>
        <div>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Processus {node.id}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: sc, letterSpacing: 1, textTransform: "uppercase" }}>
            {STATE_LABEL[node.state]}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <div style={{ flex: 1, background: C.surface, borderRadius: 8, padding: "7px 4px", textAlign: "center", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 8, color: C.muted, marginBottom: 2 }}>HORLOGE</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>{node.clock}</div>
        </div>
        <div style={{ flex: 1, background: C.surface, borderRadius: 8, padding: "7px 4px", textAlign: "center", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 8, color: C.muted, marginBottom: 2 }}>SNAP LOCAL</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: node.localState !== null ? C.green : C.muted, fontFamily: "monospace" }}>
            {node.localState !== null ? node.localState : "–"}
          </div>
        </div>
        <div style={{ flex: 1, background: C.surface, borderRadius: 8, padding: "7px 4px", textAlign: "center", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 8, color: C.muted, marginBottom: 2 }}>MARKERS</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.accent, fontFamily: "monospace" }}>
            {node.markersReceived.length}/{N - 1}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {(isRecording || isDone) && (
        <div style={{ background: C.border, borderRadius: 4, height: 4, marginBottom: 10, overflow: "hidden" }}>
          <div style={{
            width: `${snapProgress}%`, height: "100%",
            background: `linear-gradient(90deg, ${C.accent}, ${C.green})`,
            borderRadius: 4, transition: "width 0.4s",
          }} />
        </div>
      )}

      {/* Channel states */}
      {Object.keys(node.channelState).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {Object.entries(node.channelState).map(([from, msgs]) => (
            <div key={from} style={{
              fontSize: 9, color: C.purple, background: C.card,
              border: `1px solid ${C.purple}33`, borderRadius: 6,
              padding: "3px 8px", marginBottom: 3,
            }}>
              Canal P{from}→P{node.id}: [{msgs.length > 0 ? msgs.join(", ") : "∅"}]
              {node.markersReceived.includes(Number(from)) ? " ✓" : " ⏺"}
            </div>
          ))}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {isIdle && (
          <button onClick={onInitiate} style={bst(C.amber)}>▶ Initier instantané</button>
        )}
        {isRecording && (
          <div style={{ fontSize: 9, color: C.muted, textAlign: "center", padding: "4px 0" }}>
            Enregistrement en cours…
          </div>
        )}
        {isDone && (
          <div style={{ fontSize: 10, color: C.green, textAlign: "center", padding: "4px 0", fontWeight: 700 }}>
            ✓ Instantané local complet
          </div>
        )}
        {!isIdle && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, marginTop: 2 }}>
            <div style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>Envoyer msg applicatif :</div>
            <div style={{ display: "flex", gap: 4 }}>
              {others(node.id).map((tid) => (
                <button key={tid} onClick={() => onSendTo(tid)} style={{ ...bst(NODE_COLORS[tid]), flex: 1, textAlign: "center", padding: "5px 2px" }}>
                  →P{tid}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const bst = (color: string, outline = false): CSSProperties => ({
  background: outline ? "transparent" : `${color}14`,
  border: `1px solid ${color}44`,
  borderRadius: 8,
  color,
  padding: "7px 10px",
  fontSize: 11,
  cursor: "pointer",
  width: "100%",
  textAlign: "left",
  fontFamily: "inherit",
  transition: "all 0.15s",
});

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MarkerBubble({ m, onDeliver }: { m: MarkerMsg; onDeliver: () => void }) {
  return (
    <div onClick={onDeliver} style={{
      display: "flex", alignItems: "center", gap: 8,
      background: C.card, border: `1px solid ${C.amber}44`,
      borderRadius: 10, padding: "9px 12px", cursor: "pointer",
      marginBottom: 6, fontSize: 11, color: C.text, transition: "all 0.15s",
    }}>
      <span style={{ fontSize: 14 }}>▶</span>
      <span style={{ color: C.amber, fontFamily: "monospace", fontWeight: 800, minWidth: 60 }}>MARKER</span>
      <span style={{ color: C.muted }}>P{m.from} → P{m.to}</span>
      <span style={{ flex: 1 }} />
      <span style={{
        background: C.amber, color: "#000", borderRadius: 4,
        padding: "2px 7px", fontSize: 9, fontWeight: 800,
      }}>DÉLIVRER</span>
    </div>
  );
}

function AppMsgBubble({ m, onDeliver }: { m: AppMsg; onDeliver: () => void }) {
  const col = m.status === "recorded" ? C.purple : C.cyan;
  return (
    <div onClick={onDeliver} style={{
      display: "flex", alignItems: "center", gap: 8,
      background: C.card, border: `1px solid ${col}44`,
      borderRadius: 10, padding: "9px 12px", cursor: "pointer",
      marginBottom: 6, fontSize: 11, color: C.text, transition: "all 0.15s",
    }}>
      <span style={{ fontSize: 14 }}>✉️</span>
      <span style={{ color: col, fontFamily: "monospace", fontWeight: 800, minWidth: 60 }}>
        MSG {m.status === "recorded" ? "(capturé)" : ""}
      </span>
      <span style={{ color: C.muted }}>P{m.from} → P{m.to}</span>
      <span style={{ color: C.muted, fontSize: 9, fontFamily: "monospace" }}>val={m.value}</span>
      <span style={{ flex: 1 }} />
      <span style={{
        background: col, color: "#000", borderRadius: 4,
        padding: "2px 7px", fontSize: 9, fontWeight: 800,
      }}>DÉLIVRER</span>
    </div>
  );
}

// ─── Log entry icons ──────────────────────────────────────────────────────────
const LOG_ICON: Record<LogEntry["type"], string> = {
  init: "🎯",
  marker_sent: "▶",
  local_snap: "📸",
  channel_snap: "📦",
  done: "✓",
  app_msg: "✉️",
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Snapshots() {
  const [sim, setSim] = useState<SimState>(initSim);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sim.log.length]);

  const pendingMarkers = sim.markers.filter((m) => m.status === "in_transit");
  const pendingApp = sim.appMsgs.filter((m) => m.status === "in_transit" || m.status === "recorded");

  const handle = useCallback(
    <T extends unknown[]>(fn: (s: SimState, ...a: T) => SimState, ...args: T) =>
      setSim((s) => fn(s, ...args)),
    []
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      color: C.text,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      padding: "24px 20px 60px",
    }}>
      <style>{`
        button:hover { filter: brightness(1.25); transform: translateY(-1px); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
      `}</style>

      {/* Back */}
      <div style={{ marginBottom: 20 }}>
        <Link to="/" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 10,
          background: C.surface, border: `1px solid ${C.border}`,
          color: C.text, fontSize: 12, fontWeight: 700, textDecoration: "none",
        }}>← Retour au menu</Link>
      </div>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: C.accent, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }}>
          Instantané Distribué Global
        </div>
        <h1 style={{
          fontSize: 28, fontWeight: 900, margin: 0,
          background: `linear-gradient(135deg, ${NODE_COLORS[0]}, ${NODE_COLORS[1]}, ${NODE_COLORS[2]}, ${NODE_COLORS[3]})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Chandy – Lamport
        </h1>
        <p style={{ color: C.muted, fontSize: 12, margin: "6px 0 0" }}>
          4 processus · Messages MARKER · Simulation interactive
        </p>
      </div>

      {/* Global done banner */}
      {sim.globalSnapshotDone && (
        <div style={{
          textAlign: "center", marginBottom: 20,
          padding: "12px 20px", background: `${C.green}15`,
          border: `1px solid ${C.green}44`, borderRadius: 12,
          color: C.green, fontSize: 13, fontWeight: 700,
          maxWidth: 680, margin: "0 auto 20px",
        }}>
          🎉 Instantané global cohérent terminé — tous les processus ont clôturé leurs canaux
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        {[
          ["Inactif", C.muted],
          ["Initiateur", C.amber],
          ["Enregistrement", C.accent],
          ["Terminé", C.green],
          ["MARKER", C.amber],
          ["MSG applicatif", C.cyan],
          ["MSG capturé", C.purple],
        ].map(([l, col]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: col as string }} />
            <span style={{ color: C.muted }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Main row */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
        {sim.nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            onInitiate={() => handle(doInitiate, node.id)}
            onSendTo={(to) => handle(doSendAppMsg, node.id, to)}
          />
        ))}

        {/* Network */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: "16px 18px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        }}>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: "uppercase" }}>
            Réseau
          </div>
          <NetworkSVG nodes={sim.nodes} markers={sim.markers} appMsgs={sim.appMsgs} />
          <div style={{ fontSize: 10, color: C.muted }}>
            Markers:{" "}<span style={{ color: C.amber, fontWeight: 700 }}>{pendingMarkers.length}</span>
            {"  "}Msgs:{" "}<span style={{ color: C.cyan, fontWeight: 700 }}>{pendingApp.length}</span>
          </div>
        </div>
      </div>

      {/* Message queues */}
      {(pendingMarkers.length > 0 || pendingApp.length > 0) && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: 18,
          maxWidth: 720, margin: "18px auto 0",
        }}>
          <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
            📨 Messages en Transit ({pendingMarkers.length + pendingApp.length})
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>
            Cliquez pour délivrer au destinataire :
          </div>
          {pendingMarkers.map((m) => (
            <MarkerBubble key={m.id} m={m} onDeliver={() => handle(doDeliverMarker, m.id)} />
          ))}
          {pendingApp.map((m) => (
            <AppMsgBubble key={m.id} m={m} onDeliver={() => handle(doDeliverAppMsg, m.id)} />
          ))}
        </div>
      )}

      {/* Event log */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: 18,
        maxWidth: 720, margin: "18px auto 0",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, textTransform: "uppercase" }}>
            📋 Journal des Événements
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.muted }}>
              Étape <span style={{ color: C.text, fontWeight: 700 }}>{sim.step}</span>
            </span>
            <button
              onClick={() => setSim(initSim())}
              style={{ ...bst(C.red, true), width: "auto", padding: "4px 12px" }}
            >🔄 Reset</button>
          </div>
        </div>

        {sim.log.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 0", color: C.muted, fontSize: 12 }}>
            Aucun événement — Cliquez sur "Initier instantané" sur un processus pour démarrer
          </div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
            {sim.log.map((entry, idx) => (
              <div key={entry.id} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "7px 10px", borderRadius: 7, fontSize: 11,
                background: idx === sim.log.length - 1 ? `${NODE_COLORS[entry.processId]}10` : "transparent",
                borderLeft: `2.5px solid ${NODE_COLORS[entry.processId]}`,
              }}>
                <span style={{ color: C.muted, fontSize: 10, minWidth: 28, fontFamily: "monospace" }}>
                  #{String(idx + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 13 }}>{LOG_ICON[entry.type]}</span>
                <span style={{ color: NODE_COLORS[entry.processId], fontWeight: 700, minWidth: 22 }}>
                  P{entry.processId}
                </span>
                <span style={{ color: C.text, flex: 1, lineHeight: 1.5 }}>{entry.text}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* Algorithm steps */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
        gap: 12, maxWidth: 720, margin: "18px auto 0",
      }}>
        {[
          { n: "1", t: "Initiation", c: C.amber, d: "L'initiateur enregistre son état local et envoie un MARKER sur tous ses canaux sortants." },
          { n: "2", t: "Frontière", c: C.accent, d: "Au 1er MARKER reçu, un processus enregistre son état local, relaie les markers et commence à enregistrer les canaux." },
          { n: "3", t: "État des canaux", c: C.purple, d: "Les messages arrivant après l'enregistrement local mais avant le MARKER du canal sont capturés dans l'état du canal." },
          { n: "4", t: "Cohérence globale", c: C.green, d: "Quand tous les canaux entrants ont reçu un MARKER, l'instantané local est complet. L'union forme l'instantané global." },
        ].map(({ n, t, c, d }) => (
          <div key={n} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${c}`, borderRadius: 10, padding: "12px 14px",
          }}>
            <div style={{ color: c, fontSize: 11, fontWeight: 800, marginBottom: 5 }}>{n}. {t}</div>
            <div style={{ color: C.muted, fontSize: 10, lineHeight: 1.6 }}>{d}</div>
          </div>
        ))}
      </div>

      {/* Suggested scenario */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: 18, maxWidth: 720, margin: "18px auto 0",
      }}>
        <div style={{ fontSize: 10, color: C.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
          🎯 Scénario Suggéré
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            ["1", NODE_COLORS[0], "Cliquez P0 → Initier instantané (P0 devient initiateur)"],
            ["2", NODE_COLORS[1], "Avant de délivrer les MARKERs, utilisez P0 → MSG vers P1 ou P2 pour créer des msgs en transit"],
            ["3", C.amber, "Délivrez les MARKERs un à un, observez comment chaque processus enregistre son état local"],
            ["4", C.purple, "Délivrez un msg applicatif arrivé APRÈS le MARKER → il est capturé dans l'état du canal"],
            ["5", C.green, "Continuez jusqu'à ce que tous les processus soient DONE → instantané global cohérent"],
          ].map(([n, col, txt]) => (
            <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 11 }}>
              <span style={{
                background: `${col}22`, color: col as string, borderRadius: 4,
                padding: "1px 6px", fontWeight: 700, fontSize: 10, minWidth: 18, textAlign: "center",
              }}>{n}</span>
              <span style={{ color: C.muted }}>{txt as string}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
