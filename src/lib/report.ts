// Places where QR stickers go, and the problems a student can report.

export const SPOTS = [
  { id: 'washroom', name: 'Washroom' },
  { id: 'corridor', name: 'Corridor switchboard' },
  { id: 'stairs', name: 'Staircase' },
  { id: 'tap', name: 'Water tap / cooler' },
] as const;

export const ISSUES = [
  { id: 'lights-day', name: 'Lights on in daylight' },
  { id: 'switch', name: 'Broken switch or fan regulator' },
  { id: 'sensor', name: 'Sensor light not working' },
  { id: 'leak', name: 'Water leak or tap left open' },
  { id: 'overflow', name: 'Roof tank overflowing' },
  { id: 'other', name: 'Other' },
] as const;
