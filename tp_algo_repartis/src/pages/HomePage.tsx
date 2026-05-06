import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface AlgorithmItem {
  id: string;
  path: string;
  title: string;
  category: string;
  description: string;
  color: string;
  light: string;
  border: string;
  icon: ReactNode;
  tags: string[];
}

interface AlgoCardProps {
  algo: AlgorithmItem;
  onClick: () => void;
}

const algorithms: AlgorithmItem[] = [
  {
    id: 'ricart-agrawala',
    path: '/ricart-agrawala',
    title: 'Ricart – Agrawala',
    category: 'Exclusion Mutuelle',
    description:
      'Algorithme distribué d\'exclusion mutuelle basé sur les horloges de Lamport. Chaque processus demande la permission à tous avant d\'entrer en section critique.',
    color: '#6366f1',
    light: '#eef2ff',
    border: '#c7d2fe',
    icon: (
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <circle cx="19" cy="8"  r="5" fill="#6366f1" opacity="0.9"/>
        <circle cx="7"  cy="29" r="5" fill="#6366f1" opacity="0.7"/>
        <circle cx="31" cy="29" r="5" fill="#6366f1" opacity="0.7"/>
        <line x1="19" y1="13" x2="9"  y2="25" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 2"/>
        <line x1="19" y1="13" x2="29" y2="25" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 2"/>
        <line x1="10"  y1="29" x2="26" y2="29" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 2"/>
      </svg>
    ),
    tags: ['Lamport', 'REQUEST/REPLY', '3 processus'],
  },
  {
    id: 'token-ring',
    path: '/token-ring',
    title: 'Token Ring',
    category: 'Exclusion Mutuelle',
    description:
      'Un jeton unique circule en anneau entre les processus. Seul le détenteur du jeton peut accéder à la ressource partagée.',
    color: '#0ea5e9',
    light: '#f0f9ff',
    border: '#bae6fd',
    icon: (
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <circle cx="19" cy="19" r="13" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="4 3" fill="none"/>
        <circle cx="19" cy="6"  r="4" fill="#0ea5e9"/>
        <circle cx="32" cy="19" r="4" fill="#0ea5e9" opacity="0.6"/>
        <circle cx="19" cy="32" r="4" fill="#0ea5e9" opacity="0.6"/>
        <circle cx="6"  cy="19" r="4" fill="#0ea5e9" opacity="0.6"/>
        <polygon points="21,3 17,3 19,7" fill="#fbbf24"/>
      </svg>
    ),
    tags: ['Jeton', 'Anneau', 'FIFO'],
  },
  {
    id: 'bully',
    path: '/bully',
    title: 'Bully Algorithm',
    category: 'Élection',
    description:
      'Algorithme d\'élection où le processus avec l\'identifiant le plus élevé remporte l\'élection. Un processus "bully" écrase les candidats inférieurs.',
    color: '#f59e0b',
    light: '#fffbeb',
    border: '#fde68a',
    icon: (
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <rect x="13" y="2" width="12" height="8" rx="3" fill="#f59e0b"/>
        <text x="19" y="9" textAnchor="middle" fontSize="7" fontWeight="800" fill="#fff">★</text>
        <rect x="2"  y="16" width="10" height="7" rx="2" fill="#f59e0b" opacity="0.5"/>
        <rect x="14" y="16" width="10" height="7" rx="2" fill="#f59e0b" opacity="0.5"/>
        <rect x="26" y="16" width="10" height="7" rx="2" fill="#f59e0b" opacity="0.5"/>
        <line x1="19" y1="10" x2="7"  y2="16" stroke="#f59e0b" strokeWidth="1.5"/>
        <line x1="19" y1="10" x2="19" y2="16" stroke="#f59e0b" strokeWidth="1.5"/>
        <line x1="19" y1="10" x2="31" y2="16" stroke="#f59e0b" strokeWidth="1.5"/>
        <rect x="6" y="28" width="26" height="7" rx="2" fill="#f59e0b" opacity="0.2"/>
        <text x="19" y="34" textAnchor="middle" fontSize="6" fill="#92400e" fontWeight="700">ÉLIMINÉS</text>
      </svg>
    ),
    tags: ['ID max', 'ELECTION', 'COORDINATOR'],
  },
  {
    id: 'ring-election',
    path: '/ring-election',
    title: 'Ring Election',
    category: 'Élection',
    description:
      'Élection en anneau : chaque processus transmet son ID au suivant. Le message fait le tour et le plus grand ID devient coordinateur.',
    color: '#10b981',
    light: '#f0fdf4',
    border: '#a7f3d0',
    icon: (
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <circle cx="19" cy="19" r="13" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 3" fill="none"/>
        <circle cx="19" cy="6"  r="4" fill="#10b981"/>
        <circle cx="32" cy="19" r="4" fill="#10b981" opacity="0.55"/>
        <circle cx="19" cy="32" r="4" fill="#10b981" opacity="0.55"/>
        <circle cx="6"  cy="19" r="4" fill="#10b981" opacity="0.55"/>
        <path d="M22 6 Q34 6 32 15" stroke="#10b981" strokeWidth="1.5" fill="none" markerEnd="url(#arr)"/>
        <defs>
          <marker id="arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0L0,5L5,2.5z" fill="#10b981"/>
          </marker>
        </defs>
      </svg>
    ),
    tags: ['Anneau', 'ID max', 'Un tour'],
  },
  {
    id: 'snapshots',
    path: '/snapshots',
    title: 'Chandy-Lamport',
    category: 'Instantanés',
    description:
      'Algorithme de prise d’instantané distribué qui capture un état cohérent du système sans arrêter les processus. Les marqueurs délimitent la frontière de l’instantané.',
    color: '#8b5cf6',
    light: '#f5f3ff',
    border: '#ddd6fe',
    icon: (
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <rect x="6" y="8" width="10" height="10" rx="3" fill="#8b5cf6" opacity="0.9" />
        <rect x="22" y="8" width="10" height="10" rx="3" fill="#8b5cf6" opacity="0.7" />
        <rect x="14" y="22" width="10" height="10" rx="3" fill="#8b5cf6" opacity="0.5" />
        <path d="M11 13H27" stroke="#8b5cf6" strokeWidth="1.6" strokeDasharray="3 2" />
        <path d="M19 18V22" stroke="#8b5cf6" strokeWidth="1.6" strokeDasharray="3 2" />
        <circle cx="19" cy="28" r="3" fill="#f59e0b" />
      </svg>
    ),
    tags: ['Instantané', 'Marqueurs', 'Cohérence'],
  },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 40px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 0 24px' }}>
          <div style={{
            display: 'inline-block',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 700,
            color: '#64748b',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            Systèmes Distribués
          </div>
          <h1 style={{
            fontSize: 32,
            fontWeight: 800,
            color: '#0f172a',
            margin: '0 0 10px',
            letterSpacing: -0.5,
          }}>
            Algorithmes Distribués
          </h1>
          <p style={{
            color: '#64748b',
            fontSize: 15,
            margin: 0,
            maxWidth: 520,
            lineHeight: 1.6,
          }}>
            Simulation interactive de 4 algorithmes — exclusion mutuelle et élection de coordinateur.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 40px 60px' }}>
        {/* Section: Exclusion Mutuelle */}
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
          }}>
            <div style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' }}>
              Exclusion Mutuelle
            </span>
            <div style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {algorithms.filter((a) => a.category === 'Exclusion Mutuelle').map((algo) => (
              <AlgoCard key={algo.id} algo={algo} onClick={() => navigate(algo.path)} />
            ))}
          </div>
        </div>

        {/* Section: Élection */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' }}>
              Élection de Coordinateur
            </span>
            <div style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {algorithms.filter((a) => a.category === 'Élection').map((algo) => (
              <AlgoCard key={algo.id} algo={algo} onClick={() => navigate(algo.path)} />
            ))}
          </div>
        </div>

        {/* Section: Instantanés */}
        <div style={{ marginTop: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' }}>
              Instantanés Distribués
            </span>
            <div style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            {algorithms.filter((a) => a.category === 'Instantanés').map((algo) => (
              <AlgoCard key={algo.id} algo={algo} onClick={() => navigate(algo.path)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlgoCard({ algo, onClick }: AlgoCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#fff',
        border: `1.5px solid ${algo.border}`,
        borderRadius: 14,
        padding: '24px 24px 20px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = `0 8px 24px ${algo.color}20`;
        e.currentTarget.style.borderColor = algo.color;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
        e.currentTarget.style.borderColor = algo.border;
      }}
    >
      {/* Background accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 120, height: 120,
        background: `radial-gradient(circle at top right, ${algo.light}, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Icon + category */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{
          background: algo.light,
          border: `1px solid ${algo.border}`,
          borderRadius: 10,
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {algo.icon}
        </div>
        <span style={{
          background: algo.light,
          color: algo.color,
          border: `1px solid ${algo.border}`,
          borderRadius: 20,
          padding: '3px 10px',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
        }}>
          {algo.category}
        </span>
      </div>

      {/* Title */}
      <div style={{
        fontSize: 17,
        fontWeight: 800,
        color: '#0f172a',
        marginBottom: 8,
        letterSpacing: -0.3,
      }}>
        {algo.title}
      </div>

      {/* Description */}
      <div style={{
        fontSize: 13,
        color: '#64748b',
        lineHeight: 1.6,
        marginBottom: 16,
      }}>
        {algo.description}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {algo.tags.map((tag: string) => (
          <span key={tag} style={{
            background: '#f1f5f9',
            color: '#475569',
            borderRadius: 5,
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 600,
          }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Arrow */}
      <div style={{
        position: 'absolute', bottom: 20, right: 20,
        color: algo.color, fontSize: 18, fontWeight: 700,
        opacity: 0.5,
      }}>
        →
      </div>
    </button>
  );
}
