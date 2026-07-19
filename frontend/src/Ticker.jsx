import React from 'react';

const TICKER_MESSAGES = [
  { text: "Exchange Alpha flagged 0x7f36... [HIGH RISK]", color: "#ef4444" },
  { text: "DeFi Oracle blocked $50,000 flash loan on 0x3cbd...", color: "#f59e0b" },
  { text: "Wallet Beta submitted counter-proof for 0xd8da...", color: "#10b981" },
  { text: "Network Consensus reached on Lazarus Group", color: "#8b5cf6" },
  { text: "Protocol Gamma flagged new phishing contract", color: "#ef4444" },
  { text: "142 malicious transactions blocked in last hour", color: "#10b981" },
  { text: "Cross-chain tracking active: ETH -> SOL bridge monitored", color: "#3b82f6" },
  { text: "Court of Appeals slashed 500 $NIGHT from malicious node", color: "#ef4444" },
  { text: "AI Model detected high-velocity drainer pattern", color: "#f59e0b" },
  { text: "Tornado Cash interaction flagged by Node 4", color: "#8b5cf6" },
  { text: "Zero-Knowledge commitment verified on Midnight testnet", color: "#10b981" },
  { text: "Suspicious fan-out transfer intercepted", color: "#f59e0b" },
  { text: "New OFAC sanction list synced with Sentinel Mesh", color: "#3b82f6" },
  { text: "Staking pool rewards distributed to honest validators", color: "#10b981" }
];

export default function Ticker() {
  return (
    <div style={{
      width: '100%',
      background: '#030712',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '8px 0',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      fontSize: 12,
      fontFamily: 'JetBrains Mono, monospace',
      color: '#9ca3af'
    }}>
      <div style={{
        padding: '0 16px',
        fontWeight: 700,
        color: '#6366f1',
        borderRight: '1px solid rgba(255,255,255,0.1)',
        zIndex: 10,
        background: '#030712'
      }}>
        LIVE FEED
      </div>
      <div className="ticker-wrapper" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className="ticker-content">
          {[...TICKER_MESSAGES, ...TICKER_MESSAGES].map((msg, i) => (
            <span key={i} style={{ margin: '0 24px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: msg.color, boxShadow: `0 0 6px ${msg.color}` }} />
              <span style={{ color: msg.color }}>{msg.text}</span>
            </span>
          ))}
        </div>
      </div>
      <style>{`
        .ticker-content {
          display: inline-block;
          animation: ticker-scroll 60s linear infinite;
        }
        .ticker-content:hover {
          animation-play-state: paused;
        }
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
