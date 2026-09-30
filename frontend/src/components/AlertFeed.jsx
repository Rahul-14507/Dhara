import React from 'react';
import { AlertTriangle, AlertCircle, Info, BellRing } from 'lucide-react';

export default function AlertFeed({ alerts = [] }) {
  return (
    <div className="card-panel">
      <div className="panel-header">
        <div className="panel-title">
          <BellRing size={16} color="var(--warning-color)" />
          Hazard Alert Stream
        </div>
        <span className="panel-tag">
          {alerts.length} Events Logged
        </span>
      </div>

      {alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          <Info size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
          No critical hazard escalations active. All nodes reporting baseline parameters.
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.slice(0, 30).map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const isWarning = alert.severity === 'WARNING';
            const Icon = isCritical ? AlertTriangle : AlertCircle;

            return (
              <div key={alert.id || Math.random()} className={`alert-item severity-${alert.severity}`}>
                <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                  <Icon
                    size={18}
                    style={{
                      marginTop: '2px',
                      color: isCritical ? 'var(--critical-color)' : isWarning ? 'var(--warning-color)' : 'var(--watch-color)'
                    }}
                  />
                  <div>
                    <div className="alert-event-title">
                      {alert.event}
                      <span className={`risk-pill risk-${alert.severity}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                        {alert.severity}
                      </span>
                    </div>
                    <div className="alert-meta">
                      <span>Node: <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{alert.node_id}</strong></span>
                      <span>Cluster: <strong style={{ color: 'var(--text-main)' }}>{alert.cluster_id}</strong></span>
                      <span>Score: <strong style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{alert.risk_score?.toFixed(1)}</strong></span>
                    </div>
                    {alert.triggers && alert.triggers.length > 0 && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {alert.triggers.join(' | ')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="alert-time">
                  {alert.iso_time || 'Just now'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
