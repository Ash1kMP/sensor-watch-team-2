/***************************************************************************
 * ESP32 Multi-Function Web Server
 *
 * This code provides:
 *  - Sensor data collection from DS18B20 sensors.
 *  - A web interface for:
 *       * Displaying sensor data (Main page).
 *       * Managing OTA updates.
 *       * Managing sensor labels.
 *       * Filesystem management (list, view, download, delete, upload, format, and FS info).
 *       * Connectivity management: manually disconnect and reconnect to WiFi.
 *
 * All HTML pages are stored in flash (using PROGMEM) to conserve RAM.
 * Detailed inline comments explain each section.
 ***************************************************************************/

#define FIRMWARE_VERSION "1.1.3"

 //---------------------------------------------------------------------
 // LIBRARY INCLUDES
 //---------------------------------------------------------------------
 #include <WiFi.h>
 #include <ESPmDNS.h>
 #include <Update.h>
 #include <OneWire.h>
 #include <DallasTemperature.h>
 #include <LittleFS.h>
 #include <HTTPClient.h>
 #include <ArduinoJson.h>
 #include <ArduinoOTA.h>
 #include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <AsyncMqttClient.h>
#include <DHT.h>
#define DHTPIN 14
#define DHTTYPE DHT22


// ---- DHT read throttle/cache (avoid oversampling) ----
static uint32_t lastDhtRead = 0;
static float    lastHum = NAN, lastTc = NAN;
const  uint32_t DHT_MIN_INTERVAL_MS = 2000; // DHT22 needs ≥2s between reads

// ---- Alert thresholds (runtime-configurable; persisted in /config.json) ----
// Temperature (°F)
float gTEMP_F_WARN_HIGH = 85.0;
float gTEMP_F_CRIT_HIGH = 95.0;
float gTEMP_F_WARN_LOW  = 32.0;
float gTEMP_F_CRIT_LOW  = 20.0;

// Humidity (% RH)
float gHUM_WARN_HIGH = 70.0;
float gHUM_CRIT_HIGH = 80.0;
float gHUM_WARN_LOW  = 25.0;
float gHUM_CRIT_LOW  = 15.0;

// Filesystem usage (%)
uint8_t gFS_WARN_PCT  = 80;
uint8_t gFS_CRIT_PCT  = 95;

// Connectivity (MQTT heartbeat age)
uint32_t gMQTT_WARN_MS = 60UL * 1000UL;        // 60s
uint32_t gMQTT_CRIT_MS = 5UL  * 60UL * 1000UL; // 5 min
// Wi-Fi signal (RSSI, dBm)
int gRSSI_WARN_DBM = -70;  // warn below this
int gRSSI_CRIT_DBM = -80;  // error below this

// Active profile
String gProfile = "default";

// --- Temporary backward-compat (so current code still compiles) ---
#define TEMP_F_HIGH        gTEMP_F_WARN_HIGH
#define TEMP_F_LOW         gTEMP_F_WARN_LOW
#define HUMIDITY_HIGH      gHUM_WARN_HIGH
#define HUMIDITY_LOW       gHUM_WARN_LOW
#define FS_USED_WARN_PCT   gFS_WARN_PCT


// ================= MQTT CONFIG (EDIT THESE) =================
static const char* MQTT_HOST = "test.mosquitto.org";
static const uint16_t MQTT_PORT = 1883;          
static const char* MQTT_USER = "";               
static const char* MQTT_PASS = "";               

// Intervals
static const uint32_t HEARTBEAT_MS = 30 * 1000;
static const uint32_t HEALTH_MS    = 15 * 1000;
static const uint32_t TELEMETRY_MS = 5 * 1000;
static const uint32_t ALERTS_MS    = 5 * 1000;

// ================= MQTT STATE =================
AsyncMqttClient mqtt;
String gClientId;
String mqttBaseTopic;
unsigned long lastMqttHeartbeat = 0;
unsigned long lastMqttHealth    = 0;
unsigned long lastMqttTelemetry = 0;
unsigned long lastMqttAlerts    = 0;
String deviceIdNoColon() {
  String mac = WiFi.macAddress();
  String out; out.reserve(mac.length());
  for (char c: mac) if (c != ':') out += c;
  return out;
}

String topicBase() {
  if (mqttBaseTopic.length() == 0) {
    mqttBaseTopic = String("dev/") + deviceIdNoColon();
  }
  return mqttBaseTopic;
}

// Build heartbeat JSON
void buildHeartbeatDoc(JsonDocument &doc, const char* status = "ONLINE") {
  String ipAddress = (WiFi.getMode() == WIFI_AP) ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
  doc["deviceId"] = deviceIdNoColon();
  doc["fw"]       = FIRMWARE_VERSION;
  doc["ip"]       = ipAddress;
  doc["rssi"]     = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : -127;
  doc["uptimeMs"] = (uint32_t)millis();
  doc["ts"]       = (uint32_t)millis();
  doc["status"]   = status;
}

// Build health JSON
void buildHealthDoc(JsonDocument &doc) {
  doc["deviceId"] = deviceIdNoColon();
  doc["ts"]       = (uint32_t)millis();
  doc["rssi"]     = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : -127;

  JsonObject h = doc["health"].to<JsonObject>();
  uint32_t total = LittleFS.totalBytes();
  uint32_t used  = LittleFS.usedBytes();
  h["freeHeap"]    = (uint32_t)ESP.getFreeHeap();
  h["minFreeHeap"] = (uint32_t)ESP.getMinFreeHeap();
  h["fsUsedPct"]   = total ? (uint32_t)((100.0 * used) / total) : 0;
  h["fsFree"]      = (total > used) ? (uint32_t)(total - used) : 0;
  h["queueBytes"]  = 0; 
}

// Publish helpers
bool mqttIsConnected() { return mqtt.connected(); }

bool mqttPublish(const String& subPath, const JsonDocument& doc, bool retain=false, uint8_t qos=1) {
  String topic = topicBase() + subPath;
  String payload; serializeJson(doc, payload);
  return mqtt.publish(topic.c_str(), qos, retain, payload.c_str());
}

bool mqttPublishRaw(const String& subPath, const char* payload, bool retain=false, uint8_t qos=1) {
  String topic = topicBase() + subPath;
  return mqtt.publish(topic.c_str(), qos, retain, payload);
}

