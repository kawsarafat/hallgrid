'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  ClipboardList,
  Cpu,
  ExternalLink,
  Gauge,
  Menu,
  ScanSearch,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Alerts, type Status } from '@/components/Alerts';
import { Detector } from '@/components/Detector';
import { Hardware } from '@/components/Hardware';
import { Overview, type LiveEvent, type LiveNode, type Violation } from '@/components/Overview';
import { Savings } from '@/components/Savings';
import { Students } from '@/components/Students';
import { Survey } from '@/components/Survey';
import { counts, DEFAULT_ASSUMPTIONS, DEFAULT_COSTS, REFERENCE_HALL, toMap, type Assumption, type CostOptions, type Hall } from '@/lib/model';

type Tab = 'overview' | 'detection' | 'alerts' | 'savings' | 'hardware' | 'survey' | 'students';

const NAV: { group: string; items: { id: Tab; label: string; icon: LucideIcon }[] }[] = [
  {
    group: 'Monitor',
    items: [
      { id: 'overview', label: 'Overview', icon: Gauge },
      { id: 'detection', label: 'Heater detection', icon: ScanSearch },
      { id: 'alerts', label: 'Alerts and QR', icon: Bell },
    ],
  },
  {
    group: 'Plan',
    items: [
      { id: 'savings', label: 'Savings model', icon: BarChart3 },
      { id: 'hardware', label: 'Hardware', icon: Cpu },
    ],
  },
  {
    group: 'People',
    items: [
      { id: 'students', label: 'Student view', icon: Users },
      { id: 'survey', label: 'Survey', icon: ClipboardList },
    ],
  },
];
const ALL = NAV.flatMap((g) => g.items);

export default function Page() {
  const [tab, setTab] = useState<Tab>('overview');
  const [menu, setMenu] = useState(false);
  const [hall, setHall] = useState<Hall>(REFERENCE_HALL);
  const [assumptions, setAssumptions] = useState<Assumption[]>(DEFAULT_ASSUMPTIONS);
  const [costs, setCosts] = useState<CostOptions>(DEFAULT_COSTS);
  const [status, setStatus] = useState<Status>(null);
  const [live, setLive] = useState<LiveNode[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [updated, setUpdated] = useState<Date | null>(null);
  const a = useMemo(() => toMap(assumptions), [assumptions]);
  const c = counts(hall);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (ALL.some((x) => x.id === h)) setTab(h);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ telemetry: false, nodes: [], telegram: false, admin: false }));
  }, []);

  useEffect(() => {
    if (!status?.telemetry) return;
    const load = () =>
      fetch('/api/telemetry')
        .then((r) => r.json())
        .then((j: { nodes: LiveNode[]; events: LiveEvent[]; violations: Violation[] }) => {
          setLive(j.nodes ?? []);
          setEvents(j.events ?? []);
          setViolations(j.violations ?? []);
          setUpdated(new Date());
        })
        .catch(() => undefined);
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [status?.telemetry]);

  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : '';
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const go = (t: Tab) => {
    setTab(t);
    setMenu(false);
    history.replaceState(null, '', `#${t}`);
    window.scrollTo({ top: 0 });
  };

  const reset = () => {
    setHall(REFERENCE_HALL);
    setAssumptions(DEFAULT_ASSUMPTIONS);
    setCosts(DEFAULT_COSTS);
  };

  const reporting = live.filter((n) => n.ageS < 180).length;
  const current = ALL.find((x) => x.id === tab)!;

  const nav = (
    <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-side-muted">{g.group}</div>
          <ul className="space-y-0.5">
            {g.items.map(({ id, label, icon: Icon }) => {
              const on = tab === id;
              return (
                <li key={id}>
                  <button
                    onClick={() => go(id)}
                    aria-current={on ? 'page' : undefined}
                    className={`relative flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                      on ? 'bg-white/10 text-white' : 'text-side-muted hover:bg-white/5 hover:text-side-ink'
                    }`}
                  >
                    {on && <span className="absolute left-0 top-2 h-5 w-0.5 rounded-r bg-brand-400" />}
                    <Icon size={16} aria-hidden />
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-6 py-5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
        <Zap size={16} strokeWidth={2.5} aria-hidden />
      </span>
      <div>
        <div className="text-[15px] font-semibold leading-tight text-white">HallGrid</div>
        <div className="text-[11px] text-side-muted">Hall energy management</div>
      </div>
    </div>
  );

  const hallCard = (
    <div className="mx-3 mb-4 rounded-lg bg-side-2 px-3 py-3 text-xs">
      <div className="font-medium text-side-ink">Reference hall</div>
      <div className="mt-0.5 text-side-muted">
        {c.floors} floors · {c.wings} wings · {c.students} students
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-60">
      {/* Sidebar, desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-side lg:flex">
        {brand}
        {nav}
        {hallCard}
      </aside>

      {/* Drawer, mobile */}
      {menu && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenu(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-side">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button onClick={() => setMenu(false)} aria-label="Close menu" className="rounded-lg p-2 text-side-muted hover:bg-white/10">
                <X size={18} />
              </button>
            </div>
            {nav}
            {hallCard}
          </aside>
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setMenu(true)} aria-label="Open menu" className="-ml-1 rounded-lg p-2 text-ink-2 hover:bg-sunken lg:hidden">
            <Menu size={18} />
          </button>
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            <span className="hidden text-ink-3 sm:inline">HallGrid</span>
            <span className="hidden text-line-strong sm:inline">/</span>
            <span className="truncate font-medium text-ink">{current.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {reporting > 0 ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-good-bg px-3 py-1 text-xs font-medium text-good-ink ring-1 ring-inset ring-good-line">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-good" />
                </span>
                {reporting} node{reporting > 1 ? 's' : ''} live
                {updated && <span className="hidden font-normal text-good-ink/80 sm:inline">· {updated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-warn-bg px-3 py-1 text-xs font-medium text-warn-ink ring-1 ring-inset ring-warn-line">
                <Activity size={13} aria-hidden />
                <span className="hidden sm:inline">Demo mode: no hardware, simulated readings</span>
                <span className="sm:hidden">Demo mode</span>
              </span>
            )}
            <a
              href="https://github.com/kawsarafat/hallgrid-bd"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-ink-2 hover:bg-sunken hover:text-ink md:inline-flex"
            >
              Source <ExternalLink size={13} aria-hidden />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {tab === 'overview' && <Overview hall={hall} a={a} live={live} events={events} violations={violations} onNavigate={go} />}
        {tab === 'savings' && (
          <Savings hall={hall} setHall={setHall} assumptions={assumptions} setAssumptions={setAssumptions} a={a} costs={costs} setCosts={setCosts} onReset={reset} />
        )}
        {tab === 'detection' && <Detector />}
        {tab === 'hardware' && <Hardware hall={hall} costs={costs} />}
        {tab === 'survey' && <Survey />}
        {tab === 'students' && <Students hall={hall} a={a} violations={violations} />}
        {tab === 'alerts' && <Alerts hall={hall} status={status} />}

        <footer className="mt-12 border-t border-line pt-5 text-xs text-ink-3">
          Team SustainSSTU, Sunamganj Science and Technology University · Sustainable Energy Idea Contest 2026, Category 2 · Savings figures are estimates
          until measured in a pilot.
        </footer>
      </main>
    </div>
  );
}
