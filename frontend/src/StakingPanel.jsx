import React, { useState, useEffect } from 'react';
import { getStakingNodes } from './api';

export default function StakingPanel() {
  const [stakers, setStakers] = useState([]);
  const [bounties, setBounties] = useState([]);

  useEffect(() => {
    // 1. Fetch real staking nodes
    const fetchNodes = async () => {
      try {
        const nodes = await getStakingNodes();
        setStakers(nodes);
      } catch (e) {
        console.error("Failed to fetch staking nodes", e);
      }
    };
    fetchNodes();
    const t = setInterval(fetchNodes, 5000);

    // 2. Listen for live bounty payouts
    const eventSource = new EventSource('http://127.0.0.1:8000/staking/bounties');
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setBounties(prev => {
          const updated = [data, ...prev];
          return updated.slice(0, 5); // keep last 5 bounties
        });
      } catch (err) {}
    };

    return () => {
      clearInterval(t);
      eventSource.close();
    };
  }, []);
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', color: 'var(--text-primary)' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Cryptoeconomic Security & Reputation</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          The Sentinel Mesh uses a Confidence-Based Consensus model. Members must stake tokens to participate, and their threat intelligence is weighted by their on-chain Reputation Score. 
          If a member submits a cryptographically proven false flag, their staked tokens are slashed and their reputation is destroyed.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
        {stakers.map(s => (
          <div key={s.name} style={{
            background: 'var(--bg-card)', border: `1px solid ${s.status === 'Warned' ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)', padding: 24, position: 'relative', overflow: 'hidden',
            transition: 'border-color var(--transition-fast)'
          }}
          onMouseEnter={e => { if(s.status !== 'Warned') e.currentTarget.style.borderColor = 'var(--border-hover)' }}
          onMouseLeave={e => { if(s.status !== 'Warned') e.currentTarget.style.borderColor = 'var(--border)' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 4,
              background: s.status === 'Warned' ? 'var(--amber)' : 'var(--green)'
            }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{s.name}</div>
              <div style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: s.status === 'Warned' ? 'var(--amber-subtle)' : 'var(--green-subtle)',
                color: s.status === 'Warned' ? 'var(--amber)' : 'var(--green)', border: `1px solid ${s.status === 'Warned' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`
              }}>
                {s.status}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>{s.type}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Staked</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-light)' }}>{s.staked}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Slashed (Penalties)</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: s.slashed !== "0" ? 'var(--red)' : 'var(--green)' }}>{s.slashed}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Reputation Score</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${s.reputation}%`, height: '100%', background: s.reputation > 90 ? 'var(--green)' : s.reputation > 60 ? 'var(--amber)' : 'var(--red)', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: s.reputation > 90 ? 'var(--green)' : s.reputation > 60 ? 'var(--amber)' : 'var(--red)' }}>{s.reputation}/100</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 24, padding: 16, borderRadius: 'var(--radius-lg)',
        background: 'var(--accent-glow)', border: '1px solid rgba(99,102,241,0.2)',
        display: 'flex', gap: 12, alignItems: 'flex-start'
      }}>
        <div style={{ fontSize: 18, marginTop: 2 }}>⚖️</div>
        <div>
          <div style={{ color: 'var(--accent-light)', fontWeight: 600, fontSize: 13 }}>The Court of Appeals</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
            When a user successfully appeals a flag using the ZK-Counter Proof system, the offending node is penalized. 
            The slashed tokens are automatically redistributed to the victim and the honest nodes in the network.
          </div>
        </div>
      </div>

      {/* White-Hat Bounty System */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>White-Hat Bounty Feed</h3>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
          {bounties.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
              Monitoring AI threat engine for live white-hat bounties...
            </div>
          )}
          {bounties.map((bounty, i) => (
            <div key={bounty.id} style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              padding: '12px 0', borderBottom: i < bounties.length - 1 ? '1px solid var(--border)' : 'none',
              animation: 'slideIn 0.3s ease-out forwards'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--green-subtle)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  🛡️
                </div>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>{bounty.reason}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>Bounty claimed by <span style={{ color: 'var(--text-secondary)'}}>{bounty.researcher}</span></div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--green)', fontWeight: 600, fontSize: 12, fontFamily: 'var(--font-mono)' }}>{bounty.payout}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{bounty.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
