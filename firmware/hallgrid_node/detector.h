// Step-change detector for one wing feeder, fed once per second.
// C++ port of src/lib/detect.ts. Keep the constants and rules identical.

#pragma once
#include <math.h>
#include <stdint.h>
#include <string.h>

namespace detect {

const float MIN_STEP_W = 800.0f;
const float MIN_COS_DELTA = 0.98f;
const int CONFIRM_S = 5;
const unsigned long MIN_ON_S = 120;  // 2 min: counted violation + alert
const float OUTAGE_V = 150.0f;
const unsigned long OUTAGE_HOLDOFF_S = 120;
const float STABLE_BAND_W = 150.0f;
const float BASELINE_ALPHA = 0.05f;

enum EventType : uint8_t {
  EV_NONE = 0,
  EV_STEP,
  EV_RESISTIVE_ALERT,
  EV_RESISTIVE_SHORT,
  EV_RESISTIVE_END,
  EV_OUTAGE,
  EV_RESTORE,
};

struct Event {
  EventType type;
  unsigned long t;          // seconds since boot
  unsigned long startedAt;  // for resistive events
  float dP;
  float dN;
  float cosDelta;
  bool resistive;
  unsigned long durationS;
};

inline const char* eventName(EventType t) {
  switch (t) {
    case EV_STEP: return "step";
    case EV_RESISTIVE_ALERT: return "resistive_alert";
    case EV_RESISTIVE_SHORT: return "resistive_short";
    case EV_RESISTIVE_END: return "resistive_end";
    case EV_OUTAGE: return "outage";
    case EV_RESTORE: return "restore";
    default: return "none";
  }
}

class StepDetector {
 public:
  // Writes up to maxOut events into out[] and returns how many were written.
  int update(unsigned long t, float v, float p, float n, Event* out, int maxOut) {
    int k = 0;
    auto push = [&](const Event& e) { if (k < maxOut) out[k++] = e; };

    if (v < OUTAGE_V) {
      if (!inOutage) push(make(EV_OUTAGE, t));
      inOutage = true;
      pendingCount = 0;
      open = false;
      return k;
    }
    if (inOutage) {
      inOutage = false;
      holdoffUntil = t + OUTAGE_HOLDOFF_S;
      hasBase = false;
      push(make(EV_RESTORE, t));
    }
    if (!hasBase || t < holdoffUntil) {
      pBase = p;
      nBase = n;
      hasBase = true;
      return k;
    }

    if (open) {
      if (p < openLevel - openDP / 2) {
        if (belowSince == 0) belowSince = t;
        if (t - belowSince >= (unsigned long)CONFIRM_S) {
          Event e = make(openAlerted ? EV_RESISTIVE_END : EV_RESISTIVE_SHORT, t);
          e.startedAt = openStart;
          e.dP = openDP;
          e.durationS = belowSince - openStart;
          push(e);
          open = false;
          belowSince = 0;
          pBase = p;
          nBase = n;
          pendingCount = 0;
          return k;
        }
      } else {
        belowSince = 0;
      }
      if (!openAlerted && t - openStart >= MIN_ON_S) {
        openAlerted = true;
        Event e = make(EV_RESISTIVE_ALERT, t);
        e.startedAt = openStart;
        e.dP = openDP;
        e.cosDelta = openCos;
        push(e);
      }
    }

    float dev = p - pBase;
    if (fabsf(dev) < STABLE_BAND_W) {
      pendingCount = 0;
      pBase += BASELINE_ALPHA * (p - pBase);
      nBase += BASELINE_ALPHA * (n - nBase);
      return k;
    }

    pendP[pendingCount] = p;
    pendN[pendingCount] = n;
    if (pendingCount == 0) pendStart = t;
    pendingCount++;
    if (pendingCount < CONFIRM_S) return k;

    float pm = median(pendP, pendingCount);
    float nm = median(pendN, pendingCount);
    pendingCount = 0;

    if (fabsf(dev) < MIN_STEP_W) {
      // Medium change (a few fans, a PC): accept as the new level.
      pBase = pm;
      nBase = nm;
      return k;
    }

    float dP = pm - pBase;
    float dN = nm - nBase;
    float cosDelta = fabsf(dP) / sqrtf(dP * dP + dN * dN);
    bool resistive = dP > 0 && cosDelta >= MIN_COS_DELTA;

    Event e = make(EV_STEP, t);
    e.dP = dP;
    e.dN = dN;
    e.cosDelta = cosDelta;
    e.resistive = resistive;
    push(e);

    if (resistive && !open) {
      open = true;
      openAlerted = false;
      openStart = pendStart;
      openDP = dP;
      openCos = cosDelta;
      openLevel = pm;
    }
    pBase = pm;
    nBase = nm;
    return k;
  }

 private:
  bool hasBase = false;
  float pBase = 0, nBase = 0;
  float pendP[CONFIRM_S], pendN[CONFIRM_S];
  int pendingCount = 0;
  unsigned long pendStart = 0;

  bool open = false, openAlerted = false;
  unsigned long openStart = 0;
  float openDP = 0, openCos = 0, openLevel = 0;
  unsigned long belowSince = 0;

  bool inOutage = false;
  unsigned long holdoffUntil = 0;

  static Event make(EventType type, unsigned long t) {
    Event e;
    memset(&e, 0, sizeof(e));
    e.type = type;
    e.t = t;
    return e;
  }

  static float median(const float* a, int n) {
    float b[CONFIRM_S];
    for (int i = 0; i < n; i++) b[i] = a[i];
    for (int i = 1; i < n; i++) {
      float x = b[i];
      int j = i - 1;
      while (j >= 0 && b[j] > x) { b[j + 1] = b[j]; j--; }
      b[j + 1] = x;
    }
    return (n % 2) ? b[n / 2] : 0.5f * (b[n / 2 - 1] + b[n / 2]);
  }
};

}  // namespace detect
