import asyncio
import time
from typing import Dict, List, Any, Optional
from collections import deque
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from backend.models import (
    TelemetryPayload,
    TelemetryResponse,
    RiskAssessment,
    AlertRecord,
    NodeState,
    SystemOverview,
    ScenarioUpdateRequest
)
from backend.risk_engine import RiskEngine
from backend.simulator import global_simulator

app = FastAPI(
    title="DHARA Disaster Hazard Analysis & Risk Alerting API",
    description="Hyper-local landslide and flash-flood early warning prototype telemetry & risk ingestion engine",
    version="1.0.0"
)

# CORS middleware for open localhost/LAN dashboard access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core State
risk_engine = RiskEngine(history_window=150)
nodes_db: Dict[str, Dict[str, Any]] = {}
alerts_history: deque = deque(maxlen=200)

# Default demo coordinates if not provided in payload
DEFAULT_COORDS = {
    "NODE-A1": (17.50, 78.35),
    "NODE-A2": (17.52, 78.38),
    "NODE-B1": (17.55, 78.40),
    "NODE-B2": (17.58, 78.42),
    "NODE-C1": (17.61, 78.45),
    "DHARA-NODE-01": (17.53, 78.37) # Physical ESP32 default cluster location
}

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)

ws_manager = ConnectionManager()
sim_task: Optional[asyncio.Task] = None

def get_node_status(last_seen: float) -> str:
    elapsed = time.time() - last_seen
    if elapsed <= 10.0:
        return "ONLINE"
    elif elapsed <= 30.0:
        return "STALE"
    else:
        return "OFFLINE"

@app.on_event("startup")
async def startup_event():
    # Start internal simulator background loop
    global sim_task
    if sim_task is None or sim_task.done():
        sim_task = asyncio.create_task(global_simulator.run_loop())
        print("[DHARA BACKEND] Background LoRa Cluster Simulator started.")

@app.on_event("shutdown")
async def shutdown_event():
    global sim_task
    global_simulator.stop()
    if sim_task:
        sim_task.cancel()

# ----------------- HTTP TELEMETRY INGESTION -----------------

@app.post("/api/telemetry", response_model=TelemetryResponse)
async def ingest_telemetry(payload: TelemetryPayload):
    now = time.time()
    t_time = payload.timestamp if (payload.timestamp and payload.timestamp > 0) else now

    # Coords fallback
    lat = payload.lat
    lng = payload.lng
    if lat is None or lng is None:
        def_lat, def_lng = DEFAULT_COORDS.get(payload.node_id, (17.51, 78.36))
        lat = lat or def_lat
        lng = lng or def_lng
        payload.lat = lat
        payload.lng = lng

    # 1. Process risk calculation & temporal rate of change
    assessment, alert = risk_engine.push_telemetry(payload)

    # 2. Update node record
    node_record = {
        "node_id": payload.node_id,
        "cluster_id": payload.cluster_id,
        "source": payload.source,
        "lat": lat,
        "lng": lng,
        "last_seen": now,
        "latest_telemetry": payload.model_dump(),
        "latest_risk": assessment.model_dump()
    }
    nodes_db[payload.node_id] = node_record

    # 3. Store alert if generated
    if alert:
        alerts_history.appendleft(alert.model_dump())

    # 4. Broadcast live update to all WebSocket clients
    status_str = get_node_status(now)
    live_event = {
        "type": "telemetry",
        "data": {
            "node_id": payload.node_id,
            "cluster_id": payload.cluster_id,
            "source": payload.source,
            "status": status_str,
            "lat": lat,
            "lng": lng,
            "last_seen": now,
            "seconds_since_last": 0.0,
            "telemetry": payload.model_dump(),
            "risk": assessment.model_dump(),
            "alert": alert.model_dump() if alert else None
        }
    }
    await ws_manager.broadcast(live_event)

    return TelemetryResponse(
        status="ok",
        node_id=payload.node_id,
        risk_score=assessment.risk_score,
        risk_level=assessment.risk_level,
        timestamp=now
    )

# ----------------- REST QUERY ENDPOINTS -----------------

@app.get("/api/nodes")
async def get_nodes():
    now = time.time()
    result = []
    for nid, data in nodes_db.items():
        last_seen = data["last_seen"]
        status = get_node_status(last_seen)
        result.append({
            "node_id": data["node_id"],
            "cluster_id": data["cluster_id"],
            "source": data["source"],
            "lat": data["lat"],
            "lng": data["lng"],
            "status": status,
            "last_seen": last_seen,
            "seconds_since_last": round(now - last_seen, 1),
            "latest_telemetry": data["latest_telemetry"],
            "latest_risk": data["latest_risk"]
        })
    # Sort by cluster and node ID
    result.sort(key=lambda x: (x["cluster_id"], x["node_id"]))
    return result

