import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProcessState = "IDLE" | "WANTING" | "IN_CS" | "FAILED";
type MsgType = "REQ" | "REP";
type DiaKind = "arrow" | "cs_start" | "cs_end";

interface Process {
  id: number;
  state: ProcessState;
  clock: number;
  reqClock: number | null;
  replies: number[];
  deferred: number[];
  failed: boolean;
}

interface Msg {
  id: string;
  type: MsgType;
  from: number;
  to: number;
  clock: number;
  done: boolean;
}

interface DiagramItem {
  id: string;
  kind: DiaKind;
  sub?: MsgType;
  from?: number;
  to?: number;
  fc?: number | null;
  tc?: number | null;
  pid?: number;
  clock?: number | null;
}

interface LogItem {
  id: string;
  pid: number;
  type: EventType;
  desc: string;
  clock: number;
}

interface AppState {
  procs: Process[];
  msgs: Msg[];
  log: LogItem[];
  dia: DiagramItem[];
  step: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = ["#60a5fa", "#f472b6", "#34d399"];
const NAMES = ["Site 0", "Site 1", "Site 2"];

const STATE_LABEL = { IDLE: "Inactif", WANTING: "En attente", IN_CS: "Section Critique", FAILED: "Panne" };
const STATE_COLOR = { IDLE: "#64748b", WANTING: "#f59e0b", IN_CS: "#ef4444", FAILED: "#f87171" };
const EVT_ICON = {
  REQUEST_SENT: "→", REPLY_SENT: "←", REPLY_RECEIVED: "✓",
  ENTERED_CS: "🔒", EXITED_CS: "🔓", DEFERRED: "⏳", FAILED: "✕", RECOVERED: "↺",
} as const;

type EventType = keyof typeof EVT_ICON;

let _id = 0;
function uid() { return String(++_id); }
function tick(cur: number, recv: number | null = null): number {
  return recv !== null ? Math.max(cur, recv) + 1 : cur + 1;
}

// ─── Initial state ────────────────────────────────────────────────────────────
function initState(): AppState {
  _id = 0;
  return {
    procs: [0,1,2].map((id): Process => ({
      id, state:"IDLE", clock:0,
      reqClock:null, replies:[], deferred:[], failed:false,
    })),
    msgs: [],
    log:  [],
    dia:  [],
    step: 0,
  };
}

function cloneProcs(ps: Process[]): Process[] {
  return ps.map((p) => ({ ...p, replies: [...p.replies], deferred: [...p.deferred] }));
}

// ─── Pure state transitions ───────────────────────────────────────────────────
function doRequest(st: AppState, pid: number): AppState {
  const procs = cloneProcs(st.procs);
  const p = procs[pid];
  if (p.state !== "IDLE" || p.failed) return st;

  const nc = tick(p.clock);
  p.clock = nc;
  p.state = "WANTING";
  p.reqClock = nc;
  p.replies = [];

  const targets = procs.filter((q) => q.id !== pid && !q.failed);
  const newMsgs: Msg[] = targets.map((q) => ({ id: uid(), type: "REQ", from: pid, to: q.id, clock: nc, done: false }));
  const newDia: DiagramItem[] = targets.map((q): DiagramItem => ({ id: uid(), kind: "arrow", sub: "REQ", from: pid, to: q.id, fc: nc, tc: null }));

  return {
    ...st,
    procs,
    msgs: [...st.msgs, ...newMsgs],
    log: [...st.log, { id: uid(), pid, type: "REQUEST_SENT", desc: `Site ${pid} envoie REQUEST(ts=${nc})`, clock: nc }],
    dia: [...st.dia, ...newDia],
    step: st.step + 1,
  };
}

function doDeliver(st: AppState, msgId: string): AppState {
  const msg = st.msgs.find((m) => m.id === msgId);
  if (!msg || msg.done) return st;

  const procs = cloneProcs(st.procs);
  const r = procs[msg.to];
  if (r.failed) return st;

  const nc = tick(r.clock, msg.clock);
  r.clock = nc;

  // Update matching arrow's tc
  let updDia = st.dia.map(d => {
    if (d.kind==="arrow" && d.sub===msg.type && d.from===msg.from
        && d.to===msg.to && d.fc===msg.clock && d.tc===null) {
      return { ...d, tc:nc };
    }
    return d;
  });

  const newMsgs: Msg[] = [];
  const newLog: LogItem[] = [];
  const newDia: DiagramItem[] = [];

  if (msg.type === "REQ") {
    const defer =
      r.state === "IN_CS" ||
      (r.state === "WANTING" && r.reqClock !== null &&
        (r.reqClock < msg.clock || (r.reqClock === msg.clock && r.id < msg.from)));

    if (defer) {
      r.deferred.push(msg.from);
      newLog.push({ id:uid(), pid:r.id, type:"DEFERRED",
        desc:`Site ${r.id} diffère REPLY → Site ${msg.from}`, clock:nc });
    } else {
      newMsgs.push({ id:uid(), type:"REP", from:r.id, to:msg.from, clock:nc, done:false });
      newDia.push({ id:uid(), kind:"arrow", sub:"REP", from:r.id, to:msg.from, fc:nc, tc:null } as DiagramItem);
      newLog.push({ id:uid(), pid:r.id, type:"REPLY_SENT",
        desc:`Site ${r.id} envoie REPLY → Site ${msg.from}`, clock:nc });
    }
  } else {
    // REP
    if (r.state === "WANTING") {
      r.replies.push(msg.from);
      const active = procs.filter(p => !p.failed && p.id !== r.id);
      const allIn  = active.every(p => r.replies.includes(p.id));

      // update tc for this reply arrow
      updDia = updDia.map(d => {
        if (d.kind==="arrow" && d.sub==="REP" && d.from===msg.from
            && d.to===r.id && d.tc===null) {
          return { ...d, tc:nc };
        }
        return d;
      });

      newLog.push({ id:uid(), pid:r.id, type:"REPLY_RECEIVED",
        desc:`Site ${r.id} reçoit REPLY de Site ${msg.from} (${r.replies.length}/${active.length})`, clock:nc });

      if (allIn) {
        r.state = "IN_CS";
        newLog.push({ id:uid(), pid:r.id, type:"ENTERED_CS",
          desc:`✓ Site ${r.id} entre en SECTION CRITIQUE`, clock:nc });
        newDia.push({ id:uid(), kind:"cs_start", pid:r.id, clock:nc });
      }
    }
  }

  const updMsgs = st.msgs.map(m => m.id===msgId ? { ...m, done:true } : m);

  return {
    ...st, procs,
    msgs: [...updMsgs, ...newMsgs],
    log:  [...st.log,  ...newLog],
    dia:  [...updDia,  ...newDia],
    step: st.step+1,
  };
}

function doExit(st: AppState, pid: number): AppState {
  const procs = cloneProcs(st.procs);
  const p = procs[pid];
  if (p.state !== "IN_CS") return st;

  const nc = tick(p.clock);
  p.clock = nc;
  p.state = "IDLE";
  p.reqClock = null;

  const def = [...p.deferred];
  p.deferred = [];

  const newMsgs: Msg[] = def
    .filter((tid) => !procs[tid].failed)
    .map((tid) => ({ id: uid(), type: "REP", from: pid, to: tid, clock: nc, done: false }));

  const newDia: DiagramItem[] = [
    { id: uid(), kind: "cs_end", pid, clock: nc },
    ...def
      .filter((tid) => !procs[tid].failed)
      .map((tid): DiagramItem => ({ id: uid(), kind: "arrow", sub: "REP", from: pid, to: tid, fc: nc, tc: null })),
  ];

  return {
    ...st,
    procs,
    msgs: [...st.msgs, ...newMsgs],
    log: [...st.log, { id: uid(), pid, type: "EXITED_CS",
      desc: `Site ${pid} quitte SC${def.length ? " → REPLY différées: " + def.map((d) => "Site " + d).join(", ") : ""}`,
      clock: nc }],
    dia: [...st.dia, ...newDia],
    step: st.step + 1,
  };
}

function doFail(st: AppState, pid: number): AppState {
  const procs = cloneProcs(st.procs);
  procs[pid].failed = true;
  procs[pid].state = "FAILED";
  return {
    ...st,
    procs,
    log: [...st.log, { id: uid(), pid, type: "FAILED", desc: `⚠ Site ${pid} PANNE`, clock: procs[pid].clock }],
    step: st.step + 1,
  };
}

function doRecover(st: AppState, pid: number): AppState {
  const procs = cloneProcs(st.procs);
  const p = procs[pid];
  p.failed = false;
  p.state = "IDLE";
  p.reqClock = null;
  p.replies = [];
  p.deferred = [];

  const newMsgs: Msg[] = [];
  const newDia: DiagramItem[] = [];
  const newLog: LogItem[] = [{ id: uid(), pid, type: "RECOVERED", desc: `Site ${pid} rétabli`, clock: p.clock }];

  const updMsgs = st.msgs.map((m) => {
    if (m.done || m.to !== pid || m.type !== "REQ") return m;
    const nc = tick(p.clock, m.clock);
    p.clock = nc;
    newMsgs.push({ id: uid(), type: "REP", from: pid, to: m.from, clock: nc, done: false });
    newDia.push({ id: uid(), kind: "arrow", sub: "REP", from: pid, to: m.from, fc: nc, tc: null });
    newLog.push({ id: uid(), pid, type: "REPLY_SENT",
      desc: `Site ${pid} (rétabli) envoie REPLY → Site ${m.from}`, clock: nc });
    return { ...m, done: true };
  });

  return {
    ...st,
    procs,
    msgs: [...updMsgs, ...newMsgs],
    dia: [...st.dia, ...newDia],
    log: [...st.log, ...newLog],
    step: st.step + 1,
  };
}

// ─── Space-Time Diagram ───────────────────────────────────────────────────────
interface DiagramProps {
  procs: Process[];
  dia: DiagramItem[];
}

function Diagram({ procs, dia }: DiagramProps) {
  const W = 700;
  const H = 270;
  const LEFT = 68;
  const RIGHT = W - 24;
  const LW = RIGHT - LEFT;
  const siteY = [H - 38, H / 2, 36];

  const clocks = new Set<number>([0]);
  procs.forEach((p) => clocks.add(p.clock));
  dia.forEach((d) => {
    if (d.fc != null) clocks.add(d.fc);
    if (d.tc != null) clocks.add(d.tc);
    if (d.clock != null) clocks.add(d.clock);
  });
  const maxC = Math.max(8, ...Array.from(clocks));
  const xOf = (c: number) => LEFT + (c / maxC) * LW;

  const isArrowDone = (d: DiagramItem): d is DiagramItem & { kind: "arrow"; sub: MsgType; from: number; to: number; fc: number; tc: number } =>
    d.kind === "arrow" && d.fc != null && d.tc != null && typeof d.from === "number" && typeof d.to === "number" && (d.sub === "REQ" || d.sub === "REP");
  const isArrowInFlight = (d: DiagramItem): d is DiagramItem & { kind: "arrow"; sub: MsgType; from: number; to: number; fc: number; tc: null } =>
    d.kind === "arrow" && d.fc != null && d.tc === null && typeof d.from === "number" && typeof d.to === "number" && (d.sub === "REQ" || d.sub === "REP");

  // Build CS segments from cs_start / cs_end markers
  const csSegs: Array<{ pid: number; s: number; e: number | null; done: boolean }> = [];
  const starts: Record<number, number | null> = {};
  dia.forEach((d) => {
    if (d.kind === "cs_start" && typeof d.pid === "number") starts[d.pid] = d.clock ?? null;
    if (d.kind === "cs_end" && typeof d.pid === "number" && starts[d.pid] != null) {
      csSegs.push({ pid: d.pid, s: starts[d.pid] as number, e: d.clock ?? null, done: true });
      delete starts[d.pid];
    }
  });
  procs.forEach((p) => {
    if (p.state === "IN_CS" && starts[p.id] != null) {
      csSegs.push({ pid: p.id, s: starts[p.id] as number, e: null, done: false });
    }
  });

  const arrows   = dia.filter(isArrowDone);
  const inflight = dia.filter(isArrowInFlight);

  // Dot clocks per process
  const dotMap: Record<number, Set<number>> = { 0: new Set<number>(), 1: new Set<number>(), 2: new Set<number>() };
  dia.forEach((d) => {
    if (d.kind === "arrow") {
      if (d.fc != null && typeof d.from === "number") dotMap[d.from].add(d.fc);
      if (d.tc != null && typeof d.to === "number") dotMap[d.to].add(d.tc);
    }
    if ((d.kind === "cs_start" || d.kind === "cs_end") && typeof d.pid === "number" && d.clock != null)
      dotMap[d.pid].add(d.clock);
  });
  procs.forEach(p => { if (p.clock>0) dotMap[p.id].add(p.clock); });

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}
      style={{ display:"block", fontFamily:"monospace", overflow:"visible" }}>
      <defs>
        {[["aR","#60a5fa"],["aA","#34d399"],["aG","#334155"]].map(([id,c])=>(
          <marker key={id} id={id} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L7,3.5 z" fill={c}/>
          </marker>
        ))}
      </defs>