void publishTelemetryAndAlerts(const JsonDocument &doc) {
  if (!mqttIsConnected()) return;

  const unsigned long now = millis();

  // ---- Telemetry (devices/<MAC>/telemetry) ----
  if (now - lastMqttTelemetry >= TELEMETRY_MS) {
    JsonDocument telem;
    telem["deviceId"] = deviceIdNoColon();
    telem["ts"]       = (uint32_t)now;
    // deep-copy sensor array
    if (doc["sensors"].is<JsonArray>()) {
      telem["sensors"] = doc["sensors"];
    }
    mqttPublish("/telemetry", telem, /*retain=*/false, /*qos=*/0);
    lastMqttTelemetry = now;
  }

  // ---- Critical alerts (dev/<MAC>/critical) ----
  if (doc["alerts"].is<JsonArray>() && doc["alerts"].size() > 0) {
    if (now - lastMqttAlerts >= ALERTS_MS) {
      JsonDocument alertsDoc;
      alertsDoc["deviceId"] = deviceIdNoColon();
      alertsDoc["ts"]       = (uint32_t)now;
      alertsDoc["alerts"]   = doc["alerts"]; 
      mqttPublish("/critical", alertsDoc, /*retain=*/false, /*qos=*/1);
      lastMqttAlerts = now;
    }
  }
}

void mqttConnect() {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  if (strlen(MQTT_USER)) mqtt.setCredentials(MQTT_USER, MQTT_PASS);
  gClientId = String("esp32-") + deviceIdNoColon();
  mqtt.setClientId(gClientId.c_str());
  // LWT: if device drops unexpectedly, broker publishes offline to /critical
  String willTopic = topicBase() + "/critical";
  mqtt.setWill(willTopic.c_str(), 1, true, "offline");

  mqtt.onConnect([](bool){
    // Presence: publish retained "online" to /critical
    mqttPublishRaw("/critical", "online", true, 1);
    // Optional: also send a retained heartbeat snapshot for dashboards
    JsonDocument hb;
    buildHeartbeatDoc(hb, "ONLINE");
    mqttPublish("/heartbeat", hb, true, 1);
  });

  mqtt.onDisconnect([](AsyncMqttClientDisconnectReason){
    // Auto-reconnect after a short delay
    static unsigned long nextTry = 0;
    if (millis() > nextTry) { nextTry = millis() + 2000; mqtt.connect(); }
  });

  mqtt.connect();
}

String processor(const String& var) {
  if (var == "firmwareVersion") {
    return FIRMWARE_VERSION;
  }
  return String();
}
 
 //---------------------------------------------------------------------
 // DYNAMIC HTML PAGES (Stored in flash)
 //---------------------------------------------------------------------
 
 //---------------------------------------------------------------------
 // GLOBAL WIFI SETTINGS
 //---------------------------------------------------------------------
 const char* hostName = "esp32";
 String wifiSSID = "thebarn";
 String wifiPassword = "11961Amherst";
 const char* remoteServerName = "http://ecoforces.com/update_db.php";
 String remoteApiKey = "tPmAT5Ab3j7F9";
 
 //---------------------------------------------------------------------
 // GLOBAL OBJECTS
 //---------------------------------------------------------------------
//WebServer server(83);
 //WebSocketsServer webSocket(81);
AsyncWebServer       server(100);
 AsyncWebSocket       ws("/ws");

 OneWire oneWire(4);
 DallasTemperature sensors(&oneWire);
 DHT dht(DHTPIN, DHTTYPE); 
 bool isAPMode = false;
 File fsUploadFile;
 unsigned long lastWebSocketTime = 0;
 unsigned long webSocketInterval = 500;
 unsigned long lastDBUpdateTime = 0;
 unsigned long dbUpdateInterval = 20000;
 bool captureEnabled = true; // Default: sensor data is captured.
 
 // Global variables for OTA progress.
 unsigned long bytesWritten = 0;
 unsigned long totalSize = 0;
 volatile int uploadProgress = 0;  
 volatile bool updateFinished = false;
 volatile bool updateSuccessful = false;
 
// Track last FIFO event for UI alerting
volatile unsigned long lastFifoTrimTs = 0;
volatile size_t lastFifoTrimKept = 0;
volatile size_t lastFifoTrimTotal = 0;
 
//---------------------------------------------------------------------
// FUNCTION PROTOTYPES
//---------------------------------------------------------------------
void initFileSystem();
void loadSensorLabels(JsonDocument &doc);
void saveSensorLabels(JsonDocument &doc);
void uploadStoredData();
void startAccessPoint();
void handleWebSocketMessage(uint8_t num, uint8_t *payload, size_t length);
void onWebSocketEvent(AsyncWebSocket*server,AsyncWebSocketClient *client, AwsEventType type, void *arg,uint8_t *data, size_t len);
void updateWebSocketClients();
void setupOTA();
void connectToWiFi();
void formatFileSystem();
void sendSensorData();
void storeLabelsLocally(JsonDocument &doc);
void storeDataLocally();
void handleFileUpload(AsyncWebServerRequest *req, const String &filename,size_t index, uint8_t *data,size_t len, bool final);
void serverFileListHandler(AsyncWebServerRequest *req);
void downloadFileHandler(AsyncWebServerRequest *req);
void viewFileHandler(AsyncWebServerRequest *req);
void formatFSHandler(AsyncWebServerRequest *req);
void fsInfoHandler(AsyncWebServerRequest *req);
void loadWiFiConfig();
void connectivityEndpoints();
void handleStopCapture(AsyncWebServerRequest *req);
void handleStartCapture(AsyncWebServerRequest *req);
void handleRestart(AsyncWebServerRequest *req);
void sendProgressUpdate();
void loadConfig();
void saveConfig();
void applyConfigFromDoc(JsonDocument &doc);
void publishTelemetryAndAlerts(const JsonDocument &doc);

// FIFO + notifications
size_t countFileLines(const char* path);
bool fifoTrimKeepLast(const char* path, size_t keepLast);
void fifoGuardLogs();
void notifyFifoTrim(const char* path, size_t total, size_t kept);
 
// ---------------------------------------------------------------------
// FIFO LOG MAINTENANCE (keeps /data.json from growing unbounded)
// ---------------------------------------------------------------------
#define LOG_PATH "/data.json"
static const size_t LOG_MAX_LINES = 2000;   // when exceeded, we trim
static const size_t LOG_TRIM_KEEP = 1400;   // keep this many newest lines

// Count '\n'-terminated lines without loading the entire file into RAM.
size_t countFileLines(const char* path) {
  if (!LittleFS.exists(path)) return 0;
  File f = LittleFS.open(path, "r");
  if (!f) return 0;
  size_t lines = 0;
  while (f.available()) {
    if (f.read() == '\n') lines++;
  }
  f.close();
  return lines;
}

// Forward declaration for notifier to avoid reordering
// (actual definition provided below)
// void notifyFifoTrim(const char* path, size_t total, size_t kept);

