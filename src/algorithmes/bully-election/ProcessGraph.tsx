import React, { useEffect, useRef, useState } from 'react';
import type { Process, Message } from './types';

interface ProcessGraphProps {
  processes: Process[];
  messages: Message[];
  currentLeader: number | null;
  onAddProcess: () => void;
  onRemoveProcess: (id: number) => void;
}

interface AnimatedDot {
  id: string;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  progress: number;
  type: string;
  toFailed: boolean;
}

export const ProcessGraph: React.FC<ProcessGraphProps> = ({
  processes,
  messages,
  currentLeader,
  onAddProcess,
  onRemoveProcess,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animDotsRef = useRef<AnimatedDot[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastMsgCountRef = useRef<number>(0);
  const [selectedForRemove, setSelectedForRemove] = useState<number | null>(null);

  /**
   * Positions : TOUS les processus (actifs + pannes) sont placés sur le cercle.
   * On trie par ID pour garder des positions stables.
   */
  const getPositions = (
    canvas: HTMLCanvasElement,
    all: Process[],
  ): Map<number, { x: number; y: number }> => {
    const map = new Map<number, { x: number; y: number }>();
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.36;
    const sorted = [...all].sort((a, b) => a.id - b.id);
    sorted.forEach((p, i) => {
      const angle = (i / sorted.length) * Math.PI * 2 - Math.PI / 2;
      map.set(p.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    });
    return map;
  };

  // Déclencher les dots animés pour les nouveaux messages
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (messages.length <= lastMsgCountRef.current) {
      lastMsgCountRef.current = messages.length;
      return;
    }

    const newMsgs = messages.slice(lastMsgCountRef.current);
    lastMsgCountRef.current = messages.length;

    // On utilise TOUS les processus pour les positions (pannes comprises)
    const positions = getPositions(canvas, processes);

    newMsgs.forEach(msg => {
      const from = positions.get(msg.from);
      const to = positions.get(msg.to);
      if (!from || !to) return;
      animDotsRef.current.push({
        id: msg.id + '-' + Date.now(),
        fx: from.x,
        fy: from.y,
        tx: to.x,
        ty: to.y,
        progress: 0,
        type: msg.type,
        toFailed: msg.toFailed ?? false,
      });
    });
  }, [messages, processes]);

  // Boucle de dessin principale
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      if (processes.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Aucun processus', w / 2, h / 2);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const positions = getPositions(canvas, processes);
      const sorted = [...processes].sort((a, b) => a.id - b.id);

      // ── Arêtes ───────────────────────────────────────────────────────────
      // On dessine les arêtes entre actifs uniquement (lignes de communication)
      sorted.forEach((p1, i) => {
        sorted.forEach((p2, j) => {
          if (i >= j) return;
          if (p1.isFailed || p2.isFailed) return; // pas d'arête vers une panne
          const a = positions.get(p1.id)!;
          const b = positions.get(p2.id)!;
          const recent = messages
            .slice(-12)
            .some(
              m =>
                !m.toFailed &&
                ((m.from === p1.id && m.to === p2.id) ||
                  (m.from === p2.id && m.to === p1.id)),
            );
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = recent
            ? 'rgba(79,70,229,0.28)'
            : 'rgba(203,213,225,0.5)';
          ctx.lineWidth = recent ? 1.5 : 0.8;
          ctx.setLineDash(recent ? [6, 3] : []);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      });

      // ── Dots animés ──────────────────────────────────────────────────────
      animDotsRef.current = animDotsRef.current.filter(dot => {
        dot.progress = Math.min(dot.progress + 0.035, 1);
        const x = dot.fx + (dot.tx - dot.fx) * dot.progress;
        const y = dot.fy + (dot.ty - dot.fy) * dot.progress;

        let color = '#4f46e5';
        if (dot.type === 'ELECTION') color = '#f59e0b';
        if (dot.type === 'OK') color = '#10b981';
        if (dot.type === 'COORDINATOR') color = '#4f46e5';

        // Dot vers processus en panne : plus transparent, tireté
        const alpha = dot.toFailed ? 0.4 : 1;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, dot.toFailed ? 4 : 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;

        return dot.progress < 1;
      });

      // ── Nœuds ────────────────────────────────────────────────────────────
      const nodeR = 32;

      sorted.forEach(p => {
        const pos = positions.get(p.id)!;
        const isLeader = p.id === currentLeader;
        const isElec = p.state === 'ELECTION_IN_PROGRESS';
        const isSel = p.id === selectedForRemove;
        const isFailed = p.isFailed;

        // Anneau de pulsation pour le leader
        if (isLeader && !isFailed) {
          const pulse = (Date.now() / 700) % 1;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, nodeR + 5 + pulse * 5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(245,158,11,0.18)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Cercle principal
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeR, 0, Math.PI * 2);

        if (isFailed) {
          ctx.fillStyle = '#fef2f2';
        } else if (isLeader) {
          ctx.fillStyle = '#fef3c7';
        } else if (isElec) {
          ctx.fillStyle = '#eef2ff';
        } else {
          ctx.fillStyle = '#ffffff';
        }
        ctx.fill();

        ctx.strokeStyle = isFailed
          ? '#ef4444'
          : isLeader
            ? '#f59e0b'
            : isElec
              ? '#4f46e5'
              : isSel
                ? '#ef4444'
                : 'rgba(203,213,225,0.9)';
        ctx.lineWidth =
          isFailed ? 1.5 : isLeader || isSel ? 2 : isElec ? 1.5 : 1;

        // Tirets pour les processus en panne
        if (isFailed) ctx.setLineDash([5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Étiquette principale
        ctx.fillStyle = isFailed
          ? '#ef4444'
          : isLeader
            ? '#92400e'
            : isElec
              ? '#3730a3'
              : '#1e293b';
        ctx.font = `${isLeader ? '600 ' : ''}13px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const labelY =
          isLeader || isElec || isFailed ? pos.y - 5 : pos.y;
        ctx.fillText(`P${p.id}`, pos.x, labelY);

        // Sous-étiquette
        if (isFailed) {
          ctx.font = '9px ui-monospace, monospace';
          ctx.fillStyle = '#ef4444';
          ctx.fillText('PANNE', pos.x, pos.y + 8);
        } else if (isLeader) {
          ctx.font = '9px ui-monospace, monospace';
          ctx.fillStyle = '#b45309';
          ctx.fillText('COORD', pos.x, pos.y + 8);
        } else if (isElec) {
          ctx.font = '9px ui-monospace, monospace';
          ctx.fillStyle = '#4338ca';
          ctx.fillText('ELEC', pos.x, pos.y + 8);
        }

        // Point de statut (coin supérieur droit)
        if (!isFailed) {
          const dotColor = isLeader
            ? '#f59e0b'
            : isElec
              ? '#4f46e5'
              : '#10b981';
          ctx.beginPath();
          ctx.arc(pos.x + nodeR - 8, pos.y - nodeR + 8, 5, 0, Math.PI * 2);
          ctx.fillStyle = dotColor;
          ctx.fill();
        } else {
          // Croix pour les pannes
          const cx2 = pos.x + nodeR - 12;
          const cy2 = pos.y - nodeR + 12;
          ctx.beginPath();
          ctx.moveTo(cx2 - 4, cy2 - 4);
          ctx.lineTo(cx2 + 4, cy2 + 4);
          ctx.moveTo(cx2 + 4, cy2 - 4);
          ctx.lineTo(cx2 - 4, cy2 + 4);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [processes, messages, currentLeader, selectedForRemove]);

  // Clic sur le canvas → sélectionner un nœud pour le supprimer
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    const positions = getPositions(canvas, processes);

    let hit: number | null = null;
    positions.forEach((pos, id) => {
      const dx = mx - pos.x;
      const dy = my - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) <= 36) hit = id;
    });

    setSelectedForRemove(prev => (prev === hit ? null : hit));
  };

  return (
    <div className="process-graph-container">
      <div className="process-graph-header">
        <h3>Topologie des processus</h3>
        <div className="graph-actions">
          <button className="btn-graph-action btn-add" onClick={onAddProcess}>
            + Ajouter
          </button>
          {selectedForRemove !== null && (
            <button
              className="btn-graph-action btn-remove"
              onClick={() => {
                onRemoveProcess(selectedForRemove);
                setSelectedForRemove(null);
              }}
            >
              − Supprimer P{selectedForRemove}
            </button>
          )}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="process-graph-canvas"
        onClick={handleCanvasClick}
        style={{ cursor: 'pointer' }}
      />

      <div className="graph-legend">
        <span className="legend-item">
          <span className="legend-dot leader" /> Coordinateur
        </span>
        <span className="legend-item">
          <span className="legend-dot active" /> Actif
        </span>
        <span className="legend-item">
          <span className="legend-dot failed" /> En panne
        </span>
        <span className="legend-item">
          <span className="legend-dot election" /> ELECTION
        </span>
        <span className="legend-item">
          <span className="legend-dot ok" /> OK
        </span>
        <span className="legend-item">
          <span className="legend-dot coordinator" /> COORDINATOR
        </span>
      </div>
    </div>
  );
};