      {/* vertical grid */}
      {Array.from({length:maxC+1},(_,c)=>(
        <line key={c} x1={xOf(c)} y1={28} x2={xOf(c)} y2={H-12}
          stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="2 4" opacity={0.35}/>
      ))}

      {/* timelines */}
      {[0,1,2].map(pid => {
        const y=siteY[pid], col=procs[pid].failed?"#f87171":COLORS[pid];
        return (
          <g key={pid}>
            <text x={2} y={y+4} fontSize={9} fill={col} fontWeight="700">{NAMES[pid]}</text>
            <line x1={LEFT} y1={y} x2={RIGHT} y2={y} stroke={col} strokeWidth={1.5} opacity={0.55}/>
            <polygon points={`${RIGHT},${y-4} ${RIGHT+9},${y} ${RIGHT},${y+4}`} fill={col} opacity={0.55}/>
          </g>
        );
      })}

      {/* CS bars */}
      {csSegs.map((seg,i) => {
        const y=siteY[seg.pid], x1=xOf(seg.s);
        const x2 = seg.done && seg.e != null ? xOf(seg.e) : x1+36;
        const w  = Math.max(x2-x1, 14);
        return (
          <g key={i}>
            <rect x={x1} y={y-6} width={w} height={12} fill="#ef4444" rx={2} opacity={seg.done?0.92:0.7}>
              {!seg.done && <animate attributeName="opacity" values="0.4;0.88;0.4" dur="1s" repeatCount="indefinite"/>}
            </rect>
            {!seg.done && <text x={x1+w+3} y={y+4} fontSize={8} fill="#ef4444" fontWeight="800">SC</text>}
          </g>
        );
      })}

