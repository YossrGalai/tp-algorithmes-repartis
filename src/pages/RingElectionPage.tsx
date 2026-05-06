import React from 'react';
import { Link } from 'react-router-dom';
import RingElectionApp from '../algorithmes/ring-election/RingElectionApp';

const RingElectionPage: React.FC = () => {
    return (
        <div className="flex flex-col h-screen bg-slate-950">
            {/* Header with Back Button */}
            <header className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-start" style={{ marginTop: '20px', marginLeft: '20px' }}>
                <Link 
                    to="/" 
                    className="btn-primary"
                    style={{
                        padding: '6px 16px',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        border: 'none',
                        maxWidth: '100px'
                    }}
                >
                    Retour
                </Link>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 relative overflow-auto flex flex-col p-4">
                 <RingElectionApp />
            </main>
        </div>
    );
};

export default RingElectionPage;
