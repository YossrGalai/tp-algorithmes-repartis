// components/RingVisualization.tsx

import { useEffect, useRef, useState } from 'react';
import type { Process } from '../types/tokenRing';

interface RingVisualizationProps {
  processes: Process[];
  currentTokenHolder: number;
  animatingArc: { from: number; to: number } | null;
}

// Positions fixes des 3 nœuds (triangle)
const POSITIONS = [
  { cx: 340, cy: 72 },   // P0 — haut-centre
  { cx: 530, cy: 200 },  // P1 — bas-droite
  { cx: 150, cy: 200 },  // P2 — bas-gauche
];

const NODE_R = 40;
const CENTER = { x: 340, y: 157 }; // centre du triangle

// ── Geometry helpers ──────────────────────────────────────────────────────

/** Point sur le bord du cercle `from` en direction de `to` */
function edgePoint(fromIdx: number, toIdx: number, r: number) {
  const from = POSITIONS[fromIdx];
  const to   = POSITIONS[toIdx];
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const dist = Math.hypot(dx, dy);
  return {
    x: from.cx + (dx / dist) * (r + 3),
    y: from.cy + (dy / dist) * (r + 3),
  };
}

/** Contrôle de Bézier quadratique : milieu du segment poussé vers l'extérieur du triangle */
function controlPoint(fromIdx: number, toIdx: number) {
  const from = POSITIONS[fromIdx];
  const to   = POSITIONS[toIdx];
  const mx = (from.cx + to.cx) / 2;
  const my = (from.cy + to.cy) / 2;
  // Vecteur du centre vers le milieu, amplifié vers l'extérieur
  const factor = 0.5;
  return {
    x: mx + (mx - CENTER.x) * factor,
    y: my + (my - CENTER.y) * factor,
  };
}

/** Chemin SVG d'un arc */
function arcPath(fromIdx: number, toIdx: number): string {
  const s = edgePoint(fromIdx, toIdx, NODE_R);
  const e = edgePoint(toIdx, fromIdx, NODE_R);
  const c = controlPoint(fromIdx, toIdx);
  return `M ${s.x} ${s.y} Q ${c.x} ${c.y} ${e.x} ${e.y}`;
}

/** Point sur la courbe de Bézier quadratique à t ∈ [0,1] */
function bezierPoint(fromIdx: number, toIdx: number, t: number) {
  const s = edgePoint(fromIdx, toIdx, NODE_R);
  const e = edgePoint(toIdx, fromIdx, NODE_R);
  const c = controlPoint(fromIdx, toIdx);
  return {
    x: (1 - t) ** 2 * s.x + 2 * (1 - t) * t * c.x + t ** 2 * e.x,
    y: (1 - t) ** 2 * s.y + 2 * (1 - t) * t * c.y + t ** 2 * e.y,
  };
}

// ── Couleurs par état ─────────────────────────────────────────────────────
const STATE_COLORS: Record<string, { fill: string; stroke: string; label: string; labelColor: string }> = {
  idle:     { fill: '#F8FAFC', stroke: '#CBD5E1', label: 'inactif',   labelColor: '#94A3B8' },
  waiting:  { fill: '#FFFBEB', stroke: '#F59E0B', label: 'en attente', labelColor: '#92400E' },
  critical: { fill: '#FEF2F2', stroke: '#EF4444', label: 'SC 🔒',      labelColor: '#991B1B' },
  done:     { fill: '#F0FDF4', stroke: '#22C55E', label: 'terminé',   labelColor: '#166534' },
};

const ARCS: [number, number][] = [[0, 1], [1, 2], [2, 0]];

