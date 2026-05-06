import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { AlgorithmState, ProcessNode, Message, Event } from '../types';
import {
  initializeState,
  requestCS,
  receiveRequest,
  receiveReply,
  exitCS,
  failProcess,
  recoverProcess,
  getPendingMessages,
} from '../algorithmes/ricartagrawala';

// ─── Color palette ────────────────────────────────────────────────────────────
const COLORS = {
  idle: '#64748b',
  wanting: '#f59e0b',
  inCS: '#10b981',
  failed: '#ef4444',
  bg: '#0a0e1a',
  surface: '#111827',
  border: '#1e2d45',
  text: '#e2e8f0',
  muted: '#64748b',
  request: '#f59e0b',
  reply: '#10b981',
  accent: '#6366f1',
};

const PROCESS_COLORS = ['#6366f1', '#ec4899', '#f59e0b'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const stateLabel = (state: ProcessNode['state']) =>
  ({ IDLE: 'Inactif', WANTING: 'En attente', IN_CS: 'En SC', FAILED: 'En panne' }[state]);

const stateColor = (state: ProcessNode['state']) =>
  ({ IDLE: COLORS.idle, WANTING: COLORS.wanting, IN_CS: COLORS.inCS, FAILED: COLORS.failed }[state]);

const eventIcon = (type: Event['type']) =>
  ({
    REQUEST_SENT: '📤',
    REPLY_SENT: '✉️',
    REPLY_RECEIVED: '📩',
    ENTERED_CS: '🔒',
    EXITED_CS: '🔓',
    DEFERRED: '⏳',
    FAILED: '💥',
    RECOVERED: '✅',
  }[type]);

// ─── Process Node Component ───────────────────────────────────────────────────
const ProcessCard: React.FC<{
  process: ProcessNode;
  color: string;
  onRequest: () => void;
  onExit: () => void;
  onFail: () => void;
  onRecover: () => void;
  pendingReplies: number;
  totalNeeded: number;
}> = ({ process, color, onRequest, onExit, onFail, onRecover, totalNeeded }) => {
  const isActive = process.state !== 'FAILED';

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `2px solid ${process.state === 'IN_CS' ? COLORS.inCS : process.state === 'FAILED' ? COLORS.failed : color}`,
        borderRadius: 16,
        padding: 20,
        width: 220,
        position: 'relative',
        boxShadow: process.state === 'IN_CS'
          ? `0 0 30px ${COLORS.inCS}44`
          : process.state === 'FAILED'
          ? `0 0 20px ${COLORS.failed}33`
          : `0 0 15px ${color}22`,
        transition: 'all 0.4s ease',
        opacity: process.failed ? 0.6 : 1,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: process.failed ? COLORS.failed : color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 700,
            color: '#fff',
            boxShadow: `0 0 12px ${process.failed ? COLORS.failed : color}88`,
            animation: process.state === 'IN_CS' ? 'pulse 1.5s infinite' : 'none',
          }}
        >
          {process.failed ? '✕' : `P${process.id}`}
        </div>
        <div>
          <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15 }}>
            Processus {process.id}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: stateColor(process.state),
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {stateLabel(process.state)}
          </div>
        </div>
      </div>

      {/* Clock */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: COLORS.muted, fontSize: 10, marginBottom: 2 }}>HORLOGE</div>
          <div
            style={{
              color: color,
              fontSize: 22,
              fontWeight: 800,
              fontFamily: 'monospace',
            }}
          >
            {process.clock}
          </div>
        </div>
        {process.requestClock !== null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: COLORS.muted, fontSize: 10, marginBottom: 2 }}>REQ CLOCK</div>
            <div style={{ color: COLORS.wanting, fontSize: 22, fontWeight: 800, fontFamily: 'monospace' }}>
              {process.requestClock}
            </div>
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: COLORS.muted, fontSize: 10, marginBottom: 2 }}>RÉPONSES</div>
          <div style={{ color: COLORS.reply, fontSize: 22, fontWeight: 800, fontFamily: 'monospace' }}>
            {process.repliesReceived.length}/{totalNeeded}
          </div>
        </div>
      </div>

      {/* Deferred replies */}
      {process.deferredReplies.length > 0 && (
        <div
          style={{
            background: '#1a1000',
            border: `1px solid ${COLORS.wanting}44`,
            borderRadius: 8,
            padding: '6px 10px',
            marginBottom: 12,
            fontSize: 12,
            color: COLORS.wanting,
          }}
        >
          ⏳ Différées: {process.deferredReplies.map((id) => `P${id}`).join(', ')}
        </div>
      )}

      {/* Progress bar for WANTING */}
      {process.state === 'WANTING' && (
        <div
          style={{
            background: '#1e2d45',
            borderRadius: 4,
            height: 6,
            marginBottom: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${(process.repliesReceived.length / Math.max(totalNeeded, 1)) * 100}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${COLORS.wanting}, ${COLORS.reply})`,
              borderRadius: 4,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isActive && process.state === 'IDLE' && (
          <button onClick={onRequest} style={btnStyle(color)}>
            📤 Demander SC
          </button>
        )}
        {isActive && process.state === 'IN_CS' && (
          <button onClick={onExit} style={btnStyle(COLORS.inCS)}>
            🔓 Quitter SC
          </button>
        )}
        {isActive ? (
          <button onClick={onFail} style={btnStyle(COLORS.failed, true)}>
            💥 Simuler panne
          </button>
        ) : (
          <button onClick={onRecover} style={btnStyle(COLORS.inCS)}>
            ✅ Rétablir
          </button>
        )}
      </div>
    </div>
  );
};

const btnStyle = (color: string, outline = false): React.CSSProperties => ({
  background: outline ? 'transparent' : `${color}22`,
  border: `1px solid ${color}66`,
  borderRadius: 8,
  color: color,
  padding: '7px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
  width: '100%',
  textAlign: 'left',
});

// ─── Message Arrow Component ──────────────────────────────────────────────────
const MessageBubble: React.FC<{
  message: Message;
  onDeliver: () => void;
}> = ({ message, onDeliver }) => {
  if (message.status === 'delivered') return null;

  const isRequest = message.type === 'REQUEST';
  return (
    <div
      onClick={onDeliver}
      style={{
        background: isRequest ? '#1a1000' : '#001a0a',
        border: `1px solid ${isRequest ? COLORS.request : COLORS.reply}`,
        borderRadius: 8,
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: 12,
        color: isRequest ? COLORS.request : COLORS.reply,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.2s',
        marginBottom: 4,
      }}
    >
      <span>{isRequest ? '📤' : '✉️'}</span>
      <span style={{ flex: 1 }}>
        <strong>{message.type}</strong> P{message.from}→P{message.to}
      </span>
      <span style={{ color: COLORS.muted, fontSize: 10 }}>ts:{message.clock}</span>
      <span
        style={{
          background: isRequest ? COLORS.request : COLORS.reply,
          color: '#000',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        Délivrer
      </span>
    </div>
  );
};

// ─── Network Visualization ────────────────────────────────────────────────────
const NetworkGraph: React.FC<{
  processes: ProcessNode[];
  messages: Message[];
}> = ({ processes, messages }) => {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const r = 95;

  const positions = processes.map((_, i) => ({
    x: cx + r * Math.cos((2 * Math.PI * i) / 3 - Math.PI / 2),
    y: cy + r * Math.sin((2 * Math.PI * i) / 3 - Math.PI / 2),
  }));

  const pending = messages.filter((m) => m.status === 'sending');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <marker id="arrow-req" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={COLORS.request} />
        </marker>
        <marker id="arrow-rep" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={COLORS.reply} />
        </marker>
        {processes.map((_, i) => (
          <filter key={i} id={`glow-${i}`}>
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>

      {/* Grid lines */}
      {processes.map((_, i) =>
        processes.map((_, j) => {
          if (j <= i) return null;
          return (
            <line
              key={`line-${i}-${j}`}
              x1={positions[i].x}
              y1={positions[i].y}
              x2={positions[j].x}
              y2={positions[j].y}
              stroke={COLORS.border}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          );
        })
      )}

      {/* Pending messages as arrows */}
      {pending.map((msg) => {
        const from = positions[msg.from];
        const to = positions[msg.to];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / len;
        const ny = dy / len;
        const offset = 22;
        const isReq = msg.type === 'REQUEST';
        return (
          <g key={msg.id}>
            <line
              x1={from.x + nx * offset}
              y1={from.y + ny * offset}
              x2={to.x - nx * (offset + 6)}
              y2={to.y - ny * (offset + 6)}
              stroke={isReq ? COLORS.request : COLORS.reply}
              strokeWidth={2}
              markerEnd={isReq ? 'url(#arrow-req)' : 'url(#arrow-rep)'}
              strokeDasharray="6,3"
            >
              <animate attributeName="stroke-dashoffset" from="18" to="0" dur="0.8s" repeatCount="indefinite" />
            </line>
            <text
              x={(from.x + nx * offset + to.x - nx * (offset + 6)) / 2}
              y={(from.y + ny * offset + to.y - ny * (offset + 6)) / 2 - 6}
              fontSize={9}
              fill={isReq ? COLORS.request : COLORS.reply}
              textAnchor="middle"
              fontWeight="bold"
            >
              {msg.type}
            </text>
          </g>
        );
      })}

      {/* Process nodes */}
      {processes.map((process, i) => {
        const pos = positions[i];
        const color = process.failed ? COLORS.failed : PROCESS_COLORS[i];
        return (
          <g key={process.id}>
            {process.state === 'IN_CS' && (
              <circle cx={pos.x} cy={pos.y} r={26} fill={`${COLORS.inCS}22`}>
                <animate attributeName="r" values="22;30;22" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={22}
              fill={`${color}22`}
              stroke={color}
              strokeWidth={2.5}
              filter={`url(#glow-${i})`}
            />
            <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={800} fill={color}>
              {process.failed ? '✕' : `P${i}`}
            </text>
            <text x={pos.x} y={pos.y + 36} textAnchor="middle" fontSize={9} fill={stateColor(process.state)} fontWeight={600}>
              {stateLabel(process.state).toUpperCase()}
            </text>
            <text x={pos.x} y={pos.y + 47} textAnchor="middle" fontSize={9} fill={COLORS.muted}>
              clk:{process.clock}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const RicartAgrawalaPage: React.FC = () => {
  const [state, setState] = useState<AlgorithmState>(initializeState());
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.events.length]);

  const activeCount = state.processes.filter((p) => !p.failed).length;
  const totalNeeded = activeCount - 1;

  const handleRequest = useCallback(
    (id: number) => setState((s) => requestCS(s, id)),
    []
  );
  const handleExit = useCallback(
    (id: number) => setState((s) => exitCS(s, id)),
    []
  );
  const handleFail = useCallback(
    (id: number) => setState((s) => failProcess(s, id)),
    []
  );
  const handleRecover = useCallback(
    (id: number) => setState((s) => recoverProcess(s, id)),
    []
  );
  const handleDeliver = useCallback((msgId: string) => {
    setState((s) => {
      const msg = s.messages.find((m) => m.id === msgId);
      if (!msg) return s;
      if (msg.type === 'REQUEST') return receiveRequest(s, msgId);
      return receiveReply(s, msgId);
    });
  }, []);

  const handleReset = () => setState(initializeState());

  const pending = getPendingMessages(state);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        padding: 24,
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 12px ${COLORS.inCS}88; }
          50% { box-shadow: 0 0 30px ${COLORS.inCS}cc; }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.surface}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
        button:hover { filter: brightness(1.3); transform: translateY(-1px); }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: COLORS.accent, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8 }}>
          Algorithme d'Exclusion Mutuelle Distribuée
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            margin: 0,
            background: `linear-gradient(135deg, ${PROCESS_COLORS[0]}, ${PROCESS_COLORS[1]}, ${PROCESS_COLORS[2]})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Ricart – Agrawala
        </h1>
        <p style={{ color: COLORS.muted, margin: '8px 0 0', fontSize: 13 }}>
          3 processus · Horloges de Lamport · Exclusion mutuelle distribuée
        </p>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 20,
          marginBottom: 28,
          flexWrap: 'wrap',
        }}
      >
        {[
          { label: 'Inactif', color: COLORS.idle },
          { label: 'En attente', color: COLORS.wanting },
          { label: 'Section Critique', color: COLORS.inCS },
          { label: 'En panne', color: COLORS.failed },
          { label: 'REQUEST', color: COLORS.request },
          { label: 'REPLY', color: COLORS.reply },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ color: COLORS.muted }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap' }}>

        {/* Process cards */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          {state.processes.map((process) => (
            <ProcessCard
              key={process.id}
              process={process}
              color={PROCESS_COLORS[process.id]}
              onRequest={() => handleRequest(process.id)}
              onExit={() => handleExit(process.id)}
              onFail={() => handleFail(process.id)}
              onRecover={() => handleRecover(process.id)}
              pendingReplies={process.repliesReceived.length}
              totalNeeded={totalNeeded}
            />
          ))}
        </div>

        {/* Network Graph */}
        <div
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, color: COLORS.muted, letterSpacing: 2, textTransform: 'uppercase' }}>
            Réseau
          </div>
          <NetworkGraph processes={state.processes} messages={state.messages} />
          <div style={{ fontSize: 11, color: COLORS.muted }}>
            Messages en transit: <span style={{ color: COLORS.accent, fontWeight: 700 }}>{pending.length}</span>
          </div>
        </div>
      </div>

      {/* Message Queue */}
      {pending.length > 0 && (
        <div
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 20,
            marginTop: 20,
            maxWidth: 700,
            margin: '20px auto 0',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: COLORS.accent,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>📨</span> File de Messages en Transit
            <span
              style={{
                background: `${COLORS.accent}33`,
                color: COLORS.accent,
                borderRadius: 10,
                padding: '2px 8px',
                fontSize: 11,
              }}
            >
              {pending.length}
            </span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
            Cliquez sur un message pour le délivrer au destinataire :
          </div>
          {pending.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onDeliver={() => handleDeliver(msg.id)} />
          ))}
        </div>
      )}

      {/* Event Log */}
      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 20,
          marginTop: 20,
          maxWidth: 900,
          margin: '20px auto 0',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 11, color: COLORS.accent, letterSpacing: 2, textTransform: 'uppercase' }}>
            📋 Journal des Événements
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 12, color: COLORS.muted }}>
              Étape: <strong style={{ color: COLORS.text }}>{state.step}</strong>
            </span>
            <button
              onClick={handleReset}
              style={{
                background: 'transparent',
                border: `1px solid ${COLORS.failed}66`,
                borderRadius: 6,
                color: COLORS.failed,
                padding: '4px 12px',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              🔄 Réinitialiser
            </button>
          </div>
        </div>

        {state.events.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 0',
              color: COLORS.muted,
              fontSize: 13,
            }}
          >
            Aucun événement — Cliquez sur "Demander SC" pour commencer la simulation
          </div>
        ) : (
          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {state.events.map((evt, idx) => (
              <div
                key={evt.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: idx === state.events.length - 1 ? `${PROCESS_COLORS[evt.processId]}11` : 'transparent',
                  borderLeft: `3px solid ${PROCESS_COLORS[evt.processId] || COLORS.muted}`,
                  fontSize: 12,
                }}
              >
                <span style={{ color: COLORS.muted, fontSize: 10, minWidth: 30, fontFamily: 'monospace' }}>
                  #{idx + 1}
                </span>
                <span>{eventIcon(evt.type)}</span>
                <span
                  style={{
                    color: PROCESS_COLORS[evt.processId] || COLORS.muted,
                    fontWeight: 700,
                    minWidth: 24,
                  }}
                >
                  P{evt.processId}
                </span>
                <span style={{ color: COLORS.text, flex: 1 }}>{evt.description}</span>
                <span style={{ color: COLORS.muted, fontSize: 10, fontFamily: 'monospace' }}>
                  clk:{evt.clock}
                </span>
              </div>
            ))}
            <div ref={eventsEndRef} />
          </div>
        )}
      </div>

      {/* Algorithm explanation */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
          marginTop: 20,
          maxWidth: 900,
          margin: '20px auto 0',
        }}
      >
        {[
          {
            title: '1. Demande (REQUEST)',
            color: COLORS.request,
            content:
              'Un processus qui veut entrer en SC incrémente son horloge et envoie un message REQUEST(ts, i) à tous les autres.',
          },
          {
            title: '2. Réception & Priorité',
            color: COLORS.accent,
            content:
              'Un processus répond immédiatement sauf s\'il est en SC ou s\'il a une demande plus prioritaire (ts plus petit ou même ts avec id plus petit).',
          },
          {
            title: '3. Entrée en SC',
            color: COLORS.inCS,
            content:
              'Quand un processus reçoit toutes les réponses REPLY des processus actifs, il entre en section critique.',
          },
          {
            title: '4. Libération',
            color: COLORS.reply,
            content:
              'En quittant la SC, le processus envoie les REPLY différées, permettant aux autres d\'entrer.',
          },
        ].map(({ title, color, content }) => (
          <div
            key={title}
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderLeft: `3px solid ${color}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ color, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{title}</div>
            <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.6 }}>{content}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RicartAgrawalaPage;