import { useState } from 'react';
import { queryAddress } from './api';

export default function DefiOraclePanel() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null); // 'approved' | 'denied'
  const [details, setDetails] = useState(null);

  const DEMO_ADDRESSES = {
    'Vitalik.eth': '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    'Lazarus Group': '0x7f367cc41522ce07553e823bf3be79a889debe1b',
  };

  const handleBorrow = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setResult(null);
    setDetails(null);

    try {
      // Simulate blockchain tx delay
      await new Promise(r => setTimeout(r, 1200));
      
      const data = await queryAddress(address.trim());
      setDetails(data);

      // Defi logic: reject if MEDIUM or HIGH
      if (data.confidence_tier === 'HIGH' || data.confidence_tier === 'MEDIUM') {
        setResult('denied');
      } else {
        setResult('approved');
      }
    } catch (e) {
      console.error(e);
      setResult('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: 500, margin: '40px auto', 
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', padding: 32,
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: -100, left: -100, right: -100, height: 200,
        background: 'linear-gradient(180deg, var(--accent-glow) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ display: 'inline-block', padding: '6px 12px', background: 'var(--accent-glow)', borderRadius: 'var(--radius-xl)', color: 'var(--accent-light)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 12 }}>
          MOCK DEFI PROTOCOL
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Liquidity Pool</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Borrow USDC against your ETH collateral</div>
      </div>

      <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Amount to borrow</span>
          <span style={{ color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>100,000.00 USDC</span>
        </div>
        
        <div style={{ marginTop: 20 }}>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Recipient Wallet Address</label>
          <input 
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="0x..."
            style={{
              width: '100%', background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '12px 16px', color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)', fontSize: 13,
              outline: 'none', boxSizing: 'border-box'
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {Object.entries(DEMO_ADDRESSES).map(([name, addr]) => (
            <button
              key={name}
              onClick={() => setAddress(addr)}
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer',
                transition: 'border-color var(--transition-fast)'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        marginTop: 24, background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: 16,
        display: 'flex', alignItems: 'flex-start', gap: 12, border: '1px solid var(--border)'
      }}>
        <div style={{ fontSize: 20 }}>🛡️</div>
        <div>
          <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Sentinel Mesh Oracle Active</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
            This protocol queries the zero-knowledge intelligence network. Loans to wallets with MEDIUM or HIGH risk flags will be rejected by the smart contract.
          </div>
        </div>
      </div>

      <button
        onClick={handleBorrow}
        disabled={loading || !address}
        style={{
          width: '100%', marginTop: 24, padding: '16px', borderRadius: 'var(--radius-lg)',
          background: 'var(--accent)',
          border: 'none', color: 'white', fontWeight: 600, fontSize: 14,
          cursor: (loading || !address) ? 'not-allowed' : 'pointer',
          opacity: (loading || !address) ? 0.6 : 1,
          transition: 'background var(--transition-fast)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10
        }}
        onMouseEnter={e => { if(!loading && address) e.currentTarget.style.background = 'var(--accent-light)' }}
        onMouseLeave={e => { if(!loading && address) e.currentTarget.style.background = 'var(--accent)' }}
      >
        {loading ? (
          <><span className="spinner" style={{
            width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite'
          }}/> Querying Oracle...</>
        ) : 'Request 100,000 USDC Loan'}
      </button>

      {/* Results Box */}
      {result && (
        <div style={{
          marginTop: 20, padding: 20, borderRadius: 'var(--radius-lg)',
          background: result === 'approved' ? 'var(--green-subtle)' : 'var(--red-subtle)',
          border: `1px solid ${result === 'approved' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          animation: 'fadeInUp 0.4s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ 
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: result === 'approved' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: result === 'approved' ? 'var(--green)' : 'var(--red)', fontSize: 18
            }}>
              {result === 'approved' ? '✓' : '✕'}
            </div>
            <div>
              <div style={{ color: result === 'approved' ? 'var(--green)' : 'var(--red)', fontWeight: 600, fontSize: 14 }}>
                {result === 'approved' ? 'Loan Approved' : 'Loan Denied by Smart Contract'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                Oracle check completed
              </div>
            </div>
          </div>
          
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Oracle Threat Tier:</span>
              <span style={{ color: details?.confidence_tier === 'HIGH' ? 'var(--red)' : details?.confidence_tier === 'MEDIUM' ? 'var(--amber)' : 'var(--green)', fontWeight: 700 }}>
                {details?.confidence_tier || 'UNKNOWN'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Unique Flags Found:</span>
              <span>{details?.flag_count || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Contract Status:</span>
              <span>{result === 'approved' ? 'EXECUTED' : 'REVERTED'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Kill Switch Simulation */}
      {result === 'denied' && (
        <div style={{
          marginTop: 16, padding: 16, borderRadius: 'var(--radius-lg)',
          background: 'var(--amber-subtle)', border: '1px solid rgba(245,158,11,0.2)',
          animation: 'fadeInUp 0.6s ease', color: 'var(--text-primary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🚨</span>
            <span style={{ fontWeight: 600, color: 'var(--amber)' }}>Automated Kill Switch Triggered</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Because this wallet triggered a HIGH RISK threshold from the Sentinel Mesh Oracle, a smart contract hook has automatically paused all withdrawals and swaps for this address across the Protocol Gamma ecosystem.
          </div>
          <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(245,158,11,0.2)', paddingTop: 8 }}>
            <span style={{ color: 'var(--text-muted)' }}>Funds Frozen:</span>
            <span style={{ color: 'var(--amber)', fontWeight: 700 }}>$1,204,500.00 USDC</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