@app.get("/api/nodes/{node_id}")
async def get_node(node_id: str):
    if node_id not in nodes_db:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    data = nodes_db[node_id]
    now = time.time()
    last_seen = data["last_seen"]
    return {
        "node_id": data["node_id"],
        "cluster_id": data["cluster_id"],
        "source": data["source"],
        "lat": data["lat"],
        "lng": data["lng"],
        "status": get_node_status(last_seen),
        "last_seen": last_seen,
        "seconds_since_last": round(now - last_seen, 1),
        "latest_telemetry": data["latest_telemetry"],
        "latest_risk": data["latest_risk"]
    }

@app.get("/api/telemetry/{node_id}")
async def get_node_telemetry_history(node_id: str):
    raw_history = risk_engine.get_history(node_id)
    # Return formatted historical data points
    history_items = []
    for t_time, t_obj in raw_history:
        history_items.append({
            "timestamp": t_time,
            "time_str": time.strftime("%H:%M:%S", time.localtime(t_time)),
            "temperature": t_obj.temperature,
            "humidity": t_obj.humidity,
            "soil_moisture": t_obj.soil_moisture,
            "rain_intensity": t_obj.rain_intensity,
            "tilt_x": t_obj.tilt_x,
            "tilt_y": t_obj.tilt_y,
            "vibration": t_obj.vibration,
            "accel_x": t_obj.accel_x,
            "accel_y": t_obj.accel_y,
            "accel_z": t_obj.accel_z,
            "gyro_x": t_obj.gyro_x,
            "gyro_y": t_obj.gyro_y,
            "gyro_z": t_obj.gyro_z
        })
    return history_items

@app.get("/api/alerts")
async def get_alerts():
    return list(alerts_history)

@app.get("/api/overview", response_model=SystemOverview)
async def get_overview():
    now = time.time()
    total_nodes = len(nodes_db)
    online_count = 0
    stale_count = 0
    offline_count = 0
    safe_count = 0
    watch_count = 0
    warning_count = 0
    critical_count = 0

    for nid, data in nodes_db.items():
        st = get_node_status(data["last_seen"])
        if st == "ONLINE":
            online_count += 1
        elif st == "STALE":
            stale_count += 1
        else:
            offline_count += 1

        risk_lvl = data.get("latest_risk", {}).get("risk_level", "SAFE")
        if risk_lvl == "SAFE":
            safe_count += 1
        elif risk_lvl == "WATCH":
            watch_count += 1
        elif risk_lvl == "WARNING":
            warning_count += 1
        elif risk_lvl == "CRITICAL":
            critical_count += 1

    return SystemOverview(
        total_nodes=total_nodes,
        online_nodes=online_count,
        stale_nodes=stale_count,
        offline_nodes=offline_count,
        safe_nodes=safe_count,
        watch_nodes=watch_count,
        warning_nodes=warning_count,
        critical_nodes=critical_count,
        active_alerts=len(alerts_history),
        server_time=now
    )

@app.get("/api/scenario")
async def get_scenario():
    return {
        "scenario": global_simulator.scenario,
        "running": global_simulator.running
    }

@app.post("/api/scenario")
async def update_scenario(req: ScenarioUpdateRequest):
    global sim_task
    global_simulator.set_scenario(req.scenario)

    if req.running is not None:
        if req.running and not global_simulator.running:
            if sim_task is None or sim_task.done():
                sim_task = asyncio.create_task(global_simulator.run_loop())
        elif not req.running and global_simulator.running:
            global_simulator.stop()

    # Broadcast scenario change to dashboard
    await ws_manager.broadcast({
        "type": "scenario_change",
        "data": {
            "scenario": global_simulator.scenario,
            "running": global_simulator.running
        }
    })

    return {
        "status": "ok",
        "scenario": global_simulator.scenario,
        "running": global_simulator.running
    }

# ----------------- WEBSOCKET STREAM -----------------

@app.websocket("/ws/live")
async def websocket_live_stream(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial snapshot upon connection
        nodes_list = await get_nodes()
        overview_data = await get_overview()
        await websocket.send_json({
            "type": "init_snapshot",
            "data": {
                "nodes": nodes_list,
                "alerts": list(alerts_history)[:20],
                "overview": overview_data.model_dump(),
                "scenario": global_simulator.scenario,
                "sim_running": global_simulator.running
            }
        })
        while True:
            # Keep socket alive and handle client messages if any
            client_msg = await websocket.receive_text()
            # If client requests ping/pong or scenario change
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