// Trim the file to keep only the last `keepLast` lines.
// Copies the tail to /data.tmp then renames — safer on power loss.
bool fifoTrimKeepLast(const char* path, size_t keepLast) {
  if (!LittleFS.exists(path)) return true;
  File in = LittleFS.open(path, "r");
  if (!in) return false;

  // Pass 1: count total lines
  size_t total = 0;
  while (in.available()) {
    if (in.read() == '\n') total++;
  }
  in.close();

  if (total <= keepLast) return true; // nothing to do

  const size_t skip = total - keepLast;

  // Pass 2: copy tail
  in = LittleFS.open(path, "r");
  if (!in) return false;
  File out = LittleFS.open("/data.tmp", "w");
  if (!out) { in.close(); return false; }

  // Skip first `skip` lines
  size_t seen = 0;
  while (in.available() && seen < skip) {
    if (in.read() == '\n') seen++;
  }
  // Copy remainder in chunks
  const size_t BUFSZ = 512;
  uint8_t buf[BUFSZ];
  while (in.available()) {
    size_t n = in.read(buf, BUFSZ);
    if (n) out.write(buf, n);
  }
  in.close();
  out.close();

  // Replace original with trimmed tail
  LittleFS.remove(path);
  LittleFS.rename("/data.tmp", path);

  Serial.printf("FIFO: trimmed %s (kept last %u of %u lines)\n", path, (unsigned)keepLast, (unsigned)total);
  notifyFifoTrim(path, total, keepLast);
  return true;
}

// Decide when to trim:
//  1) If FS usage >= critical threshold, trim aggressively.
//  2) If line count exceeded, trim to LOG_TRIM_KEEP.
void fifoGuardLogs() {
  uint32_t totalBytes = LittleFS.totalBytes();
  uint32_t usedBytes  = LittleFS.usedBytes();
  uint32_t usedPct    = totalBytes ? (uint32_t)((100.0 * usedBytes) / totalBytes) : 0;

  if (usedPct >= gFS_CRIT_PCT) {
    fifoTrimKeepLast(LOG_PATH, LOG_TRIM_KEEP);
    return;
  }

  size_t lines = countFileLines(LOG_PATH);
  if (lines > LOG_MAX_LINES) {
    fifoTrimKeepLast(LOG_PATH, LOG_TRIM_KEEP);
  }
}

// Notify UI and MQTT about a FIFO trim event
void notifyFifoTrim(const char* path, size_t total, size_t kept) {
  lastFifoTrimTs    = millis();
  lastFifoTrimKept  = kept;
  lastFifoTrimTotal = total;

  // WebSocket one-shot event for dashboard
  String msg = "{\"event\":\"fifo_trim\",\"path\":\"";
  msg += path;
  msg += "\",\"kept\":";
  msg += (unsigned)kept;
  msg += ",\"total\":";
  msg += (unsigned)total;
  msg += ",\"ts\":";
  msg += (uint32_t)millis();
  msg += "}";
  ws.textAll(msg);

  // Also publish to MQTT critical stream for auditing
  if (mqttIsConnected()) {
    JsonDocument d;
    d["deviceId"] = deviceIdNoColon();
    d["ts"]       = (uint32_t)millis();
    d["event"]    = "fifo_trim";
    d["path"]     = path;
    d["kept"]     = (uint32_t)kept;
    d["total"]    = (uint32_t)total;
    d["message"]  = "FIFO trimmed log";
    mqttPublish("/critical", d, false, 1);
  }
}

//---------------------------------------------------------------------
// FILESYSTEM SETUP FUNCTIONS
//---------------------------------------------------------------------
 void initFileSystem() {
   if (!LittleFS.begin()) {
     Serial.println("Failed to initialize file system");
     formatFileSystem();
   } else {
     Serial.println("File system initialized");
   }
 }
 
 void loadSensorLabels(JsonDocument &doc) {
   if (LittleFS.exists("/labels.json")) {
     File file = LittleFS.open("/labels.json", "r");
     if (file) {
       DeserializationError error = deserializeJson(doc, file);
       if (error) {
         Serial.println("Failed to read labels.json, initializing empty document");
         doc.to<JsonObject>();
       }
       file.close();
     }
   } else {
     doc.to<JsonObject>();
     saveSensorLabels(doc);
   }
 }
 
 void saveSensorLabels(JsonDocument &doc) {
   File file = LittleFS.open("/labels.json", "w");
   if (file) {
     serializeJson(doc, file);
     file.close();
     Serial.println("Sensor labels saved successfully");
   } else {
     Serial.println("Failed to write labels.json");
   }
 }
 
 void formatFileSystem() {
   Serial.println("Formatting file system...");
   if (LittleFS.format()) {
     Serial.println("File system formatted successfully");
     if (LittleFS.begin()) {
       Serial.println("File system initialized after formatting");
     } else {
       Serial.println("Failed to initialize file system after formatting");
     }
   } else {
     Serial.println("Failed to format file system");
   }
 }
 
// Wi-Fi event hook to drive MQTT presence and timers
void onWiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case SYSTEM_EVENT_STA_GOT_IP:
#ifdef ARDUINO_EVENT_WIFI_STA_GOT_IP
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
#endif
      // When we have IP, (re)connect MQTT
      mqttConnect();
      break;

    case SYSTEM_EVENT_STA_DISCONNECTED:
#ifdef ARDUINO_EVENT_WIFI_STA_DISCONNECTED
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
#endif
      // Nothing to do: LWT will publish OFFLINE automatically if broker connection drops.
      break;

    default: break;
  }
}
//---------------------------------------------------------------------
// WIFI CONFIGURATION FUNCTIONS
 //---------------------------------------------------------------------
 void loadWiFiConfig() {
   if (LittleFS.exists("/wifi_config.json")) {
     File file = LittleFS.open("/wifi_config.json", "r");
     if (file) {
       JsonDocument doc;
       DeserializationError error = deserializeJson(doc, file);
       if (!error) {
         if (!doc["ssid"].isNull() && !doc["password"].isNull()) {
           wifiSSID = doc["ssid"].as<String>();
           wifiPassword = doc["password"].as<String>();
           Serial.println("Loaded WiFi config: " + wifiSSID + ", " + wifiPassword);
         }
       }
       file.close();
     }
   }
 }
 
void connectToWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(hostName);
  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());
  Serial.print("Connecting to WiFi");

  const uint32_t START = millis();
  const uint32_t TIMEOUT_MS = 30000; // try up to 30s before falling back to AP
  while (WiFi.status() != WL_CONNECTED && (millis() - START) < TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected to WiFi. IP: " + WiFi.localIP().toString());
    isAPMode = false;
  } else {
    Serial.println("\nWiFi connection failed after 30s. Starting AP mode...");
    startAccessPoint();
  }
}
 
 //---------------------------------------------------------------------
 // WEBSOCKET FUNCTIONS
 //---------------------------------------------------------------------

