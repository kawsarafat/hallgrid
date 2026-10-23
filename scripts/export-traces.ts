// Prints the synthetic scenario traces as CSV so the C++ detector can be checked
// against the TypeScript one. See firmware/test/host_test.cpp.
import { SCENARIOS, synthTrace } from '../src/lib/detect.ts';

for (const sc of SCENARIOS) for (const s of synthTrace(sc)) console.log(`${sc.id},${s.t},${s.v.toFixed(1)},${s.p},${s.n}`);
