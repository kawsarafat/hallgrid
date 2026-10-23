// HallGrid node firmware for ESP32 DevKit V1 + PZEM-004T v3.0.
//
// One node sits in each wing distribution board (ROLE_WING) and one in the
// common/pump board (ROLE_COMMON). Control logic runs locally and keeps working
// without Wi-Fi; the network task only reports.
//
// Status: compiles for "ESP32 Dev Module" with esp32 core 2.0.17 and the
// PZEM004Tv30 library 1.2.1. Not yet run on a real distribution board.
// Read firmware/README.md before wiring anything.

#define ROLE_WING 1
#define ROLE_COMMON 2

#include "config.h"
#include "detector.h"

#include <Arduino.h>
#include <HTTPClient.h>
#include <PZEM004Tv30.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>

#define FW_VERSION "2.0.0"

// ---------------------------------------------------------------- pins
// PZEM-004T TTL side: power it from 5 V and put a 1k/2k divider on its TX line,
// because its optocoupler output is pulled up to 5 V.
const int PIN_PZEM_RX = 16;  // ESP32 RX2 <- PZEM TX (through divider)
const int PIN_PZEM_TX = 17;  // ESP32 TX2 -> PZEM RX

const int PIN_RELAY1 = 26;  // wing: corridor lights   | common: pump contactor coil
const int PIN_RELAY2 = 25;  // wing: washroom lights   | common: unused
const int PIN_LDR = 34;     // wing: LDR module analog out (ADC1, input only)
const int PIN_PIR = 27;     // wing: HC-SR501 output (3.3 V)
const int PIN_TRIG = 5;     // common: JSN-SR04T trigger
const int PIN_ECHO = 18;    // common: JSN-SR04T echo (through 1k/2k divider)
const int PIN_RESET = 0;    // BOOT button: hold 3 s to clear a pump lockout
const int PIN_LED = 2;

// ---------------------------------------------------------------- timing
const unsigned long METER_MS = 1000;
const unsigned long SUMMARY_MS = 60000;
const unsigned long CONTROL_MS = 200;

// Lighting
const unsigned long BRIGHT_CONFIRM_MS = 10UL * 60 * 1000;
const unsigned long DARK_CONFIRM_MS = 2UL * 60 * 1000;
const unsigned long PIR_HOLD_MS = 15UL * 60 * 1000;
const unsigned long PIR_SILENT_FAULT_MS = 6UL * 60 * 60 * 1000;  // no motion for 6 h in daytime = suspect sensor
const int NIGHT_START_H = 18;  // corridor lights are never cut between these hours
const int NIGHT_END_H = 6;

// Pump
const int PUMP_START_PCT = 40;
const int PUMP_STOP_PCT = 95;
const unsigned long PUMP_MAX_RUN_MS = 90UL * 60 * 1000;
const unsigned long PUMP_RISE_CHECK_MS = 20UL * 60 * 1000;
const int PUMP_MIN_RISE_PCT = 5;
const unsigned long PUMP_MIN_OFF_MS = 5UL * 60 * 1000;
const int SONAR_MAX_BAD = 10;

// ---------------------------------------------------------------- state
HardwareSerial PzemSerial(2);
PZEM004Tv30 pzem(PzemSerial, PIN_PZEM_RX, PIN_PZEM_TX);
detect::StepDetector detector;

struct Agg {
  int n = 0;
  float vSum = 0, pSum = 0, nSum = 0, pMax = 0;
  void add(float v, float p, float q) { n++; vSum += v; pSum += p; nSum += q; if (p > pMax) pMax = p; }
  void clear() { *this = Agg(); }
} agg;

float lastPf = NAN, lastHz = NAN, lastKwh = NAN;
int meterErrors = 0;  // consecutive failed reads
bool meterFault = false;

// Lighting
bool corridorOn = true;
bool washroomOn = true;
float brightAvg = -1;
unsigned long brightSince = 0, darkSince = 0;
unsigned long lastMotionMs = 0;
bool pirFault = false;

// Pump
enum PumpState { PUMP_IDLE, PUMP_RUNNING, PUMP_LOCKOUT };
PumpState pumpState = PUMP_IDLE;
const char* pumpReason = "";
int tankPct = -1;
int sonarBad = 0;
unsigned long pumpStartedMs = 0, pumpStoppedMs = 0;
int pumpStartPct = 0;
unsigned long resetPressedMs = 0;

// Outgoing messages, filled by loop() and sent by the network task on core 0.
struct Msg { char body[640]; };
QueueHandle_t outbox;

// ---------------------------------------------------------------- helpers
void setRelay(int pin, bool energized) {
  digitalWrite(pin, (energized ^ (RELAY_ACTIVE_LOW == 1)) ? HIGH : LOW);
}

