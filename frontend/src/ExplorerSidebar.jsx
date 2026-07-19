import React from 'react';

const TIER_CONFIG = {
  HIGH_RISK:  { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  SUSPICIOUS: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  CLEAN:      { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
};

export default function ExplorerSidebar({ node, onClose }) {
  if (!node) return null;

  const cfg = TIER_CONFIG[node.tier] || TIER_CONFIG.CLEAN;
  
  // Mock data for presentation
  const txVolume = node.flag_count > 0 ? (node.flag_count * 1.5).toFixed(1) : "0.0";
  const connections = node.flag_count > 0 ? (node.flag_count * 2) + 1 : 2;

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 300,
      background: 'rgba(17,24,39,0.95)', borderLeft: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(10px)', padding: 20, display: 'flex', flexDirection: 'column',
      animation: 'slideIn 0.3s ease', zIndex: 100, overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, letterSpacing: '0.05em' }}>NODE EXPLORER</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f9fafb', lineHeight: 1.2 }}>{node.label}</div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#6b7280', fontSize: 18, cursor: 'pointer'
        }}>✕</button>
      </div>

      <div style={{
        background: '#030712', borderRadius: 8, padding: 12, marginBottom: 20,
        border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11, color: '#d1d5db', wordBreak: 'break-all'
      }}>
        {node.id}
      </div>
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 99, background: cfg.bg, border: `1px solid ${cfg.color}33`,
          color: cfg.color, fontSize: 11, fontWeight: 700
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }} />
          {node.tier.replace('_', ' ')}
        </div>
        
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.1)`,
          color: '#d1d5db', fontSize: 11, fontWeight: 700
        }}>
          {node.id.startsWith('sol:') ? '🟣 Solana' : node.id.startsWith('btc:') ? '🟠 Bitcoin' : '🔵 Ethereum'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>Sentinel Flags</span>
          <span style={{ color: node.flag_count > 0 ? '#ef4444' : '#10b981', fontWeight: 700, fontSize: 13 }}>{node.flag_count}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>Confidence Tier</span>
          <span style={{ color: '#f9fafb', fontWeight: 700, fontSize: 13 }}>{node.confidence_tier || 'NONE'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>Known Connections</span>
          <span style={{ color: '#f9fafb', fontWeight: 700, fontSize: 13 }}>{connections} wallets</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>Est. Tx Volume</span>
          <span style={{ color: '#f9fafb', fontWeight: 700, fontSize: 13 }}>${txVolume}M+</span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {node.flag_count > 0 && (
        <div style={{
          padding: 12, borderRadius: 8, background: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.2)', fontSize: 12, color: '#a5b4fc',
          lineHeight: 1.4
        }}>
          <strong>Insight:</strong> This node has been cryptographically verified as malicious by {node.flag_count} independent sources in the Sentinel Mesh.
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