// ── Composant ─────────────────────────────────────────────────────────────
export default function RingVisualization({
  processes,
  animatingArc,
}: RingVisualizationProps) {
  const [dotT, setDotT] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTs = useRef<number>(0);

  const DURATION = 800; // ms

  useEffect(() => {
    if (!animatingArc) {
      return;
    }

    // Annule toute animation en cours
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    startTs.current = performance.now();

    function frame(now: number) {
      const elapsed = now - startTs.current;
      const t = Math.min(elapsed / DURATION, 1);
      setDotT(t);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      }
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animatingArc]);

  const dotPos = animatingArc ? bezierPoint(animatingArc.from, animatingArc.to, dotT) : null;

  return (
    <svg
      width="100%"
      viewBox="0 0 680 280"
      role="img"
      aria-label="Anneau de 3 processus Token Ring"
      style={{ display: 'block' }}
    >
      <defs>
        {/* Flèche pour les arcs */}
        <marker
          id="tr-arrowhead"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path
            d="M1 2 L8 5 L1 8"
            fill="none"
            stroke="context-stroke"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>

        {/* Filtre glow pour le jeton animé */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Filtre glow rouge pour SC */}
        <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Arcs de circulation ── */}
      {ARCS.map(([f, t]) => {
        const key = `${f}-${t}`;
        const isActive = animatingArc ? animatingArc.from === f && animatingArc.to === t : false;
        return (
          <path
            key={key}
            d={arcPath(f, t)}
            fill="none"
            stroke={isActive ? '#3B82F6' : '#CBD5E1'}
            strokeWidth={isActive ? 2.5 : 1.5}
            markerEnd="url(#tr-arrowhead)"
            style={{ transition: 'stroke 0.25s, stroke-width 0.25s' }}
          />
        );
      })}

      {/* ── Point animé du jeton ── */}
      {dotPos && (
        <circle
          cx={dotPos.x}
          cy={dotPos.y}
          r={10}
          fill="#3B82F6"
          filter="url(#glow)"
          opacity={1 - dotT * 0.3}
        />
      )}

      {/* ── Nœuds processus ── */}
      {processes.map((p) => {
        const pos   = POSITIONS[p.id];
        const style = STATE_COLORS[p.state] ?? STATE_COLORS.idle;
        const isCS  = p.state === 'critical';

        return (
          <g key={p.id}>
            {/* Halo pulsant si détenteur du jeton */}
            {p.hasToken && (
              <>
                <circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={NODE_R + 14}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="1"
                  strokeDasharray="5 4"
                  opacity="0.4"
                />
                <circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={NODE_R + 22}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="0.5"
                  strokeDasharray="3 6"
                  opacity="0.2"
                />
              </>
            )}

            {/* Halo rouge si en SC */}
            {isCS && (
              <circle
                cx={pos.cx}
                cy={pos.cy}
                r={NODE_R + 10}
                fill="#FEF2F2"
                stroke="#EF4444"
                strokeWidth="1"
                opacity="0.4"
                filter="url(#glow-red)"
              />
            )}

            {/* Cercle principal */}
            <circle
              cx={pos.cx}
              cy={pos.cy}
              r={NODE_R}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={isCS ? 2.5 : 1.5}
              style={{ transition: 'fill 0.35s, stroke 0.35s, stroke-width 0.2s' }}
            />

            {/* Label Px */}
            <text
              x={pos.cx}
              y={pos.cy - 9}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="16"
              fontWeight="600"
              fill="#1E293B"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              P{p.id}
            </text>

            {/* État */}
            <text
              x={pos.cx}
              y={pos.cy + 12}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="10"
              fill={style.labelColor}
              style={{ transition: 'fill 0.35s', fontFamily: 'system-ui, sans-serif' }}
            >
              {style.label}
            </text>

            {/* Badge jeton (au-dessus) */}
            {p.hasToken && (
              <text
                x={pos.cx}
                y={pos.cy - NODE_R - 18}
                textAnchor="middle"
                fontSize="12"
                fill="#2563EB"
                fontWeight="500"
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                🎫 jeton
              </text>
            )}

            {/* Badge "veut accéder" (en dessous) */}
            {p.wantsAccess && p.state === 'waiting' && (
              <text
                x={pos.cx}
                y={pos.cy + NODE_R + 16}
                textAnchor="middle"
                fontSize="10"
                fill="#B45309"
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                ⏳ veut accéder
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}