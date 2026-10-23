// Text of every message the system sends. Used by the API routes and shown on
// the dashboard, so what people read on the page is what Telegram delivers.

export const heaterAlert = (where: string, dP: number, countThisMonth?: number) =>
  `${where}: an unauthorised ${(dP / 1000).toFixed(1)} kW resistive appliance (heater, cooker, kettle or immersion rod) has been on for more than 2 minutes. ` +
  `Recorded as a violation for this wing${countThisMonth ? ` (${countThisMonth} this month)` : ''}. Please check the room circuits at the wing distribution board.`;

export const pumpLockAlert = (reason: 'max_runtime' | 'no_rise') =>
  `Pump stopped and locked: it ${reason === 'max_runtime' ? 'ran for 90 minutes without filling the tank' : 'ran 20 minutes but the tank level did not rise'}. ` +
  'Check the well, valve and level sensor, then hold the reset button for 3 seconds.';

export const pumpSensorAlert = () => 'Pump stopped: the roof-tank level sensor is not giving readings. Automatic filling is paused.';

export const reportAlert = (id: number, issue: string, place: string, note: string) =>
  `Report #${id}: ${issue}\nPlace: ${place}${note ? `\nNote: ${note}` : ''}`;

export const classReminder = () => 'Classes start in 10 minutes. If you are the last one out, please switch off the fan and lights.';
