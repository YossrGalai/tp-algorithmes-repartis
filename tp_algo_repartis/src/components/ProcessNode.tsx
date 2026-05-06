// components/ProcessNode.tsx

import type { Process } from '../types/tokenRing';
import '../styles/ProcessNode.css';

interface ProcessNodeProps {
  process: Process;
}

const STATE_CONFIG = {
  idle:     { label: 'Inactif',          emoji: '😴', className: 'state-idle' },
  waiting:  { label: 'En attente',       emoji: '⏳', className: 'state-waiting' },
  critical: { label: 'Section Critique', emoji: '🔒', className: 'state-critical' },
  done:     { label: 'Terminé',          emoji: '✅', className: 'state-done' },
};

export default function ProcessNode({ process: p }: ProcessNodeProps) {
  const cfg = STATE_CONFIG[p.state] ?? STATE_CONFIG.idle;

  return (
    <div className={`process-node ${cfg.className} ${p.hasToken ? 'has-token' : ''}`}>
      <div className="pn-header">
        <span className="pn-emoji">{cfg.emoji}</span>
        <span className="pn-id">P{p.id}</span>
        {p.hasToken && <span className="pn-badge token-badge">🎫 Jeton</span>}
      </div>

      <div className="pn-body">
        <div className="pn-row">
          <span className="pn-key">État</span>
          <span className={`pn-val state-badge ${cfg.className}`}>{cfg.label}</span>
        </div>
        <div className="pn-row">
          <span className="pn-key">Veut accès</span>
          <span className="pn-val">{p.wantsAccess ? '✓ Oui' : '✗ Non'}</span>
        </div>
      </div>
    </div>
  );
}