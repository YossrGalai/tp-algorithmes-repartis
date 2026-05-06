import React, { useRef, useEffect } from 'react';
import type { Process, Message } from './types.ts';
import './styles.css';

interface ProcessGraphProps {
  processes: Process[];
  messages: Message[];
  currentLeader: number | null;
}

export const ProcessGraph: React.FC<ProcessGraphProps> = ({ processes, messages, currentLeader }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dimensionen
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 120;

    // Nettoyer le canvas
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);

    // Dessiner les processus en cercle
    processes.forEach((process, index) => {
      const angle = (index / processes.length) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      // Couleur selon l'état
      let color = '#4CAF50'; // IDLE - vert
      if (process.isFailed) {
        color = '#f44336'; // FAILED - rouge
      } else if (process.isCoordinator) {
        color = '#FFD700'; // COORDINATOR - or
      } else if (process.state === 'ELECTION_IN_PROGRESS') {
        color = '#FF9800'; // ELECTION_IN_PROGRESS - orange
      }

      // Dessiner le nœud
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Texte (ID du processus)
      ctx.fillStyle = '#000';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(process.id.toString(), x, y);

      // Label du coordinator
      if (process.isCoordinator) {
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.fillText('(L)', x, y + 18);
      }
    });

    // Dessiner les messages avec des flèches animées
    const animationTime = Date.now() % 2000; // 2 secondes de cycle
    const progress = animationTime / 2000;

    messages.slice(-10).forEach((message, _msgIndex) => {
      const fromProcess = processes[message.from];
      const toProcess = processes[message.to];

      if (!fromProcess || !toProcess) return;

      const fromAngle = (message.from / processes.length) * Math.PI * 2 - Math.PI / 2;
      const toAngle = (message.to / processes.length) * Math.PI * 2 - Math.PI / 2;

      const fromX = centerX + Math.cos(fromAngle) * radius;
      const fromY = centerY + Math.sin(fromAngle) * radius;
      const toX = centerX + Math.cos(toAngle) * radius;
      const toY = centerY + Math.sin(toAngle) * radius;

      // Position intermédiaire de la flèche (animation)
      const currentX = fromX + (toX - fromX) * progress;
      const currentY = fromY + (toY - fromY) * progress;

      // Couleur selon le type de message
      let msgColor = '#2196F3'; // ELECTION - bleu
      if (message.type === 'OK') {
        msgColor = '#9C27B0'; // OK - violet
      } else if (message.type === 'ELECTED') {
        msgColor = '#4CAF50'; // ELECTED - vert
      }

      // Dessiner la flèche
      ctx.strokeStyle = msgColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Flèche animée
      ctx.fillStyle = msgColor;
      ctx.beginPath();
      ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Label du message
      const labelX = fromX + (toX - fromX) * 0.5;
      const labelY = fromY + (toY - fromY) * 0.5 - 15;
      ctx.fillStyle = msgColor;
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(message.type, labelX, labelY);
    });

    // Légende
    const legendX = 10;
    let legendY = 10;
    const legendLineHeight = 20;

    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.fillText('Légende:', legendX, legendY);

    const legendItems = [
      { color: '#4CAF50', label: 'IDLE' },
      { color: '#FF9800', label: 'Élection' },
      { color: '#FFD700', label: 'Coordinateur' },
      { color: '#f44336', label: 'En panne' },
    ];

    legendY += legendLineHeight;
    legendItems.forEach((item) => {
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, legendY - 8, 12, 12);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, legendY - 8, 12, 12);

      ctx.fillStyle = '#333';
      ctx.font = '11px Arial';
      ctx.fillText(item.label, legendX + 20, legendY);
      legendY += legendLineHeight;
    });
  }, [processes, messages, currentLeader]);

  return (
    <div className="process-graph-container">
      <h3>Visualisation des Processus</h3>
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        className="process-graph-canvas"
      />
    </div>
  );
};
