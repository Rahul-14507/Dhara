import React from 'react';
import { Radio } from 'lucide-react';

export default function NetworkFlowVisualizer({ nodes = [], isLive = true }) {
  const physicalNode = nodes.find(n => n.source === 'physical');

  return (
    <div className="network-flow-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Radio size={14} color="var(--cyan-bright)" />
          <span style={{ fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            DATA TRANSMISSION & INGESTION ARCHITECTURE
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={{ fontSize: '0.62rem', background: '#f1f5f9', color: 'var(--cyan-bright)', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'var(--font-mono)' }}>
            SIMULATED LORA LINK
          </span>
          <span style={{ fontSize: '0.62rem', background: 'var(--safe-bg)', color: 'var(--safe-color)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--safe-border)', fontFamily: 'var(--font-mono)' }}>
            HTTP GATEWAY INGESTION
          </span>
        </div>
      </div>

      <svg className="network-flow-svg" viewBox="0 0 900 135">
        {/* Transmission Paths */}
        <path d="M 125 35 Q 225 35 325 68" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M 125 68 Q 225 68 325 68" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M 125 102 Q 225 102 325 68" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />

        {/* Gateway to DHARA Core */}
        <path d="M 445 68 L 530 68" fill="none" stroke="#94a3b8" strokeWidth="2" />

        {/* DHARA Core to Subsystems */}
        <path d="M 650 68 Q 695 30 740 30" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M 650 68 L 740 68" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M 650 68 Q 695 105 740 105" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />

        {/* Animated Packets */}
        {isLive && (
          <>
            <circle r="3" fill="#0284c7">
              <animateMotion dur="2.2s" repeatCount="indefinite" path="M 125 35 Q 225 35 325 68" />
            </circle>
            <circle r="3" fill="#0284c7">
              <animateMotion dur="2.0s" begin="0.7s" repeatCount="indefinite" path="M 125 68 Q 225 68 325 68" />
            </circle>
            <circle r="3" fill="#0284c7">
              <animateMotion dur="2.4s" begin="1.3s" repeatCount="indefinite" path="M 125 102 Q 225 102 325 68" />
            </circle>
            <circle r="3.5" fill="#0369a1">
              <animateMotion dur="1.4s" repeatCount="indefinite" path="M 445 68 L 530 68" />
            </circle>
            <circle r="3" fill="#059669">
              <animateMotion dur="1.8s" repeatCount="indefinite" path="M 650 68 Q 695 30 740 30" />
            </circle>
            <circle r="3" fill="#d97706">
              <animateMotion dur="1.8s" begin="0.6s" repeatCount="indefinite" path="M 650 68 L 740 68" />
            </circle>
            <circle r="3" fill="#0284c7">
              <animateMotion dur="1.8s" begin="1.0s" repeatCount="indefinite" path="M 650 68 Q 695 105 740 105" />
            </circle>
          </>
        )}

        {/* Distributed Nodes Column */}
        <g transform="translate(10, 10)">
          <rect width="115" height="115" rx="5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
          <text x="10" y="18" fill="#475569" fontSize="8.5" fontWeight="700" letterSpacing="0.04em">DISTRIBUTED NODES</text>
          
          <rect x="8" y="26" width="98" height="22" rx="3" fill="#ffffff" stroke="#e2e8f0" />
          <text x="14" y="40" fill="#0f172a" fontSize="8.5" fontFamily="monospace">NODE-A1/A2</text>
          <circle cx="95" cy="37" r="2.5" fill="#059669" />

          <rect x="8" y="52" width="98" height="22" rx="3" fill="#ffffff" stroke="#e2e8f0" />
          <text x="14" y="66" fill="#0f172a" fontSize="8.5" fontFamily="monospace">NODE-B1/B2/C1</text>
          <circle cx="95" cy="63" r="2.5" fill="#059669" />

          <rect x="8" y="78" width="98" height="22" rx="3" fill={physicalNode ? "var(--cyan-bg)" : "#ffffff"} stroke={physicalNode ? "rgba(2,132,199,0.4)" : "#e2e8f0"} />
          <text x="14" y="92" fill={physicalNode ? "#0284c7" : "#64748b"} fontSize="8.5" fontFamily="monospace" fontWeight={physicalNode ? "bold" : "normal"}>ESP32 (Physical)</text>
          <circle cx="95" cy="89" r="2.5" fill={physicalNode ? "#0284c7" : "#94a3b8"} />
        </g>

        {/* LoRa Gateway Simulation Box */}
        <g transform="translate(325, 38)">
          <rect width="120" height="60" rx="5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
          <text x="12" y="20" fill="#0284c7" fontSize="9.5" fontWeight="700">LORA GATEWAY</text>
          <text x="12" y="34" fill="#475569" fontSize="7.5">SIMULATION LAYER</text>
          <text x="12" y="48" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">Packet Demux</text>
        </g>

        {/* DHARA Core Box */}
        <g transform="translate(530, 38)">
          <rect width="120" height="60" rx="5" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
          <text x="12" y="20" fill="#0f172a" fontSize="9.5" fontWeight="700">DHARA CORE</text>
          <text x="12" y="34" fill="#0284c7" fontSize="7.5" fontWeight="600">FastAPI Ingestion</text>
          <text x="12" y="48" fill="#64748b" fontSize="7.5" fontFamily="monospace">HTTP Port 8000</text>
        </g>

        {/* Subsystems */}
        <g transform="translate(740, 14)">
          <rect width="145" height="30" rx="4" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1" />
          <text x="10" y="16" fill="#059669" fontSize="9" fontWeight="700">RISK ENGINE</text>
          <text x="10" y="25" fill="#047857" fontSize="7">4-Factor Normalized Model</text>
        </g>

        <g transform="translate(740, 52)">
          <rect width="145" height="30" rx="4" fill="#fffbeb" stroke="#fde68a" strokeWidth="1" />
          <text x="10" y="16" fill="#d97706" fontSize="9" fontWeight="700">ALERT ENGINE</text>
          <text x="10" y="25" fill="#b45309" fontSize="7">Temporal Trends & Thresholds</text>
        </g>

        <g transform="translate(740, 90)">
          <rect width="145" height="30" rx="4" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="1" />
          <text x="10" y="16" fill="#0284c7" fontSize="9" fontWeight="700">LIVE WEBSOCKET</text>
          <text x="10" y="25" fill="#0369a1" fontSize="7">/ws/live Broadcast Stream</text>
        </g>
      </svg>
    </div>
  );
}
