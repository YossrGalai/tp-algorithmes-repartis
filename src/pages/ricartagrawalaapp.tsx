import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { CSSProperties } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
const PROCESS_COLORS = ["#818cf8", "#f472b6", "#fb923c"] as const;

type ProcessState = "IDLE" | "WANTING" | "IN_CS" | "FAILED";
type MessageType = "REQUEST" | "REPLY";
type MessageStatus = "pending" | "delivered";
type EventType =
  | "REQUEST_SENT"
  | "REPLY_SENT"
  | "REPLY_RECEIVED"
  | "ENTERED_CS"
  | "EXITED_CS"
  | "DEFERRED"
  | "FAILED"
  | "RECOVERED";

interface Process {
  id: number;
  state: ProcessState;
  clock: number;
  requestClock: number | null;
  repliesReceived: number[];
  deferredReplies: number[];
  failed: boolean;
}

interface Message {
  id: string;
  type: MessageType;
  from: number;
  to: number;
  clock: number;
  status: MessageStatus;
}

interface EventItem {
  id: string;
  processId: number;
  type: EventType;
  desc: string;
  clock: number;
  step: number;
}

interface State {
  processes: Process[];
  messages: Message[];
  events: EventItem[];
  step: number;
}

function makeId() {
  return Math.random().toString(36).slice(2, 8);
}

function tickClock(current: number, received: number | null = null): number {
  return received !== null ? Math.max(current, received) + 1 : current + 1;
}

// ─── Initial state ────────────────────────────────────────────────────────────
function initState(): State {
  return {
    processes: [0, 1, 2].map((id) => ({
      id,
      state: "IDLE" as ProcessState,
      clock: 0,
      requestClock: null,
      repliesReceived: [],
      deferredReplies: [],
      failed: false,
    })),
    messages: [],
    events: [],
    step: 0,
  };
}

// ─── Algorithm operations ──────────────────────────────────────────────────────
/** @param {any[]} ps */
function cloneProcesses(ps: Process[]): Process[] {
  return ps.map((p) => ({
    ...p,
    repliesReceived: [...p.repliesReceived],
    deferredReplies: [...p.deferredReplies],
  }));
}

function doRequestCS(state: State, pid: number): State {
  const processes = cloneProcesses(state.processes);
  const p = processes[pid];
  if (p.state !== "IDLE" || p.failed) return state;

  const nc = tickClock(p.clock);
  p.clock = nc;
  p.state = "WANTING";
  p.requestClock = nc;
  p.repliesReceived = [];

  const msgs: Message[] = [];
  processes.forEach((q) => {
    if (q.id !== pid && !q.failed)
      msgs.push({ id: makeId(), type: "REQUEST", from: pid, to: q.id, clock: nc, status: "pending" });
  });

  const evt: EventItem = {
    id: makeId(), processId: pid, type: "REQUEST_SENT",
    desc: `P${pid} envoie REQUEST(ts=${nc}) à ${processes.filter(q => q.id !== pid && !q.failed).map(q => "P" + q.id).join(", ")}`,
    clock: nc, step: state.step,
  };

  return { ...state, processes, messages: [...state.messages, ...msgs], events: [...state.events, evt], step: state.step + 1 };
}

