import React from 'react';

const ProcessNode = ({ id, isActive, isLeader, isFailed, angle, ringSize, style }) => {
  return (
    <div
      className={`process-node ${isActive ? 'active-sender' : ''} ${isLeader ? 'leader' : ''} ${isFailed ? 'is-failed' : ''}`}
      style={style}
    >
      <span className="id-label" style={{ opacity: isFailed ? 0.5 : 1 }}>P{id}</span>
      <span className="node-status">{isFailed ? 'Panne' : isLeader ? 'Leader' : isActive ? 'Actif' : 'Veille'}</span>
      {isLeader && !isFailed && <span style={{ position: 'absolute', top: '-15px', fontSize: '1.2rem' }}>👑</span>}
      {isFailed && <span style={{ position: 'absolute', top: '-10px', fontSize: '1.2rem' }}>⚠️</span>}
    </div>
  );
};

export default ProcessNode;