// Lights are wired through the relay's normally-closed contact, so a dead node,
// a reboot or a power cut on the 5 V side leaves the lights ON.
void applyLight(int pin, bool lightOn) { setRelay(pin, !lightOn); }

bool timeValid() { return time(nullptr) > 1700000000; }

int localHour() {
  if (!timeValid()) return -1;
  struct tm t;
  time_t now = time(nullptr);
  localtime_r(&now, &t);
  return t.tm_hour;
}

bool isNight() {
  int h = localHour();
  if (h < 0) return false;
  return h >= NIGHT_START_H || h < NIGHT_END_H;
}

void enqueue(const char* body) {
  Msg m;
  strncpy(m.body, body, sizeof(m.body) - 1);
  m.body[sizeof(m.body) - 1] = 0;
  if (xQueueSend(outbox, &m, 0) != pdTRUE) {
    // Queue full: drop the oldest message to make room for the newest.
    Msg old;
    xQueueReceive(outbox, &old, 0);
    xQueueSend(outbox, &m, 0);
  }
}

unsigned long upS() { return millis() / 1000; }

long long unixNow() { return timeValid() ? (long long)time(nullptr) : 0; }

// ---------------------------------------------------------------- meter
void reportEvent(const detect::Event& e);

void readMeter() {
  float v = pzem.voltage();
  float i = pzem.current();
  float p = pzem.power();
  float pf = pzem.pf();
  float hz = pzem.frequency();
  float kwh = pzem.energy();

  if (isnan(v) || isnan(i) || isnan(p)) {
    // No reading. With mains present this is a wiring or meter fault; with
    // mains absent the PZEM is unpowered (its measuring side runs from mains).
    if (++meterErrors >= 10) meterFault = true;
    v = 0; i = 0; p = 0;
  } else {
    meterErrors = 0;
    meterFault = false;
    lastPf = pf;
    lastHz = hz;
    lastKwh = kwh;
  }

  // Non-active power from apparent and active power. It includes reactive and
  // distortion power and has no sign; that is enough for the step test.
  float s = v * i;
  float n = (s > p) ? sqrtf(s * s - p * p) : 0;
  if (v > 0) agg.add(v, p, n);

  detect::Event ev[4];
  int k = detector.update(upS(), v, p, n, ev, 4);
  for (int j = 0; j < k; j++) reportEvent(ev[j]);
}

void reportEvent(const detect::Event& e) {
  if (e.type == detect::EV_STEP && !e.resistive) return;  // ordinary steps stay local
  char buf[400];
  snprintf(buf, sizeof buf,
           "{\"nodeId\":\"%s\",\"fw\":\"%s\",\"kind\":\"event\",\"up\":%lu,\"ts\":%lld,"
           "\"event\":{\"type\":\"%s\",\"dP\":%.0f,\"dN\":%.0f,\"cos\":%.3f,\"startedAt\":%lu,\"durationS\":%lu}}",
           NODE_ID, FW_VERSION, upS(), unixNow(), detect::eventName(e.type), e.dP, e.dN, e.cosDelta,
           e.startedAt, e.durationS);
  enqueue(buf);
  Serial.println(buf);
}

// ---------------------------------------------------------------- lighting (wing)
void controlLights() {
  unsigned long now = millis();

  int raw = analogRead(PIN_LDR);
  int bright = LDR_DARK_IS_HIGH ? 4095 - raw : raw;
  brightAvg = (brightAvg < 0) ? bright : brightAvg + 0.01f * (bright - brightAvg);  // ~20 s smoothing at 200 ms

  // Corridor: daylight cut-off with hysteresis and confirmation delays, never at night.
  if (isNight()) {
    corridorOn = true;
    brightSince = darkSince = 0;
  } else if (brightAvg > LDR_BRIGHT_OFF) {
    darkSince = 0;
    if (!brightSince) brightSince = now;
    if (now - brightSince >= BRIGHT_CONFIRM_MS) corridorOn = false;
  } else if (brightAvg < LDR_DARK_ON) {
    brightSince = 0;
    if (!darkSince) darkSince = now;
    if (now - darkSince >= DARK_CONFIRM_MS) corridorOn = true;
  } else {
    brightSince = darkSince = 0;  // in the band: keep current state
  }
  applyLight(PIN_RELAY1, corridorOn);

  // Washroom: on while there is motion, held for 15 minutes.
  if (digitalRead(PIN_PIR) == HIGH) {
    lastMotionMs = now;
    pirFault = false;
  }
  int h = localHour();
  bool busyHours = h >= 6 && h < 23;
  if (busyHours && now - lastMotionMs > PIR_SILENT_FAULT_MS) pirFault = true;
  washroomOn = pirFault || (now - lastMotionMs < PIR_HOLD_MS);
  applyLight(PIN_RELAY2, washroomOn);
}

