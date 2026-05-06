// components/TokenRingStats.tsx

interface TokenRingStatsProps {
  messageCount: number;
  step: number;
  totalSteps: number;
  tokenHolder: number;
}

export default function TokenRingStats({
  messageCount,
  step,
  totalSteps,
  tokenHolder,
}: TokenRingStatsProps) {
  const progress = totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;

  return (
    <div className="tr-stats">
      <div className="stat-card">
        <span className="stat-label">Messages</span>
        <span className="stat-value">{messageCount}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Étape</span>
        <span className="stat-value">{step}<span className="stat-total">/{totalSteps}</span></span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Jeton chez</span>
        <span className="stat-value">P{tokenHolder}</span>
      </div>
      <div className="stat-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-label">{progress}%</span>
      </div>
    </div>
  );
}