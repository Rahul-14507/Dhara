# DHARA — Disaster Hazard Analysis & Risk Alerting System

**DHARA** (*Disaster Hazard Analysis & Risk Alerting System*) is a hyper-local landslide and flash-flood early warning system prototype. It models a distributed sensor network across multiple geographic cluster sectors, ingesting high-frequency telemetry, computing multi-parameter geotechnical & hydrological risk scores, and generating real-time hazard alerts.

---

## ⚠️ Technical Architecture & Honesty Notice

1. **LoRa Network Simulation & HTTP Gateway Ingestion**:
   - The physical ESP32 and simulated nodes currently use HTTP POST for local/LAN demonstration purposes.
   - The backend abstracts and models these incoming requests as arriving through an interconnected **LoRa Gateway**.
   - The ingestion architecture is designed so that the HTTP reception layer can be seamlessly swapped with a physical SX1276/SX1262 LoRa Concentrator / LoRaWAN packet forwarder in field deployments.
2. **Prototype Risk Engine**:
   - The risk thresholds, weighted scoring factors ($0.30 \times \text{Rain} + 0.30 \times \text{Soil} + 0.25 \times \text{Tilt} + 0.15 \times \text{Vibration}$), and temporal rate-of-change metrics are demonstration/academic formulas and should not be used as field-certified slope-stability standards without regional geotechnical calibration.

---

## 🏗️ System Architecture

```
Physical Node (ESP32):
  [DHT11 + Soil Moisture + Raindrop + MPU6050]
        │
        ▼ (HTTP POST / Simulated LoRa link)
  ┌────────────────────────────────────────────────────────┐
  │                 DHARA GATEWAY INGESTION                │
  │                   (FastAPI Backend)                    │
  └───────────────────────────┬────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    [Risk Engine]      [Alert Engine]     [WebSocket Stream]
 (Normalized Scoring) (Temporal Trends)  (/ws/live Broadcast)
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
               ┌─────────────────────────────┐
               │    DHARA REACT DASHBOARD    │
               │   (Live Charts, Map, Feed)  │
               └─────────────────────────────┘

Simulated Multi-Cluster Nodes:
  • CLUSTER-A: NODE-A1, NODE-A2
  • CLUSTER-B: NODE-B1, NODE-B2
  • CLUSTER-C: NODE-C1
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Arduino IDE (if flashing physical ESP32)

---

### Step 1: Start the FastAPI Backend

Open a terminal (PowerShell / Command Prompt) in the project directory:

```powershell
cd c:\Projects\Dhara
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

- API Base URL: `http://localhost:8000`
- Interactive API Docs: `http://localhost:8000/docs`
- Live WebSocket Endpoint: `ws://localhost:8000/ws/live`

*(Note: The backend automatically boots the background cluster simulator on startup).*

---

### Step 2: (Optional) Standalone Simulator CLI

To run the simulator independently or simulate specific disaster scenarios from the terminal:

```powershell
cd c:\Projects\Dhara
# Usage: python backend/simulator.py [SCENARIO]
python backend/simulator.py NORMAL
# Or test extreme conditions:
python backend/simulator.py CRITICAL
```

Supported Scenarios:
- `NORMAL` — Baseline dry/moderate conditions (Risk: SAFE)
- `HEAVY_RAIN` — Rapid precipitation accumulation (Risk: WATCH/WARNING)
- `SOIL_SATURATION` — High moisture absorption & ground softening (Risk: WARNING)
- `SLOPE_MOVEMENT` — Abrupt IMU pitch/roll tilt and displacement vibration (Risk: WARNING/CRITICAL)
- `CRITICAL` — Simultaneous multi-parameter disaster trigger (Risk: CRITICAL)

---

### Step 3: Start the React Live Dashboard

Open a second terminal:

```powershell
cd c:\Projects\Dhara\frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open your browser and navigate to:
👉 **`http://localhost:5173`** (or `http://YOUR_LAN_IP:5173` on other devices on your LAN)

---

### Step 4: Configure & Flash the Physical ESP32 Node

#### 1. Find Your Computer's LAN IP Address
In PowerShell run:
```powershell
ipconfig
```
Look for `IPv4 Address` under your active Wi-Fi / Ethernet adapter (e.g., `192.168.1.100` or `192.168.29.150`).

#### 2. Open Arduino Sketch
Open `firmware/esp32_dhara_node/esp32_dhara_node.ino` in Arduino IDE.

#### 3. Update Wi-Fi & Backend Endpoint
Modify lines 23–27:
```cpp
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// REPLACE WITH YOUR PC'S LOCAL IP:
const char* BACKEND_URL   = "http://192.168.1.100:8000/api/telemetry";
```

#### 4. Hardware Wiring & Pinout Table

