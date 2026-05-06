// components/EventLog.tsx

import { useEffect, useRef } from 'react';
import type { TokenRingEvent } from '../types/tokenRing';
import '../styles/EventLog.css';

interface EventLogProps {
  events: TokenRingEvent[];
}

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  TOKEN_SENT:     { label: 'Envoi jeton',   className: 'ev-token-sent' },
  TOKEN_RECEIVED: { label: 'Reçu jeton',    className: 'ev-token-recv' },
  ENTER_CS:       { label: 'Entrée SC',     className: 'ev-enter-cs' },
  EXIT_CS:        { label: 'Sortie SC',     className: 'ev-exit-cs' },
  REQUEST_ACCESS: { label: 'Demande',       className: 'ev-request' },
  PASS_TOKEN:     { label: 'Passe jeton',   className: 'ev-pass' },
};

export default function EventLog({ events }: EventLogProps) {
  const listRef  = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas à chaque nouvel événement
   useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight; // ← scroll interne uniquement
    }
  }, [events.length]);

  return (
    <div className="event-log">
      <h3 className="log-title">📋 Journal des événements</h3>
      <div className="log-list"ref={listRef}>
        {events.map((ev, idx) => {
          const cfg = TYPE_CONFIG[ev.type] ?? { label: ev.type, className: '' };
          const isLast = idx === events.length - 1;
          return (
            <div key={idx} className={`log-row ${isLast ? 'log-row--new' : ''}`}>
              <span className="log-index">{idx + 1}</span>
              <span className={`log-type-badge ${cfg.className}`}>{cfg.label}</span>
              <span className="log-msg">{ev.message}</span>
              {ev.timestamp > 0 && (
                <span className="log-time">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          );
        })}
        
      </div>
    </div>
  );
}