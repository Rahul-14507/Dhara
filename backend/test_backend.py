import asyncio
import httpx
from backend.main import app
from backend.models import TelemetryPayload
from backend.risk_engine import RiskEngine

def test_risk_engine():
    engine = RiskEngine()
    
    # Baseline test (SAFE)
    p1 = TelemetryPayload(
        node_id="TEST-NODE-01",
        cluster_id="CLUSTER-A",
        source="simulated",
        timestamp=1000.0,
        temperature=25.0,
        humidity=60.0,
        soil_moisture=25.0,
        rain_intensity=5.0,
        tilt_x=1.0,
        tilt_y=1.0,
        vibration=0.03
    )
    assessment1, alert1 = engine.push_telemetry(p1)
    assert assessment1.risk_level == "SAFE"
    assert assessment1.risk_score < 30.0

    # High Rain & Tilt test (CRITICAL)
    p2 = TelemetryPayload(
        node_id="TEST-NODE-01",
        cluster_id="CLUSTER-A",
        source="simulated",
        timestamp=1030.0,
        temperature=22.0,
        humidity=95.0,
        soil_moisture=90.0,
        rain_intensity=95.0,
        tilt_x=22.0,
        tilt_y=15.0,
        vibration=0.35
    )
    assessment2, alert2 = engine.push_telemetry(p2)
    assert assessment2.risk_level in ["WARNING", "CRITICAL"]
    assert assessment2.risk_score >= 60.0
    assert alert2 is not None
    assert assessment2.rain_rate_of_change > 0

    print("Risk engine unit tests passed!")

async def test_fastapi_endpoints():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Ingestion test
        payload = {
            "node_id": "DHARA-TEST-NODE",
            "cluster_id": "CLUSTER-A",
            "source": "physical",
            "temperature": 27.5,
            "humidity": 68.0,
            "soil_raw": 2200,
            "soil_moisture": 52.0,
            "rain_raw": 1900,
            "rain_intensity": 45.0,
            "accel_x": 0.05,
            "accel_y": -0.02,
            "accel_z": 1.02,
            "gyro_x": 0.2,
            "gyro_y": 0.1,
            "gyro_z": 0.0,
            "tilt_x": 3.2,
            "tilt_y": 2.1,
            "vibration": 0.06
        }
        res = await client.post("/api/telemetry", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["status"] == "ok"
        assert data["node_id"] == "DHARA-TEST-NODE"

        # Overview test
        ov_res = await client.get("/api/overview")
        assert ov_res.status_code == 200
        ov_data = ov_res.json()
        assert ov_data["total_nodes"] >= 1

        # Nodes list test
        nodes_res = await client.get("/api/nodes")
        assert nodes_res.status_code == 200
        nodes = nodes_res.json()
        assert any(n["node_id"] == "DHARA-TEST-NODE" for n in nodes)

        print("FastAPI endpoints test passed!")

if __name__ == "__main__":
    test_risk_engine()
    asyncio.run(test_fastapi_endpoints())