      {/* in-flight arrows */}
      {inflight.map(d => {
        const fy=siteY[d.from], ty=siteY[d.to], fx=xOf(d.fc);
        const tx=fx+(RIGHT-fx)*0.55;
        return (
          <line key={d.id} x1={fx} y1={fy} x2={tx} y2={ty}
            stroke="#64748b" strokeWidth={1} strokeDasharray="5 3"
            markerEnd="url(#aG)" opacity={0.45}/>
        );
      })}

      {/* completed arrows */}
      {arrows.map(d => {
        const fy=siteY[d.from], ty=siteY[d.to];
        const fx=xOf(d.fc), tx=xOf(d.tc);
        const isReq=d.sub==="REQ", col=isReq?"#60a5fa":"#34d399";
        const mx=(fx+tx)/2, my=(fy+ty)/2;
        const dx=tx-fx, dy2=ty-fy, len=Math.sqrt(dx*dx+dy2*dy2)||1;
        const nx=-dy2/len, ny=dx/len, off=11;
        const lbl=isReq?`(R,${d.fc})`:`(A,${d.fc})`;
        return (
          <g key={d.id}>
            <line x1={fx} y1={fy} x2={tx} y2={ty}
              stroke={col} strokeWidth={1.6}
              markerEnd={isReq?"url(#aR)":"url(#aA)"}/>
            <text x={mx+nx*off} y={my+ny*off+4}
              fontSize={8} fill={col} textAnchor="middle" fontWeight="700">{lbl}</text>
          </g>
        );
      })}

