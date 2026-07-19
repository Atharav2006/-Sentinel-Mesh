import { useState, useEffect, useCallback } from 'react';
import { scoreAddress, flagAddress, queryAddress, getRegistry, getHealth, getGraph } from './api';
import ForceGraph from './ForceGraph';
import SimulationPanel from './SimulationPanel';
import AppealPanel from './AppealPanel';
import HeroParticles from './HeroParticles';
import DefiOraclePanel from './DefiOraclePanel';
import Ticker from './Ticker';
import StakingPanel from './StakingPanel';
import ExplorerSidebar from './ExplorerSidebar';
import FederatedAIPanel from './FederatedAIPanel';
import MempoolScanner from './MempoolScanner';
import ZkKycPanel from './ZkKycPanel';
import CrossChainRadar from './CrossChainRadar';
import { DAppConnectorAPI } from './midnight-sdk';
import './App.css';

// ── Demo wallet set ────────────────────────────────────────────────────────────
const DEMO_WALLETS = [
  { address: '0x7f367cc41522ce07553e823bf3be79a889debe1b', label: 'Lazarus Group (OFAC)' },
  { address: '0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b', label: 'Hydra Marketplace (OFAC)' },
  { address: '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b', label: 'Tornado Cash Router' },
  { address: '0x3cbded43efdaf0fc77b9c55f6fc9988fcc9b757d', label: 'Suspicious Wallet' },
  { address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', label: 'vitalik.eth (Clean)' },
];

const TIER_CONFIG = {
  HIGH_RISK:  { color: '#ef4444', glow: 'rgba(239,68,68,0.2)',   bg: 'rgba(239,68,68,0.08)',   label: '⚠ HIGH RISK',  badge: '#ef4444' },
  SUSPICIOUS: { color: '#f59e0b', glow: 'rgba(245,158,11,0.2)',  bg: 'rgba(245,158,11,0.08)',  label: '~ SUSPICIOUS', badge: '#f59e0b' },
  CLEAN:      { color: '#10b981', glow: 'rgba(16,185,129,0.2)',  bg: 'rgba(16,185,129,0.08)',  label: '✓ CLEAN',      badge: '#10b981' },
};

const CONF_CONFIG = {
  HIGH:   { color: '#ef4444', label: 'HIGH — flagged by 3+ independent sources' },
  MEDIUM: { color: '#f59e0b', label: 'MEDIUM — flagged by 2 sources' },
  LOW:    { color: '#f59e0b', label: 'LOW — flagged by 1 source' },
  NONE:   { color: '#10b981', label: 'NONE — no flags found' },
};

function short(addr) {
  return addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '';
}

function ScoreBar({ score }) {
  const color = score > 60 ? '#ef4444' : score >= 30 ? '#f59e0b' : '#10b981';
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
        <span>Risk Score</span><span style={{ color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{score}/100</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${score}%`, borderRadius: 99,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          boxShadow: `0 0 12px ${color}66`,
          transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)'
        }} />
      </div>
    </div>
  );
}

function Badge({ tier }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.CLEAN;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.06em', color: cfg.color,
      background: cfg.bg, border: `1px solid ${cfg.color}44`,
    }}>
      {cfg.label}
    </span>
  );
}

function FlagChip({ tag }) {
  return (
    <span style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: '2px 8px',
      borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#fca5a5',
      border: '1px solid rgba(239,68,68,0.2)', whiteSpace: 'nowrap',
    }}>
      {tag}
    </span>
  );
}

// ── Removed simple NetworkGraph — replaced with D3 ForceGraph ─────────────────────────────────────

export default function App() {
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [queryData, setQueryData] = useState(null);
  const [flagData,  setFlagData]  = useState(null);
  const [registry,  setRegistry]  = useState([]);
  const [graphData, setGraphData] = useState(null);
  const [health,    setHealth]    = useState(null);
  const [error,     setError]     = useState('');
  const [activeTab, setActiveTab] = useState('search');
  const [selectedNode, setSelectedNode] = useState(null);
  const [wallet, setWallet] = useState(null);

  const fetchRegistry = useCallback(async () => {
    try { setRegistry(await getRegistry()); } catch {}
  }, []);

  const fetchGraph = useCallback(async () => {
    try { setGraphData(await getGraph()); } catch {}
  }, []);

  useEffect(() => {
    fetchRegistry();
    fetchGraph();
    getHealth().then(setHealth).catch(() => setHealth({ status: 'offline' }));
    const t = setInterval(() => { fetchRegistry(); fetchGraph(); }, 5000);
    return () => clearInterval(t);
  }, [fetchRegistry, fetchGraph]);

  const handleScan = async (addr) => {
    const target = (addr || input).trim();
    if (!target) return;
    setInput(target);
    setLoading(true);
    setError('');
    setScoreData(null);
    setQueryData(null);
    setFlagData(null);

    try {
      const [score, query] = await Promise.all([
        scoreAddress(target),
        queryAddress(target),
      ]);
      setScoreData(score);
      setQueryData(query);

      if (score.exceeds_threshold) {
        const flag = await flagAddress(target);
        setFlagData(flag);
        await Promise.all([fetchRegistry(), fetchGraph()]);
      }
    } catch (e) {
      setError(e.message || 'Failed to scan address. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  const tier = scoreData?.tier;
  const cfg  = tier ? TIER_CONFIG[tier] : null;

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">S</div>
            <div>
              <div className="logo-title">Sentinel Mesh</div>
              <div className="logo-sub">Confidential Fraud Intelligence</div>
            </div>
          </div>
          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className={`status-dot ${health?.status === 'ok' ? 'online' : 'offline'}`} />
              <span className="status-label">{health?.status === 'ok' ? `API Online · ${health.registry_size} proofs` : 'API Offline'}</span>
            </div>
            
            <button
              onClick={async () => {
                if (wallet) {
                  setWallet(null);
                } else {
                  const res = await DAppConnectorAPI.connectWallet();
                  setWallet(res.address);
                }
              }}
              style={{
                background: wallet ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${wallet ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
                color: wallet ? '#10b981' : '#e5e7eb',
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace'
              }}
            >
              {wallet ? `🟢 ${wallet}` : 'Connect Lace Wallet'}
            </button>
          </div>
        </div>
      </header>
      
      <Ticker />

      {/* ── Hero ── */}
      <section className="hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <HeroParticles />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-badge">Powered by Zero-Knowledge Proofs · Midnight Blockchain · MLH DeFi Track</div>
          <h1 className="hero-title">
            Prove fraud.<br />
            <span className="hero-accent">Reveal nothing.</span>
          </h1>
          <p className="hero-desc">
            A shared fraud-intelligence network where exchanges flag malicious wallets
            using ZK proofs — without exposing transaction data, models, or identity.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
            <button
              onClick={() => { setActiveTab('search'); document.querySelector('#wallet-search')?.focus(); }}
              className="scan-btn"
              style={{
                padding: '13px 28px', borderRadius: 12, fontSize: 14,
              }}
            >
              Try Live Demo →
            </button>
            <button
              onClick={() => setActiveTab('registry')}
              className="demo-chip"
              style={{
                padding: '13px 24px', fontSize: 14, fontWeight: 600,
              }}
            >
              View Registry
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats Grid ── */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '24px',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px',
        }}>
          {[
            { val: health?.registry_size ?? 0, label: 'ZK Proofs Generated', color: 'var(--text-primary)' },
            { val: '3',  label: 'Network Nodes', color: 'var(--accent-light)' },
            { val: [...new Set(registry.map(r => r.address))].length, label: 'Threats Flagged', color: 'var(--red)' },
            { val: '0',  label: 'Data Exposed',  color: 'var(--green)' },
          ].map((s) => (
            <div key={s.label} style={{
              textAlign: 'center', padding: '20px 16px',
            }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: s.color, fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {s.val}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontWeight: 500, letterSpacing: '0.03em' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-light)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>How It Works</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Privacy by design, not by policy</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 40 }}>
          {[
            {
              step: '01', icon: '🔍',
              title: 'Private Scoring',
              desc: 'Each network member runs their own fraud model locally. Scores are computed privately and never shared.',
            },
            {
              step: '02', icon: '🔐',
              title: 'ZK Proof Submission',
              desc: 'If a wallet exceeds the risk threshold, a SHA256 commitment proves it without revealing the actual score.',
            },
            {
              step: '03', icon: '📊',
              title: 'Consensus Registry',
              desc: 'Confidence tiers (LOW/MEDIUM/HIGH) emerge as independent members flag the same wallet — no central authority.',
            },
          ].map(s => (
            <div key={s.step} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: 24, position: 'relative',
              transition: 'border-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
                marginBottom: 12,
              }}>{s.step}</div>
              <div style={{ fontSize: 24, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

        <div className="nav-inner">
          <div className="tabs">
            <button className={`tab ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>🛡️ Scan Wallet</button>
            <button className={`tab ${activeTab === 'registry' ? 'active' : ''}`} onClick={() => setActiveTab('registry')}>📜 Threat Registry</button>
            <button className={`tab ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')}>🕸️ Network Graph</button>
            <button className={`tab ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>🧠 Federated AI</button>
            <button className={`tab ${activeTab === 'mempool' ? 'active' : ''}`} onClick={() => setActiveTab('mempool')}>⏳ Mempool Scanner</button>
            <button className={`tab ${activeTab === 'crosschain' ? 'active' : ''}`} onClick={() => setActiveTab('crosschain')}>🌉 Cross-Chain Radar</button>
            <button className={`tab ${activeTab === 'kyc' ? 'active' : ''}`} onClick={() => setActiveTab('kyc')}>🆔 ZK-KYC</button>
            <button className={`tab ${activeTab === 'staking' ? 'active' : ''}`} onClick={() => setActiveTab('staking')}>💰 Cryptoeconomics</button>
            <button className={`tab ${activeTab === 'oracle' ? 'active' : ''}`} onClick={() => setActiveTab('oracle')}>⚡ DeFi Oracle</button>
          </div>
        </div>

      <main className="main">

        {activeTab === 'search' && (
          <>
            {/* ── Search bar ── */}
            <div className="search-card">
              <div className="search-row">
                <input
                  id="wallet-search"
                  className="search-input"
                  placeholder="Enter wallet address  e.g. 0x7f367..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScan()}
                  spellCheck={false}
                />
                <button
                  id="scan-btn"
                  className={`scan-btn ${loading ? 'loading' : ''}`}
                  onClick={() => handleScan()}
                  disabled={loading || !input.trim()}
                >
                  {loading ? <span className="spinner" /> : 'Scan'}
                </button>
              </div>

              {/* Quick demos */}
              <div className="demo-row">
                <span className="demo-label">Try:</span>
                {DEMO_WALLETS.map(w => (
                  <button key={w.address} className="demo-chip" onClick={() => handleScan(w.address)}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="error-banner">{error}</div>}

            {/* ── Result card ── */}
            {scoreData && cfg && (
              <div className="result-card" style={{ '--glow': cfg.glow, '--accent': cfg.color, borderColor: `${cfg.color}33` }}>
                <div className="result-header">
                  <div>
                    <div className="result-addr">{short(scoreData.address)}</div>
                    <div className="result-addr-full">{scoreData.address}</div>
                  </div>
                  <Badge tier={scoreData.tier} />
                </div>

                <ScoreBar score={scoreData.score} />

                {scoreData.flags.length > 0 && (
                  <div className="flags-row">
                    {scoreData.flags.map(f => <FlagChip key={f} tag={f} />)}
                  </div>
                )}

                <div className="result-grid">
                  <div className="stat-box">
                    <div className="stat-val">{scoreData.tx_count}</div>
                    <div className="stat-key">Transactions</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-val">{scoreData.mixer_interactions}</div>
                    <div className="stat-key">Mixer Hits</div>
                  </div>
                  <div className="stat-box" style={{ background: scoreData.ai_confidence > 0.8 ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)' }}>
                    <div className="stat-val" style={{ color: scoreData.ai_confidence > 0.8 ? '#ef4444' : '#a78bfa' }}>
                      {Math.round((scoreData.ai_confidence || 0) * 100)}%
                    </div>
                    <div className="stat-key" style={{ color: scoreData.ai_confidence > 0.8 ? '#fca5a5' : '#c4b5fd' }}>AI Threat Prob</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-val">{queryData?.flag_count ?? 0}</div>
                    <div className="stat-key">Times Flagged</div>
                  </div>
                </div>

                {/* ZK proof result */}
                {flagData?.flagged && (
                  <div className="proof-box">
                    <div className="proof-header">
                      <span className="proof-icon">ZK</span>
                      <span>Zero-Knowledge Proof Generated</span>
                    </div>
                    <div className="proof-row">
                      <span className="proof-key">Proof ID</span>
                      <span className="proof-val">{flagData.proof_id}</span>
                    </div>
                    <div className="proof-row">
                      <span className="proof-key">Commitment</span>
                      <span className="proof-val">{flagData.commitment}</span>
                    </div>
                    <div className="proof-row">
                      <span className="proof-key">Proves</span>
                      <span className="proof-val" style={{ color: '#f87171' }}>score &gt; 60 · score hidden</span>
                    </div>
                    <div className="proof-row">
                      <span className="proof-key">Confidence</span>
                      <span className="proof-val" style={{ color: CONF_CONFIG[queryData?.confidence_tier]?.color }}>
                        {queryData?.confidence_tier} — {queryData?.flag_count} flag(s)
                      </span>
                    </div>
                  </div>
                )}

                {/* Multi-member simulation panel — only for HIGH RISK */}
                {scoreData.tier === 'HIGH_RISK' && (
                  <div style={{ marginTop: 20 }}>
                    <SimulationPanel
                      address={scoreData.address}
                      onSimulationComplete={() => {
                        fetchRegistry();
                        fetchGraph();
                      }}
                    />
                  </div>
                )}

                {/* Counter-proof appeal — shown for any flagged wallet */}
                {scoreData.exceeds_threshold && (
                  <AppealPanel
                    address={scoreData.address}
                    flagCount={queryData?.flag_count ?? 1}
                  />
                )}

                {scoreData.tier === 'CLEAN' && (
                  <div className="clean-banner">
                    No flags found in registry. Wallet appears clean.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'registry' && (
          <div className="registry-card">
            <div className="registry-header">
              <h2 className="registry-title">Flagged Address Registry</h2>
              <span className="registry-sub">
                ZK proofs only — no scores, no evidence, no member identities
              </span>
            </div>

            <div style={{ marginBottom: 28, position: 'relative', overflow: 'hidden', borderRadius: 16 }}>
              <h3 style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Network Graph
              </h3>
              {graphData ? (
                <>
                  <ForceGraph
                    graphData={graphData}
                    onNodeClick={(node) => setSelectedNode(node)}
                  />
                  <ExplorerSidebar node={selectedNode} onClose={() => setSelectedNode(null)} />
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#4b5563', padding: '60px 0', fontSize: 14 }}>
                  Loading graph...
                </div>
              )}
            </div>

            <h3 style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Proof Log
            </h3>
            {registry.length === 0 ? (
              <div style={{ color: '#4b5563', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
                Registry is empty. Scan a wallet to generate proofs.
              </div>
            ) : (
              <div className="proof-table">
                <div className="proof-table-head">
                  <span>Address</span>
                  <span>Proof ID</span>
                  <span>Commitment</span>
                  <span>Confidence</span>
                </div>
                {registry.map(e => {
                  const ccfg = CONF_CONFIG[e.confidence_tier] || CONF_CONFIG.NONE;
                  return (
                    <div key={e.proof_id} className="proof-table-row">
                      <span className="mono">{short(e.address)}</span>
                      <span className="mono dim">{e.proof_id}</span>
                      <span className="mono dim">{e.commitment.slice(0, 16)}...</span>
                      <span style={{ color: ccfg.color, fontWeight: 600, fontSize: 12 }}>{e.confidence_tier}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

          {activeTab === 'staking' && <StakingPanel />}
          {activeTab === 'network' && <ForceGraph graphData={graphData} onNodeClick={setSelectedNode} />}
          {activeTab === 'oracle' && <DefiOraclePanel />}
          {activeTab === 'ai' && <FederatedAIPanel />}
          {activeTab === 'mempool' && <MempoolScanner />}
          {activeTab === 'crosschain' && <CrossChainRadar />}
          {activeTab === 'kyc' && <ZkKycPanel />}
        
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <div>Built for Midnight Hackathon · MLH · DeFi Track</div>
        <div style={{ color: '#374151', marginTop: 4 }}>Scores never leave your device · Only ZK proofs hit the chain</div>
      </footer>
    </div>
  );
}
