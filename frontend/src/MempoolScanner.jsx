import React, { useState, useEffect } from 'react';

const genHash = () => '0x' + [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
const genAmount = () => (Math.random() * 10).toFixed(4) + ' ETH';

export default function MempoolScanner() {
  const [txs, setTxs] = useState([]);
  const [blockedCount, setBlockedCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const isMalicious = Math.random() > 0.85;
      
      const newTx = {
        id: Math.random().toString(),
        hash: genHash(),
        amount: genAmount(),
        status: isMalicious ? 'BLOCKED' : 'PENDING',
        time: new Date().toISOString().split('T')[1].slice(0, 12),
        gas: Math.floor(Math.random() * 100 + 20) + ' Gwei'
      };

      if (isMalicious) {
        setBlockedCount(c => c + 1);
      }

      setTxs(prev => [newTx, ...prev].slice(0, 15));
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', color: 'var(--text-primary)' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Mempool Pre-Crime Detection</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6, lineHeight: 1.6, maxWidth: 600 }}>
          Real-time scanning of the Ethereum mempool. Transactions from flagged wallets are intercepted before block confirmation.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Terminal feed */}
        <div style={{ 
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', 
          padding: 20, height: 440, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 10, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
            <span style={{ width: 80 }}>STATUS</span>
            <span style={{ flex: 1 }}>TX HASH</span>
            <span style={{ width: 100, textAlign: 'right' }}>AMOUNT</span>
            <span style={{ width: 80, textAlign: 'right' }}>GAS</span>
          </div>
          
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {txs.map((tx) => (
              <div key={tx.id} style={{ 
                display: 'flex', alignItems: 'center', padding: '8px 0', 
                borderBottom: '1px solid var(--border)',
                animation: 'fadeIn 0.2s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 80 }}>
                  <div style={{ 
                    width: 6, height: 6, borderRadius: '50%', 
                    background: tx.status === 'BLOCKED' ? 'var(--red)' : 'var(--green)',
                  }}></div>
                  <span style={{ 
                    fontSize: 10, fontWeight: 600, 
                    color: tx.status === 'BLOCKED' ? 'var(--red)' : 'var(--green)',
                  }}>
                    {tx.status}
                  </span>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tx.hash}</div>
                </div>
                <div style={{ width: 100, textAlign: 'right', color: 'var(--text-primary)', fontWeight: 500 }}>{tx.amount}</div>
                <div style={{ width: 80, textAlign: 'right', color: 'var(--text-muted)' }}>{tx.gas}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ 
            background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 24, 
            border: '1px solid var(--border)',
            transition: 'border-color var(--transition-fast)' 
          }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.03em', marginBottom: 8 }}>Pre-Crime Intercepts</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{blockedCount}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Drainers blocked</div>
          </div>
          
          <div style={{ 
            background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 24, 
            border: '1px solid var(--border)',
            transition: 'border-color var(--transition-fast)' 
          }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.03em', marginBottom: 8 }}>Scan Rate</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>~2.5</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>txs / sec analyzed</div>
          </div>

          <div style={{ 
            background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 24, 
            border: '1px solid var(--border)',
            transition: 'border-color var(--transition-fast)' 
          }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.03em', marginBottom: 8 }}>Model Confidence</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent-light)', letterSpacing: '-0.03em', lineHeight: 1 }}>94.7%</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Threat classification</div>
          </div>
        </div>
      </div>
    </div>
  );
}