      {/* clock dots */}
      {[0,1,2].map(pid => {
        const y=siteY[pid], col=procs[pid].failed?"#f87171":COLORS[pid];
        return [...dotMap[pid]].map(clk => {
          const x=xOf(clk);
          return (
            <g key={`${pid}-${clk}`}>
              <circle cx={x} cy={y} r={9} fill="#ffffff" stroke={col} strokeWidth={1.5}/>
              <text x={x} y={y+4} fontSize={8} fill={col} textAnchor="middle" fontWeight="700">{clk}</text>
            </g>
          );
        });
      })}

      {/* legend */}
      <g transform={`translate(${LEFT},${H-6})`} fontSize={7}>
        <line x1={0} y1={0} x2={22} y2={0} stroke="#60a5fa" strokeWidth={1.5} markerEnd="url(#aR)"/>
        <text x={26} y={4} fill="#60a5fa">REQUEST (R,ts)</text>
        <line x1={100} y1={0} x2={122} y2={0} stroke="#34d399" strokeWidth={1.5} markerEnd="url(#aA)"/>
        <text x={126} y={4} fill="#34d399">REPLY (A,ts)</text>
        <rect x={200} y={-5} width={18} height={10} fill="#ef4444" rx={1}/>
        <text x={222} y={4} fill="#ef4444">Section Critique</text>
      </g>
    </svg>
  );
}

