import { useState, useRef } from 'react';

const CONF_COLOR = {
  NONE:   '#4b5563',
  LOW:    '#f59e0b',
  MEDIUM: '#f97316',
  HIGH:   '#ef4444',
};

const CONF_LABEL = {
  NONE:   'No flags',
  LOW:    'LOW — 1 source',
  MEDIUM: 'MEDIUM — 2 sources',
  HIGH:   'HIGH — 3+ sources',
};

function TierBadge({ tier, animate }) {
  const color = CONF_COLOR[tier] || '#4b5563';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 14px', borderRadius: 99,
      background: `${color}18`, border: `1px solid ${color}55`,
      color, fontWeight: 700, fontSize: 13,
      transition: 'all 0.5s ease',
      boxShadow: animate ? `0 0 20px ${color}66` : 'none',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: color,
        boxShadow: `0 0 8px ${color}`,
        animation: tier !== 'NONE' ? 'pulse 1.5s infinite' : 'none',
      }} />
      {CONF_LABEL[tier]}
    </span>
  );
}

function MemberStep({ step, visible }) {
  if (!visible) return null;
  const m = step.member;
  const flagged = step.flagged;

  return (
    <div style={{
      display: 'flex', gap: 14, padding: '14px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      animation: 'stepIn 0.4s ease',
      opacity: visible ? 1 : 0,
    }}>
      {/* Member badge */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `${m.color}22`, border: `1px solid ${m.color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 12, color: m.color, fontFamily: 'Inter, sans-serif',
      }}>
        {m.icon}
      </div>

      {/* Member info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</span>
          <span style={{ fontSize: 11, color: '#6b7280', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 4 }}>
            {m.type}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{m.description}</div>

        {/* Score row (hidden) and proof row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            padding: '2px 8px', borderRadius: 4, color: '#9ca3af',
          }}>
            score: ████ /100
          </span>
          {flagged ? (
            <>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                padding: '2px 8px', borderRadius: 4, color: '#a5b4fc',
              }}>
                proof: {step.proof_id}
              </span>
              <span style={{
                fontSize: 11, color: '#10b981', fontWeight: 600,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                padding: '2px 8px', borderRadius: 4,
              }}>
                ZK submitted
              </span>
            </>
          ) : (
            <span style={{ fontSize: 11, color: '#6b7280' }}>Below threshold — no proof submitted</span>
          )}
        </div>
      </div>

      {/* Tier transition */}
      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 90 }}>
        <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 4 }}>Confidence</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11, color: CONF_COLOR[step.confidence_before] }}>{step.confidence_before}</span>
          <span style={{ color: '#374151', fontSize: 12 }}>→</span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: CONF_COLOR[step.confidence_after],
            ...(step.confidence_after !== step.confidence_before ? {
              textShadow: `0 0 8px ${CONF_COLOR[step.confidence_after]}`,
            } : {})
          }}>{step.confidence_after}</span>
        </div>
      </div>
    </div>
  );
}

export default function SimulationPanel({ address, onSimulationComplete }) {
  const [running,       setRunning]       = useState(false);
  const [steps,         setSteps]         = useState([]);
  const [visibleCount,  setVisibleCount]  = useState(0);
  const [finalConf,     setFinalConf]     = useState('NONE');
  const [done,          setDone]          = useState(false);
  const timerRef = useRef(null);

  const runSim = async () => {
    if (running) return;
    setRunning(true);
    setSteps([]);
    setVisibleCount(0);
    setFinalConf('NONE');
    setDone(false);

    try {
      const res  = await fetch(`http://localhost:8000/simulate/${address}`, { method: 'POST' });
      const data = await res.json();

      setSteps(data.steps);
      setFinalConf(data.final_confidence);

      // Reveal steps one by one with 900ms delay for cinematic effect
      let count = 0;
      const reveal = () => {
        count++;
        setVisibleCount(count);
        if (count < data.steps.length) {
          timerRef.current = setTimeout(reveal, 900);
        } else {
          setDone(true);
          setRunning(false);
          onSimulationComplete?.(data);
        }
      };
      timerRef.current = setTimeout(reveal, 400);
    } catch (e) {
      setRunning(false);
      console.error('Simulation failed:', e);
    }
  };

  const currentConf = steps[visibleCount - 1]?.confidence_after || 'NONE';

  return (
    <div style={{
      background: 'rgba(99,102,241,0.04)',
      border: '1px solid rgba(99,102,241,0.18)',
      borderRadius: 16, padding: '22px 24px',
      marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            Network Simulation
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
            3 independent members score this wallet privately and submit ZK proofs
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {(running || done) && <TierBadge tier={currentConf} animate={running} />}
          <button
            onClick={runSim}
            disabled={running || !address}
            style={{
              padding: '10px 20px',
              background: running
                ? 'rgba(99,102,241,0.2)'
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', borderRadius: 10,
              color: 'white', fontWeight: 700, fontSize: 13,
              cursor: running || !address ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: !address ? 0.4 : 1,
              transition: 'all 0.2s',
              boxShadow: running ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
            }}
          >
            {running ? (
              <>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  animation: 'spin 0.7s linear infinite',
                  display: 'inline-block',
                }} />
                Simulating...
              </>
            ) : done ? 'Re-run Simulation' : 'Run Network Simulation'}
          </button>
        </div>
      </div>

      {/* Members legend */}
      {steps.length === 0 && !running && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { icon: 'EA', name: 'Exchange Alpha', color: '#6366f1' },
            { icon: 'WB', name: 'Wallet Beta',    color: '#8b5cf6' },
            { icon: 'PG', name: 'Protocol Gamma', color: '#a78bfa' },
          ].map(m => (
            <div key={m.icon} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: `${m.color}10`, border: `1px solid ${m.color}22`,
              borderRadius: 8, padding: '8px 14px',
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: 7,
                background: `${m.color}22`, border: `1px solid ${m.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 10, color: m.color,
              }}>{m.icon}</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{m.name}</span>
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#4b5563', display: 'flex', alignItems: 'center', marginLeft: 4 }}>
            Each scores independently · Only ZK proofs hit the registry
          </div>
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div>
          {steps.map((step, i) => (
            <MemberStep key={step.step} step={step} visible={i < visibleCount} />
          ))}

          {done && (
            <div style={{
              marginTop: 16, padding: '14px 18px',
              background: `${CONF_COLOR[finalConf]}10`,
              border: `1px solid ${CONF_COLOR[finalConf]}33`,
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              animation: 'fadeIn 0.5s ease',
            }}>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>
                Final registry state for this address:
              </span>
              <TierBadge tier={finalConf} animate={false} />
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
