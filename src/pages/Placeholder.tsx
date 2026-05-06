interface PlaceholderProps {
  name: string;
}

export default function Placeholder({ name }: PlaceholderProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <h2 style={{ color: '#0f172a', margin: '0 0 8px' }}>{name}</h2>
      <p style={{ color: '#64748b', margin: '0 0 24px' }}>Page en cours d'implémentation</p>
      <a href="/" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>← Retour à l'accueil</a>
    </div>
  );
}
