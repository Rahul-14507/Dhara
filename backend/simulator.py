import asyncio
import random
import time
import math
import sys
import httpx
from typing import Dict, Any, List

DEFAULT_BACKEND_URL = "http://127.0.0.1:8000/api/telemetry"

NODE_CONFIGS = [
    {
        "node_id": "NODE-A1",
        "cluster_id": "CLUSTER-A",
        "lat": 17.50,
        "lng": 78.35,
        "base_temp": 27.5,
        "base_humidity": 68.0,
        "base_soil": 28.0,
        "base_rain": 2.0,
        "base_tilt_x": 0.8,
        "base_tilt_y": 1.1,
    },
    {
        "node_id": "NODE-A2",
        "cluster_id": "CLUSTER-A",
        "lat": 17.52,
        "lng": 78.38,
        "base_temp": 28.1,
        "base_humidity": 66.0,
        "base_soil": 32.0,
        "base_rain": 1.5,
        "base_tilt_x": 1.4,
        "base_tilt_y": 0.6,
    },
    {
        "node_id": "NODE-B1",
        "cluster_id": "CLUSTER-B",
        "lat": 17.55,
        "lng": 78.40,
        "base_temp": 26.8,
        "base_humidity": 71.0,
        "base_soil": 25.0,
        "base_rain": 4.0,
        "base_tilt_x": 2.1,
        "base_tilt_y": 1.9,
    },
    {
        "node_id": "NODE-B2",
        "cluster_id": "CLUSTER-B",
        "lat": 17.58,
        "lng": 78.42,
        "base_temp": 26.2,
        "base_humidity": 73.0,
        "base_soil": 30.0,
        "base_rain": 3.0,
        "base_tilt_x": 1.2,
        "base_tilt_y": 1.7,
    },
    {
        "node_id": "NODE-C1",
        "cluster_id": "CLUSTER-C",
        "lat": 17.61,
        "lng": 78.45,
        "base_temp": 25.5,
        "base_humidity": 75.0,
        "base_soil": 34.0,
        "base_rain": 0.0,
        "base_tilt_x": 0.5,
        "base_tilt_y": 0.9,
    }
]

