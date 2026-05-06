import React, { useEffect, useRef } from 'react';
import type { Message } from './types';

interface MessageLogProps {
  messages: Message[];
}

export const MessageLog: React.FC<MessageLogProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getEntryClass = (type: string): string => {
    switch (type) {
      case 'ELECTION':
        return 'log-entry election';
      case 'OK':
        return 'log-entry ok';
      case 'ELECTED':
        return 'log-entry elected';
      case 'COORDINATOR':
        return 'log-entry coordinator';
      default:
        return 'log-entry';
    }
  };

  const countElection = messages.filter(m => m.type === 'ELECTION').length;
  const countOk = messages.filter(m => m.type === 'OK').length;
  const countElected = messages.filter(m => m.type === 'COORDINATOR').length;

  return (
    <div className="message-log-container">
      <h3>Journal des messages</h3>

      <div className="message-log">
        {messages.length === 0 ? (
          <div className="log-empty">Aucun message — lancez une élection.</div>
        ) : (
          messages.map(msg => {
            const baseClass = getEntryClass(msg.type);
            const failure = msg.toFailed === true;
            const cls = failure ? `${baseClass} failure` : baseClass;
            return (
              <div key={msg.id} className={cls}>
                <span className="log-arrow">P{msg.from} → P{msg.to}:</span>
                <span style={{ marginLeft: 8 }}>{msg.content}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="message-summary">
        <div className="summary-item">
          <span className="summary-count">{countElection}</span>
          <span className="summary-label">ELECTION</span>
        </div>
        <div className="summary-item">
          <span className="summary-count">{countOk}</span>
          <span className="summary-label">OK</span>
        </div>
        <div className="summary-item">
          <span className="summary-count">{countElected}</span>
          <span className="summary-label">ELECTED</span>
        </div>
        <div className="summary-item">
          <span className="summary-count">{messages.length}</span>
          <span className="summary-label">Total</span>
        </div>
      </div>
      <div className="details-section" style={{ marginTop: 12 }}>
        <h4>Hypothèses</h4>
        <ul className="details-list">
          <li>Le réseau de communication est fiable et synchrone (borne connue sur le temps de communication)</li>
          <li>Chaque processus connaît l'identité des autres</li>
        </ul>
      </div>

      <div className="details-section" style={{ marginTop: 12 }}>
        <h4>Complexité</h4>
        <div>
          <p>Pour N processus :</p>
          <p><strong>Pire cas</strong> : le plus petit processus lance l'élection → O(n²) messages.</p>
          <p><strong>Meilleur cas</strong> : le futur leader lance l'élection → n − 1 messages.</p>
        </div>
      </div>
    </div>
  );
};
