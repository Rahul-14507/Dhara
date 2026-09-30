/*
 * DHARA - Disaster Hazard Analysis & Risk Alerting System
 * Physical Sensor Node Firmware (ESP32)
 * 
 * Hardware Peripherals:
 *  - ESP32 Dev Board
 *  - DHT11 Temperature & Humidity Sensor (Data -> GPIO 4)
 *  - Capacitive/Resistive Soil Moisture Sensor (Analog -> GPIO 34 / ADC1)
 *  - Raindrop Sensor (Analog -> GPIO 35 / ADC1)
 *  - MPU6050 / MPU6500 6-DOF IMU (I2C: SDA -> GPIO 21, SCL -> GPIO 22)
 *
 * NOTE: The ESP32 communicates over local Wi-Fi / HTTP to the DHARA Gateway.
 * In production/field deployments, this ingestion point connects via a LoRa transceiver.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <DHT.h>
#include <math.h>

// ==========================================
// 1. NETWORK CONFIGURATION (UPDATE THESE!)
// ==========================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// REPLACE WITH YOUR BACKEND PC'S LOCAL IP ADDRESS (e.g., from 'ipconfig')
// Example: "http://192.168.1.100:8000/api/telemetry"
const char* BACKEND_URL   = "http://192.168.1.100:8000/api/telemetry";

// Node Identity
const char* NODE_ID       = "DHARA-NODE-01";
const char* CLUSTER_ID    = "CLUSTER-A";
const char* DATA_SOURCE   = "physical";

// Telemetry interval (ms)
const unsigned long TELEMETRY_INTERVAL_MS = 2000;

// ==========================================
// 2. PIN DEFINITIONS & SENSOR CONSTANTS
// ==========================================
#define PIN_DHT           4      // DHT11 Data Pin
#define DHTTYPE           DHT11
#define PIN_SOIL_ANALOG   34     // Soil moisture analog pin (ADC1)
#define PIN_RAIN_ANALOG   35     // Raindrop sensor analog pin (ADC1)
#define MPU_ADDR          0x68   // MPU6050 I2C 7-bit Address

// Calibration thresholds (Standard ESP32 12-bit ADC 0 - 4095)
// Dry air reading ~3800-4095, Submerged in water ~1200-1500
const int SOIL_DRY_RAW   = 3800;
const int SOIL_WET_RAW   = 1400;

// Dry rain plate ~4000-4095, Heavy water drops ~1000-1600
const int RAIN_DRY_RAW   = 4000;
const int RAIN_WET_RAW   = 1200;

DHT dht(PIN_DHT, DHTTYPE);

// Acceleration calibration offsets / baselines
float accel_x = 0.0, accel_y = 0.0, accel_z = 1.0;
float gyro_x = 0.0, gyro_y = 0.0, gyro_z = 0.0;
float tilt_x = 0.0, tilt_y = 0.0;
float vibration_mag = 0.0;
bool mpu_detected = false;

unsigned long last_telemetry_time = 0;

// ==========================================
// 3. MPU6050 HELPER FUNCTIONS
// ==========================================
void initMPU() {
  Wire.begin(21, 22); // SDA=21, SCL=22
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0x00); // Wake up MPU6050
  byte error = Wire.endTransmission();
  
  if (error == 0) {
    mpu_detected = true;
    Serial.println("[MPU6050] Sensor detected & initialized successfully.");
  } else {
    mpu_detected = false;
    Serial.println("[MPU6050] Sensor NOT found at 0x68. Check wiring!");
  }
}

void readMPU() {
  if (!mpu_detected) {
    // Fallback simulated small baseline if hardware unattached during bench test
    accel_x = 0.02; accel_y = -0.01; accel_z = 0.99;
    gyro_x = 0.1; gyro_y = 0.1; gyro_z = 0.0;
    tilt_x = 1.1; tilt_y = 0.6;
    vibration_mag = 0.03;
    return;
  }

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); // Starting register for Accel/Gyro data
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 14, true);

  if (Wire.available() >= 14) {
    int16_t raw_ax = Wire.read() << 8 | Wire.read();
    int16_t raw_ay = Wire.read() << 8 | Wire.read();
    int16_t raw_az = Wire.read() << 8 | Wire.read();
    int16_t raw_temp = Wire.read() << 8 | Wire.read();
    int16_t raw_gx = Wire.read() << 8 | Wire.read();
    int16_t raw_gy = Wire.read() << 8 | Wire.read();
    int16_t raw_gz = Wire.read() << 8 | Wire.read();

    // Convert to g (default +/- 2g range: 16384 LSB/g)
    accel_x = (float)raw_ax / 16384.0;
    accel_y = (float)raw_ay / 16384.0;
    accel_z = (float)raw_az / 16384.0;

    // Convert to deg/s (default +/- 250 deg/s: 131 LSB/(deg/s))
    gyro_x = (float)raw_gx / 131.0;
    gyro_y = (float)raw_gy / 131.0;
    gyro_z = (float)raw_gz / 131.0;

    // Calculate Pitch & Roll tilt angles in degrees
    tilt_x = atan2(accel_x, sqrt(accel_y * accel_y + accel_z * accel_z)) * 180.0 / M_PI;
    tilt_y = atan2(accel_y, sqrt(accel_x * accel_x + accel_z * accel_z)) * 180.0 / M_PI;

    // Vibration index: deviation from steady 1g gravitational vector
    float total_g = sqrt(accel_x * accel_x + accel_y * accel_y + accel_z * accel_z);
    vibration_mag = fabs(total_g - 1.0);
  }
}

// ==========================================
// 4. WIFI CONNECTION & FAILURE RECOVERY
// ==========================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WIFI] Connecting to SSID: %s ...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start_attempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start_attempt < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected!");
    Serial.print("[WIFI] IP Assigned: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WIFI] Connection timeout. Will retry next cycle.");
  }
}

// ==========================================
// 5. SETUP & MAIN LOOP
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=============================================");
  Serial.println("   DHARA PHYSICAL SENSOR NODE INITIALIZING   ");
  Serial.println("=============================================");

  pinMode(PIN_SOIL_ANALOG, INPUT);
  pinMode(PIN_RAIN_ANALOG, INPUT);

  dht.begin();
  initMPU();
  connectWiFi();
}

void loop() {
  unsigned long current_time = millis();

  if (current_time - last_telemetry_time >= TELEMETRY_INTERVAL_MS) {
    last_telemetry_time = current_time;

    // 1. Read DHT11 Temperature & Humidity
    float temp_c = dht.readTemperature();
    float hum_pct = dht.readHumidity();

    if (isnan(temp_c) || isnan(hum_pct)) {
      Serial.println("[DHT11] Warning: Failed to read from sensor. Using defaults.");
      temp_c = 26.5;
      hum_pct = 60.0;
    }

    // 2. Read Soil Moisture Sensor (Analog ADC)
    int raw_soil = analogRead(PIN_SOIL_ANALOG);
    // Invert scale: higher wetness = lower ADC value
    float soil_pct = map(raw_soil, SOIL_DRY_RAW, SOIL_WET_RAW, 0, 100);
    soil_pct = constrain(soil_pct, 0.0, 100.0);

    // 3. Read Raindrop Sensor (Analog ADC)
    int raw_rain = analogRead(PIN_RAIN_ANALOG);
    float rain_pct = map(raw_rain, RAIN_DRY_RAW, RAIN_WET_RAW, 0, 100);
    rain_pct = constrain(rain_pct, 0.0, 100.0);

    // 4. Read MPU6050 IMU
    readMPU();

    // 5. Construct JSON Telemetry Payload
    char json_payload[512];
    snprintf(json_payload, sizeof(json_payload),
      "{"
        "\"node_id\":\"%s\","
        "\"cluster_id\":\"%s\","
        "\"source\":\"%s\","
        "\"temperature\":%.1f,"
        "\"humidity\":%.1f,"
        "\"soil_raw\":%d,"
        "\"soil_moisture\":%.1f,"
        "\"rain_raw\":%d,"
        "\"rain_intensity\":%.1f,"
        "\"accel_x\":%.3f,"
        "\"accel_y\":%.3f,"
        "\"accel_z\":%.3f,"
        "\"gyro_x\":%.2f,"
        "\"gyro_y\":%.2f,"
        "\"gyro_z\":%.2f,"
        "\"tilt_x\":%.2f,"
        "\"tilt_y\":%.2f,"
        "\"vibration\":%.3f"
      "}",
      NODE_ID, CLUSTER_ID, DATA_SOURCE,
      temp_c, hum_pct,
      raw_soil, soil_pct,
      raw_rain, rain_pct,
      accel_x, accel_y, accel_z,
      gyro_x, gyro_y, gyro_z,
      tilt_x, tilt_y,
      vibration_mag
    );

    Serial.println("[TELEMETRY] Outgoing Payload:");
    Serial.println(json_payload);

    // 6. Transmit over HTTP to FastAPI Backend
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(BACKEND_URL);
      http.addHeader("Content-Type", "application/json");
      http.setTimeout(2500); // 2.5 second timeout

      int http_code = http.POST((uint8_t*)json_payload, strlen(json_payload));

      if (http_code > 0) {
        String response = http.getString();
        Serial.printf("[HTTP] Status: %d | Response: %s\n", http_code, response.c_str());
      } else {
        Serial.printf("[HTTP] POST failed, error: %s\n", http.errorToString(http_code).c_str());
      }
      http.end();
    } else {
      Serial.println("[WIFI] Disconnected. Attempting reconnect...");
      connectWiFi();
    }
  }
}