class NodeSimulator:
    def __init__(self, backend_url: str = DEFAULT_BACKEND_URL):
        self.backend_url = backend_url
        self.scenario = "NORMAL"
        self.running = False
        self.step_count = 0
        # Dynamic state per node
        self.node_states = {}
        for cfg in NODE_CONFIGS:
            self.node_states[cfg["node_id"]] = {
                "soil": cfg["base_soil"],
                "rain": cfg["base_rain"],
                "tilt_x": cfg["base_tilt_x"],
                "tilt_y": cfg["base_tilt_y"],
                "vibration": 0.04
            }

    def set_scenario(self, scenario: str):
        valid = ["NORMAL", "HEAVY_RAIN", "SOIL_SATURATION", "SLOPE_MOVEMENT", "CRITICAL"]
        if scenario.upper() in valid:
            self.scenario = scenario.upper()
            print(f"[SIMULATOR] Scenario transitioned to: {self.scenario}")

    def generate_telemetry_for_node(self, cfg: dict) -> dict:
        nid = cfg["node_id"]
        state = self.node_states[nid]
        noise = lambda amp: random.uniform(-amp, amp)

        # Scenario dynamic drift
        if self.scenario == "NORMAL":
            # Baseline normal conditions
            state["rain"] = max(0.0, min(15.0, state["rain"] * 0.9 + cfg["base_rain"] * 0.1 + noise(1.5)))
            state["soil"] = max(15.0, min(40.0, state["soil"] * 0.95 + cfg["base_soil"] * 0.05 + noise(1.0)))
            state["tilt_x"] = max(0.0, min(3.0, state["tilt_x"] * 0.95 + cfg["base_tilt_x"] * 0.05 + noise(0.2)))
            state["tilt_y"] = max(0.0, min(3.0, state["tilt_y"] * 0.95 + cfg["base_tilt_y"] * 0.05 + noise(0.2)))
            state["vibration"] = max(0.01, min(0.06, 0.03 + noise(0.015)))

        elif self.scenario == "HEAVY_RAIN":
            # Rain ramps up quickly to 75-95%
            target_rain = 85.0 + noise(10.0)
            state["rain"] = min(100.0, state["rain"] + (target_rain - state["rain"]) * 0.2 + noise(2.0))
            # Soil moisture slowly absorbs
            state["soil"] = min(75.0, state["soil"] + 2.5 + noise(1.0))
            state["tilt_x"] = max(0.0, min(4.0, state["tilt_x"] + noise(0.3)))
            state["tilt_y"] = max(0.0, min(4.0, state["tilt_y"] + noise(0.3)))
            state["vibration"] = max(0.03, min(0.12, 0.06 + noise(0.02)))

        elif self.scenario == "SOIL_SATURATION":
            # Rain stays high/moderate
            state["rain"] = max(45.0, min(80.0, state["rain"] * 0.9 + 60.0 * 0.1 + noise(3.0)))
            # Soil reaches critical saturation 85-98%
            state["soil"] = min(98.0, state["soil"] + 3.5 + noise(1.0))
            # Slight slope creep
            state["tilt_x"] = min(7.0, state["tilt_x"] + 0.3 + noise(0.2))
            state["tilt_y"] = min(7.0, state["tilt_y"] + 0.3 + noise(0.2))
            state["vibration"] = max(0.05, min(0.18, 0.09 + noise(0.03)))

        elif self.scenario == "SLOPE_MOVEMENT":
            # Rain moderate or normal
            state["rain"] = max(10.0, min(50.0, state["rain"] * 0.9 + 25.0 * 0.1 + noise(2.0)))
            # High tilt displacement & active vibration
            state["tilt_x"] = min(28.0, state["tilt_x"] + 1.8 + noise(0.8))
            state["tilt_y"] = min(25.0, state["tilt_y"] + 1.6 + noise(0.8))
            state["vibration"] = max(0.15, min(0.48, 0.28 + noise(0.08)))

        elif self.scenario == "CRITICAL":
            # Compound extreme disaster scenario
            state["rain"] = min(100.0, state["rain"] + 4.0 + noise(2.0))
            state["soil"] = min(99.0, state["soil"] + 4.0 + noise(1.0))
            state["tilt_x"] = min(32.0, state["tilt_x"] + 2.2 + noise(0.9))
            state["tilt_y"] = min(30.0, state["tilt_y"] + 2.0 + noise(0.9))
            state["vibration"] = max(0.25, min(0.60, 0.40 + noise(0.10)))

        # Environmental values
        temp = round(cfg["base_temp"] + noise(0.6) - (state["rain"] * 0.05), 1)
        humidity = round(min(99.0, max(40.0, cfg["base_humidity"] + (state["rain"] * 0.3) + noise(1.5))), 1)
        soil_m = round(max(0.0, min(100.0, state["soil"])), 1)
        rain_i = round(max(0.0, min(100.0, state["rain"])), 1)
        
        # Raw ADC equivalents (simulate 12-bit ESP32 ADC: 0-4095 inverted/scaled)
        # Wet soil / rain -> lower resistance / higher ADC or vice-versa depending on sensor
        soil_raw = int(4095 - (soil_m / 100.0 * 3000) + noise(20))
        rain_raw = int(4095 - (rain_i / 100.0 * 3200) + noise(30))

        # IMU calculations
        tx = round(state["tilt_x"], 2)
        ty = round(state["tilt_y"], 2)
        vib = round(state["vibration"], 3)

        # Approximate accel / gyro consistent with tilt
        rad_x = math.radians(tx)
        rad_y = math.radians(ty)
        accel_x = round(math.sin(rad_x) + noise(vib * 0.3), 3)
        accel_y = round(math.sin(rad_y) + noise(vib * 0.3), 3)
        accel_z = round(math.cos(math.sqrt(rad_x**2 + rad_y**2)) + noise(vib * 0.2), 3)

        gyro_x = round(noise(vib * 15.0), 2)
        gyro_y = round(noise(vib * 15.0), 2)
        gyro_z = round(noise(vib * 10.0), 2)

        return {
            "node_id": cfg["node_id"],
            "cluster_id": cfg["cluster_id"],
            "source": "simulated",
            "timestamp": time.time(),
            "temperature": temp,
            "humidity": humidity,
            "soil_raw": soil_raw,
            "soil_moisture": soil_m,
            "rain_raw": rain_raw,
            "rain_intensity": rain_i,
            "accel_x": accel_x,
            "accel_y": accel_y,
            "accel_z": accel_z,
            "gyro_x": gyro_x,
            "gyro_y": gyro_y,
            "gyro_z": gyro_z,
            "tilt_x": tx,
            "tilt_y": ty,
            "vibration": vib,
            "lat": cfg["lat"],
            "lng": cfg["lng"]
        }

    async def step(self, client: httpx.AsyncClient):
        self.step_count += 1
        for cfg in NODE_CONFIGS:
            payload = self.generate_telemetry_for_node(cfg)
            try:
                resp = await client.post(self.backend_url, json=payload, timeout=2.0)
                if resp.status_code != 200:
                    print(f"[SIMULATOR] Error from backend: {resp.status_code} {resp.text}")
            except Exception as e:
                # Backend might still be starting or restarting
                pass

    async def run_loop(self):
        self.running = True
        print(f"[SIMULATOR] Starting LoRa cluster simulation -> {self.backend_url}")
        print(f"[SIMULATOR] Initial scenario: {self.scenario}")
        async with httpx.AsyncClient() as client:
            while self.running:
                await self.step(client)
                await asyncio.sleep(1.5)

    def stop(self):
        self.running = False
        print("[SIMULATOR] Simulation stopped.")

# Global simulator instance for backend-controlled simulation
global_simulator = NodeSimulator()

async def main():
    scenario = "NORMAL"
    if len(sys.argv) > 1:
        scenario = sys.argv[1].upper()
    sim = NodeSimulator()
    sim.set_scenario(scenario)
    try:
        await sim.run_loop()
    except KeyboardInterrupt:
        sim.stop()

if __name__ == "__main__":
    asyncio.run(main())
