import React from 'react';

export default function LiveChart({
  title,
  data = [],
  dataKey,
  unit = '',
  color = '#0284c7',
  minVal = 0,
  maxVal = 100,
  warningThreshold = null,
  criticalThreshold = null,
  currentVal = 0
}) {
  // Extract values from history array
  const points = data.slice(-80).map((d) => {
    let val = d[dataKey];
    if (val === undefined || val === null) val = 0;
    return typeof val === 'number' ? val : parseFloat(val) || 0;
  });

  const width = 450;
  const height = 110;
  const padding = { top: 12, right: 12, bottom: 20, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Compute dynamic scale if values exceed default bounds
  let effectiveMin = minVal;
  let effectiveMax = maxVal;
  if (points.length > 0) {
    const pMax = Math.max(...points);
    if (pMax > effectiveMax) effectiveMax = Math.ceil(pMax * 1.15);
  }
  const range = effectiveMax - effectiveMin || 1;

  const getX = (index, total) => {
    if (total <= 1) return padding.left;
    return padding.left + (index / (total - 1)) * chartWidth;
  };

  const getY = (val) => {
    const clamped = Math.max(effectiveMin, Math.min(effectiveMax, val));
    const normalized = (clamped - effectiveMin) / range;
    return padding.top + chartHeight - normalized * chartHeight;
  };

  // Generate SVG path string
  let pathD = '';
  let areaD = '';

  if (points.length > 0) {
    const coords = points.map((val, idx) => ({
      x: getX(idx, points.length),
      y: getY(val)
    }));

    pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      pathD += ` L ${coords[i].x} ${coords[i].y}`;
    }

    const lastX = coords[coords.length - 1].x;
    const firstX = coords[0].x;
    const bottomY = padding.top + chartHeight;
    areaD = `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }

  // Generate unique gradient ID
  const gradId = `chart-grad-${dataKey}-${title.replace(/\s+/g, '')}`;

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-label">{title}</span>
        <span className="chart-current-val" style={{ color: color }}>
          {typeof currentVal === 'number' ? currentVal.toFixed(1) : currentVal}
          <span style={{ fontSize: '0.75rem', marginLeft: '3px', color: 'var(--text-dim)' }}>{unit}</span>
        </span>
      </div>

      <div className="chart-canvas-box">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={width - padding.right}
            y2={padding.top}
            stroke="#e2e8f0"
            strokeDasharray="2 2"
          />
          <line
            x1={padding.left}
            y1={padding.top + chartHeight / 2}
            x2={width - padding.right}
            y2={padding.top + chartHeight / 2}
            stroke="#e2e8f0"
            strokeDasharray="2 2"
          />
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            stroke="#cbd5e1"
          />

          {/* Threshold marker lines if configured */}
          {criticalThreshold && (
            <line
              x1={padding.left}
              y1={getY(criticalThreshold)}
              x2={width - padding.right}
              y2={getY(criticalThreshold)}
              stroke="#dc2626"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.7"
            />
          )}

          {/* Area Fill */}
          {areaD && <path d={areaD} fill={`url(#${gradId})`} />}

          {/* Line Path */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Current tip circle */}
          {points.length > 0 && (
            <circle
              cx={getX(points.length - 1, points.length)}
              cy={getY(points[points.length - 1])}
              r="4"
              fill="#ffffff"
              stroke={color}
              strokeWidth="2"
            />
          )}

          {/* Y Axis Labels */}
          <text x="5" y={padding.top + 6} fill="var(--text-dim)" fontSize="8" fontFamily="monospace">
            {effectiveMax}
          </text>
          <text x="5" y={padding.top + chartHeight} fill="var(--text-dim)" fontSize="8" fontFamily="monospace">
            {effectiveMin}
          </text>
          <text x={width - padding.right - 45} y={height - 4} fill="var(--text-dim)" fontSize="8" fontFamily="monospace">
            -80 samples
          </text>
        </svg>
      </div>
    </div>
  );
}
