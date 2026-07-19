import React, { useState } from 'react';
import { banIdentity } from './api';

export default function ZkKycPanel() {
  const [target, setTarget] = useState('');
  const [banned, setBanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [zkDid, setZkDid] = useState('');
  const [zkProof, setZkProof] = useState(null);
  const [showProof, setShowProof] = useState(false);

  const submitBan = async () => {
    if (!target.trim()) return;
    setLoading(true);
    setBanned(false);
    setNodes([]);
    setErrorMsg(null);
    setZkDid('');
    setZkProof(null);
    setShowProof(false);
    
    try {
      // Small delay just to show the spinner briefly
      await new Promise(r => setTimeout(r, 600));
      
      const response = await banIdentity(target.trim());
      
      if (!response.success) {
        setErrorMsg(response.message);
        return;
      }

      setZkDid(response.zk_did);
      setNodes(response.propagation_details || response.nodes);
      setZkProof(response.zk_proof);
      setBanned(true);

    } catch (e) {
      setErrorMsg(e.message || "Failed to contact backend API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', color: 'var(--text-primary)' }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Zero-Knowledge KYC & Identity Banning</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6, lineHeight: 1.6, maxWidth: 700 }}>
          Hackers easily switch wallet addresses. Sentinel Mesh solves this by integrating with Decentralized Identity (DID) systems. 
          When an exchange flags a wallet, a ZK Proof links the wallet to the underlying human's <strong>Identity Hash</strong>, permanently banning the scammer globally while keeping their real name and passport private.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16 }}>
        {/* Input Panel */}
        <div style={{ 
          background: 'var(--bg-card)', border: '1px solid var(--border)', 
          borderRadius: 'var(--radius-lg)', padding: 24,
          transition: 'border-color var(--transition-fast)'
        }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Flag User Identity</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>Scammer Wallet Address</label>
            <input 
              type="text" 
              placeholder="0x..." 
              value={target}
              onChange={e => setTarget(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', background: 'var(--bg-input)', 
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', 
                color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13,
                outline: 'none', transition: 'border-color var(--transition-fast)'
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>
          <button 
            onClick={submitBan}
            disabled={loading || !target}
            style={{
              width: '100%', padding: '12px', background: 'var(--red)',
              border: 'none', borderRadius: 'var(--radius-sm)', color: 'white', 
              fontWeight: 600, fontSize: 13, cursor: (loading || !target) ? 'not-allowed' : 'pointer',
              opacity: (loading || !target) ? 0.6 : 1, transition: 'all var(--transition-fast)', 
              display: 'flex', justifyContent: 'center', alignItems: 'center'
            }}
            onMouseEnter={e => { if(!loading && target) e.currentTarget.style.background = '#dc2626' }}
            onMouseLeave={e => { if(!loading && target) e.currentTarget.style.background = 'var(--red)' }}
          >
            {loading ? <><span className="spinner" style={{ marginRight: 8, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}/> Querying Backend...</> : 'Ban Identity Hash Globally'}
          </button>
        </div>

        {/* Global Propagation Panel */}
        <div style={{ 
          background: 'var(--bg-surface)', border: '1px solid var(--border)', 
          borderRadius: 'var(--radius-lg)', padding: 24, position: 'relative' 
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Global Exchange Propagation</h3>
          
          {errorMsg && (
            <div style={{ 
              background: 'var(--amber-subtle)', border: '1px solid rgba(245,158,11,0.2)', 
              padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 20,
              animation: 'fadeIn 0.3s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ color: 'var(--amber)', fontSize: 13, fontWeight: 600 }}>Backend Rejected Request</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                {errorMsg}
              </div>
            </div>
          )}

          {banned && !errorMsg ? (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div style={{ 
                background: 'var(--red-subtle)', border: '1px solid rgba(239,68,68,0.2)', 
                padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 20 
              }}>
                <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.05em' }}>COMPUTED IDENTITY HASH</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#fca5a5' }}>
                  {zkDid}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {nodes.map((node, i) => (
                  <div key={node.name} style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '12px 16px', background: 'var(--bg-card)', 
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', 
                    animation: `slideIn 0.3s ease ${i * 0.15}s both` 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 16 }}>{node.icon}</span>
                      <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>{node.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{node.time}</span>
                      <span style={{ 
                        background: node.status === 'BANNED' || node.status === 'ADDRESS BLOCKED' ? 'var(--red-subtle)' : 'var(--amber-subtle)', 
                        color: node.status === 'BANNED' || node.status === 'ADDRESS BLOCKED' ? 'var(--red)' : 'var(--amber)', 
                        padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, letterSpacing: '0.03em' 
                      }}>
                        {node.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ZK Proof Terminal Toggle */}
              {zkProof && (
                <div style={{ marginTop: 20 }}>
                  <button 
                    onClick={() => setShowProof(!showProof)}
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      padding: '8px 16px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'background var(--transition-fast)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                  >
                    <span>{showProof ? '▼' : '▶'}</span> View Raw ZK-SNARK Proof
                  </button>
                  
                  {showProof && (
                    <div style={{ 
                      marginTop: 12, background: '#0d1117', border: '1px solid #30363d',
                      borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                      animation: 'slideDown 0.3s ease'
                    }}>
                      <div style={{ 
                        background: '#161b22', borderBottom: '1px solid #30363d', 
                        padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'center' 
                      }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                        <span style={{ marginLeft: 8, color: '#8b949e', fontSize: 11, fontFamily: 'var(--font-mono)' }}>zk_proof_payload.json</span>
                      </div>
                      <pre style={{ 
                        margin: 0, padding: 16, overflowX: 'auto', maxHeight: 300, overflowY: 'auto',
                        color: '#c9d1d9', fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.5
                      }}>
                        <code dangerouslySetInnerHTML={{ 
                          __html: JSON.stringify(zkProof, null, 2)
                            .replace(/"pi_a":/g, '<span style="color: #79c0ff">"pi_a":</span>')
                            .replace(/"pi_b":/g, '<span style="color: #79c0ff">"pi_b":</span>')
                            .replace(/"pi_c":/g, '<span style="color: #79c0ff">"pi_c":</span>')
                            .replace(/"publicSignals":/g, '<span style="color: #d2a8ff">"publicSignals":</span>')
                            .replace(/"curve":/g, '<span style="color: #ff7b72">"curve":</span>')
                        }} />
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : !errorMsg ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Waiting for identity ban submission...
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { 
          from { opacity: 0; transform: translateY(8px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        @keyframes slideDown { 
          from { opacity: 0; transform: translateY(-10px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