// ─── Process Card ─────────────────────────────────────────────────────────────
interface ProcCardProps {
  proc: Process;
  needed: number;
  onRequest: () => void;
  onExit: () => void;
  onFail: () => void;
  onRecover: () => void;
}

function ProcCard({ proc, needed, onRequest, onExit, onFail, onRecover }: ProcCardProps) {
  const col = proc.failed ? "#f87171" : COLORS[proc.id];
  const sCol = STATE_COLOR[proc.state];

  return (
    <div style={{
      background:"#ffffff", border:`1.5px solid ${col}33`,
      borderLeft:`3px solid ${col}`, borderRadius:12,
      padding:"14px 16px", width:165, boxSizing:"border-box",
      boxShadow: proc.state==="IN_CS" ? `0 0 20px ${col}22` : "none",
    }}>
      {/* header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <div style={{
          width:30, height:30, borderRadius:"50%",
          background:`${col}1a`, border:`1.5px solid ${col}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:11, fontWeight:800, color:col, fontFamily:"monospace",
        }}>
          {proc.failed?"✕":`P${proc.id}`}
        </div>
        <div>
          <div style={{ color:"#0f172a", fontWeight:700, fontSize:12 }}>{NAMES[proc.id]}</div>
          <div style={{ fontSize:9, color:sCol, fontWeight:700 }}>{STATE_LABEL[proc.state]}</div>
        </div>
      </div>

      {/* clock */}
      <div style={{ display:"flex", gap:6, marginBottom:8 }}>
        <div style={{ flex:1, textAlign:"center", background:"#f8fafc", borderRadius:6, padding:"5px 2px", border:"1px solid #e2e8f0" }}>
          <div style={{ fontSize:8, color:"#64748b" }}>HORLOGE</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#0f172a", fontFamily:"monospace" }}>{proc.clock}</div>
        </div>
        {proc.state==="WANTING" && (
          <div style={{ flex:1, textAlign:"center", background:"#f8fafc", borderRadius:6, padding:"5px 2px", border:"1px solid #e2e8f0" }}>
            <div style={{ fontSize:8, color:"#64748b" }}>REPLY</div>
            <div style={{ fontSize:20, fontWeight:800, color:"#34d399", fontFamily:"monospace" }}>
              {proc.replies.length}/{needed}
            </div>
          </div>
        )}
      </div>

      {/* progress */}
      {proc.state==="WANTING" && needed>0 && (
        <div style={{ background:"#e2e8f0", borderRadius:3, height:4, marginBottom:8, overflow:"hidden" }}>
          <div style={{
            width:`${(proc.replies.length/needed)*100}%`,
            height:"100%", background:"linear-gradient(90deg,#f59e0b,#34d399)",
            borderRadius:3, transition:"width 0.3s",
          }}/>
        </div>
      )}

      {/* deferred */}
      {proc.deferred.length>0 && (
        <div style={{ fontSize:9, color:"#92400e", background:"#fef3c7", borderRadius:5,
          padding:"3px 6px", marginBottom:8, border:"1px solid #fde68a" }}>
          ⏳ Différées: {proc.deferred.map(id=>`P${id}`).join(", ")}
        </div>
      )}

      {/* BUTTONS — plain flow, no absolute overlay, no overflow:hidden on parent */}
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {!proc.failed && proc.state==="IDLE" && (
          <button onClick={onRequest} style={btnStyle(col)}>📤 Demander SC</button>
        )}
        {!proc.failed && proc.state==="IN_CS" && (
          <button onClick={onExit} style={btnStyle("#ef4444")}>🔓 Quitter SC</button>
        )}
        {!proc.failed && proc.state==="WANTING" && (
          <div style={{ fontSize:9, color:"#f59e0b", padding:"3px 0" }}>⏳ En attente…</div>
        )}
        {!proc.failed
          ? <button onClick={onFail}    style={btnStyle("#f87171",true)}>💥 Panne</button>
          : <button onClick={onRecover} style={btnStyle("#34d399")}     >↺ Rétablir</button>
        }
      </div>
    </div>
  );
}

