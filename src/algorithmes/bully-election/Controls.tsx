import React, { useState } from 'react';
import './styles.css';

interface ControlsProps {
  processCount: number;
  currentLeader: number | null;
  onStartElection: (processId: number) => void;
  onSimulateFailure: (processId: number) => void;
  onRecoverProcess: (processId: number) => void;
  onReset: () => void;
  failedProcesses: number[];
}

export const Controls: React.FC<ControlsProps> = ({
  processCount,
  currentLeader,
  onStartElection,
  onSimulateFailure,
  onRecoverProcess,
  onReset,
  failedProcesses,
}) => {
  const [selectedProcess, setSelectedProcess] = useState<number>(0);
  const [useRandom, setUseRandom] = useState(false);

  const handleStartElection = () => {
    if (useRandom) {
      const aliveProcesses = Array.from({ length: processCount }, (_, i) => i).filter(
        (id) => !failedProcesses.includes(id)
      );

      if (aliveProcesses.length === 0) {
        alert('Tous les processus sont en panne!');
        return;
      }

      const randomId = aliveProcesses[Math.floor(Math.random() * aliveProcesses.length)];
      onStartElection(randomId);
    } else {
      if (failedProcesses.includes(selectedProcess)) {
        alert(`Le processus ${selectedProcess} est en panne et ne peut pas initier l'élection!`);
        return;
      }
      onStartElection(selectedProcess);
    }
  };

  const handleSimulateFailure = () => {
    if (failedProcesses.includes(selectedProcess)) {
      alert(`Le processus ${selectedProcess} est déjà en panne!`);
      return;
    }
    onSimulateFailure(selectedProcess);
  };

  const handleRecoverProcess = (processId: number) => {
    onRecoverProcess(processId);
  };

  return (
    <div className="controls-container">
      <div className="control-section">
        <h3>Contrôles</h3>

        <div className="control-group">
          <label>Sélectionner un Processus:</label>
          <div className="process-selector">
            {Array.from({ length: processCount }, (_, i) => (
              <button
                key={i}
                className={`process-btn ${
                  selectedProcess === i
                    ? 'selected'
                    : failedProcesses.includes(i)
                      ? 'failed'
                      : currentLeader === i
                        ? 'leader'
                        : ''
                }`}
                onClick={() => setSelectedProcess(i)}
                title={
                  failedProcesses.includes(i)
                    ? `Processus ${i} (EN PANNE)`
                    : currentLeader === i
                      ? `Processus ${i} (COORDINATEUR)`
                      : `Processus ${i}`
                }
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={useRandom}
              onChange={(e) => setUseRandom(e.target.checked)}
            />
            Choix aléatoire du processus pour l'élection
          </label>
        </div>

        <div className="control-group">
          <button className="btn btn-primary" onClick={handleStartElection}>
            Démarrer Élection
          </button>
        </div>

        <div className="control-group">
          <button className="btn btn-danger" onClick={handleSimulateFailure}>
            Simuler Panne du Processus {selectedProcess}
          </button>
        </div>

        {failedProcesses.length > 0 && (
          <div className="control-group">
            <label>Processus en panne:</label>
            <div className="failed-processes">
              {failedProcesses.map((id) => (
                <div key={id} className="failed-process-item">
                  <span>Processus {id}</span>
                  <button
                    className="btn btn-small btn-success"
                    onClick={() => handleRecoverProcess(id)}
                  >
                    Récupérer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="control-group">
          <button className="btn btn-secondary" onClick={onReset}>
            Réinitialiser
          </button>
        </div>
      </div>

      <div className="info-section">
        <h4>Informations Système</h4>
        <div className="info-item">
          <strong>Nombre de Processus:</strong> {processCount}
        </div>
        <div className="info-item">
          <strong>Coordinateur Actuel:</strong>
          {currentLeader !== null ? (
            <span className="coordinator-badge">Processus {currentLeader}</span>
          ) : (
            <span className="no-leader">Aucun coordinateur</span>
          )}
        </div>
        <div className="info-item">
          <strong>Processus en Panne:</strong> {failedProcesses.length}
        </div>
        <div className="info-item">
          <strong>Processus Actifs:</strong> {processCount - failedProcesses.length}
        </div>
      </div>

      <div className="algorithm-info">
        <h4>Algorithme Bully - Résumé</h4>
        <ul>
          <li>P envoie ELECTION à tous les processus avec ID supérieur</li>
          <li>Si aucune réponse → P gagne l'élection</li>
          <li>P envoie ELECTED à tous les processus</li>
          <li>Cas worst: O(n²) messages</li>
          <li>Cas best: (n-1) messages</li>
        </ul>
      </div>
    </div>
  );
};
