import React, { useRef, useEffect, useState } from 'react';
import type { Message } from './types.ts';
import './styles.css';

interface MessageLogProps {
  messages: Message[];
  messageLog: string[];
}

export const MessageLog: React.FC<MessageLogProps> = ({ messageLog }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ELECTION' | 'OK' | 'ELECTED'>('ALL');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageLog]);

  const filteredLog = messageLog.filter((msg) => {
    if (filter === 'ALL') return true;
    return msg.includes(filter);
  });

  const visibleLogCount = isExpanded ? filteredLog.length : Math.min(5, filteredLog.length);

  return (
    <div className="message-log-container">
      <div className="message-log-header">
        <h3>Journal des Messages</h3>
        <div className="filter-controls">
          <button
            className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            Tous ({messageLog.length})
          </button>
          <button
            className={`filter-btn ${filter === 'ELECTION' ? 'active' : ''}`}
            onClick={() => setFilter('ELECTION')}
          >
            ELECTION
          </button>
          <button
            className={`filter-btn ${filter === 'OK' ? 'active' : ''}`}
            onClick={() => setFilter('OK')}
          >
            OK
          </button>
          <button
            className={`filter-btn ${filter === 'ELECTED' ? 'active' : ''}`}
            onClick={() => setFilter('ELECTED')}
          >
            ELECTED
          </button>
        </div>
      </div>

      <div className={`message-log ${isExpanded ? 'expanded' : 'collapsed'}`}>
        {filteredLog.slice(0, visibleLogCount).map((msg, index) => {
          const isError = msg.includes('ERREUR');
          const isCritical = msg.includes('CRITIQUE');
          const isSuccess = msg.includes('SUCCÈS');

          return (
            <div
              key={index}
              className={`log-entry ${isError ? 'error' : isCritical ? 'critical' : isSuccess ? 'success' : ''}`}
            >
              {msg}
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>

      <button className="toggle-btn" onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? '- Afficher moins' : '+ Afficher plus'}
      </button>

      <div className="message-summary">
        <strong>Résumé:</strong>
        <ul>
          <li>Messages ELECTION: {messageLog.filter((m) => m.includes('ELECTION')).length}</li>
          <li>Messages OK: {messageLog.filter((m) => m.includes('MESSAGE OK')).length}</li>
          <li>Messages ELECTED: {messageLog.filter((m) => m.includes('MESSAGE ELECTED')).length}</li>
          <li>Total: {messageLog.length}</li>
        </ul>
      </div>
    </div>
  );
};
