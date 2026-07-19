import { useState, useRef, useEffect } from 'react';
import { submitAppeal, verifyAppeal, sendAppealChatMessage } from './api';

const STATUS_CONFIG = {
  NONE:     { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', label: 'No appeal filed' },
  PENDING:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  label: 'Appeal pending review' },
  DISPUTED: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  label: 'Disputed — strong counter-evidence' },
};

function WitnessBox({ witness, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(JSON.stringify(witness, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 24,
    }}>
      <div style={{
        background: '#0d1117', border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: 16, padding: 28, maxWidth: 580, width: '100%',
        boxShadow: '0 0 60px rgba(139,92,246,0.2)',
        animation: 'fadeIn 0.3s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#a78bfa' }}>
              🔑 Private Witness — Save This Now
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              This will NOT be stored on any server. It proves you authored this appeal.
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#6b7280',
            cursor: 'pointer', fontSize: 20, lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{
          background: '#030712', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, padding: 16, fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11, color: '#e5e7eb', lineHeight: 1.7, overflowX: 'auto',
          maxHeight: 260, overflowY: 'auto',
        }}>
          {JSON.stringify(witness, null, 2)}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={copy} style={{
            flex: 1, padding: '10px 0',
            background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)',
            border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(139,92,246,0.3)'}`,
            borderRadius: 8, color: copied ? '#10b981' : '#a78bfa',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {copied ? '✓ Copied!' : 'Copy to Clipboard'}
          </button>
          <button onClick={onClose} style={{
            padding: '10px 20px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, color: '#9ca3af', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            I've saved it
          </button>
        </div>

        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 8, fontSize: 11, color: '#fbbf24',
        }}>
          ⚠ Your <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>salt</code> is the key to proving authorship.
          If you lose it, you cannot prove you filed this appeal.
        </div>
      </div>
    </div>
  );
}

