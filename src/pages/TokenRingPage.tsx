// pages/TokenRingPage.tsx

import { useState, useCallback, useRef } from 'react';
import { useNavigate} from 'react-router-dom';
import { initTokenRingState, generateSteps, nextStep } from '../algorithmes/tokenRing';
import type { TokenRingState } from '../types/tokenRing';
import ProcessNode from '../components/ProcessNode';
import EventLog from '../components/EventLog';
import TokenRingStats from '../components/TokenRingStats';
import RingVisualization from '../components/RingVisualization';
import '../styles/TokenRingPage.css';

type Phase = 'config' | 'simulation';

export default function TokenRingPage() {
  const navigate = useNavigate();
  // ── Phase de configuration ─────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('config');

  // Quel(s) processus veulent accéder ? [P0, P1, P2]
  const [wantsAccess, setWantsAccess] = useState<boolean[]>([true, false, true]);

  // ── Phase de simulation ────────────────────────────────────────────────
  const stepsRef = useRef<((s: TokenRingState) => TokenRingState)[]>([]);
  const [state, setState] = useState<TokenRingState>(initTokenRingState([true, false, true]));
  const [totalSteps, setTotalSteps] = useState(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Handlers configuration ─────────────────────────────────────────────
  const toggleProcess = (id: number) => {
    setWantsAccess((prev) => prev.map((v, i) => (i === id ? !v : v)));
  };

  const handleStart = useCallback(() => {
    const steps = generateSteps(wantsAccess);
    stepsRef.current = steps;
    setTotalSteps(steps.length);
    setState(initTokenRingState(wantsAccess));
    setPhase('simulation');
  }, [wantsAccess]);

  // ── Handlers simulation ────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    setState((prev) => nextStep(prev, stepsRef.current));
  }, []);

  const handleReset = useCallback(() => {
    if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null; }
    setTotalSteps(0);
    setPhase('config');
  }, []);

  const handleAuto = useCallback(() => {
    if (autoRef.current) {
      clearInterval(autoRef.current);
      autoRef.current = null;
      setState((prev) => ({ ...prev, isRunning: false }));
      return;
    }
    setState((prev) => ({ ...prev, isRunning: true }));
    autoRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.isFinished || prev.step >= stepsRef.current.length) {
          clearInterval(autoRef.current!);
          autoRef.current = null;
          return { ...prev, isRunning: false, isFinished: true };
        }
        return nextStep(prev, stepsRef.current);
      });
    }, 1200);
  }, []);

  // ══════════════════════════════════════════════════════════════════════
  // PHASE CONFIG
  // ══════════════════════════════════════════════════════════════════════
  if (phase === 'config') {
    return (
      <div className="tr-page">
        
        <header className="tr-header">
          <h1>🔁 Token Ring</h1>
          <p className="tr-subtitle">Exclusion mutuelle — 3 processus en anneau</p>
        </header>

        <div className="tr-config-card">
          <h2 className="config-title">Configuration du scénario</h2>
          <p className="config-desc">
            Choisissez quels processus veulent accéder à la ressource partagée.
            Le jeton circulera dans l'ordre <strong>P0 → P1 → P2 → P0</strong>.
          </p>

          <div className="config-processes">
            {[0, 1, 2].map((id) => (
              <button
                key={id}
                className={`config-proc-btn ${wantsAccess[id] ? 'config-proc-active' : ''}`}
                onClick={() => toggleProcess(id)}
                aria-pressed={wantsAccess[id]}
              >
                <span className="config-proc-id">P{id}</span>
                <span className="config-proc-icon">{wantsAccess[id] ? '🔒' : '😴'}</span>
                <span className="config-proc-label">
                  {wantsAccess[id] ? 'Veut accéder' : 'Pas de besoin'}
                </span>
              </button>
            ))}
          </div>

          {/* Résumé du scénario */}
          <div className="config-summary">
            <h3>Scénario généré :</h3>
            <ul>
              {[0, 1, 2].map((id) => (
                <li key={id}>
                  <strong>P{id}</strong> — {wantsAccess[id]
                    ? 'a le jeton → entre en SC → libère → passe le jeton'
                    : 'reçoit le jeton → pas besoin → passe directement'}
                </li>
              ))}
            </ul>
            <p className="config-msg-estimate">
              Estimation : <strong>{wantsAccess.filter(Boolean).length === 0 ? 3 : 3} messages</strong> échangés
              {wantsAccess.every((v) => !v) && ' (aucun accès demandé, le jeton circule à vide)'}
            </p>
          </div>

          <div className="config-actions">
            <button
              className="btn btn-start"
              onClick={handleStart}
            >
              🚀 Lancer la simulation
            </button>
            <button
              className="btn btn-back"
              onClick={() => navigate('/')}
            >
              ← Retour au menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // PHASE SIMULATION
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="tr-page">
             <button
      className="btn btn-back"
      onClick={() => navigate('/')}
    >
      ← Retour au menu
    </button>
      <header className="tr-header">
        <h1>🔁 Token Ring</h1>
        <p className="tr-subtitle">
          Scénario : {[0, 1, 2]
            .filter((id) => state.wantsAccessConfig[id])
            .map((id) => `P${id}`)
            .join(', ') || 'Aucun processus'} veulent accéder
        </p>
      </header>
     
            
      <div className="tr-layout">
        {/* Anneau SVG */}
        <section className="tr-ring-section">
          <RingVisualization
            processes={state.processes}
            currentTokenHolder={state.currentTokenHolder}
            animatingArc={state.animatingArc}
          />
        </section>

        {/* Stats + Contrôles */}
        <section className="tr-controls-section">
          <TokenRingStats
            messageCount={state.messageCount}
            step={state.step}
            totalSteps={totalSteps}
            tokenHolder={state.currentTokenHolder}
          />

          <div className="tr-controls">
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={state.isFinished || state.isRunning}
            >
              ▶ Étape suivante
            </button>
            <button
              className={`btn ${state.isRunning ? 'btn-danger' : 'btn-secondary'}`}
              onClick={handleAuto}
              disabled={state.isFinished && !state.isRunning}
            >
              {state.isRunning ? '⏹ Stop' : '⚡ Auto'}
            </button>
            <button className="btn btn-reset" onClick={handleReset}>
              ⚙️ Reconfigurer
            </button>
          </div>

          {state.isFinished && (
            <div className="tr-finished">
              ✅ Simulation terminée — <strong>{state.messageCount} messages</strong> échangés
            </div>
          )}
        </section>
      </div>

      {/* Cartes des processus */}
      <section className="tr-processes">
        {state.processes.map((p) => (
          <ProcessNode key={p.id} process={p} />
        ))}
      </section>

      {/* Journal */}
      <section className="tr-log-section">
        <EventLog events={state.events} />
      </section>
    </div>
  );
}