function doDeliver(state: State, msgId: string): State {
  const msg = state.messages.find((m) => m.id === msgId);
  if (!msg || msg.status === "delivered") return state;

  const processes = cloneProcesses(state.processes);
  const receiver = processes[msg.to];
  if (receiver.failed) return state;

  const nc = tickClock(receiver.clock, msg.clock);
  receiver.clock = nc;

  const newMsgs: Message[] = [];
  const newEvts: EventItem[] = [];

  if (msg.type === "REQUEST") {
    const myReqTs = receiver.requestClock;
    const shouldDefer =
      receiver.state === "IN_CS" ||
      (receiver.state === "WANTING" &&
        myReqTs !== null &&
        (myReqTs < msg.clock || (myReqTs === msg.clock && receiver.id < msg.from)));

    if (shouldDefer) {
      receiver.deferredReplies.push(msg.from);
      newEvts.push({
        id: makeId(), processId: receiver.id, type: "DEFERRED",
        desc: `P${receiver.id} diffère REPLY à P${msg.from} (sa priorité est plus haute)`,
        clock: nc, step: state.step,
      } as EventItem);
    } else {
      newMsgs.push({ id: makeId(), type: "REPLY", from: receiver.id, to: msg.from, clock: nc, status: "pending" } as Message);
      newEvts.push({
        id: makeId(), processId: receiver.id, type: "REPLY_SENT",
        desc: `P${receiver.id} envoie REPLY à P${msg.from}`,
        clock: nc, step: state.step,
      } as EventItem);
    }
  } else {
    // REPLY
    if (receiver.state === "WANTING") {
      receiver.repliesReceived.push(msg.from);
      const active = processes.filter((p) => !p.failed && p.id !== receiver.id);
      const allReplied = active.every((p) => receiver.repliesReceived.includes(p.id));
      newEvts.push({
        id: makeId(), processId: receiver.id, type: "REPLY_RECEIVED",
        desc: `P${receiver.id} reçoit REPLY de P${msg.from} (${receiver.repliesReceived.length}/${active.length})`,
        clock: nc, step: state.step,
      } as EventItem);
      if (allReplied) {
        receiver.state = "IN_CS";
        newEvts.push({
          id: makeId(), processId: receiver.id, type: "ENTERED_CS",
          desc: `✓ P${receiver.id} entre en SECTION CRITIQUE — toutes les réponses reçues`,
          clock: nc, step: state.step,
        } as EventItem);
      }
    }
  }

  const updatedMsgs: Message[] = state.messages.map((m: Message) =>
    m.id === msgId ? ({ ...m, status: "delivered" } as Message) : m
  );

  return {
    ...state, processes,
    messages: [...updatedMsgs, ...newMsgs],
    events: [...state.events, ...newEvts],
    step: state.step + 1,
  };
}

function doExitCS(state: State, pid: number): State {
  const processes = cloneProcesses(state.processes);
  const p = processes[pid];
  if (p.state !== "IN_CS") return state;

  const nc = tickClock(p.clock);
  p.clock = nc;
  p.state = "IDLE";
  p.requestClock = null;

  const deferred = [...p.deferredReplies];
  p.deferredReplies = [];

  const newMsgs: Message[] = deferred
    .filter((tid) => !processes[tid].failed)
    .map((tid) => ({ id: makeId(), type: "REPLY", from: pid, to: tid, clock: nc, status: "pending" }));

  const newEvts: EventItem[] = [
    {
      id: makeId(), processId: pid, type: "EXITED_CS",
      desc: `P${pid} quitte la SC${deferred.length ? " — envoie les REPLY différées à " + deferred.map((d) => "P" + d).join(", ") : ""}`,
      clock: nc, step: state.step,
    },
  ];

  return {
    ...state, processes,
    messages: [...state.messages, ...newMsgs],
    events: [...state.events, ...newEvts],
    step: state.step + 1,
  };
}

function doFail(state: State, pid: number): State {
  const processes = cloneProcesses(state.processes);
  processes[pid].failed = true;
  processes[pid].state = "FAILED";
  const evt: EventItem = {
    id: makeId(), processId: pid, type: "FAILED",
    desc: `⚠ P${pid} tombe en PANNE — les processus en attente de sa réponse peuvent bloquer`,
    clock: processes[pid].clock, step: state.step,
  };
  return { ...state, processes, events: [...state.events, evt], step: state.step + 1 };
}

function doRecover(state: State, pid: number): State {
  const processes = cloneProcesses(state.processes);
  const p = processes[pid];
  p.failed = false;
  p.state = "IDLE";
  p.requestClock = null;
  p.repliesReceived = [];
  p.deferredReplies = [];
  const evt: EventItem = {
    id: makeId(), processId: pid, type: "RECOVERED",
    desc: `P${pid} est rétabli`,
    clock: p.clock, step: state.step,
  };
  return { ...state, processes, events: [...state.events, evt], step: state.step + 1 };
}

// ─── Sub-components ────────────────────────────────────────────────────────────
const STATE_LABEL = { IDLE: "Inactif", WANTING: "En attente", IN_CS: "Section Critique", FAILED: "Panne" };
const STATE_COLOR = { IDLE: "#64748b", WANTING: "#f59e0b", IN_CS: "#34d399", FAILED: "#f87171" };
const EVT_ICON = {
  REQUEST_SENT: "→", REPLY_SENT: "←", REPLY_RECEIVED: "✓",
  ENTERED_CS: "🔒", EXITED_CS: "🔓", DEFERRED: "⏳", FAILED: "✕", RECOVERED: "↺",
};

interface NetworkSVGProps {
  processes: Process[];
  messages: Message[];
}