| Sensor / Module | Sensor Pin | ESP32 Pin | Description |
| :--- | :--- | :--- | :--- |
| **DHT11** | DATA / OUT | **GPIO 4** | Ambient Temp & Humidity |
| **DHT11** | VCC & GND | 3.3V / GND | Power |
| **Soil Moisture** | Analog OUT (A0) | **GPIO 34** (ADC1) | Volumetric Soil Wetness |
| **Soil Moisture** | VCC & GND | 3.3V / GND | Power |
| **Raindrop Sensor** | Analog OUT (A0) | **GPIO 35** (ADC1) | Precipitation Intensity |
| **Raindrop Sensor** | VCC & GND | 3.3V / GND | Power |
| **MPU6050 IMU** | SDA | **GPIO 21** | I2C Data Line |
| **MPU6050 IMU** | SCL | **GPIO 22** | I2C Clock Line |
| **MPU6050 IMU** | VCC & GND | 3.3V / GND | Power |

#### 5. Flash Sketch
- Board: `ESP32 Dev Module`
- Upload Speed: `115200` or `921600`
- Open Serial Monitor at `115200 baud` to observe outgoing JSON packets and server responses.

---

## 📡 Telemetry Data Protocol

### JSON Telemetry Payload (`POST /api/telemetry`)
```json
{
  "node_id": "DHARA-NODE-01",
  "cluster_id": "CLUSTER-A",
  "source": "physical",
  "timestamp": 1720000000,
  "temperature": 28.4,
  "humidity": 72.0,
  "soil_raw": 2450,
  "soil_moisture": 54.0,
  "rain_raw": 1800,
  "rain_intensity": 38.0,
  "accel_x": 0.04,
  "accel_y": -0.02,
  "accel_z": 1.01,
  "gyro_x": 0.4,
  "gyro_y": 0.2,
  "gyro_z": 0.1,
  "tilt_x": 2.3,
  "tilt_y": 1.8,
  "vibration": 0.08
}
```

### Ingestion Response
```json
{
  "status": "ok",
  "node_id": "DHARA-NODE-01",
  "risk_score": 37.4,
  "risk_level": "WATCH",
  "timestamp": 1720000000.0
}
```

---

## 🧪 Testing with cURL

Simulate a telemetry POST manually:
```bash
curl -X POST "http://127.0.0.1:8000/api/telemetry" \
     -H "Content-Type: application/json" \
     -d '{
       "node_id": "DHARA-TEST-NODE",
       "cluster_id": "CLUSTER-A",
       "source": "simulated",
       "temperature": 27.5,
       "humidity": 80.0,
       "soil_moisture": 65.0,
       "rain_intensity": 70.0,
       "accel_x": 0.1,
       "accel_y": 0.2,
       "accel_z": 0.98,
       "gyro_x": 0.5,
       "gyro_y": 0.2,
       "gyro_z": 0.1,
       "tilt_x": 8.5,
       "tilt_y": 6.2,
       "vibration": 0.12
     }'
```

Query System Overview:
```bash
curl "http://127.0.0.1:8000/api/overview"
```

---

## 📊 Prototype Risk Calculation Model

The risk engine computes a compound hazard score from 0.0 to 100.0:

$$\text{Risk Score} = 0.30 \cdot \text{Rain}_{\text{score}} + 0.30 \cdot \text{Soil}_{\text{score}} + 0.25 \cdot \text{Tilt}_{\text{score}} + 0.15 \cdot \text{Vibration}_{\text{score}}$$

### Risk Categories:
- **`0 – 30`**: **SAFE** (Green) — Baseline environmental parameters
- **`30 – 60`**: **WATCH** (Amber) — Moderate rainfall or soil moisture accumulation
- **`60 – 80`**: **WARNING** (Orange) — High soil saturation or noticeable slope deformation
- **`80 – 100`**: **CRITICAL** (Red) — Imminent landslide or flash-flood probability; immediate alert dispatched

### Node Health Status:
- **`ONLINE`**: Telemetry received $< 10$ seconds ago
- **`STALE`**: Telemetry received between $10 – 30$ seconds ago
- **`OFFLINE`**: Telemetry received $> 30$ seconds ago

---

## 📂 Project Structure

```
Dhara/
├── backend/
│   ├── main.py              # FastAPI server, WebSocket hub, REST endpoints
│   ├── models.py            # Pydantic data models & telemetry schemas
│   ├── risk_engine.py       # Multi-factor normalized risk engine & rate-of-change
│   ├── simulator.py         # Multi-cluster LoRa node simulator & scenario engine
│   └── requirements.txt     # Python dependencies
├── firmware/
│   └── esp32_dhara_node/
│       └── esp32_dhara_node.ino  # ESP32 C++ firmware (DHT11, Soil, Rain, MPU6050)
├── frontend/
│   ├── index.html           # HTML template
│   ├── package.json         # React & Vite configuration
│   ├── vite.config.js       # Vite proxy & server config
│   └── src/
│       ├── App.jsx          # Live monitoring dashboard
│       ├── index.css        # Cohesive dark engineering UI design system
│       ├── main.jsx         # React DOM mount point
│       └── components/
│           ├── NetworkFlowVisualizer.jsx # Animated LoRa/HTTP data flow
│           ├── TerrainMap.jsx            # Stylized cluster map
│           ├── NodeDetailPanel.jsx       # Detailed sensor & risk decomposition
│           ├── LiveChart.jsx             # Time-series live SVG chart
│           └── AlertFeed.jsx             # Real-time hazard alert feed
└── README.md                # Comprehensive documentation
```