void updateWebSocketClients() {
    String ipAddress = isAPMode ? WiFi.softAPIP().toString()
                                : WiFi.localIP().toString();

    String status = captureEnabled
                      ? (WiFi.status() == WL_CONNECTED ? "Connected to WiFi"
                                                       : "Storing data locally")
                      : "Paused";

    if (captureEnabled) sensors.requestTemperatures();

    int sensorCount = sensors.getDeviceCount();

    JsonDocument doc;
    doc["ipAddress"] = ipAddress;
    doc["status"]    = status;

    // ---- ESP status block ----
    JsonObject esp = doc["esp"].to<JsonObject>();
    esp["uptimeMs"] = (uint32_t)millis();

    JsonObject wifi = esp["wifi"].to<JsonObject>();
bool staConnected = (WiFi.status() == WL_CONNECTED);
int  rssiVal      = staConnected ? WiFi.RSSI() : -127;
wifi["connected"] = staConnected;
wifi["rssi"]      = rssiVal;
wifi["ip"]        = ipAddress; 

    uint32_t total = LittleFS.totalBytes();
    uint32_t used  = LittleFS.usedBytes();
    JsonObject fs  = esp["fs"].to<JsonObject>();
    fs["total"]   = total;
    fs["used"]    = used;
    fs["free"]    = (total > used) ? (total - used) : 0;
    fs["usedPct"] = total ? (uint32_t)((100.0 * used) / total) : 0;

    esp["mqttConnected"] = mqttIsConnected();

    // ---- Sensors array ----
    JsonArray sensorArray = doc["sensors"].to<JsonArray>();

    // Load label map once
    JsonDocument labelDoc;
    loadSensorLabels(labelDoc);
    JsonObject labels = labelDoc.as<JsonObject>();

    // DS18B20 temps (°F)
    for (int i = 0; i < sensorCount; ++i) {
        DeviceAddress deviceAddress;
        if (!sensors.getAddress(deviceAddress, i)) continue;

        char addressString[17];
        for (uint8_t j = 0; j < 8; ++j)
            sprintf(addressString + j * 2, "%02X", deviceAddress[j]);

        String label = labels[addressString].is<String>() ? labels[addressString].as<String>() : String("Sensor ") + String(i + 1);;
        String readingValue;
        float tempF = NAN;
        bool invalid = true;
        if (captureEnabled) {
            tempF = sensors.getTempF(deviceAddress);
            invalid = (isnan(tempF) || tempF < -100.0f); // -196.6°F etc. => invalid/sentinel
            readingValue = invalid ? "sensor invalid/offline" : String(tempF, 1) + "°F";
        } else {
            readingValue = "Paused";
        }

        JsonObject sensorObj = sensorArray.add<JsonObject>();
        sensorObj["id"]            = String(addressString);
        sensorObj["label"]         = "S" + String(i + 1) + ": " + label;
        sensorObj["reading_value"] = readingValue;
        if (!invalid) sensorObj["tempF"] = tempF; // numeric for alerting
    }

    // DHT22 (throttled) humidity (%) and temp (°C)
    if (captureEnabled) {
        uint32_t now = millis();
        if (now - lastDhtRead >= DHT_MIN_INTERVAL_MS || isnan(lastHum) || isnan(lastTc)) {
            lastHum = dht.readHumidity();
            lastTc  = dht.readTemperature();
            lastDhtRead = now;
        }

        JsonObject h = sensorArray.add<JsonObject>();
        h["id"]            = "DHT22_Humidity";
        h["label"]         = "DHT22 Humidity";
        h["reading_value"] = isnan(lastHum) ? "--" : String(lastHum, 1) + "%";
        if (!isnan(lastHum)) h["humidity"] = lastHum;

        JsonObject t = sensorArray.add<JsonObject>();
        t["id"]            = "DHT22_TempC";
        t["label"]         = "DHT22 Temperature";
        t["reading_value"] = isnan(lastTc) ? "--" : String(lastTc, 1) + "°C";
        if (!isnan(lastTc)) t["tempC"] = lastTc;
    }

    // ---- Alerts ----
    JsonArray alerts = doc["alerts"].to<JsonArray>();
    // Capture state
    if (!captureEnabled) {
        JsonObject a = alerts.add<JsonObject>();
        a["severity"] = "warn";
        a["message"]  = "Data capture is paused.";
    }
    // WiFi / MQTT status
    if (WiFi.status() != WL_CONNECTED) {
        JsonObject a = alerts.add<JsonObject>();
        a["severity"] = "warn";
        a["message"]  = "WiFi disconnected – storing data locally.";
    }
    if (!mqttIsConnected()) {
        JsonObject a = alerts.add<JsonObject>();
        a["severity"] = "warn";
        a["message"]  = "MQTT broker not connected.";
    }
    // Filesystem usage
    uint32_t usedPct = total ? (uint32_t)((100.0 * used) / total) : 0;
    if (usedPct >= FS_USED_WARN_PCT) {
        JsonObject a = alerts.add<JsonObject>();
        a["severity"] = "warn";
        a["message"]  = String("Filesystem high usage: ") + String(usedPct) + "%";
    }
    // Wi-Fi RSSI thresholds
    if (staConnected) {
        if (rssiVal <= gRSSI_CRIT_DBM) {
            JsonObject a = alerts.add<JsonObject>();
            a["severity"] = "error";
            a["message"]  = String("Wi-Fi signal very weak (") + String(rssiVal) + " dBm). Move closer to the router/AP.";
        } else if (rssiVal <= gRSSI_WARN_DBM) {
            JsonObject a = alerts.add<JsonObject>();
            a["severity"] = "warn";
            a["message"]  = String("Wi-Fi signal weak (") + String(rssiVal) + " dBm). Consider relocating for better reception.";
        }
    }
    // Sensor presence
    if (sensorCount == 0) {
        JsonObject a = alerts.add<JsonObject>();
        a["severity"] = "error";
        a["message"]  = "No DS18B20 sensors detected.";
    }
    // Threshold alerts from the DS18B20 readings
    for (JsonObject s : sensorArray) {
        if (s["tempF"].is<float>()) {
            float tf = s["tempF"].as<float>();
            if (tf > TEMP_F_HIGH || tf < TEMP_F_LOW) {
                JsonObject a = alerts.add<JsonObject>();
                a["severity"] = (tf > TEMP_F_HIGH) ? "error" : "warn";
                a["message"]  = String("Temperature out of range on ") + s["label"].as<String>()
                                + String(" (") + String(tf,1) + "°F)";
            }
        }
    }

    // DHT thresholds
    if (!isnan(lastHum) && (lastHum > HUMIDITY_HIGH || lastHum < HUMIDITY_LOW)) {
        JsonObject a = alerts.add<JsonObject>();
        a["severity"] = "warn";
        a["message"]  = String("Humidity out of range (") + String(lastHum,1) + "%)";
    }

    // FIFO trim alert shown for ~60s after an event
    if (lastFifoTrimTs && (millis() - lastFifoTrimTs) < 60000) {
        JsonObject a = alerts.add<JsonObject>();
        a["severity"] = "info";
        String fifoMsg;
        fifoMsg.reserve(96);
        fifoMsg  = "Log maintenance: FIFO trimmed ";
        fifoMsg += LOG_PATH;
        fifoMsg += " (kept last ";
        fifoMsg += (unsigned long)lastFifoTrimKept;
        fifoMsg += " of ";
        fifoMsg += (unsigned long)lastFifoTrimTotal;
        fifoMsg += " lines)";
        a["message"] = fifoMsg;
    }

    // ---- Broadcast ----
    String jsonData;
    serializeJson(doc, jsonData);
    ws.textAll(jsonData);
    publishTelemetryAndAlerts(doc);
}

 void handleWebSocketMessage(uint8_t num, uint8_t *payload, size_t length) {
   String message = String((char *)payload).substring(0, length);
   Serial.printf("WebSocket[%u]: %s\n", num, message.c_str());
 }
 