function NetworkSVG({ processes, messages }: NetworkSVGProps) {
  const size = 260;
  const cx = 130, cy = 130, r = 88;
  const pos = processes.map((_, i) => ({
    x: cx + r * Math.cos((2 * Math.PI * i) / 3 - Math.PI / 2),
    y: cy + r * Math.sin((2 * Math.PI * i) / 3 - Math.PI / 2),
  }));
  const pending = messages.filter((m) => m.status === "pending");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <defs>
        <marker id="ar" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L7,3.5 z" fill="#818cf8" />
        </marker>
        <marker id="ar2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L7,3.5 z" fill="#34d399" />
        </marker>
      </defs>
      {/* Base edges */}
      {[0, 1, 2].map((i) =>
        [0, 1, 2].filter((j) => j > i).map((j) => (
          <line key={`${i}-${j}`}
            x1={pos[i].x} y1={pos[i].y} x2={pos[j].x} y2={pos[j].y}
            stroke="#1e293b" strokeWidth={1.5} strokeDasharray="4 3"
          />
        ))
      )}
      {/* Pending messages */}
      {pending.map((msg) => {
        const f = pos[msg.from], t = pos[msg.to];
        const dx = t.x - f.x, dy = t.y - f.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / len, ny = dy / len, off = 20;
        const isReq = msg.type === "REQUEST";
        return (
          <g key={msg.id}>
            <line
              x1={f.x + nx * off} y1={f.y + ny * off}
              x2={t.x - nx * (off + 5)} y2={t.y - ny * (off + 5)}
              stroke={isReq ? "#818cf8" : "#34d399"}
              strokeWidth={2} strokeDasharray="5 3"
              markerEnd={isReq ? "url(#ar)" : "url(#ar2)"}
            >
              <animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.7s" repeatCount="indefinite" />
            </line>
            <text
              x={(f.x + nx * off + t.x - nx * (off + 5)) / 2}
              y={(f.y + ny * off + t.y - ny * (off + 5)) / 2 - 6}
              fontSize={8} fill={isReq ? "#818cf8" : "#34d399"}
              textAnchor="middle" fontWeight="700" fontFamily="monospace"
            >
              {msg.type}
            </text>
          </g>
        );
      })}
      {/* Process nodes */}
      {processes.map((p, i) => {
        const { x, y } = pos[i];
        const color = p.failed ? "#f87171" : PROCESS_COLORS[i];
        const isCS = p.state === "IN_CS";
        return (
          <g key={p.id}>
            {isCS && (
              <circle cx={x} cy={y} r={24} fill={`${color}22`} stroke={color} strokeWidth={1.5} strokeDasharray="3 2">
                <animate attributeName="r" values="20;28;20" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={x} cy={y} r={18} fill="#0f172a" stroke={color} strokeWidth={2.5} />
            <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize={11} fontWeight="800" fill={color} fontFamily="monospace">
              {p.failed ? "✕" : `P${i}`}
            </text>
            <text x={x} y={y + 30} textAnchor="middle" fontSize={8} fill={STATE_COLOR[p.state]} fontWeight="600">
              {STATE_LABEL[p.state].toUpperCase()}
            </text>
            <text x={x} y={y + 40} textAnchor="middle" fontSize={7} fill="#475569" fontFamily="monospace">
              clk:{p.clock}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface ProcessCardProps {
  process: Process;
  totalNeeded: number;
  onRequest: () => void;
  onExit: () => void;
  onFail: () => void;
  onRecover: () => void;
}

function ProcessCard({ process, onRequest, onExit, onFail, onRecover, totalNeeded }: ProcessCardProps) {
  const color = process.failed ? "#f87171" : PROCESS_COLORS[process.id];
  const stateColor = STATE_COLOR[process.state];
  const isCS = process.state === "IN_CS";

  return (
    <div style={{
      background: "#ffffff",
      border: `1px solid #e2e8f0`,
      borderLeft: `4px solid ${stateColor}`,
      borderRadius: 18,
      padding: "18px 20px",
      width: 220,
      boxSizing: "border-box",
      transition: "all 0.35s ease",
      opacity: process.failed ? 0.75 : 1,
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 12px 24px rgba(15, 23, 42, 0.06)",
    }}>
      {isCS && (
        <div style={{
          position: "absolute", inset: 0, background: "#34d39908",
          borderRadius: 12, pointerEvents: "none",
          animation: "csGlow 2s ease-in-out infinite",
        }} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: `${color}22`, border: `2px solid ${color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 800, color, fontFamily: "monospace",
        }}>
          {process.failed ? "✕" : `P${process.id}`}
        </div>
        <div>
          <div style={{ color: "#0f172a", fontWeight: 700, fontSize: 13 }}>Processus {process.id}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: stateColor, letterSpacing: 1, textTransform: "uppercase" }}>
            {STATE_LABEL[process.state]}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, textAlign: "center", background: "#f8fafc", borderRadius: 8, padding: "8px 4px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>HORLOGE</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>{process.clock}</div>
        </div>
        {process.requestClock !== null && (
          <div style={{ flex: 1, textAlign: "center", background: "#f8fafc", borderRadius: 8, padding: "6px 4px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>REQ ts</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b", fontFamily: "monospace" }}>{process.requestClock}</div>
          </div>
        )}
        <div style={{ flex: 1, textAlign: "center", background: "#f8fafc", borderRadius: 8, padding: "6px 4px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>REPLY</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#34d399", fontFamily: "monospace" }}>
            {process.repliesReceived.length}/{totalNeeded}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {process.state === "WANTING" && totalNeeded > 0 && (
        <div style={{ background: "#1e293b", borderRadius: 4, height: 5, marginBottom: 10, overflow: "hidden" }}>
          <div style={{
            width: `${(process.repliesReceived.length / totalNeeded) * 100}%`,
            height: "100%",
            background: `linear-gradient(90deg, #f59e0b, #34d399)`,
            borderRadius: 4, transition: "width 0.4s",
          }} />
        </div>
      )}

      {/* Deferred */}
      {process.deferredReplies.length > 0 && (
        <div style={{ fontSize: 10, color: "#92400e", background: "#fef3c7", borderRadius: 6, padding: "4px 8px", marginBottom: 10, border: "1px solid #fde68a" }}>
          ⏳ Différées: {process.deferredReplies.map((id) => `P${id}`).join(", ")}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {!process.failed && process.state === "IDLE" && (
          <button onClick={onRequest} style={btnSt(color)}>📤 Demander SC</button>
        )}
        {!process.failed && process.state === "IN_CS" && (
          <button onClick={onExit} style={btnSt("#34d399")}>🔓 Quitter SC</button>
        )}
        {!process.failed ? (
          <button onClick={onFail} style={btnSt("#f87171", true)}>💥 Simuler panne</button>
        ) : (
          <button onClick={onRecover} style={btnSt("#34d399")}>↺ Rétablir</button>
        )}
      </div>
    </div>
  );
}

const btnSt = (color: string, outline = false): CSSProperties => ({
  background: outline ? "transparent" : `${color}12`,
  border: `1px solid ${color}33`,
  borderRadius: 10,
  color,
  padding: "8px 12px",
  fontSize: 12,
  cursor: "pointer",
  width: "100%",
  textAlign: "left",
  fontFamily: "inherit",
  transition: "all 0.15s",
});

interface MessageBubbleProps {
  msg: Message;
  onDeliver: () => void;
}

function MessageBubble({ msg, onDeliver }: MessageBubbleProps) {
  const isReq = msg.type === "REQUEST";
  return (
    <div onClick={onDeliver} style={{
      display: "flex", alignItems: "center", gap: 8,
      background: isReq ? "#f8fafc" : "#f0f9ff",
      border: `1px solid ${isReq ? "#fde68a" : "#bfdbfe"}`,
      borderRadius: 10, padding: "10px 12px", cursor: "pointer",
      marginBottom: 8, fontSize: 12,
      color: "#0f172a",
      transition: "all 0.15s",
    }}>
      <span style={{ fontSize: 14 }}>{isReq ? "📤" : "✉️"}</span>
      <span style={{ flex: 1, fontFamily: "monospace", fontWeight: 700 }}>{msg.type}</span>
      <span style={{ color: "#64748b" }}>P{msg.from} → P{msg.to}</span>
      <span style={{ color: "#475569", fontSize: 10 }}>ts:{msg.clock}</span>
      <span style={{
        background: isReq ? "#f59e0b" : "#34d399",
        color: "#000", borderRadius: 4, padding: "2px 7px",
        fontSize: 10, fontWeight: 800,
      }}>DÉLIVRER</span>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState<State>(initState);
  const evtEndRef = useRef<HTMLDivElement | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    evtEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.events.length]);

  const pending = state.messages.filter((m) => m.status === "pending");
  const active = state.processes.filter((p) => !p.failed);

  // Auto-play: deliver oldest pending message every 1.2s
  useEffect(() => {
    if (autoPlay) {
      autoRef.current = setInterval(() => {
        setState((s) => {
          const p = s.messages.find((m) => m.status === "pending");
          return p ? doDeliver(s, p.id) : s;
        });
      }, 1200);
    } else {
      if (autoRef.current !== null) clearInterval(autoRef.current);
    }
    return () => {
      if (autoRef.current !== null) clearInterval(autoRef.current);
    };
  }, [autoPlay]);

  const handle = useCallback(
    <T extends unknown[]>(fn: (state: State, ...args: T) => State, ...args: T) =>
      setState((s) => fn(s, ...args)),
    []
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      color: "#0f172a",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      padding: "24px 20px 48px",
    }}>
      <style>{`
        @keyframes csGlow { 0%,100%{opacity:1} 50%{opacity:0.3} }
        button:hover { filter: brightness(1.08); }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link to="/" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          borderRadius: 12,
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
        }}>
          ← Retour au menu
        </Link>
      </div>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>
          Exclusion Mutuelle Distribuée
        </div>
        <h1 style={{
          fontSize: 26, fontWeight: 900, margin: 0,
          background: "linear-gradient(120deg, #818cf8, #f472b6, #fb923c)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Ricart – Agrawala
        </h1>
        <p style={{ color: "#475569", fontSize: 12, margin: "6px 0 0" }}>
          3 processus · Horloges de Lamport · Scénario interactif
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        {[
          ["Inactif", "#64748b"], ["En attente", "#f59e0b"], ["Section Critique", "#34d399"],
          ["En panne", "#f87171"], ["REQUEST", "#818cf8"], ["REPLY", "#34d399"],
        ].map(([l, c]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <div style={{ width: 11, height: 11, borderRadius: 9999, background: c }} />
            <span style={{ color: "#475569", fontWeight: 600 }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Main row */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
        {/* Process cards */}
        {state.processes.map((p) => (
          <ProcessCard
            key={p.id}
            process={p}
            totalNeeded={Math.max(0, active.filter((a) => a.id !== p.id).length)}
            onRequest={() => handle(doRequestCS, p.id)}
            onExit={() => handle(doExitCS, p.id)}
            onFail={() => handle(doFail, p.id)}
            onRecover={() => handle(doRecover, p.id)}
          />
        ))}

        {/* Network graph */}
        <div style={{
          background: "#ffffff", border: "1px solid #e2e8f0",
          borderRadius: 14, padding: "18px 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          boxShadow: "0 12px 24px rgba(15, 23, 42, 0.06)",
        }}>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, textTransform: "uppercase" }}>
            Réseau distribué
          </div>
          <NetworkSVG processes={state.processes} messages={state.messages} />
          <div style={{ fontSize: 10, color: "#475569" }}>
            En transit: <span style={{ color: "#818cf8", fontWeight: 700 }}>{pending.length}</span> messages
          </div>
        </div>
      </div>

      {/* Message queue */}
      {pending.length > 0 && (
        <div style={{
          background: "#ffffff", border: "1px solid #e2e8f0",
          borderRadius: 14, padding: 18,
          maxWidth: 680, margin: "18px auto 0",
          boxShadow: "0 12px 24px rgba(15, 23, 42, 0.06)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "#818cf8", letterSpacing: 2, textTransform: "uppercase" }}>
              📨 Messages en Transit ({pending.length})
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#64748b" }}>Auto-délivraison</span>
              <div
                onClick={() => setAutoPlay((v) => !v)}
                style={{
                  width: 38, height: 20, borderRadius: 10,
                  background: autoPlay ? "#818cf8" : "#e2e8f0",
                  cursor: "pointer", position: "relative", transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute", top: 2, left: autoPlay ? 20 : 2,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                }} />
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>
            Cliquez sur un message pour le délivrer manuellement :
          </div>
          {pending.map((m) => (
            <MessageBubble key={m.id} msg={m} onDeliver={() => handle(doDeliver, m.id)} />
          ))}
        </div>
      )}

      {/* Event log */}
      <div style={{
        background: "#ffffff", border: "1px solid #e2e8f0",
        borderRadius: 14, padding: 18,
        maxWidth: 680, margin: "18px auto 0",
        boxShadow: "0 12px 24px rgba(15, 23, 42, 0.06)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "#818cf8", letterSpacing: 2, textTransform: "uppercase" }}>
            📋 Journal des Événements
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#475569" }}>
              Étape <span style={{ color: "#0f172a", fontWeight: 700 }}>{state.step}</span>
            </span>
            <button
              onClick={() => { setState(initState()); setAutoPlay(false); }}
              style={{ ...btnSt("#f87171", true), width: "auto", padding: "4px 12px" }}
            >
              🔄 Reset
            </button>
          </div>
        </div>

        {state.events.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 0", color: "#475569", fontSize: 12 }}>
            Aucun événement — Cliquez sur "Demander SC" pour démarrer la simulation
          </div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
            {state.events.map((evt, idx) => (
              <div key={evt.id} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "7px 10px", borderRadius: 7, fontSize: 11,
                background: idx === state.events.length - 1 ? `${PROCESS_COLORS[evt.processId]}12` : "transparent",
                borderLeft: `2.5px solid ${PROCESS_COLORS[evt.processId] || "#475569"}`,
              }}>
                <span style={{ color: "#334155", fontSize: 10, minWidth: 28, fontFamily: "monospace" }}>
                  #{String(idx + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 13 }}>{EVT_ICON[evt.type]}</span>
                <span style={{ color: PROCESS_COLORS[evt.processId], fontWeight: 700, minWidth: 22 }}>
                  P{evt.processId}
                </span>
                <span style={{ color: "#cbd5e1", flex: 1, lineHeight: 1.5 }}>{evt.desc}</span>
                <span style={{ color: "#334155", fontSize: 9, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  clk:{evt.clock}
                </span>
              </div>
            ))}
            <div ref={evtEndRef} />
          </div>
        )}
      </div>

      {/* Algorithm steps */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
        gap: 12, maxWidth: 680, margin: "18px auto 0",
      }}>
        {[
          { n: "1", t: "REQUEST", c: "#818cf8", d: "P envoie REQUEST(ts, i) à tous. ts = horloge de Lamport incrémentée." },
          { n: "2", t: "Priorité", c: "#f472b6", d: "Répondre immédiatement sauf si P est en SC ou a une demande plus prioritaire (ts plus petit, ou même ts & id plus petit)." },
          { n: "3", t: "REPLY → SC", c: "#34d399", d: "Quand toutes les REPLY reçues, P entre en section critique." },
          { n: "4", t: "Libération", c: "#fb923c", d: "En quittant SC, P envoie les REPLY différées pour débloquer les autres." },
        ].map(({ n, t, c, d }) => (
          <div key={n} style={{
            background: "#ffffff", border: `1px solid ${c}33`,
            borderLeft: `3px solid ${c}`, borderRadius: 10, padding: "12px 14px",
          }}>
            <div style={{ color: c, fontSize: 11, fontWeight: 800, marginBottom: 5 }}>
              {n}. {t}
            </div>
            <div style={{ color: "#475569", fontSize: 10, lineHeight: 1.6 }}>{d}</div>
          </div>
        ))}
      </div>

      {/* Scenario guide */}
      <div style={{
        background: "#ffffff", border: "1px solid #e2e8f0",
        borderRadius: 14, padding: 18, maxWidth: 680, margin: "18px auto 0",
        boxShadow: "0 12px 24px rgba(15, 23, 42, 0.06)",
      }}>
        <div style={{ fontSize: 10, color: "#f59e0b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
          🎯 Scénario Suggéré (Exemple Prof)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            ["1", "#818cf8", "Cliquez P0 → Demander SC"],
            ["2", "#f472b6", "Cliquez P1 → Demander SC (conflit)"],
            ["3", "#fb923c", "Cliquez P2 → Demander SC (3 concurrents)"],
            ["4", "#34d399", "Délivrez les messages REQUEST un par un, observez les REPLY différées"],
            ["5", "#818cf8", "Simulez une panne sur P2 → observez l'impact (P0 ou P1 peut bloquer)"],
            ["6", "#f472b6", "Rétablissez P2, quittez SC, observez la libération des différées"],
          ].map(([n, c, txt]) => (
            <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 11 }}>
              <span style={{
                background: `${c}22`, color: c, borderRadius: 4,
                padding: "1px 6px", fontWeight: 700, fontSize: 10, minWidth: 18, textAlign: "center",
              }}>{n}</span>
              <span style={{ color: "#94a3b8" }}>{txt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}