// ---------------------------------------------------------------- pump (common)
int readSonarCm() {
  int v[5], n = 0;
  for (int k = 0; k < 5; k++) {
    digitalWrite(PIN_TRIG, LOW);
    delayMicroseconds(4);
    digitalWrite(PIN_TRIG, HIGH);
    delayMicroseconds(20);
    digitalWrite(PIN_TRIG, LOW);
    unsigned long us = pulseIn(PIN_ECHO, HIGH, 30000);
    if (us > 0) v[n++] = (int)(us * 0.0343f / 2);
    delay(60);  // let echoes die out
  }
  if (n < 3) return -1;
  for (int a = 1; a < n; a++) { int x = v[a], b = a - 1; while (b >= 0 && v[b] > x) { v[b + 1] = v[b]; b--; } v[b + 1] = x; }
  int cm = v[n / 2];
  if (cm < 20 || cm > TANK_EMPTY_CM + 15) return -1;
  return cm;
}

void stopPump(PumpState next, const char* reason) {
  setRelay(PIN_RELAY1, false);
  pumpState = next;
  pumpReason = reason;
  pumpStoppedMs = millis();
  char buf[200];
  snprintf(buf, sizeof buf,
           "{\"nodeId\":\"%s\",\"fw\":\"%s\",\"kind\":\"event\",\"up\":%lu,\"ts\":%lld,\"event\":{\"type\":\"pump_stop\",\"reason\":\"%s\",\"tankPct\":%d}}",
           NODE_ID, FW_VERSION, upS(), unixNow(), reason, tankPct);
  enqueue(buf);
  Serial.println(buf);
}

void controlPump() {
  unsigned long now = millis();
  static unsigned long lastSonar = 0;
  if (now - lastSonar < 2000) return;
  lastSonar = now;

  int cm = readSonarCm();
  if (cm < 0) {
    if (++sonarBad >= SONAR_MAX_BAD) {
      tankPct = -1;
      if (pumpState == PUMP_RUNNING) stopPump(PUMP_IDLE, "sensor_fault");
      return;  // no level, no automatic start
    }
    return;
  }
  sonarBad = 0;
  long pct = (long)(TANK_EMPTY_CM - cm) * 100 / (TANK_EMPTY_CM - TANK_FULL_CM);
  tankPct = constrain(pct, 0, 100);

  switch (pumpState) {
    case PUMP_IDLE:
      if (tankPct <= PUMP_START_PCT && (pumpStoppedMs == 0 || now - pumpStoppedMs >= PUMP_MIN_OFF_MS)) {
        setRelay(PIN_RELAY1, true);
        pumpState = PUMP_RUNNING;
        pumpStartedMs = now;
        pumpStartPct = tankPct;
        pumpReason = "";
      }
      break;
    case PUMP_RUNNING:
      if (tankPct >= PUMP_STOP_PCT) stopPump(PUMP_IDLE, "tank_full");
      else if (now - pumpStartedMs >= PUMP_MAX_RUN_MS) stopPump(PUMP_LOCKOUT, "max_runtime");
      else if (now - pumpStartedMs >= PUMP_RISE_CHECK_MS && tankPct - pumpStartPct < PUMP_MIN_RISE_PCT)
        stopPump(PUMP_LOCKOUT, "no_rise");  // dry well, closed valve or sensor problem
      break;
    case PUMP_LOCKOUT:
      setRelay(PIN_RELAY1, false);  // stays off until someone checks and presses reset
      break;
  }
}

void checkResetButton() {
  if (digitalRead(PIN_RESET) == LOW) {
    if (!resetPressedMs) resetPressedMs = millis();
    if (millis() - resetPressedMs > 3000 && pumpState == PUMP_LOCKOUT) {
      pumpState = PUMP_IDLE;
      pumpReason = "manual_reset";
      Serial.println("Pump lockout cleared");
    }
  } else {
    resetPressedMs = 0;
  }
}