void onWebSocketEvent(AsyncWebSocket * server, AsyncWebSocketClient * client, AwsEventType type,
                     void * arg,uint8_t * data,size_t len)
{
  switch (type) {
    case WS_EVT_CONNECT: {
      Serial.printf("WebSocket client #%u connected\n", client->id());
      // Immediately push a snapshot so UI has data without waiting
      updateWebSocketClients();
      client->text("{\"status\":\"Connected to ESP32 WebSocket\"}");
      break;
    }
    case WS_EVT_DISCONNECT: {
      Serial.printf("WebSocket client #%u disconnected\n", client->id());
      break;
    }
    case WS_EVT_DATA: {
      AwsFrameInfo * info = (AwsFrameInfo*)arg;
      if (info->opcode == WS_TEXT) {
        // make sure payload is null-terminated
        if (len < 2048) {
          data[len] = '\0';
          handleWebSocketMessage(client->id(), data, len);
        }
      }
      break;
    }
    default:
      break;
  }
}

 
 //---------------------------------------------------------------------
 // STOP/START CAPTURE AND RESTART ENDPOINTS
 //---------------------------------------------------------------------
 // Stop sensor capture endpoint (pause data collection)
 void handleStopCapture(AsyncWebServerRequest *req) {
     captureEnabled = false;
     req->send(200, "text/plain", "Sensor data capture paused.");
 }
 
 // Start sensor capture endpoint (resume data collection)
 void handleStartCapture(AsyncWebServerRequest *req) {
     captureEnabled = true;
     req->send(200, "text/plain", "Sensor data capture resumed.");
 }
 
//---------------------------------------------------------------------
// OTA UPDATE FUNCTIONS
//---------------------------------------------------------------------

