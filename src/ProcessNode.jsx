import React from 'react';

const ProcessNode = ({ id, isActive, isLeader, angle, ringSize, style }) => {
  return (
    <div
      className={`process-node ${isActive ? 'active-sender' : ''} ${isLeader ? 'leader' : ''}`}
      style={style}
    >
      <span className="id-label">P{id}</span>
      <span className="node-status">{isLeader ? 'Leader' : isActive ? 'Actif' : 'Veille'}</span>
      {isLeader && <span style={{ position: 'absolute', top: '-15px', fontSize: '1.2rem' }}>👑</span>}
    </div>
  );
};

export default ProcessNode;
