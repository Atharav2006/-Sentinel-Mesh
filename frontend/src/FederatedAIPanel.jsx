import React, { useState, useEffect } from 'react';

export default function FederatedAIPanel() {
  const [syncProgress, setSyncProgress] = useState(0);
  const [accuracy, setAccuracy] = useState(94.2);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSyncProgress(p => (p >= 100 ? 0 : p + 5));
      
      if (Math.random() > 0.5) {
        setAccuracy(a => Math.min(99.9, Math.max(90, a + (Math.random() * 0.4 - 0.1))));
      }

      const newLog = `[Sync] Received encrypted weight update from Node ${Math.floor(Math.random() * 5) + 1}...`;
      setLogs(prev => [newLog, ...prev].slice(0, 5));
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', color: 'var(--text-primary)' }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Federated AI Consensus</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6, lineHeight: 1.6, maxWidth: 600 }}>
          Network members train threat models locally and share only encrypted model weights via ZK proofs — no raw data ever leaves a node.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Global Model Status */}
        <div style={{ 
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 24, 
          border: '1px solid var(--border)',
          transition: 'border-color var(--transition-fast)'
        }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.03em', marginBottom: 16 }}>Global Model Accuracy</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {accuracy.toFixed(2)}%
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>Threat detection accuracy</div>
          
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              <span>Weight Sync Progress</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{syncProgress}%</span>
            </div>
            <div style={{ width: '100%', height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ 
                width: `${syncProgress}%`, height: '100%', 
                background: 'var(--accent)', 
                transition: 'width 0.2s linear',
                borderRadius: 2,
              }} />
            </div>
          </div>
        </div>

        {/* Live Sync Feed */}
        <div style={{ 
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 24, 
          display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border)',
          transition: 'border-color var(--transition-fast)'
        }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.03em', marginBottom: 16 }}>Live Sync Feed</div>
          <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ opacity: 1 - (i * 0.18) }}>
                <span style={{ color: 'var(--text-secondary)' }}>{new Date().toLocaleTimeString()}</span>{' '}
                <span style={{ color: 'var(--text-muted)' }}>{log}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* ZK Info */}
      <div style={{ 
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 20, 
        display: 'flex', gap: 16, alignItems: 'flex-start',
        border: '1px solid var(--border)'
      }}>
        <div style={{ 
          width: 36, height: 36, borderRadius: 'var(--radius-sm)', 
          background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: 'var(--accent-light)', flexShrink: 0,
        }}>ZK</div>
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>Zero-Knowledge Weight Validation</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
            Before merging weights into the global model, a Midnight ZK-Proof verifies on-chain that no node has poisoned the dataset with malicious weights.
          </div>
        </div>
      </div>
    </div>
  );
}
