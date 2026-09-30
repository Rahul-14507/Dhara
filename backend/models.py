from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

class TelemetryPayload(BaseModel):
    node_id: str = Field(..., description="Unique node identifier, e.g., DHARA-NODE-01 or NODE-A1")
    cluster_id: str = Field("CLUSTER-A", description="Cluster or sector ID, e.g. CLUSTER-A")
    source: Literal["physical", "simulated"] = Field("simulated", description="Data origin")
    timestamp: Optional[float] = Field(default_factory=lambda: datetime.utcnow().timestamp())

    # Environmental sensors
    temperature: float = Field(25.0, description="Ambient temperature in °C")
    humidity: float = Field(50.0, description="Relative humidity %")
    soil_raw: Optional[int] = Field(None, description="Raw ADC value from soil moisture sensor")
    soil_moisture: Optional[float] = Field(None, description="Calculated/calibrated soil moisture percentage 0-100%")
    rain_raw: Optional[int] = Field(None, description="Raw ADC value from raindrop sensor")
    rain_intensity: Optional[float] = Field(None, description="Calculated rain intensity percentage 0-100%")

    # IMU sensors (MPU6050/6500)
    accel_x: float = Field(0.0, description="Acceleration X in g")
    accel_y: float = Field(0.0, description="Acceleration Y in g")
    accel_z: float = Field(1.0, description="Acceleration Z in g")
    gyro_x: float = Field(0.0, description="Angular velocity X in °/s")
    gyro_y: float = Field(0.0, description="Angular velocity Y in °/s")
    gyro_z: float = Field(0.0, description="Angular velocity Z in °/s")
    tilt_x: float = Field(0.0, description="Tilt angle X in degrees")
    tilt_y: float = Field(0.0, description="Tilt angle Y in degrees")
    vibration: float = Field(0.0, description="Vibration magnitude / displacement metric")

    # Optional geographical coordinates
    lat: Optional[float] = None
    lng: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def calculate_missing_percentages(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Compute soil_moisture from soil_raw if missing
            if data.get("soil_moisture") is None:
                raw_soil = data.get("soil_raw")
                if raw_soil is not None:
                    # Inverted scale: 3800 dry -> 1400 wet (0 to 100%)
                    pct = ((3800 - float(raw_soil)) / (3800 - 1400)) * 100.0
                    data["soil_moisture"] = round(max(0.0, min(100.0, pct)), 1)
                else:
                    data["soil_moisture"] = 0.0

            # Compute rain_intensity from rain_raw if missing
            if data.get("rain_intensity") is None:
                raw_rain = data.get("rain_raw")
                if raw_rain is not None:
                    # Inverted scale: 4000 dry -> 1200 wet (0 to 100%)
                    pct = ((4000 - float(raw_rain)) / (4000 - 1200)) * 100.0
                    data["rain_intensity"] = round(max(0.0, min(100.0, pct)), 1)
                else:
                    data["rain_intensity"] = 0.0
        return data

class RiskAssessment(BaseModel):
    risk_score: float = Field(..., description="Aggregated risk score 0.0 to 100.0")
    risk_level: Literal["SAFE", "WATCH", "WARNING", "CRITICAL"] = Field(..., description="Categorized risk level")
    rain_score: float
    soil_score: float
    tilt_score: float
    vibration_score: float
    soil_rate_of_change: float = Field(0.0, description="% change per minute")
    rain_rate_of_change: float = Field(0.0, description="% change per minute")
    tilt_rate_of_change: float = Field(0.0, description="° change per minute")
    reasons: List[str] = Field(default_factory=list)

class TelemetryResponse(BaseModel):
    status: str = "ok"
    node_id: str
    risk_score: float
    risk_level: Literal["SAFE", "WATCH", "WARNING", "CRITICAL"]
    timestamp: float

class AlertRecord(BaseModel):
    id: str
    timestamp: float
    iso_time: str
    node_id: str
    cluster_id: str
    event: str
    severity: Literal["WATCH", "WARNING", "CRITICAL"]
    risk_score: float
    triggers: List[str]

class NodeState(BaseModel):
    node_id: str
    cluster_id: str
    source: Literal["physical", "simulated"]
    lat: float
    lng: float
    status: Literal["ONLINE", "STALE", "OFFLINE"]
    last_seen: float
    seconds_since_last: float
    latest_telemetry: TelemetryPayload
    latest_risk: RiskAssessment

class SystemOverview(BaseModel):
    total_nodes: int
    online_nodes: int
    stale_nodes: int
    offline_nodes: int
    safe_nodes: int
    watch_nodes: int
    warning_nodes: int
    critical_nodes: int
    active_alerts: int
    server_time: float

class ScenarioUpdateRequest(BaseModel):
    scenario: Literal["NORMAL", "HEAVY_RAIN", "SOIL_SATURATION", "SLOPE_MOVEMENT", "CRITICAL"]
    running: Optional[bool] = None
