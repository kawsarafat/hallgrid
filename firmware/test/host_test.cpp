// Host-side check that detector.h gives the same result as src/lib/detect.ts.
// Build: g++ -std=c++11 -O2 -o host_test firmware/test/host_test.cpp
// Input on stdin: lines "scenario,t,v,p,n" produced by scripts/export-traces.ts
#include <stdio.h>
#include <string.h>
#include "../hallgrid_node/detector.h"

int main() {
  char line[256], current[64] = "";
  detect::StepDetector* d = nullptr;
  bool alerted = false;
  auto finish = [&]() {
    if (current[0]) printf("%s,%s\n", current, alerted ? "alert" : "no alert");
  };
  while (fgets(line, sizeof line, stdin)) {
    char name[64];
    unsigned long t;
    float v, p, n;
    if (sscanf(line, "%63[^,],%lu,%f,%f,%f", name, &t, &v, &p, &n) != 5) continue;
    if (strcmp(name, current) != 0) {
      finish();
      delete d;
      d = new detect::StepDetector();
      strcpy(current, name);
      alerted = false;
    }
    detect::Event ev[4];
    int k = d->update(t, v, p, n, ev, 4);
    for (int i = 0; i < k; i++) if (ev[i].type == detect::EV_RESISTIVE_ALERT) alerted = true;
  }
  finish();
  delete d;
  return 0;
}