function btnStyle(color: string, outline = false): React.CSSProperties {
  return {
    background: outline ? "transparent" : `${color}12`,
    border: `1px solid ${color}33`, borderRadius: 7,
    color, padding: "6px 10px", fontSize: 10,
    cursor: "pointer", width: "100%", textAlign: "left",
    fontFamily: "inherit", fontWeight: 700,
  };
}

interface MsgRowProps {
  msg: Msg;
  onDeliver: () => void;
}

// ─── Message row ──────────────────────────────────────────────────────────────
function MsgRow({ msg, onDeliver }: MsgRowProps) {
  const isReq = msg.type==="REQ";
  return (
    <div onClick={onDeliver} style={{
      display:"flex", alignItems:"center", gap:8,
      background:"#ffffff", border:`1px solid ${isReq?"#bfdbfe":"#bfdbfe"}`,
      borderRadius:8, padding:"7px 10px", cursor:"pointer",
      marginBottom:6, fontSize:10, color:"#0f172a",
    }}>
      <span style={{ color:isReq?"#60a5fa":"#34d399", fontWeight:800, minWidth:36, fontFamily:"monospace" }}>
        {isReq?"REQ":"REP"}
      </span>
      <span style={{ color:"#64748b" }}>{NAMES[msg.from]} → {NAMES[msg.to]}</span>
      <span style={{ color:"#475569", fontFamily:"monospace" }}>ts:{msg.clock}</span>
      <span style={{
        marginLeft:"auto", background:isReq?"#dbeafe":"#dbeafe",
        color:isReq?"#60a5fa":"#34d399", borderRadius:4,
        padding:"2px 8px", fontSize:9, fontWeight:800,
      }}>DÉLIVRER</span>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [st, setSt] = useState<AppState>(initState);
  const [auto, setAuto] = useState(false);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEnd = useRef<HTMLDivElement | null>(null);

  const pending = st.msgs.filter((m) => !m.done);
  const active  = st.procs.filter(p => !p.failed);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [st.log.length]);

  useEffect(() => {
    if (auto) {
      autoRef.current = setInterval(() => {
        setSt((s) => {
          const m = s.msgs.find((m) => !m.done);
          return m ? doDeliver(s, m.id) : s;
        });
      }, 1100);
    } else {
      if (autoRef.current !== null) clearInterval(autoRef.current);
    }
    return () => {
      if (autoRef.current !== null) clearInterval(autoRef.current);
    };
  }, [auto]);

  const run = useCallback(<T extends unknown[]>(fn: (state: AppState, ...args: T) => AppState, ...args: T) => setSt((s) => fn(s, ...args)), []);

  return (
    <div style={{
      minHeight:"100vh", background:"#f8fafc", color:"#0f172a",
      fontFamily:"'Segoe UI',system-ui,sans-serif", padding:"20px 14px 56px",
    }}>
      <style>{`button:hover{filter:brightness(1.18)} ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}`}</style>

      {/* Title */}
      <div style={{ textAlign:"center", marginBottom:22 }}>
        <div style={{ fontSize:9, color:"#64748b", letterSpacing:4, textTransform:"uppercase", marginBottom:4 }}>
          Exclusion Mutuelle Distribuée
        </div>
        <h1 style={{ fontSize:21, fontWeight:900, margin:0,
          background:"linear-gradient(90deg,#60a5fa,#f472b6,#34d399)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          Ricart–Agrawala · Diagramme Espace-Temps
        </h1>
        <p style={{ color:"#475569", fontSize:11, margin:"4px 0 0" }}>
          3 sites · Horloges de Lamport · Simulation interactive
        </p>
      </div>

      {/* Cards */}
      <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", marginBottom:18 }}>
        {st.procs.map(p => (
          <ProcCard key={p.id} proc={p}
            needed={Math.max(0, active.filter(a => a.id!==p.id).length)}
            onRequest={() => run(doRequest, p.id)}
            onExit    ={() => run(doExit,   p.id)}
            onFail    ={() => run(doFail,   p.id)}
            onRecover ={() => run(doRecover,p.id)}
          />
        ))}
      </div>

      {/* Diagram */}
      <div style={{ background:"#ffffff", border:"1px solid #e2e8f0",
        borderRadius:14, padding:"14px 10px 8px",
        maxWidth:740, margin:"0 auto 14px" }}>
        <div style={{ fontSize:9, color:"#60a5fa", letterSpacing:3,
          textTransform:"uppercase", marginBottom:10 }}>
          📊 Diagramme Espace-Temps
        </div>
        <Diagram procs={st.procs} dia={st.dia}/>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div style={{ background:"#ffffff", border:"1px solid #e2e8f0",
          borderRadius:14, padding:14, maxWidth:740, margin:"0 auto 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ fontSize:9, color:"#f472b6", letterSpacing:2, textTransform:"uppercase" }}>
              📨 Messages en Transit ({pending.length})
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ fontSize:10, color:"#334155" }}>Auto-livraison</span>
              <div onClick={()=>setAuto(v=>!v)} style={{
                width:34, height:18, borderRadius:9,
                background:auto?"#60a5fa":"#e2e8f0",
                cursor:"pointer", position:"relative", transition:"background 0.2s",
              }}>
                <div style={{
                  position:"absolute", top:2, left:auto?18:2,
                  width:14, height:14, borderRadius:"50%",
                  background:"#fff", transition:"left 0.2s",
                }}/>
              </div>
            </div>
          </div>
          {pending.map(m => (
            <MsgRow key={m.id} msg={m} onDeliver={()=>run(doDeliver,m.id)}/>
          ))}
        </div>
      )}

      {/* Log */}
      <div style={{ background:"#ffffff", border:"1px solid #e2e8f0",
        borderRadius:14, padding:14, maxWidth:740, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:9, color:"#64748b", letterSpacing:2, textTransform:"uppercase" }}>
            📋 Journal (Étape {st.step})
          </div>
          <button onClick={()=>{ setSt(initState()); setAuto(false); }}
            style={{ ...btnStyle("#f87171",true), width:"auto", padding:"4px 12px", fontSize:10 }}>
            🔄 Reset
          </button>
        </div>
        {st.log.length===0 ? (
          <div style={{ textAlign:"center", padding:"20px 0", color:"#64748b", fontSize:11 }}>
            Aucun événement — cliquez "Demander SC" pour démarrer
          </div>
        ) : (
          <div style={{ maxHeight:200, overflowY:"auto", display:"flex", flexDirection:"column", gap:2 }}>
            {st.log.map((e,i)=>(
              <div key={e.id} style={{
                display:"flex", alignItems:"center", gap:8,
                padding:"4px 8px", borderRadius:5, fontSize:10,
                background:i===st.log.length-1?`${COLORS[e.pid]}0a`:"transparent",
                borderLeft:`2px solid ${COLORS[e.pid]||"#475569"}`,
              }}>
                <span style={{ color:"#64748b", fontSize:9, minWidth:22, fontFamily:"monospace" }}>
                  #{String(i+1).padStart(2,"0")}
                </span>
                <span style={{ fontSize:11 }}>{EVT_ICON[e.type]}</span>
                <span style={{ color:COLORS[e.pid], fontWeight:700, minWidth:20, fontSize:9 }}>P{e.pid}</span>
                <span style={{ color:"#94a3b8", flex:1, lineHeight:1.4 }}>{e.desc}</span>
                <span style={{ color:"#1e293b", fontSize:8, fontFamily:"monospace" }}>clk:{e.clock}</span>
              </div>
            ))}
            <div ref={logEnd}/>
          </div>
        )}
      </div>

      {/* Algo reminder */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",
        gap:8, maxWidth:740, margin:"12px auto 0" }}>
        {[
          { n:"1", t:"REQUEST",    c:"#60a5fa", d:"Envoie REQUEST(ts,i) à tous les autres sites." },
          { n:"2", t:"Priorité",   c:"#f472b6", d:"Répond immédiatement sauf si en SC ou demande plus prioritaire." },
          { n:"3", t:"→ SC",       c:"#34d399", d:"Toutes les REPLY reçues → entre en section critique." },
          { n:"4", t:"Libération", c:"#fb923c", d:"Quitte SC → envoie les REPLY différées." },
        ].map(({n,t,c,d})=>(
          <div key={n} style={{ background:"#ffffff", border:`1px solid #e2e8f0`,
            borderLeft:`2px solid ${c}`, borderRadius:8, padding:"10px 12px" }}>
            <div style={{ color:c, fontSize:10, fontWeight:800, marginBottom:4 }}>{n}. {t}</div>
            <div style={{ color:"#475569", fontSize:9, lineHeight:1.5 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}