// Minimal inline progress page fallback (kept in flash to avoid RAM use)
static const char otaProgressInline[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Update</title>
<style>body{font-family:Arial;text-align:center;background:#f4f4f4}</style>
</head><body><h1>Upload complete. Processing firmware…</h1></body></html>
)rawliteral";

void setupOTA()
{
  // /login
  server.on("/login", HTTP_GET, [](AsyncWebServerRequest *req){
    auto *resp = req->beginResponse(LittleFS, "/login.html", "text/html; charset=utf-8");
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });

  // /serverIndex (UI)
  server.on("/serverIndex", HTTP_GET, [](AsyncWebServerRequest *req){
    auto *resp = req->beginResponse(LittleFS, "/ota.html", "text/html; charset=utf-8");
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });

  // /update (upload endpoint)
  server.on("/update", HTTP_POST,
    // 1) request-finished handler
    [](AsyncWebServerRequest *req)
    {
      if (LittleFS.exists("/otaProgress.html")) {
        auto *resp = req->beginResponse(LittleFS, "/otaProgress.html", "text/html; charset=utf-8");
        resp->addHeader("Connection", "close");
        req->send(resp);
      } else {
        req->send(200, "text/html; charset=utf-8", otaProgressInline);
      }
    },
    // 2) chunk handler
    [](AsyncWebServerRequest *req, const String &filename, size_t index, uint8_t *data, size_t len, bool final)
    {
      static size_t bytesWritten = 0;
      static size_t totalSize    = 0;

      if (index == 0) {
        Serial.printf("Update start: %s\n", filename.c_str());
        totalSize        = req->contentLength();
        bytesWritten     = 0;
        uploadProgress   = 0;
        updateFinished   = false;
        updateSuccessful = false;
        if (!Update.begin(UPDATE_SIZE_UNKNOWN)) Update.printError(Serial);
      }

      size_t written = Update.write(data, len);
      if (written != len) Update.printError(Serial);
      bytesWritten += written;

      uploadProgress = (int)(100.0 * bytesWritten / (totalSize ? totalSize : 1));
      sendProgressUpdate();

      if (final) {
        bool ok = Update.end(true);
        Serial.printf("Update %s: %u bytes\n", ok ? "SUCCESS" : "FAILED", (unsigned)bytesWritten);
        updateSuccessful = ok;
        uploadProgress   = 100;
        updateFinished   = true;
        sendProgressUpdate();
        delay(1500);
        ESP.restart();
      }
    },
    // 3) no file-abort callback
    nullptr
  );
}

 //---------------------------------------------------------------------
 // FILESYSTEM MANAGEMENT ENDPOINTS
 //---------------------------------------------------------------------
 void serverFileListHandler(AsyncWebServerRequest *req) {
  JsonDocument doc;
  JsonArray files = doc["files"].to<JsonArray>();

  File root = LittleFS.open("/");
  File file = root.openNextFile();
  while (file) {
    JsonObject f = files.add<JsonObject>();
    f["name"] = file.name();
    f["size"] = file.size();
    file = root.openNextFile();
  }

  String output;
  serializeJson(doc, output);
  req->send(200, "application/json", output);
}
 
 // Download handler for AsyncWebServer
void downloadFileHandler(AsyncWebServerRequest *req) {
  if (!req->hasParam("file")) {
    req->send(400, "text/plain", "Missing file parameter");
    return;
  }

  String filename = req->getParam("file")->value();
  if (!filename.startsWith("/")) {
    filename = "/" + filename;
  }

  if (!LittleFS.exists(filename)) {
    req->send(404, "text/plain", "File Not Found");
    return;
  }
  String downloadName = filename.substring(1);
AsyncWebServerResponse *resp =
    req->beginResponse(LittleFS, filename, "application/octet-stream", true);
resp->addHeader("Content-Disposition", "attachment; filename=\"" + downloadName + "\"");
req->send(resp);
}
// standalone handler
void viewFileHandler(AsyncWebServerRequest *req) {
  if (!req->hasParam("file")) {
    req->send(400, "text/plain", "Missing file parameter");
    return;
  }

  String filename = req->getParam("file")->value();
  if (!filename.startsWith("/")) {
    filename = "/" + filename;
  }

  if (!LittleFS.exists(filename)) {
    req->send(404, "text/plain", "File Not Found");
    return;
  }

  // Detect a reasonable content-type for inline viewing
  String contentType = "application/octet-stream";
  if (filename.endsWith(".json")) {
    contentType = "application/json";
  } else if (filename.endsWith(".txt") || filename.endsWith(".log") || filename.endsWith(".csv")) {
    contentType = "text/plain";
  } else if (filename.endsWith(".html") || filename.endsWith(".htm")) {
    contentType = "text/html";
  }

  // Stream the file directly from LittleFS; don't build it into RAM
  AsyncWebServerResponse *resp = req->beginResponse(LittleFS, filename, contentType, /*download=*/false);
  resp->addHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  resp->addHeader("Pragma", "no-cache");
  resp->addHeader("Expires", "0");
  req->send(resp);
}

 void handleFileUpload(AsyncWebServerRequest *req, const String &filename,size_t index,uint8_t *data,size_t len,bool final)
{
    static File fsUploadFile;

    if (index == 0) {
        String path = filename.startsWith("/") ? filename : "/" + filename;
        fsUploadFile = LittleFS.open(path, "w");
    }
    if (fsUploadFile) {
        if (len) fsUploadFile.write(data, len);
        if (final) {
            fsUploadFile.close();
            // Response is sent by the route handler; do not send here.
        }
    }
}
 void formatFSHandler(AsyncWebServerRequest *req){
   if (LittleFS.format()) {
     if (LittleFS.begin()) {
       req->send(200, "text/plain", "Filesystem formatted and reinitialized");
       return;
     }
   }
   req->send(500, "text/plain", "Filesystem formatting failed");
 }
 
 void fsInfoHandler(AsyncWebServerRequest *req) {
   JsonDocument doc;
   uint32_t total = LittleFS.totalBytes();
   uint32_t used = LittleFS.usedBytes();
   uint32_t free = total - used;
   doc["total"] = total;
   doc["used"] = used;
   doc["free"] = free;
   String json;
   serializeJson(doc, json);
   req->send(200, "application/json", json);
 }
 
 //---------------------------------------------------------------------
 // DATA/DB FUNCTIONS
 //---------------------------------------------------------------------
 void uploadStoredData() {
     if (WiFi.status() == WL_CONNECTED) {
         File file = LittleFS.open("/data.json", "r");
         if (!file) {
             Serial.println("No data to upload");
             return;
         }
         HTTPClient http;
         http.begin(remoteServerName);
         http.addHeader("Content-Type", "application/x-www-form-urlencoded");
         JsonDocument doc;
         JsonArray data = doc["data"].to<JsonArray>();
         while (file.available()) {
             String line = file.readStringUntil('\n');
             JsonDocument tempDoc;
             DeserializationError error = deserializeJson(tempDoc, line);
             if (!error) {
                 data.add(tempDoc.as<JsonObject>());
             }
         }
         file.close();
         String jsonData;
         serializeJson(doc, jsonData);
         String httpRequestData = "api_key=" + String(remoteApiKey) + "&data=" + jsonData;
         int httpResponseCode = http.POST(httpRequestData);
         if (httpResponseCode == 200) {
             Serial.println("Stored data uploaded successfully");
         } else {
             Serial.printf("Error uploading stored data: %d\n", httpResponseCode);
         }
         http.end();
     }
 }
 
 void sendSensorData() {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(remoteServerName);
        http.addHeader("Content-Type", "application/x-www-form-urlencoded");

        JsonDocument doc;
        JsonArray data = doc["data"].to<JsonArray>();

        sensors.requestTemperatures();
        int sensorCount = sensors.getDeviceCount();
        DeviceAddress addr;

        for (int i = 0; i < sensorCount; i++) {
            if (!sensors.getAddress(addr, i)) continue;
            float tempF = sensors.getTempF(addr);
            String reading = isnan(tempF) ? "--" : String(tempF, 1);

            char addrStr[17];
            for (uint8_t j = 0; j < 8; j++) {
                sprintf(addrStr + j * 2, "%02X", addr[j]);
            }

            JsonObject sensorData = data.add<JsonObject>();
            sensorData["sensor_id"] = String(addrStr);
            sensorData["reading_value"] = reading;
        }

        String jsonData;
        serializeJson(doc, jsonData);
        String httpRequestData = "api_key=" + String(remoteApiKey) + "&data=" + jsonData;

        int httpResponseCode = http.POST(httpRequestData);
        http.end();

        if (httpResponseCode == 200) {
            Serial.println("Data sent successfully");
        } else {
            Serial.printf("Error sending data: %d\n", httpResponseCode);
        }
    } else {
        storeDataLocally();
    }
}

 
 void storeLabelsLocally(JsonDocument &doc) {
   File file = LittleFS.open("/labels.json", "w");
   if (file) {
     serializeJson(doc, file);
     file.close();
     Serial.println("Labels stored locally");
   } else {
     Serial.println("Failed to open labels.json file");
   }
 }
 
 void storeDataLocally() {
    // Before appending to the log, ensure it doesn't grow unbounded
    fifoGuardLogs();
    if (!LittleFS.exists("/data.json")) {
        File file = LittleFS.open("/data.json", "w");
        file.close();
    }
    File file = LittleFS.open("/data.json", "a");
    if (file) {
        sensors.requestTemperatures();
        DeviceAddress addr;
        if (sensors.getAddress(addr, 0)) {
            float tempF = sensors.getTempF(addr);
            String reading = isnan(tempF) ? "--" : String(tempF, 1);
            char buf[17];
            for (uint8_t i = 0; i < 8; i++) {
                sprintf(buf + i * 2, "%02X", addr[i]);
            }
            JsonDocument doc;
            JsonObject sensorData = doc.to<JsonObject>();
            sensorData["timestamp"]     = millis();
            sensorData["sensor_id"]     = String(buf);
            sensorData["reading_value"] = reading;
            String jsonData;
            serializeJson(doc, jsonData);
            file.println(jsonData);
        }
        file.close();
    }
}

 
 //---------------------------------------------------------------------
 // WIFI CONNECTIVITY ENDPOINTS
 //---------------------------------------------------------------------
 void connectivityEndpoints() {
  // Endpoint to disconnect WiFi and force AP mode.
  server.on("/disconnect", HTTP_POST, [](AsyncWebServerRequest *req) {
    WiFi.disconnect();
    startAccessPoint();
    req->send(200, "text/plain", "WiFi disconnected. Now in AP Mode.");
  });

  // Endpoint to scan for available networks.
  server.on("/scan", HTTP_GET, [](AsyncWebServerRequest *req) {
  int n = WiFi.scanNetworks();
  JsonDocument doc;
  JsonArray arr = doc["networks"].to<JsonArray>();
  if (n > 0) {
    for (int i = 0; i < n; i++) {
      JsonObject net = arr.add<JsonObject>();
      net["ssid"] = WiFi.SSID(i);
      net["rssi"] = WiFi.RSSI(i);
    }
  }
  String output;
  serializeJson(doc, output);
  req->send(200, "application/json", output);
});

  // Endpoint to accept new WiFi credentials and attempt reconnection.
  server.on("/connectivity", HTTP_POST, [](AsyncWebServerRequest *req) {
    if (!req->hasArg("plain")) {
      req->send(400, "text/plain", "No data provided.");
      return;
    }
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, req->arg("plain"));
    if (error) {
      req->send(400, "text/plain", "Invalid JSON data.");
      return;
    }
    if (!doc["ssid"] || !doc["password"]) {
      req->send(400, "text/plain", "Missing ssid or password.");
      return;
    }
    wifiSSID = doc["ssid"].as<String>();
    wifiPassword = doc["password"].as<String>();

    JsonDocument wifiDoc;
    wifiDoc["ssid"]     = wifiSSID;
    wifiDoc["password"] = wifiPassword;
    File wifiFile = LittleFS.open("/wifi_config.json", "w");
    if (wifiFile) {
      serializeJson(wifiDoc, wifiFile);
      wifiFile.close();
    }

    WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());
    unsigned long startAttemptTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
      delay(500);
    }
    if (WiFi.status() == WL_CONNECTED) {
      req->send(200, "text/plain", "Connected to WiFi: " + wifiSSID);
    } else {
      req->send(200, "text/plain", "Failed to connect to WiFi: " + wifiSSID);
    }
  });

  // Serve the Connectivity management page.
  server.on("/connectivity", HTTP_GET, [](AsyncWebServerRequest *req) {
    auto *resp = req->beginResponse(LittleFS, "/connectivity.html", "text/html; charset=utf-8");
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });
}

 //---------------------------------------------------------------------
 // START ACCESS POINT (AP MODE)
 //---------------------------------------------------------------------
 void startAccessPoint() {
   WiFi.mode(WIFI_AP);
   WiFi.softAP("ESP32_AP");
   isAPMode = true;
   Serial.println("AP Mode started. IP: " + WiFi.softAPIP().toString());

 }
 
 // Restart the device endpoint
 void handleRestart(AsyncWebServerRequest *req) {
     req->send(200, "text/plain", "Restarting device...");
     delay(1000);  // Give time for response to be sent
     ESP.restart();
 }
 
 // Helper function to send OTA progress updates over the websocket.
 void sendProgressUpdate() {
   String msg = "{";
   msg += "\"progress\":" + String(uploadProgress) + ",";
   if (updateFinished) {
     if (updateSuccessful)
       msg += "\"message\":\"Update complete. Rebooting...\",";
     else
       msg += "\"message\":\"Update failed. Please try again.\",";
   } else {
     msg += "\"message\":\"Uploading...\",";
   }
   msg += "\"finished\":" + String(updateFinished ? "true" : "false");
   msg += "}";
   ws.textAll(msg);
 }
 
 //---------------------------------------------------------------------
