'use client';

import { useMemo } from 'react';
import { BellRing, Gift, Lock, QrCode, Trophy } from 'lucide-react';
import type { AssumptionMap, Hall } from '@/lib/model';
import type { Violation } from './Overview';
import { simulateHall, wingIds } from '@/lib/sim';
import { Badge, Note, PageHeader, Panel, Table, fmt } from './ui';

export function Students({ hall, a, violations }: { hall: Hall; a: AssumptionMap; violations: Violation[] }) {
  const vById = new Map(violations.map((v) => [v.nodeId, v.count]));
  const ranking = useMemo(() => {
    const ids = wingIds(hall);
    const kwh = new Map(ids.map((w) => [w.id, 0]));
    for (let h = 0; h < 24; h++) {
      for (const w of simulateHall(hall, a, h, { daylightControl: true }).wings) kwh.set(w.id, (kwh.get(w.id) ?? 0) + w.reading.p / 1000);
    }
    const perWing = hall.roomsPerWing * hall.studentsPerRoom;
    return ids.map((w) => ({ ...w, perStudent: (kwh.get(w.id) ?? 0) / perWing })).sort((x, y) => x.perStudent - y.perStudent);
  }, [hall, a]);
  const best = ranking[0]?.perStudent ?? 0;
  const winner = ranking.find((w) => !(vById.get(w.id) ?? 0))?.id;

  const cards = [
    {
      icon: BellRing,
      title: 'Class-time reminder',
      text: "A short message in the hall's Telegram channel 10 minutes before the first class: if you are the last one out, switch off the fan and lights. Students can leave the channel any time.",
    },
    {
      icon: Gift,
      title: 'Monthly reward (proposal)',
      text: 'The wing with the lowest use per student gets a share of the saving as dining coupons. Needs written approval from the provost and treasury first. A wing with any violation that month (an unauthorised appliance on for more than 2 minutes) is not eligible.',
    },
    {
      icon: Lock,
      title: 'Privacy',
      text: 'Students only see wing totals. No room or person is metered, and nothing inside rooms is switched.',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Student view" description="What residents see: their wing's standing, a reminder, and a way to report faults." />

      <Note title="Simulated ranking">In a pilot the ranking comes from the wing meters, averaged over the month.</Note>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Wing ranking" description="kWh per student per day, lowest first" flush>
          <Table
            align={['l', 'l', 'r', 'r', 'r']}
            head={['Rank', 'Wing', 'kWh / student / day', 'vs. best', 'Violations']}
            rows={ranking.map((w, i) => [
              <span key="r" className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${w.id === winner ? 'bg-good-bg text-good-ink' : 'bg-sunken text-ink-2'}`}>
                {i + 1}
              </span>,
              <span key="w" className="flex items-center gap-2 font-medium text-ink">
                {w.label}
                {w.id === winner && (
                  <Badge tone="good" icon={Trophy}>
                    Reward winner
                  </Badge>
                )}
              </span>,
              fmt(w.perStudent, 2),
              <span key="d" className="text-ink-2">
                {i === 0 ? '–' : `+${fmt(((w.perStudent - best) / best) * 100, 0)}%`}
              </span>,
              (vById.get(w.id) ?? 0) > 0 ? (
                <Badge key="v" tone="crit">
                  {vById.get(w.id)} · not eligible
                </Badge>
              ) : (
                <span key="v" className="text-ink-3">0</span>
              ),
            ])}
          />
        </Panel>

        <Panel title="Report a problem" description="QR stickers in washrooms and corridors open a short form that goes to the hall electrician.">
          <div className="flex items-center gap-3 rounded-lg bg-sunken p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-ink-2 shadow-card">
              <QrCode size={20} aria-hidden />
            </span>
            <div className="text-[13px]">
              <div className="font-medium text-ink">Try the form</div>
              <a className="text-brand-600 hover:text-brand-700" href="/report?zone=Floor%202%20north&spot=washroom">
                Sample sticker: Floor 2 north, washroom
              </a>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-3">No name or phone number is collected.</p>
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ icon: Icon, title, text }) => (
          <Panel
            key={title}
            title={
              <span className="flex items-center gap-2">
                <Icon size={16} className="text-brand-600" aria-hidden />
                {title}
              </span>
            }
          >
            <p className="text-[13px] leading-relaxed text-ink-2">{text}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
