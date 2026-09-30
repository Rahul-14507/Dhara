import math
import time
from typing import List, Tuple, Dict, Any, Optional
from collections import deque
from backend.models import TelemetryPayload, RiskAssessment, AlertRecord

class RiskEngine:
    """
    DHARA Demonstration Risk Engine.
    NOTE: These thresholds and weighting factors are for prototype/demonstration
    purposes only and do not constitute certified scientific slope-stability models.
    """
    def __init__(self, history_window: int = 120):
        # Stores recent history per node: node_id -> deque of (timestamp, TelemetryPayload)
        self.node_history: Dict[str, deque] = {}
        self.history_window = history_window

    def push_telemetry(self, telemetry: TelemetryPayload) -> Tuple[RiskAssessment, Optional[AlertRecord]]:
        node_id = telemetry.node_id
        current_time = telemetry.timestamp or time.time()

        if node_id not in self.node_history:
            self.node_history[node_id] = deque(maxlen=self.history_window)

        history = self.node_history[node_id]

        # 1. Normalize individual parameter scores (0 to 100)
        # Rain score: direct 0-100%
        rain_score = max(0.0, min(100.0, float(telemetry.rain_intensity)))

        # Soil moisture score: direct 0-100%
        soil_score = max(0.0, min(100.0, float(telemetry.soil_moisture)))

        # Tilt score: compound tilt magnitude from X and Y
        tilt_mag = math.sqrt((telemetry.tilt_x ** 2) + (telemetry.tilt_y ** 2))
        # 0 deg = 0%, 30 deg slope change = 100%
        tilt_score = max(0.0, min(100.0, (tilt_mag / 30.0) * 100.0))

        # Vibration score: 0 to 0.5g scale mapped to 0-100%
        vib = max(0.0, float(telemetry.vibration))
        vibration_score = max(0.0, min(100.0, (vib / 0.5) * 100.0))

        # 2. Weighted prototype risk formula
        # 0.30 * rain + 0.30 * soil + 0.25 * tilt + 0.15 * vibration
        raw_risk = (
            0.30 * rain_score +
            0.30 * soil_score +
            0.25 * tilt_score +
            0.15 * vibration_score
        )
        risk_score = round(max(0.0, min(100.0, raw_risk)), 2)

        # 3. Categorize Risk Level
        if risk_score < 30.0:
            risk_level = "SAFE"
        elif risk_score < 60.0:
            risk_level = "WATCH"
        elif risk_score < 80.0:
            risk_level = "WARNING"
        else:
            risk_level = "CRITICAL"

        # 4. Temporal Analysis (Rate of Change calculation)
        soil_roc = 0.0
        rain_roc = 0.0
        tilt_roc = 0.0

        if len(history) >= 1:
            # Compare against the most recent preceding reading
            prev_time, prev_data = history[-1]
            dt_seconds = current_time - prev_time
            if dt_seconds > 0.5:
                dt_minutes = dt_seconds / 60.0
                soil_roc = round((telemetry.soil_moisture - prev_data.soil_moisture) / dt_minutes, 2)
                rain_roc = round((telemetry.rain_intensity - prev_data.rain_intensity) / dt_minutes, 2)
                
                prev_tilt_mag = math.sqrt((prev_data.tilt_x ** 2) + (prev_data.tilt_y ** 2))
                tilt_roc = round((tilt_mag - prev_tilt_mag) / dt_minutes, 2)

        # 5. Detect triggers and alert events
        reasons = []
        if rain_score >= 60.0:
            reasons.append(f"High rain intensity ({rain_score:.1f}%)")
        if soil_score >= 65.0:
            reasons.append(f"Elevated soil saturation ({soil_score:.1f}%)")
        if tilt_score >= 40.0:
            reasons.append(f"Significant slope tilt ({tilt_mag:.1f}°)")
        if vibration_score >= 50.0:
            reasons.append(f"Abnormal seismic/surface vibration ({vib:.3f}g)")
        if abs(soil_roc) > 15.0:
            reasons.append(f"Rapid soil moisture influx ({soil_roc:+.1f}%/min)")
        if abs(tilt_roc) > 5.0:
            reasons.append(f"Active slope deformation ({tilt_roc:+.1f}°/min)")

        assessment = RiskAssessment(
            risk_score=risk_score,
            risk_level=risk_level,
            rain_score=round(rain_score, 2),
            soil_score=round(soil_score, 2),
            tilt_score=round(tilt_score, 2),
            vibration_score=round(vibration_score, 2),
            soil_rate_of_change=soil_roc,
            rain_rate_of_change=rain_roc,
            tilt_rate_of_change=tilt_roc,
            reasons=reasons
        )

        # Generate alert object if risk escalates or high thresholds met
        alert: Optional[AlertRecord] = None
        if risk_level in ["WATCH", "WARNING", "CRITICAL"]:
            # Pick event title
            if risk_level == "CRITICAL" or len(reasons) >= 3:
                event_name = "Multi-parameter risk escalation"
            elif tilt_score >= 50.0 or abs(tilt_roc) > 4.0:
                event_name = "Abnormal slope movement"
            elif rain_score >= 60.0:
                event_name = "Heavy rainfall detected"
            elif soil_score >= 65.0:
                event_name = "Soil saturation increasing"
            else:
                event_name = "Elevated environmental hazard threshold"

            alert = AlertRecord(
                id=f"ALT-{node_id}-{int(current_time)}",
                timestamp=current_time,
                iso_time=time.strftime("%H:%M:%S", time.localtime(current_time)),
                node_id=node_id,
                cluster_id=telemetry.cluster_id,
                event=event_name,
                severity=risk_level,
                risk_score=risk_score,
                triggers=reasons if reasons else ["Elevated compound risk metric"]
            )

        # Store in history
        history.append((current_time, telemetry))

        return assessment, alert

    def get_history(self, node_id: str) -> List[Tuple[float, TelemetryPayload]]:
        if node_id in self.node_history:
            return list(self.node_history[node_id])
        return []
