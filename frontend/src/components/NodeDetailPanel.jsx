import React from 'react';
import { 
  Thermometer, 
  Droplets, 
  CloudRain, 
  Compass, 
  ShieldAlert, 
  Cpu 
} from 'lucide-react';

export default function NodeDetailPanel({ node }) {
  if (!node) {
    return (
      <div className="card-panel" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)' }}>
        <Cpu size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
        <p style={{ fontSize: '0.85rem' }}>Select any sensor node to inspect real-time telemetry & hazard breakdown.</p>
      </div>
    );
  }

  const t = node.latest_telemetry || {};
  const r = node.latest_risk || {};
  const riskLevel = r.risk_level || 'SAFE';
  const riskScore = r.risk_score !== undefined ? r.risk_score : 0;

  // Rate of change
  const soilRoc = r.soil_rate_of_change || 0;
  const rainRoc = r.rain_rate_of_change || 0;
  const tiltRoc = r.tilt_rate_of_change || 0;

  return (
    <div className="card-panel">
      {/* Header */}
      <div className="panel-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
              {node.node_id}
            </span>
            <span className={`node-source-pill ${node.source}`}>
              {node.source}
            </span>
            <span className={`node-status-badge status-${node.status}`}>
              {node.status}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            CLUSTER: {node.cluster_id} | {node.lat?.toFixed(2)}°N, {node.lng?.toFixed(2)}°E
          </div>
        </div>

        <div className={`risk-pill risk-${riskLevel}`} style={{ fontSize: '0.8rem', padding: '3px 8px' }}>
          <ShieldAlert size={13} />
          {riskLevel} ({riskScore.toFixed(1)})
        </div>
      </div>

      {/* Prototype Risk Formula Decomposition Bar */}
      <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.72rem' }}>
          <span style={{ fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>PROTOTYPE RISK COMPOSITION</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--text-main)' }}>
            Score: {riskScore.toFixed(1)} / 100
          </span>
        </div>

        {/* Multi-segment progress bar */}
        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', display: 'flex', marginBottom: '8px' }}>
          <div style={{ width: `${(r.rain_score || 0) * 0.30}%`, background: '#0284c7' }} title={`Rain: ${r.rain_score || 0}`} />
          <div style={{ width: `${(r.soil_score || 0) * 0.30}%`, background: '#059669' }} title={`Soil: ${r.soil_score || 0}`} />
          <div style={{ width: `${(r.tilt_score || 0) * 0.25}%`, background: '#d97706' }} title={`Tilt: ${r.tilt_score || 0}`} />
          <div style={{ width: `${(r.vibration_score || 0) * 0.15}%`, background: '#dc2626' }} title={`Vibration: ${r.vibration_score || 0}`} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', fontSize: '0.65rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
          <div style={{ color: '#0284c7' }}>Rain (30%): <strong>{r.rain_score?.toFixed(0) || 0}%</strong></div>
          <div style={{ color: '#059669' }}>Soil (30%): <strong>{r.soil_score?.toFixed(0) || 0}%</strong></div>
          <div style={{ color: '#d97706' }}>Tilt (25%): <strong>{r.tilt_score?.toFixed(0) || 0}%</strong></div>
          <div style={{ color: '#dc2626' }}>Vib (15%): <strong>{r.vibration_score?.toFixed(0) || 0}%</strong></div>
        </div>
      </div>

      {/* Temporal Rate of Change Indicators */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Secondary Temporal Indicators (Rate of Change)
        </div>
        <div className="roc-strip">
          <div className="roc-chip">
            <span style={{ color: 'var(--text-dim)' }}>Rain:</span>
            <span className="roc-val" style={{ color: rainRoc > 0 ? 'var(--cyan-bright)' : 'var(--text-main)' }}>
              {rainRoc > 0 ? `+${rainRoc}` : rainRoc} %/min
            </span>
          </div>
          <div className="roc-chip">
            <span style={{ color: 'var(--text-dim)' }}>Soil Sat:</span>
            <span className="roc-val" style={{ color: soilRoc > 0 ? 'var(--emerald-accent)' : 'var(--text-main)' }}>
              {soilRoc > 0 ? `+${soilRoc}` : soilRoc} %/min
            </span>
          </div>
          <div className="roc-chip">
            <span style={{ color: 'var(--text-dim)' }}>Slope Creep:</span>
            <span className="roc-val" style={{ color: Math.abs(tiltRoc) > 0 ? 'var(--warning-color)' : 'var(--text-main)' }}>
              {tiltRoc > 0 ? `+${tiltRoc}` : tiltRoc} °/min
            </span>
          </div>
        </div>
      </div>

      {/* Sensor Metric Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
        {/* Temp & Humidity */}
        <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <Thermometer size={13} color="#e11d48" /> Temperature
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', fontFamily: 'var(--font-mono)', marginTop: '2px', color: 'var(--text-main)' }}>
            {t.temperature?.toFixed(1) ?? '--'} <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>°C</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Humidity: <strong style={{ color: 'var(--text-main)' }}>{t.humidity?.toFixed(1) ?? '--'}%</strong>
          </div>
        </div>

        {/* Soil Moisture */}
        <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <Droplets size={13} color="#059669" /> Soil Moisture
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', fontFamily: 'var(--font-mono)', marginTop: '2px', color: '#059669' }}>
            {t.soil_moisture?.toFixed(1) ?? '--'} <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>%</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Raw ADC: <span style={{ fontFamily: 'monospace' }}>{t.soil_raw ?? 'N/A'}</span>
          </div>
        </div>

        {/* Rain Intensity */}
        <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <CloudRain size={13} color="#0284c7" /> Rain Intensity
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', fontFamily: 'var(--font-mono)', marginTop: '2px', color: '#0284c7' }}>
            {t.rain_intensity?.toFixed(1) ?? '--'} <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>%</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Raw ADC: <span style={{ fontFamily: 'monospace' }}>{t.rain_raw ?? 'N/A'}</span>
          </div>
        </div>

        {/* IMU Tilt X & Y */}
        <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <Compass size={13} color="#d97706" /> IMU Slope Tilt
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', fontFamily: 'var(--font-mono)', marginTop: '2px', color: '#d97706' }}>
            {t.tilt_x?.toFixed(1)}° <span style={{ fontSize: '0.85rem' }}>{t.tilt_y?.toFixed(1)}°</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Vibration: <strong style={{ color: 'var(--text-main)' }}>{t.vibration?.toFixed(3) ?? '0.000'} g</strong>
          </div>
        </div>
      </div>

      {/* Active Triggers */}
      {r.reasons && r.reasons.length > 0 && (
        <div style={{ background: 'var(--watch-bg)', border: '1px solid var(--watch-border)', padding: '0.6rem 0.75rem', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--watch-color)', textTransform: 'uppercase' }}>
            Active Threshold Triggers:
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '3px' }}>
            {r.reasons.map((reason, idx) => (
              <span key={idx} style={{ fontSize: '0.68rem', background: '#ffffff', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '3px', color: 'var(--text-main)' }}>
                • {reason}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
