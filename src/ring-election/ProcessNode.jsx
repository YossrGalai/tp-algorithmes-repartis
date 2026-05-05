import React from 'react';

const ProcessNode = ({ id, isActive, isLeader, isFailed, angle, ringSize, style, onInitiate, isSimulating }) => {
  return (
    <div
      className={`process-node ${isActive ? 'active-sender' : ''} ${isLeader ? 'leader' : ''} ${isFailed ? 'failed' : ''}`}
      style={{
        ...style,
        cursor: (isSimulating || isFailed) ? 'default' : 'pointer',
        opacity: isFailed ? 0.4 : 1,
        filter: isFailed ? 'grayscale(100%)' : 'none'
      }}
      onClick={isFailed ? undefined : onInitiate}
      title={isFailed ? "Ce noeud est en panne" : isSimulating ? "" : "Cliquer pour lancer l'élection à partir de ce noeud"}
    >
      <span className="id-label">P{id}</span>
      <span className="node-status">{isFailed ? 'PANNE' : isLeader ? 'Leader' : isActive ? 'Actif' : 'Veille'}</span>
      {isLeader && !isFailed && <span style={{ position: 'absolute', top: '-15px', fontSize: '1.2rem' }}>👑</span>}
      {isFailed && <span style={{ position: 'absolute', top: '-15px', fontSize: '1.2rem' }}>⚠️</span>}
    </div>
  );
};

export default ProcessNode;
