import React, { useState, useEffect } from 'react';
import { API } from './api';

const INITIAL_MESSAGES = [
  { text: "Waiting for live network events...", color: "#6366f1" },
  { text: "System fully synchronized with Sentinel Mesh", color: "#10b981" },
  { text: "Monitoring mempool for OFAC sanctioned addresses", color: "#3b82f6" },
  { text: "Federated ML agent active on 12 nodes", color: "#8b5cf6" },
  { text: "Zero-Knowledge SNARK verification online", color: "#10b981" },
  { text: "No active threats detected in last 5 minutes", color: "#9ca3af" },
  { text: "Connecting to centralized exchange relays...", color: "#6366f1" }
];

export default function Ticker() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);

  useEffect(() => {
    // Connect to the backend Server-Sent Events (SSE) stream
    const eventSource = new EventSource(`${API}/ticker/stream`);

    eventSource.onmessage = (event) => {
      try {
        const newMsg = JSON.parse(event.data);
        // Prepend new event and keep array length constant to prevent CSS jumps
        setMessages(prev => {
          const updated = [newMsg, ...prev];
          return updated.slice(0, 15); // Keep the latest 15 events
        });
      } catch (err) {
        console.error("Failed to parse SSE ticker event", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

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
      fontFamily: 'var(--font-mono)',
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
          {[...messages, ...messages].map((msg, i) => (
            <span key={i} style={{ margin: '0 24px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ 
                width: 6, height: 6, borderRadius: '50%', 
                background: msg.color, boxShadow: `0 0 6px ${msg.color}`,
                transition: 'all 0.3s ease'
              }} />
              <span style={{ color: msg.color, transition: 'color 0.3s ease' }}>{msg.text}</span>
            </span>
          ))}
        </div>
      </div>
      <style>{`
        .ticker-content {
          display: inline-block;
          /* Faster animation to emphasize live streaming data */
          animation: ticker-scroll 45s linear infinite;
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