export default function AppealPanel({ address, flagCount }) {
  const [phase,    setPhase]    = useState('idle');  // idle | form | chat | submitted | verify
  const [reason,   setReason]   = useState('');
  const [evidence, setEvidence] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState('');
  const [witness,  setWitness]  = useState(null);

  // Verify phase
  const [vAppealId, setVAppealId] = useState('');
  const [vReason,   setVReason]   = useState('');
  const [vSalt,     setVSalt]     = useState('');
  const [vResult,   setVResult]   = useState(null);

  // Chat phase
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: 'You are appealing a high-risk flag on your cryptographic identity. State your defense.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (phase === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, phase]);

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setLoading(true);

    try {
      const res = await sendAppealChatMessage(address, userMsg);
      setChatMessages(prev => [...prev, { role: 'ai', text: res.reply, status: res.status }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Connection to Federated AI lost. Try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim() || reason.length < 10) {
      setError('Please provide a reason of at least 10 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const urls = evidence.split('\n').map(u => u.trim()).filter(Boolean);
      const data = await submitAppeal(address, reason.trim(), urls);
      setResult(data);
      setWitness(data.private_witness);
      setPhase('submitted');
    } catch (e) {
      setError(e.message || 'Appeal submission failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    setVResult(null);
    try {
      const r = await verifyAppeal(vAppealId.trim(), vReason.trim(), vSalt.trim());
      setVResult(r);
    } catch (e) {
      setError(e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const statusCfg = result ? STATUS_CONFIG[result.appeal_status] : STATUS_CONFIG.NONE;

  return (
    <>
      {witness && <WitnessBox witness={witness} onClose={() => setWitness(null)} />}

      <div style={{
        marginTop: 16, border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          background: 'rgba(139,92,246,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#a78bfa' }}>
              Counter-Proof Appeal
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Dispute a flag using ZK-committed evidence. Your reason stays private.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['form', 'chat', 'verify'].map(p => (
              <button key={p} onClick={() => { setPhase(p); setError(''); }} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: phase === p ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${phase === p ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: phase === p ? '#a78bfa' : '#6b7280',
              }}>
                {p === 'form' ? 'File Appeal' : p === 'chat' ? 'AI Interrogation' : 'Verify Authorship'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 20 }}>

          {/* ── IDLE state ── */}
          {phase === 'idle' && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: '#9ca3af', flex: 1 }}>
                This wallet has <span style={{ color: '#ef4444', fontWeight: 700 }}>{flagCount} flag(s)</span> in the registry.
                If you own this wallet and believe it was flagged incorrectly, you can submit a counter-proof appeal.
              </div>
              <button onClick={() => setPhase('form')} style={{
                padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13,
                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                border: 'none', color: 'white', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(124,58,237,0.3)', whiteSpace: 'nowrap',
              }}>
                File Appeal
              </button>
            </div>
          )}

          {/* ── FORM phase ── */}
          {phase === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                padding: '10px 14px', borderRadius: 8, fontSize: 12,
                background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)',
                color: '#c4b5fd',
              }}>
                🔒 Your reason will be committed to via SHA256 — it is <strong>never stored in plaintext</strong>.
                Only a cryptographic hash goes on the registry.
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                  Reason for Appeal <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Explain why this wallet should not be flagged (min 10 chars)..."
                  rows={4}
                  style={{
                    width: '100%', background: '#0d1117',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                    padding: '10px 14px', color: '#e5e7eb', fontSize: 13,
                    fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                  Evidence URLs <span style={{ color: '#4b5563' }}>(optional, one per line — only hashes stored)</span>
                </label>
                <textarea
                  value={evidence}
                  onChange={e => setEvidence(e.target.value)}
                  placeholder="https://etherscan.io/tx/0x...\nhttps://..."
                  rows={3}
                  style={{
                    width: '100%', background: '#0d1117',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                    padding: '10px 14px', color: '#9ca3af', fontSize: 12,
                    fontFamily: 'JetBrains Mono, monospace', resize: 'vertical', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, fontSize: 12,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  color: '#fca5a5',
                }}>{error}</div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleSubmit} disabled={loading} style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, fontWeight: 700, fontSize: 13,
                  background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                  border: 'none', color: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  {loading ? (
                    <><span style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                      animation: 'spin 0.7s linear infinite', display: 'inline-block',
                    }} /> Submitting...</>
                  ) : 'Submit Counter-Proof'}
                </button>
                <button onClick={() => setPhase('idle')} style={{
                  padding: '11px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#6b7280', cursor: 'pointer',
                }}>Cancel</button>
              </div>
            </div>
          )}

          {/* ── CHAT phase ── */}
          {phase === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 350, background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ 
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4
                  }}>
                    <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, marginLeft: 4, textTransform: 'uppercase' }}>
                      {msg.role === 'ai' ? 'Federated AI Judge' : 'Appellant'}
                    </div>
                    <div style={{
                      padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                      background: msg.role === 'user' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${msg.role === 'user' ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      color: '#e5e7eb', borderBottomRightRadius: msg.role === 'user' ? 2 : 12, borderBottomLeftRadius: msg.role === 'ai' ? 2 : 12,
                    }}>
                      {msg.text}
                      {msg.status === 'DENIED' && (
                        <div style={{ marginTop: 8, color: '#ef4444', fontWeight: 700, fontSize: 11, background: 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: 4, display: 'inline-block' }}>
                          APPEAL DENIED
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ alignSelf: 'flex-start', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, borderBottomLeftRadius: 2, display: 'flex', gap: 4 }}>
                    <span className="dot-typing"></span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#030712' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                  placeholder="State your defense..."
                  style={{ flex: 1, background: 'transparent', border: 'none', padding: '14px 16px', color: '#e5e7eb', fontSize: 13, outline: 'none' }}
                />
                <button onClick={handleSendChat} disabled={loading || !chatInput.trim()} style={{
                  padding: '0 20px', background: 'rgba(139,92,246,0.2)', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.08)',
                  color: '#a78bfa', fontWeight: 600, cursor: (loading || !chatInput.trim()) ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
                }}>
                  Send
                </button>
              </div>
            </div>
          )}

          {/* ── SUBMITTED phase ── */}
          {phase === 'submitted' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: statusCfg.bg, border: `1px solid ${statusCfg.color}33`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, color: statusCfg.color, fontWeight: 700 }}>
                  Appeal Status: {result.appeal_status}
                </span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  {result.flag_count} flags · {result.appeal_count} appeal(s)
                </span>
              </div>

              {[
                ['Appeal ID',    result.public.appeal_id],
                ['Commitment',   result.public.reason_commitment.slice(0, 24) + '...'],
                ['Evidence',     `${result.public.evidence_count} item(s) hashed`],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '7px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12,
                }}>
                  <span style={{ color: '#6b7280' }}>{k}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e5e7eb' }}>{v}</span>
                </div>
              ))}

              <button onClick={() => setWitness(result.private_witness)} style={{
                padding: '10px 0', borderRadius: 10, fontWeight: 700, fontSize: 13,
                background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
                color: '#a78bfa', cursor: 'pointer',
              }}>
                🔑 Show Private Witness Again
              </button>
            </div>
          )}

          {/* ── VERIFY phase ── */}
          {phase === 'verify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Prove you authored an appeal by re-computing its commitment. Your reason stays private.
              </div>

              {[
                ['Appeal ID', vAppealId, setVAppealId, 'a1b2c3d4...'],
                ['Original Reason', vReason, setVReason, 'The reason you typed when filing...'],
                ['Salt', vSalt, setVSalt, '(from your private witness JSON)'],
              ].map(([label, val, setter, ph]) => (
                <div key={label}>
                  <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 5 }}>{label}</label>
                  <input
                    value={val}
                    onChange={e => setter(e.target.value)}
                    placeholder={ph}
                    style={{
                      width: '100%', background: '#0d1117',
                      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                      padding: '9px 13px', color: '#e5e7eb', fontSize: 12,
                      fontFamily: 'JetBrains Mono, monospace', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}

              {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: 12 }}>{error}</div>}

              {vResult && (
                <div style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: vResult.valid ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${vResult.valid ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  color: vResult.valid ? '#10b981' : '#ef4444',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {vResult.valid ? '✓ Authorship Verified' : '✕ Verification Failed'} — {vResult.reason}
                </div>
              )}

              <button onClick={handleVerify} disabled={loading || !vAppealId || !vReason || !vSalt} style={{
                padding: '11px 0', borderRadius: 10, fontWeight: 700, fontSize: 13,
                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                border: 'none', color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: (!vAppealId || !vReason || !vSalt) ? 0.4 : 1,
              }}>
                {loading ? 'Verifying...' : 'Verify Authorship'}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin   { to { transform: rotate(360deg); } }
        .dot-typing {
          width: 6px; height: 6px; border-radius: 50%; background-color: #a78bfa;
          animation: dot-typing 1.5s infinite linear;
          box-shadow: 10px 0 0 0 #a78bfa, 20px 0 0 0 #a78bfa;
          margin-right: 20px;
        }
        @keyframes dot-typing {
          0% { background-color: #a78bfa; box-shadow: 10px 0 0 0 rgba(167,139,250,0.2), 20px 0 0 0 rgba(167,139,250,0.2); }
          33% { background-color: rgba(167,139,250,0.2); box-shadow: 10px 0 0 0 #a78bfa, 20px 0 0 0 rgba(167,139,250,0.2); }
          66% { background-color: rgba(167,139,250,0.2); box-shadow: 10px 0 0 0 rgba(167,139,250,0.2), 20px 0 0 0 #a78bfa; }
          100% { background-color: #a78bfa; box-shadow: 10px 0 0 0 rgba(167,139,250,0.2), 20px 0 0 0 rgba(167,139,250,0.2); }
        }
      `}</style>
    </>
  );
}
