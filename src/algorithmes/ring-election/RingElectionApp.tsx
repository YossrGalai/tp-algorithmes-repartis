import React, { useState, useEffect, useRef } from 'react';
import './RingElectionApp.css';
import RingView from './RingView';
import { INITIAL_PROCESSES, MESSAGE_TYPES, handleMessage } from './election';

const RING_SIZE = 360;
const STEP_DELAY = 1500; // ms between steps

export default function RingElectionApp() {
  const [processes, setProcesses] = useState(INITIAL_PROCESSES);
  const [logs, setLogs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [leaderId, setLeaderId] = useState(null);
  const [message, setMessage] = useState(null); // { fromIndex, toIndex, type, value }
  const [isSimulating, setIsSimulating] = useState(false);
  const [messagePos, setMessagePos] = useState(null);

  const simulationRef = useRef(null);

  // Helper to get coordinates for a node index
  const getNodePos = (index) => {
    const angle = (index / processes.length) * 2 * Math.PI - Math.PI / 2;
    const radius = RING_SIZE / 2;
    return {
      x: radius + radius * Math.cos(angle),
      y: radius + radius * Math.sin(angle),
    };
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [msg, ...prev]);
  };

  const resetSystem = () => {
    if (simulationRef.current) clearTimeout(simulationRef.current);
    setProcesses(processes.map(p => ({ ...p, isActive: false, isLeader: false, isFailed: false })));
    setLogs([]);
    setActiveId(null);
    setLeaderId(null);
    setMessage(null);
    setMessagePos(null);
    setIsSimulating(false);
  };

  const exportLogs = () => {
    if (logs.length === 0) return;
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `simulation_ring_election_${new Date().getTime()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const addProcess = () => {
    if (isSimulating) return;
    const newId = processes.length > 0 ? Math.max(...processes.map(p => p.id)) + 1 : 1;
    const newProcesses = [...processes, { id: newId, isActive: false, isLeader: false, isFailed: false, queue: [] }];
    setProcesses(newProcesses);
    addLog(`Nouveau processus P${newId} ajouté.`);
  };

  const failProcess = (id: number) => {
    const wasLeader = id === leaderId;
    const isNowFailed = !processes.find(p => p.id === id)?.isFailed;

    setProcesses(processes.map(p => p.id === id ? { ...p, isFailed: !p.isFailed, isLeader: false } : p));
    
    if (isNowFailed) {
      addLog(`P${id} vient de tomber en panne !`);
      if (wasLeader) {
        addLog(`Le Leader P${id} est hors-service. DÉCLENCHEMENT AUTOMATIQUE DE L'ÉLECTION...`);
        // On attend un court instant que l'état React se mette à jour pour le nœud HS
        setTimeout(() => {
          // Trouver le premier processus vivant pour initier l'élection
          const firstAliveIdx = processes.findIndex(p => p.id !== id && !p.isFailed);
          if (firstAliveIdx !== -1) {
            startElection(firstAliveIdx);
          }
        }, 500);
      }
    } else {
      addLog(`P${id} est réparé.`);
    }
  };

  const removeProcess = (id: number) => {
    if (isSimulating || processes.length <= 3) return;
    setProcesses(processes.filter(p => p.id !== id));
    addLog(`Processus P${id} supprimé.`);
  };

  const updateId = (oldId: number, newIdInput: string) => {
    const newId = parseInt(newIdInput);
    if (isNaN(newId)) return;
    if (processes.some(p => p.id === newId)) {
      alert("Cet ID existe déjà !");
      return;
    }
    setProcesses(processes.map(p => p.id === oldId ? { ...p, id: newId } : p));
  };

  const startElection = (forcedStartIndex?: number) => {
    // console.log("Starting election...");
    if (processes.length === 0) return;
    
    // Si une simulation est déjà en cours, on l'arrête proprement avant d'en lancer une nouvelle
    if (simulationRef.current) clearTimeout(simulationRef.current);
    
    // Partial reset
    setLogs([]);
    setActiveId(null);
    setLeaderId(null);
    setMessage(null);
    setMessagePos(null);
    setIsSimulating(true);

    // Pick initiator: provided index or random
    let startIndex = forcedStartIndex !== undefined ? forcedStartIndex : Math.floor(Math.random() * processes.length);
    
    // Si l'initiateur choisi est mort, on prend le premier vivant
    if (processes[startIndex].isFailed) {
      startIndex = processes.findIndex(p => !p.isFailed);
    }

    if (startIndex === -1) {
       addLog("Erreur: Aucun processus n'est opérationnel.");
       setIsSimulating(false);
       return;
    }
    
    const startProc = processes[startIndex];
    
    // Trouver le prochain nœud vivant pour la destination (saute les HS)
    let nextIdx = (startIndex + 1) % processes.length;
    while (processes[nextIdx].isFailed && nextIdx !== startIndex) {
      nextIdx = (nextIdx + 1) % processes.length;
    }

    // Si on boucle sur soi-même, c'est qu'il n'y a qu'un seul nœud vivant
    if (nextIdx === startIndex) {
      addLog(`P${startProc.id} est le seul survivant. Il devient Leader.`);
      setLeaderId(startProc.id);
      setProcesses(prev => prev.map(p => p.id === startProc.id ? { ...p, isLeader: true } : { ...p, isLeader: false }));
      setIsSimulating(false);
      return;
    }
    
    const firstMessage = {
      fromIndex: startIndex,
      toIndex: nextIdx,
      type: MESSAGE_TYPES.ELECTION,
      value: startProc.id,
    };

    addLog(`P${startProc.id} lance l'ELECTION(${startProc.id})`);
    setMessage(firstMessage);
  };

  useEffect(() => {
    if (!message || !isSimulating) return;

    // 1. Position de départ
    const fromPos = getNodePos(message.fromIndex);
    setMessagePos(fromPos);
    setActiveId(processes[message.fromIndex].id);

    // 2. Animation vers le prochain (qui est d'office vivant grâce à notre calcul)
    const toPos = getNodePos(message.toIndex);
    
    simulationRef.current = setTimeout(() => {
      setMessagePos(toPos);
      
      simulationRef.current = setTimeout(() => {
        const targetNode = processes[message.toIndex];
        const result = handleMessage(targetNode, message);
        addLog(result.log);

        let nextMessage = null;
        if (result.action !== 'STOP') {
          // Calculer le prochain nœud vivant à chaque étape
          let nextIdx = (message.toIndex + 1) % processes.length;
          while (processes[nextIdx].isFailed && nextIdx !== message.toIndex) {
            nextIdx = (nextIdx + 1) % processes.length;
          }

          const msgType = (result.action === 'WIN' || result.action === 'FORWARD_COORDINATOR') 
            ? MESSAGE_TYPES.COORDINATOR 
            : MESSAGE_TYPES.ELECTION;

          if (result.action === 'WIN') {
            setLeaderId(result.newValue);
            setProcesses(prev => prev.map(p => p.id === result.newValue ? { ...p, isLeader: true } : { ...p, isLeader: false }));
            addLog(`P${result.newValue} envoie COORDINATOR(${result.newValue})`);
          } else if (result.action === 'FORWARD_COORDINATOR') {
            setLeaderId(result.newValue);
            setProcesses(prev => prev.map(p => p.id === result.newValue ? { ...p, isLeader: true } : p));
          }

          nextMessage = {
            fromIndex: message.toIndex,
            toIndex: nextIdx,
            type: msgType,
            value: result.newValue,
          };
        } else {
          setIsSimulating(false);
          setActiveId(null);
          setMessagePos(null);
          return;
        }

        setMessage(nextMessage);
      }, STEP_DELAY / 2);
    }, 500);

    return () => { if (simulationRef.current) clearTimeout(simulationRef.current); };
  }, [message, isSimulating, processes]);

  return (
    <div className="simulation-container">
      <h1>Ring Election</h1>
      <p className="subtitle">Algorithme de Chang-Roberts</p>
      <p style={{ 
        color: 'var(--text-muted)', 
        fontSize: '0.9rem', 
        marginBottom: '1rem', 
        textAlign: 'center',
        padding: '0 1rem'
      }}>
        Cliquez sur lancer l'élection pour qu'un processus aléatoire le fasse, sinon cliquez sur le processus qui doit lancer l'élection.
      </p>

      <div className="controls">
        <button className="btn-primary" onClick={() => startElection()} disabled={isSimulating}>
          ▶ Lancer l'Élection
        </button>
        <button className="btn-secondary" onClick={addProcess} disabled={isSimulating}>
          ➕ Ajouter Processus
        </button>
        <button className="btn-secondary" onClick={resetSystem}>🔄 Réinitialiser</button>
      </div>

      <div className="main-content">
        <div className="ring-section">
          <RingView
            processes={processes}
            activeId={activeId}
            leaderId={leaderId}
            messagePos={messagePos}
            ringSize={RING_SIZE}
            onInitiateElection={(id) => {
              const idx = processes.findIndex(p => p.id === id);
              startElection(idx);
            }}
            isSimulating={isSimulating}
          />
          
          <div className="process-list-management">
            <h3>Gérer les processus</h3>
            <div className="id-grid">
              {[...processes].sort((a, b) => a.id - b.id).map(p => (
                <div key={p.id} className={`id-item ${p.isFailed ? 'failed' : ''}`}>
                  <span className="p-label">P{p.id}</span>
                  <input 
                    type="number" 
                    defaultValue={p.id}
                    onBlur={(e) => updateId(p.id, e.target.value)}
                    disabled={isSimulating}
                  />
                  <div className="item-actions">
                    <button 
                      onClick={() => failProcess(p.id)}
                      className="fail-btn"
                      title={p.isFailed ? "Réparer" : "Mettre en panne"}
                    >
                      {p.isFailed ? '🔧' : '💥'}
                    </button>
                    <button 
                      onClick={() => removeProcess(p.id)} 
                      disabled={isSimulating || processes.length <= 3}
                      className="delete-btn"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="logs-section">
          <div className="logs-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Logs de Simulation</h3>
            <button 
              onClick={exportLogs} 
              disabled={logs.length === 0}
              style={{
                background: 'var(--accent-primary)',
                border: '1px solid var(--accent-primary)',
                color: 'white',
                padding: '4px 10px',
                fontSize: '0.7rem',
                borderRadius: '6px',
                cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
                opacity: logs.length === 0 ? 0.5 : 1
              }}
            >
              📥 Exporter
            </button>
          </div>
          <div className="logs-panel">
            {logs.length === 0 && <div className="log-entry">En attente d'initiation...</div>}
            {logs.map((log, i) => (
              <div key={i} className="log-entry">
                {`> ${log}`}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="current-msg-banner">
        {message ? (
          <>Suivant : <span style={{color: 'var(--accent-primary)'}}>{message.type}({message.value})</span></>
        ) : (
          "Système en attente"
        )}
      </div>
    </div>
  );
}

