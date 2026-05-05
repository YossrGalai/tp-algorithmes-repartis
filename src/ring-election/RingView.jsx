import React from 'react';
import ProcessNode from './ProcessNode';

const RingView = ({ processes, activeId, leaderId, messagePos, ringSize, onInitiateElection, isSimulating }) => {
  const radius = ringSize / 2;
  
  return (
    <div className="ring-area">
      <div className="ring-container">
        {/* Background path perfectly centered */}
        <svg 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          <circle 
            cx={radius} 
            cy={radius} 
            r={radius} 
            fill="none" 
            stroke="var(--ring-border)" 
            strokeWidth="2" 
            strokeDasharray="8,8" 
          />
        </svg>
        
        {processes.map((p, index) => {
          // Logic: nodes are placed at 50% 50% + cos/sin
          const angle = (index / processes.length) * 2 * Math.PI - Math.PI / 2;
          const left = radius + radius * Math.cos(angle);
          const top = radius + radius * Math.sin(angle);
          
          return (
            <ProcessNode
              key={p.id}
              id={p.id}
              isActive={activeId === p.id}
              isLeader={leaderId === p.id}
              isFailed={p.isFailed}
              angle={angle}
              ringSize={ringSize}
              onInitiate={() => {
                console.log("Node click triggered for ID:", p.id);
                if (!isSimulating && !p.isFailed) onInitiateElection(p.id);
              }}
              isSimulating={isSimulating}
              // Calculate specific style for absolute positioning
              style={{
                left: `${left}px`,
                top: `${top}px`
              }}
            />
          );
        })}

        {messagePos && (
          <div
            className="message-dot"
            style={{
              left: `${messagePos.x}px`,
              top: `${messagePos.y}px`,
              zIndex: 10 // Ensure message is on top
            }}
          />
        )}
      </div>
    </div>
  );
};

export default RingView;
