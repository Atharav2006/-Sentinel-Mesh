import React, { useState, useEffect } from 'react';

export default function CrossChainRadar() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const eventSource = new EventSource('http://127.0.0.1:8000/crosschain/stream');

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setEvents(prev => {
          const updated = [data, ...prev];
          return updated.slice(0, 8); // Keep last 8 bridge events
        });
      } catch (err) {
        console.error("Error parsing crosschain event:", err);
      }
    };

    return () => eventSource.close();
  }, []);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', color: 'var(--text-primary)' }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Cross-Chain Bridge Radar</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6, lineHeight: 1.6, maxWidth: 700 }}>
          Hackers use cross-chain bridges to hide stolen funds. Sentinel Mesh monitors bridges (Wormhole, LayerZero) in real-time. 
          When an anomaly is detected, funds are intercepted mid-flight using our Federated AI scoring.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {events.map((evt, i) => (
          <div key={evt.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 20, position: 'relative', overflow: 'hidden',
            animation: 'slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {evt.bridge} Bridge
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{evt.time}</span>
                </div>
                
                {/* Visual Tracker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {evt.source_chain === 'Ethereum' ? '🔷' : evt.source_chain === 'Arbitrum' ? '🔵' : '🔴'}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>{evt.source_chain}</span>
                  </div>
                  
                  <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.1)', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', top: -3, left: 0, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
                      boxShadow: '0 0 10px var(--accent)',
                      animation: 'moveRight 2s linear forwards'
                    }}></div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {evt.target_chain === 'Solana' ? '🟣' : evt.target_chain === 'Avalanche' ? '🔺' : '🟣'}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>{evt.target_chain}</span>
                  </div>
                </div>
              </div>
              
              <div style={{ width: 180, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{evt.amount}</div>
                <a 
                  href={`https://etherscan.io/tx/${evt.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  {evt.id.slice(0,16)}...
                </a>
              </div>
            </div>

            {/* Stamp Overlay for Anomaly */}
            {evt.status === 'INTERCEPTED' && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.05)', backdropFilter: 'blur(1px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
                animation: 'stampDown 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) 1.5s both'
              }}>
                <div style={{
                  border: '4px solid #ef4444', color: '#ef4444', padding: '10px 24px',
                  fontSize: 24, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em',
                  transform: 'rotate(-5deg)', boxShadow: '0 0 20px rgba(239,68,68,0.2)'
                }}>
                  BRIDGE BLOCKED
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, textAlign: 'center', color: '#fca5a5' }}>
                    {evt.zk_did}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {events.length === 0 && (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
            Scanning bridges for anomalies...
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes moveRight { 0% { left: 0%; } 100% { left: calc(100% - 8px); } }
        @keyframes stampDown { 
          0% { opacity: 0; transform: scale(2); } 
          100% { opacity: 1; transform: scale(1); } 
        }
      `}</style>
    </div>
  );
}
