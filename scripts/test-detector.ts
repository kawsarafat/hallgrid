// Runs the step detector on the synthetic scenarios and exits non-zero on a mismatch.
// Usage: npm run test:detector
import { SCENARIOS, runScenario } from '../src/lib/detect.ts';

let failed = 0;
for (const sc of SCENARIOS) {
  const r = runScenario(sc);
  const steps = r.events.filter((e) => e.type === 'step').map((e) => e.type === 'step' ? `${e.dP}W cos=${e.cosDelta}` : '');
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${sc.title.padEnd(48)} expected ${sc.expect.padEnd(8)} got ${r.alerted ? 'alert' : 'no alert'}`);
  if (process.argv.includes('-v')) console.log('      ', r.events.map((e) => e.type).join(', '), '|', steps.join('; '));
  if (!r.pass) failed++;
}
console.log(failed ? `\n${failed} scenario(s) failed` : '\nAll scenarios passed (synthetic data only)');
process.exit(failed ? 1 : 0);