// ---------------------------------------------------------------- summary
void sendSummary() {
  char meter[200];
  if (agg.n > 0) {
    snprintf(meter, sizeof meter, "{\"v\":%.1f,\"p\":%.0f,\"n\":%.0f,\"pMax\":%.0f,\"pf\":%.2f,\"hz\":%.1f,\"kwh\":%.3f}",
             agg.vSum / agg.n, agg.pSum / agg.n, agg.nSum / agg.n, agg.pMax, lastPf, lastHz, lastKwh);
  } else {
    strcpy(meter, "null");
  }

  char role[220];
#if NODE_ROLE == ROLE_WING
  snprintf(role, sizeof role, "\"relays\":{\"corridor\":%s,\"washroom\":%s},\"light\":{\"bright\":%d,\"night\":%s}",
           corridorOn ? "true" : "false", washroomOn ? "true" : "false", (int)brightAvg, isNight() ? "true" : "false");
#else
  snprintf(role, sizeof role, "\"relays\":{\"pump\":%s},\"tank\":{\"pct\":%d,\"state\":\"%s\",\"reason\":\"%s\"}",
           pumpState == PUMP_RUNNING ? "true" : "false", tankPct,
           pumpState == PUMP_RUNNING ? "running" : pumpState == PUMP_LOCKOUT ? "lockout" : "idle", pumpReason);
#endif

  char faults[120] = "";
  if (meterFault) strcat(faults, "\"meter\",");
  if (pirFault) strcat(faults, "\"pir\",");
  if (NODE_ROLE == ROLE_COMMON && tankPct < 0) strcat(faults, "\"level_sensor\",");
  size_t fl = strlen(faults);
  if (fl) faults[fl - 1] = 0;

  char buf[640];
  snprintf(buf, sizeof buf,
           "{\"nodeId\":\"%s\",\"fw\":\"%s\",\"kind\":\"summary\",\"up\":%lu,\"ts\":%lld,\"samples\":%d,\"meter\":%s,%s,\"faults\":[%s]}",
           NODE_ID, FW_VERSION, upS(), unixNow(), agg.n, meter, role, faults);
  enqueue(buf);
  Serial.println(buf);
  agg.clear();
}

// ---------------------------------------------------------------- network task (core 0)
void networkTask(void*) {
  WiFiClientSecure tls;
#ifdef ROOT_CA_PEM
  tls.setCACert(ROOT_CA_PEM);
#else
  tls.setInsecure();
#endif
  unsigned long backoff = 5000;
  bool ntpStarted = false;
  Msg m;

  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASS);
      for (int k = 0; k < 40 && WiFi.status() != WL_CONNECTED; k++) vTaskDelay(pdMS_TO_TICKS(250));
      if (WiFi.status() != WL_CONNECTED) {
        vTaskDelay(pdMS_TO_TICKS(backoff));
        backoff = min(backoff * 2, 120000UL);
        continue;
      }
      backoff = 5000;
      if (!ntpStarted) {
        configTime(6 * 3600, 0, "pool.ntp.org", "time.google.com");  // Bangladesh, UTC+6
        ntpStarted = true;
      }
    }

    if (xQueuePeek(outbox, &m, pdMS_TO_TICKS(1000)) != pdTRUE) continue;

    HTTPClient http;
    http.setTimeout(8000);
    int code = -1;
    if (http.begin(tls, API_URL)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-Node-Key", NODE_KEY);
      code = http.POST((uint8_t*)m.body, strlen(m.body));
      http.end();
    }

    if (code >= 200 && code < 300) {
      xQueueReceive(outbox, &m, 0);
      digitalWrite(PIN_LED, !digitalRead(PIN_LED));
    } else if (code >= 400 && code < 500 && code != 429) {
      Serial.printf("Server rejected message (%d), dropping it\n", code);
      xQueueReceive(outbox, &m, 0);
    } else {
      Serial.printf("Send failed (%d), will retry\n", code);
      vTaskDelay(pdMS_TO_TICKS(10000));
    }
  }
}

// ---------------------------------------------------------------- setup / loop
void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_RELAY1, OUTPUT);
  pinMode(PIN_RELAY2, OUTPUT);
  pinMode(PIN_RESET, INPUT_PULLUP);

#if NODE_ROLE == ROLE_WING
  applyLight(PIN_RELAY1, true);
  applyLight(PIN_RELAY2, true);
  pinMode(PIN_PIR, INPUT);
  analogSetPinAttenuation(PIN_LDR, ADC_11db);
  lastMotionMs = millis();
#else
  setRelay(PIN_RELAY1, false);  // pump off at boot
  setRelay(PIN_RELAY2, false);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
#endif

  outbox = xQueueCreate(24, sizeof(Msg));
  WiFi.mode(WIFI_STA);
  xTaskCreatePinnedToCore(networkTask, "net", 8192, nullptr, 1, nullptr, 0);

  Serial.printf("HallGrid node %s, role %d, fw %s\n", NODE_ID, NODE_ROLE, FW_VERSION);
}

void loop() {
  static unsigned long lastMeter = 0, lastSummary = 0, lastControl = 0;
  unsigned long now = millis();

  if (now - lastControl >= CONTROL_MS) {
    lastControl = now;
#if NODE_ROLE == ROLE_WING
    controlLights();
#else
    controlPump();
    checkResetButton();
#endif
  }
  if (now - lastMeter >= METER_MS) {
    lastMeter = now;
    readMeter();
  }
  if (now - lastSummary >= SUMMARY_MS) {
    lastSummary = now;
    sendSummary();
  }
  delay(5);
}