// MAIN SETUP FUNCTION
//---------------------------------------------------------------------
void setup() {

  // boot + init
  Serial.begin(500000);
  Serial.println("Booting…");
  Serial.println("Firmware Version: " + String(FIRMWARE_VERSION));
  sensors.begin();
  dht.begin();
  initFileSystem();
  loadWiFiConfig();
  // Register Wi-Fi events and prime MQTT topic base
  WiFi.onEvent(onWiFiEvent);
  mqttBaseTopic = String("dev/") + deviceIdNoColon();
  connectToWiFi();
  setupOTA();
  connectivityEndpoints();

  // page routes
  server.on("/manage", HTTP_GET, [](AsyncWebServerRequest *req){
    auto *resp = req->beginResponse(LittleFS, "/manage.html", "text/html; charset=utf-8");
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });
  server.on("/labels", HTTP_GET, [](AsyncWebServerRequest *req){
    auto *resp = req->beginResponse(LittleFS, "/labels.html", "text/html; charset=utf-8");
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });
  server.on("/fs", HTTP_GET, [](AsyncWebServerRequest *req){
    auto *resp = req->beginResponse(LittleFS, "/fs.html", "text/html; charset=utf-8");
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });
  //server.on("/connectivity", HTTP_GET, [](AsyncWebServerRequest *req){ req->send(200,"text/html",connectivityPage); });

  // update sensor labels
  server.on("/update-labels", HTTP_POST,
    [](AsyncWebServerRequest *req){},nullptr,
    [](AsyncWebServerRequest *req,uint8_t *data,size_t len,size_t, size_t){
      JsonDocument doc;
      if (deserializeJson(doc, String((char*)data, len))) {
        req->send(400,"application/json","{\"error\":\"Invalid JSON\"}");return;
      }
      saveSensorLabels(doc);
      req->send(200,"application/json","{\"status\":\"success\"}");
    });

  // sensors JSON
  server.on("/get-sensors", HTTP_GET, [](AsyncWebServerRequest *req){
    sensors.requestTemperatures();
    int cnt = sensors.getDeviceCount();
    JsonDocument lbl;
    loadSensorLabels(lbl);
    JsonDocument out;
    JsonArray arr = out["sensors"].to<JsonArray>();

    // DS18B20 sensors
    for (int i = 0; i < cnt; i++) {
      DeviceAddress a;
      if (!sensors.getAddress(a, i)) continue;

      char id[17];
      for (uint8_t j = 0; j < 8; j++) sprintf(id + j * 2, "%02X", a[j]);
      id[16] = '\0'; 

      String label = lbl[id].is<String>() ? lbl[id].as<String>() : "Sensor " + String(i + 1);
      float tempF  = sensors.getTempF(a);
      bool invalid = (isnan(tempF) || tempF < -100.0f);
      String reading = invalid ? "sensor invalid/offline" : String(tempF, 2) + " °F";

      JsonObject o = arr.add<JsonObject>();
      o["id"]            = id;
      o["label"]         = "S" + String(i + 1) + ": " + label;
      o["reading_value"] = reading;
      if (!invalid) o["tempF"] = tempF;  // numeric field for alerting/UI
    }

    //  DHT22 readings
    {
      float hum = dht.readHumidity();
      float tc  = dht.readTemperature();  // °C

      JsonObject h = arr.add<JsonObject>();
      h["id"]            = "DHT22_Humidity";
      h["label"]         = "DHT22 Humidity";
      h["reading_value"] = isnan(hum) ? "--" : String(hum, 1) + "%";
      if (!isnan(hum)) h["humidity"] = hum;   // numeric value

      JsonObject t = arr.add<JsonObject>();
      t["id"]            = "DHT22_TempC";
      t["label"]         = "DHT22 Temperature";
      t["reading_value"] = isnan(tc) ? "--" : String(tc, 1) + " °C";
      if (!isnan(tc)) t["tempC"] = tc;        // numeric value
    }
    String json; serializeJson(out, json);
    auto *resp = req->beginResponse(200, "application/json", json);
    resp->addHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    resp->addHeader("Pragma", "no-cache");
    resp->addHeader("Expires", "0");
    req->send(resp);
  });

  // lightweight status JSON for UI polling
  server.on("/status", HTTP_GET, [](AsyncWebServerRequest *req){
    JsonDocument st;

    const bool staUp = (WiFi.status() == WL_CONNECTED);
    const String ipAddress = isAPMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();

    st["ipAddress"] = ipAddress;
    st["status"]    = captureEnabled
                        ? (staUp ? "Connected to WiFi" : (isAPMode ? "AP Mode" : "Offline"))
                        : "Paused";
    st["fw"] = FIRMWARE_VERSION;

    JsonObject esp = st["esp"].to<JsonObject>();
    esp["uptimeMs"] = (uint32_t)millis();

    JsonObject wifi = esp["wifi"].to<JsonObject>();
    wifi["connected"] = staUp;
    wifi["rssi"]      = staUp ? WiFi.RSSI() : -127;
    wifi["ip"]        = ipAddress;

    const uint32_t total = LittleFS.totalBytes();
    const uint32_t used  = LittleFS.usedBytes();
    JsonObject fs = esp["fs"].to<JsonObject>();
    fs["total"]   = total;
    fs["used"]    = used;
    fs["free"]    = (total > used) ? (total - used) : 0;
    fs["usedPct"] = total ? (uint32_t)((100.0 * used) / total) : 0;

    esp["mqttConnected"] = mqttIsConnected();

    String out; serializeJson(st, out);
    auto *resp = req->beginResponse(200, "application/json", out);
    resp->addHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    resp->addHeader("Pragma", "no-cache");
    resp->addHeader("Expires", "0");
    req->send(resp);
  });

  // health JSON (for Network Health card)
  server.on("/health", HTTP_GET, [](AsyncWebServerRequest *req){
    JsonDocument health;
    buildHealthDoc(health);

    String out; serializeJson(health, out);
    auto *resp = req->beginResponse(200, "application/json", out);
    resp->addHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    resp->addHeader("Pragma", "no-cache");
    resp->addHeader("Expires", "0");
    req->send(resp);
  });

  // filesystem & capture
  server.on("/list-files",   HTTP_GET, serverFileListHandler);
  server.on("/download",     HTTP_GET, downloadFileHandler);
  server.on("/view-file",    HTTP_GET, viewFileHandler);
  server.on("/delete-file",  HTTP_GET, [](AsyncWebServerRequest *req){
    if(!req->hasParam("file")){ req->send(400,"text/plain","Missing file parameter"); return; }
    String fn=req->getParam("file")->value(); if(!fn.startsWith("/")) fn="/"+fn;
    if(!LittleFS.exists(fn)){ req->send(404,"text/plain","File Not Found"); return; }
    bool ok = LittleFS.remove(fn);
    req->send(ok?200:500,"text/plain", ok?"File deleted successfully":"Failed to delete file");
  });
  server.on("/upload-file",  HTTP_POST, [](AsyncWebServerRequest *req){ req->send(200,"text/plain","File Uploaded"); }, handleFileUpload);
  server.on("/format-fs",    HTTP_GET, formatFSHandler);
  server.on("/fsinfo",       HTTP_GET, fsInfoHandler);
  server.on("/stop-capture", HTTP_POST, handleStopCapture);
  server.on("/start-capture",HTTP_POST, handleStartCapture);
  server.on("/restart",      HTTP_POST, handleRestart);
  //server.on("/upload-file", HTTP_POST, [](AsyncWebServerRequest *req){ 
    //req->send(200,"text/plain","OK"); }, handleFileUpload, nullptr);
 
    // main page + websocket
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *req){
    auto *resp = req->beginResponse(LittleFS, "/index.html", "text/html; charset=utf-8");
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });
  // Suppress favicon 500 error with 204 No Content
  server.on("/favicon.ico", HTTP_GET, [](AsyncWebServerRequest *req){
    AsyncWebServerResponse *resp = req->beginResponse(204);
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });
  ws.onEvent(onWebSocketEvent);
  server.addHandler(&ws);
  server.begin();
  updateWebSocketClients();

  if (mqttIsConnected()) {
    JsonDocument hb;
    buildHeartbeatDoc(hb, "BOOTED");
    mqttPublish("/heartbeat", hb, false, 1);
    mqttPublishRaw("/critical", "online", true, 1);
  }
}

 //---------------------------------------------------------------------
 // MAIN LOOP FUNCTION
 //---------------------------------------------------------------------
void loop() {
    ws.cleanupClients();
  // Call updateWebSocketClients() every webSocketInterval
  if (millis() - lastWebSocketTime > webSocketInterval) {
      updateWebSocketClients();
      lastWebSocketTime = millis();
  }

  // Every dbUpdateInterval, if capture is enabled, store and possibly upload sensor data.
  if (captureEnabled && millis() - lastDBUpdateTime > dbUpdateInterval) {
      storeDataLocally();
//      if (WiFi.status() == WL_CONNECTED) {
//          uploadStoredData();
//      }
      lastDBUpdateTime = millis();
  }

 // ---- MQTT timed publishers ----
 if (mqttIsConnected()) {
   unsigned long now = millis();
   if (now - lastMqttHeartbeat >= HEARTBEAT_MS) {
     lastMqttHeartbeat = now;
     JsonDocument hb;
     buildHeartbeatDoc(hb, "ONLINE");
     mqttPublish("/heartbeat", hb, true, 1);  // retained snapshot
   }
   if (now - lastMqttHealth >= HEALTH_MS) {
     lastMqttHealth = now;
     JsonDocument health;
     buildHealthDoc(health);
     mqttPublish("/health", health, false, 0);
   }
 }
}