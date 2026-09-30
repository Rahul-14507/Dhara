import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ShieldAlert, 
  Radio, 
  Activity, 
  Layers, 
  Play, 
  Square, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  AlertTriangle,
  Server,
  Zap
} from 'lucide-react';

import NetworkFlowVisualizer from './components/NetworkFlowVisualizer';
import TerrainMap from './components/TerrainMap';
import NodeDetailPanel from './components/NodeDetailPanel';
import LiveChart from './components/LiveChart';
import AlertFeed from './components/AlertFeed';

const BACKEND_BASE = window.location.origin.includes(':5173') 
  ? 'http://127.0.0.1:8000' 
  : window.location.origin;

const WS_BASE = BACKEND_BASE.replace(/^http/, 'ws');

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('NODE-A1');
  const [alerts, setAlerts] = useState([]);
  const [overview, setOverview] = useState({
    total_nodes: 0,
    online_nodes: 0,
    stale_nodes: 0,
    offline_nodes: 0,
    safe_nodes: 0,
    watch_nodes: 0,
    warning_nodes: 0,
    critical_nodes: 0,
    active_alerts: 0
  });
  const [scenario, setScenario] = useState('NORMAL');
  const [simRunning, setSimRunning] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  
  // Historical time-series data for selected node (sliding buffer of 100 points)
  const [nodeHistory, setNodeHistory] = useState([]);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Fetch complete initial snapshot via REST
  const fetchSnapshot = useCallback(async () => {
    try {
      const [nodesRes, alertsRes, overviewRes, scenarioRes] = await Promise.all([
        fetch(`${BACKEND_BASE}/api/nodes`).then(r => r.json()),
        fetch(`${BACKEND_BASE}/api/alerts`).then(r => r.json()),
        fetch(`${BACKEND_BASE}/api/overview`).then(r => r.json()),
        fetch(`${BACKEND_BASE}/api/scenario`).then(r => r.json())
      ]);
      setNodes(nodesRes || []);
      setAlerts(alertsRes || []);
      setOverview(overviewRes || {});
      if (scenarioRes) {
        setScenario(scenarioRes.scenario || 'NORMAL');
        setSimRunning(scenarioRes.running ?? true);
      }
    } catch (e) {
      console.warn('[DHARA] REST polling error:', e);
    }
  }, []);

  // Fetch telemetry history for selected node
  const fetchNodeHistory = useCallback(async (nodeId) => {
    if (!nodeId) return;
    try {
      const histRes = await fetch(`${BACKEND_BASE}/api/telemetry/${nodeId}`).then(r => r.json());
      if (Array.isArray(histRes)) {
        // Map into chart-friendly points
        const chartPoints = histRes.map(item => ({
          ...item,
          tilt_mag: Math.sqrt((item.tilt_x || 0) ** 2 + (item.tilt_y || 0) ** 2),
          // Compound prototype score calculation if missing
          risk_score: Math.min(100, Math.max(0, 
            0.30 * (item.rain_intensity || 0) + 
            0.30 * (item.soil_moisture || 0) + 
            0.25 * (Math.min(100, Math.sqrt((item.tilt_x || 0) ** 2 + (item.tilt_y || 0) ** 2) / 30 * 100)) + 
            0.15 * (Math.min(100, (item.vibration || 0) / 0.5 * 100))
          ))
        }));
        setNodeHistory(chartPoints);
      }
    } catch (e) {
      console.warn('[DHARA] History fetch error:', e);
    }
  }, []);

  // Set up WebSocket connection with automatic exponential-style fallback
  useEffect(() => {
    let isMounted = true;

    const connectWebSocket = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(`${WS_BASE}/ws/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setWsConnected(true);
        console.log('[DHARA WS] Connected to live telemetry stream.');
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init_snapshot') {
            setNodes(msg.data.nodes || []);
            setAlerts(msg.data.alerts || []);
            setOverview(msg.data.overview || {});
            setScenario(msg.data.scenario || 'NORMAL');
            setSimRunning(msg.data.sim_running ?? true);
          } else if (msg.type === 'telemetry') {
            const telemetryEvent = msg.data;
            const updatedNodeId = telemetryEvent.node_id;

            // 1. Update node in list
            setNodes((prevNodes) => {
              const index = prevNodes.findIndex(n => n.node_id === updatedNodeId);
              const updatedNodeObj = {
                node_id: updatedNodeId,
                cluster_id: telemetryEvent.cluster_id,
                source: telemetryEvent.source,
                lat: telemetryEvent.lat,
                lng: telemetryEvent.lng,
                status: telemetryEvent.status,
                last_seen: telemetryEvent.last_seen,
                seconds_since_last: telemetryEvent.seconds_since_last,
                latest_telemetry: telemetryEvent.telemetry,
                latest_risk: telemetryEvent.risk
              };

              if (index >= 0) {
                const next = [...prevNodes];
                next[index] = updatedNodeObj;
                return next;
              } else {
                return [...prevNodes, updatedNodeObj];
              }
            });

            // 2. If it matches current selected node, append to local chart history
            if (updatedNodeId === selectedNodeId) {
              const t = telemetryEvent.telemetry;
              const r = telemetryEvent.risk;
              const newPoint = {
                timestamp: telemetryEvent.last_seen,
                temperature: t.temperature,
                humidity: t.humidity,
                soil_moisture: t.soil_moisture,
                rain_intensity: t.rain_intensity,
                tilt_x: t.tilt_x,
                tilt_y: t.tilt_y,
                tilt_mag: Math.sqrt((t.tilt_x || 0) ** 2 + (t.tilt_y || 0) ** 2),
                vibration: t.vibration,
                risk_score: r.risk_score
              };
              setNodeHistory((prev) => [...prev.slice(-90), newPoint]);
            }

            // 3. If alert included, prepend to alerts
            if (telemetryEvent.alert) {
              setAlerts((prevAlerts) => [telemetryEvent.alert, ...prevAlerts.slice(0, 50)]);
            }

            // Recalculate overview metrics smoothly
            setOverview((prev) => ({
              ...prev,
              server_time: telemetryEvent.last_seen
            }));
          } else if (msg.type === 'scenario_change') {
            setScenario(msg.data.scenario);
            setSimRunning(msg.data.running);
          }
        } catch (err) {
          console.error('[DHARA WS] Parse error:', err);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setWsConnected(false);
        console.warn('[DHARA WS] Disconnected. Reconnecting in 2.5s...');
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2500);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWebSocket();
    fetchSnapshot();

    // Fallback periodic poll to update stale/offline timer badges
    const pollInterval = setInterval(() => {
      fetchSnapshot();
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchSnapshot, selectedNodeId]);

  // When selected node changes, fetch its historical data points
  useEffect(() => {
    fetchNodeHistory(selectedNodeId);
  }, [selectedNodeId, fetchNodeHistory]);

  // Handler for changing simulation scenario
  const handleScenarioChange = async (newScenario) => {
    setScenario(newScenario);
    try {
      await fetch(`${BACKEND_BASE}/api/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: newScenario })
      });
    } catch (e) {
      console.error('Failed to update scenario:', e);
    }
  };

  // Handler for start/stop simulator
  const toggleSimulator = async () => {
    const nextRunning = !simRunning;
    setSimRunning(nextRunning);
    try {
      await fetch(`${BACKEND_BASE}/api/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenario, running: nextRunning })
      });
    } catch (e) {
      console.error('Failed to toggle simulator:', e);
    }
  };

  // Get currently selected node object
  const selectedNode = nodes.find(n => n.node_id === selectedNodeId) || nodes[0];

  return (
    <div className="dashboard-container">
      {/* 1. Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-icon">
            <ShieldAlert size={24} />
          </div>
          <div>
            <div className="brand-title">
              DHARA
              <span className="brand-badge">PROTOTYPE</span>
            </div>
            <div className="brand-subtitle">
              Disaster Hazard Analysis & Risk Alerting System
            </div>
          </div>
        </div>

        <div className="header-controls">
          {/* Live WS Status Badge */}
          <div className={`live-badge ${!wsConnected ? 'disconnected' : ''}`}>
            <span className="live-dot" />
            {wsConnected ? 'LIVE STREAMING' : 'DISCONNECTED / RECONNECTING'}
          </div>

          {/* Scenario Selector & Controls */}
          <div className="scenario-bar">
            <span className="scenario-label">Demo Scenario:</span>
            <select
              className="scenario-select"
              value={scenario}
              onChange={(e) => handleScenarioChange(e.target.value)}
            >
              <option value="NORMAL">NORMAL</option>
              <option value="HEAVY_RAIN">HEAVY RAIN</option>
              <option value="SOIL_SATURATION">SOIL SATURATION</option>
              <option value="SLOPE_MOVEMENT">SLOPE MOVEMENT</option>
              <option value="CRITICAL">CRITICAL HAZARD</option>
            </select>

            <button
              className="btn-toggle"
              onClick={toggleSimulator}
              title={simRunning ? 'Stop Simulation' : 'Start Simulation'}
            >
              {simRunning ? (
                <>
                  <Square size={13} fill="#ef4444" color="#ef4444" />
                  <span>STOP SIM</span>
                </>
              ) : (
                <>
                  <Play size={13} fill="#10b981" color="#10b981" />
                  <span>START SIM</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Summary Cards */}
      <section className="summary-grid">
        <div className="summary-card total">
          <div className="summary-title">
            <span>Total Sensor Nodes</span>
            <Layers size={16} color="var(--cyan-accent)" />
          </div>
          <div className="summary-value">{overview.total_nodes || nodes.length}</div>
          <div className="summary-sub">Across 3 Distributed Clusters</div>
        </div>

        <div className="summary-card online">
          <div className="summary-title">
            <span>Online Nodes</span>
            <Wifi size={16} color="var(--safe-color)" />
          </div>
          <div className="summary-value" style={{ color: 'var(--safe-color)' }}>
            {overview.online_nodes || nodes.filter(n => n.status === 'ONLINE').length}
          </div>
          <div className="summary-sub">
            {overview.stale_nodes || 0} Stale | {overview.offline_nodes || 0} Offline
          </div>
        </div>

        <div className="summary-card alerts">
          <div className="summary-title">
            <span>Active Hazard Alerts</span>
            <AlertTriangle size={16} color="var(--warning-color)" />
          </div>
          <div className="summary-value" style={{ color: 'var(--warning-color)' }}>
            {overview.active_alerts || alerts.length}
          </div>
          <div className="summary-sub">Temporal triggers recorded</div>
        </div>

        <div className="summary-card critical">
          <div className="summary-title">
            <span>High Risk Zones</span>
            <Zap size={16} color="var(--critical-color)" />
          </div>
          <div className="summary-value" style={{ color: (overview.warning_nodes + overview.critical_nodes) > 0 ? 'var(--critical-color)' : 'var(--text-main)' }}>
            {(overview.warning_nodes || 0) + (overview.critical_nodes || 0)}
          </div>
          <div className="summary-sub">
            {overview.critical_nodes || 0} Critical | {overview.warning_nodes || 0} Warning
          </div>
        </div>
      </section>

      {/* 3. Visual Network Ingestion Architecture */}
      <NetworkFlowVisualizer nodes={nodes} isLive={wsConnected} />

      {/* 4. Main Two-Column Monitoring Grid */}
      <div className="dashboard-main-grid">
        {/* LEFT COLUMN: Map, Live Charts & Node Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Topographical Map */}
          <TerrainMap
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={(id) => setSelectedNodeId(id)}
          />

          {/* Live Charts for Selected Node */}
          <div className="card-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Activity size={16} color="var(--cyan-bright)" />
                Real-Time Temporal Telemetry: <strong style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{selectedNodeId}</strong>
              </div>
              <span className="panel-tag">Last 80 Samples</span>
            </div>

            <div className="charts-grid">
              <LiveChart
                title="Rainfall Intensity"
                data={nodeHistory}
                dataKey="rain_intensity"
                unit="%"
                color="#38bdf8"
                currentVal={selectedNode?.latest_telemetry?.rain_intensity || 0}
                criticalThreshold={80}
              />
              <LiveChart
                title="Soil Moisture"
                data={nodeHistory}
                dataKey="soil_moisture"
                unit="%"
                color="#34d399"
                currentVal={selectedNode?.latest_telemetry?.soil_moisture || 0}
                criticalThreshold={85}
              />
              <LiveChart
                title="Slope Tilt Magnitude"
                data={nodeHistory}
                dataKey="tilt_mag"
                unit="°"
                color="#fbbf24"
                currentVal={Math.sqrt((selectedNode?.latest_telemetry?.tilt_x || 0) ** 2 + (selectedNode?.latest_telemetry?.tilt_y || 0) ** 2)}
                maxVal={30}
                criticalThreshold={20}
              />
              <LiveChart
                title="Prototype Risk Score"
                data={nodeHistory}
                dataKey="risk_score"
                unit="/100"
                color="#ef4444"
                currentVal={selectedNode?.latest_risk?.risk_score || 0}
                criticalThreshold={60}
              />
            </div>
          </div>

          {/* Node Grid View */}
          <div className="card-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Layers size={16} color="var(--cyan-bright)" />
                Distributed Sensor Nodes
              </div>
              <span className="panel-tag">Click to inspect</span>
            </div>

            <div className="nodes-grid-view">
              {nodes.map((node) => {
                const t = node.latest_telemetry || {};
                const r = node.latest_risk || {};
                const isSelected = node.node_id === selectedNodeId;

                return (
                  <div
                    key={node.node_id}
                    className={`node-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedNodeId(node.node_id)}
                  >
                    <div className="node-card-top">
                      <div>
                        <div className="node-name">
                          {node.node_id}
                          <span className={`node-source-pill ${node.source}`}>
                            {node.source}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {node.cluster_id}
                        </div>
                      </div>
                      <span className={`node-status-badge status-${node.status}`}>
                        {node.status}
                      </span>
                    </div>

                    <div className="node-metrics-mini">
                      <div className="metric-mini-item">
                        <span>Temp:</span>
                        <span>{t.temperature?.toFixed(1) ?? '--'}°C</span>
                      </div>
                      <div className="metric-mini-item">
                        <span>Humidity:</span>
                        <span>{t.humidity?.toFixed(0) ?? '--'}%</span>
                      </div>
                      <div className="metric-mini-item">
                        <span>Soil M.:</span>
                        <span>{t.soil_moisture?.toFixed(0) ?? '--'}%</span>
                      </div>
                      <div className="metric-mini-item">
                        <span>Rain:</span>
                        <span>{t.rain_intensity?.toFixed(0) ?? '--'}%</span>
                      </div>
                      <div className="metric-mini-item">
                        <span>Tilt:</span>
                        <span>{t.tilt_x?.toFixed(1)}°, {t.tilt_y?.toFixed(1)}°</span>
                      </div>
                      <div className="metric-mini-item">
                        <span>Vibration:</span>
                        <span>{t.vibration?.toFixed(2) ?? '0.00'}g</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span className={`risk-pill risk-${r.risk_level || 'SAFE'}`}>
                        {r.risk_level || 'SAFE'} ({r.risk_score?.toFixed(0) || 0})
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                        {node.seconds_since_last !== undefined ? `${node.seconds_since_last.toFixed(0)}s ago` : 'now'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Selected Node Detail & Live Alert Stream */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Selected Node Panel */}
          <NodeDetailPanel node={selectedNode} />

          {/* Live Alerts Panel */}
          <AlertFeed alerts={alerts} />
        </div>
      </div>

      {/* 5. Footer Disclaimer & Technical Honesty Banner */}
      <footer className="disclaimer-banner">
        <div>
          <span className="disclaimer-badge">PROTOTYPE NOTICE: </span>
          The DHARA Risk Engine utilizes a demonstration mathematical model for academic & prototyping validation. Field deployments require calibrated geotechnical slope-stability thresholds.
        </div>
        <div>
          <span className="disclaimer-badge">NETWORK ARCHITECTURE: </span>
          LoRa Network Simulation with HTTP Gateway Ingestion.
        </div>
      </footer>
    </div>
  );
}
