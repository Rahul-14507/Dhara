import React from 'react';
import { Navigation } from 'lucide-react';

export default function TerrainMap({ nodes = [], selectedNodeId, onSelectNode }) {
  const minLat = 17.48, maxLat = 17.63;
  const minLng = 78.33, maxLng = 78.47;

  const getPos = (lat = 17.50, lng = 78.35) => {
    const yPct = ((maxLat - lat) / (maxLat - minLat)) * 80 + 10;
    const xPct = ((lng - minLng) / (maxLng - minLng)) * 80 + 10;
    return {
      top: `${Math.max(8, Math.min(92, yPct))}%`,
      left: `${Math.max(8, Math.min(92, xPct))}%`
    };
  };

  const getRiskColor = (riskLevel = 'SAFE') => {
    switch (riskLevel) {
      case 'CRITICAL': return 'var(--critical-color)';
      case 'WARNING': return 'var(--warning-color)';
      case 'WATCH': return 'var(--watch-color)';
      default: return 'var(--safe-color)';
    }
  };

  return (
    <div className="map-canvas-container">
      {/* Grid overlay */}
      <div className="map-grid-overlay"></div>

      {/* Topographical Contours */}
      <svg className="map-topo-curve" viewBox="0 0 1000 600" preserveAspectRatio="none">
        <path d="M 0 150 Q 300 120, 600 220 T 1000 180" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="4 4" />
        <path d="M 0 300 Q 250 240, 550 380 T 1000 320" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />
        <path d="M 0 450 Q 400 360, 750 500 T 1000 440" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="4 4" />
        <path d="M 150 0 Q 350 300, 250 600" fill="none" stroke="#e2e8f0" strokeWidth="1" />
        <path d="M 650 0 Q 800 350, 700 600" fill="none" stroke="#e2e8f0" strokeWidth="1" />
        
        {/* Cluster Zone Demarcations */}
        <circle cx="280" cy="420" r="120" fill="rgba(2, 132, 199, 0.04)" stroke="#94a3b8" strokeDasharray="4 4" />
        <text x="210" y="320" fill="#64748b" fontSize="11" fontWeight="700" fontFamily="monospace">CLUSTER-A</text>

        <circle cx="620" cy="270" r="130" fill="rgba(2, 132, 199, 0.04)" stroke="#94a3b8" strokeDasharray="4 4" />
        <text x="560" y="160" fill="#64748b" fontSize="11" fontWeight="700" fontFamily="monospace">CLUSTER-B</text>

        <circle cx="850" cy="130" r="100" fill="rgba(2, 132, 199, 0.04)" stroke="#94a3b8" strokeDasharray="4 4" />
        <text x="800" y="50" fill="#64748b" fontSize="11" fontWeight="700" fontFamily="monospace">CLUSTER-C</text>
      </svg>

      {/* Map Header Overlay */}
      <div style={{ position: 'absolute', top: '10px', left: '12px', zIndex: 5, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Navigation size={13} color="var(--cyan-bright)" />
        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          GEOGRAPHIC SENSOR CLUSTER DISTRIBUTION
        </span>
      </div>

      <div style={{ position: 'absolute', bottom: '8px', right: '10px', zIndex: 5, fontSize: '0.62rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
        SECTOR COORDS: 17.50°N / 78.35°E
      </div>

      {/* Node Markers */}
      {nodes.map((node) => {
        const coords = getPos(node.lat, node.lng);
        const riskLevel = node.latest_risk?.risk_level || 'SAFE';
        const color = getRiskColor(riskLevel);
        const isSelected = selectedNodeId === node.node_id;

        return (
          <div
            key={node.node_id}
            className="map-node-marker"
            style={{
              top: coords.top,
              left: coords.left,
              color: color
            }}
            onClick={() => onSelectNode(node.node_id)}
          >
            <div
              className="map-marker-pin"
              style={{
                backgroundColor: color,
                border: isSelected ? '2px solid #0f172a' : '2px solid #ffffff',
                boxShadow: isSelected ? '0 0 0 3px rgba(2,132,199,0.3)' : '0 1px 3px rgba(0,0,0,0.15)',
                transform: isSelected ? 'scale(1.2)' : 'scale(1.0)',
                transition: 'all 0.15s ease'
              }}
            >
              {node.source === 'physical' ? (
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#fff' }} />
              ) : null}
            </div>
            <div
              className="map-marker-label"
              style={{
                borderColor: isSelected ? 'var(--cyan-bright)' : 'var(--border)',
                color: isSelected ? 'var(--cyan-bright)' : 'var(--text-main)',
                fontWeight: isSelected ? '800' : '600'
              }}
            >
              {node.node_id}
            </div>
          </div>
        );
      })}
    </div>
  );
}
