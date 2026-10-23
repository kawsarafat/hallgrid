// Shared building blocks. Every page uses these so spacing, type sizes and
// colours stay the same everywhere.
//
// Colour roles (see tailwind.config.ts):
//   ink / ink-2 / ink-3   text: primary, secondary, muted
//   brand                 interactive elements and chart series 1
//   good / warn / crit    status only, always with an icon and a label
//   series-1 / series-2   chart series, in this fixed order

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleDot, Info, XCircle, type LucideIcon } from 'lucide-react';

export const fmt = (n: number, d = 0) =>
  Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
export const bdt = (n: number) => `৳${fmt(n)}`;
export const pct = (n: number, d = 1) => `${fmt(n, d)}%`;

// ---------------------------------------------------------------- layout

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-surface shadow-card ${className}`}>{children}</div>;
}

// Card with a titled header. Use for every content block so headers line up.
export function Panel({
  title,
  description,
  actions,
  children,
  flush,
  className = '',
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </Card>
  );
}

// Kept for pages that group several panels under one heading.
export function Section({ title, note, children, right }: { title: string; note?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {note && <p className="mt-0.5 max-w-3xl text-[13px] text-ink-2">{note}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- figures

export function Kpi({
  label,
  value,
  unit,
  sub,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: 'neutral' | 'brand' | 'good';
}) {
  const iconTone = tone === 'brand' ? 'bg-brand-50 text-brand-600' : tone === 'good' ? 'bg-good-bg text-good-ink' : 'bg-sunken text-ink-2';
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        {Icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconTone}`}>
            <Icon size={16} strokeWidth={2} aria-hidden />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[28px] font-semibold leading-none tracking-tight text-ink">{value}</span>
        {unit && <span className="text-sm font-medium text-ink-2">{unit}</span>}
      </div>
      {sub && <div className="mt-2 text-xs leading-relaxed text-ink-3">{sub}</div>}
    </Card>
  );
}

// Old name, same look.
export const Stat = ({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) => <Kpi label={label} value={value} sub={sub} />;

// Horizontal bars with the value printed beside each bar, so nothing depends on colour.
export function BarList({ items, unit = '', max, format = (n: number) => fmt(n) }: { items: { label: string; value: number; note?: string }[]; unit?: string; max?: number; format?: (n: number) => string }) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{it.label}</span>
            <span className="shrink-0 tabular-nums text-ink-2">
              {format(it.value)}
              {unit && <span className="text-ink-3"> {unit}</span>}
              {it.note && <span className="ml-2 text-ink-3">{it.note}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-sunken">
            <div className="h-2 rounded-full bg-series-1" style={{ width: `${Math.max(0, Math.min(100, (it.value / top) * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- status

type Tone = 'neutral' | 'brand' | 'good' | 'warn' | 'crit';
const TONE: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-2 ring-line',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  good: 'bg-good-bg text-good-ink ring-good-line',
  warn: 'bg-warn-bg text-warn-ink ring-warn-line',
  crit: 'bg-crit-bg text-crit-ink ring-crit-line',
};
const TONE_ICON: Record<Tone, LucideIcon | null> = { neutral: null, brand: null, good: CheckCircle2, warn: AlertTriangle, crit: XCircle };

export function Badge({ tone = 'neutral', children, icon }: { tone?: Tone | 'sim' | 'live' | 'bad'; children: ReactNode; icon?: LucideIcon | null }) {
  const t: Tone = tone === 'sim' ? 'warn' : tone === 'live' ? 'good' : tone === 'bad' ? 'crit' : tone;
  const Icon = icon === undefined ? TONE_ICON[t] : icon;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[t]}`}>
      {Icon && <Icon size={12} strokeWidth={2.25} aria-hidden />}
      {children}
    </span>
  );
}

// Shows whether a number was measured or simulated. Used on every reading.
export function DataSource({ measured }: { measured: boolean }) {
  return measured ? (
    <Badge tone="good" icon={CircleDot}>
      Measured
    </Badge>
  ) : (
    <Badge tone="warn" icon={null}>
      Simulated
    </Badge>
  );
}

export function Note({ children, tone = 'sim', title }: { children: ReactNode; tone?: 'sim' | 'info'; title?: string }) {
  const warn = tone === 'sim';
  const Icon = warn ? AlertTriangle : Info;
  return (
    <div className={`flex gap-3 rounded-xl px-4 py-3 text-[13px] leading-relaxed ring-1 ring-inset ${warn ? 'bg-warn-bg text-warn-ink ring-warn-line' : 'bg-brand-50 text-brand-800 ring-brand-100'}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div>
        {title && <div className="font-semibold">{title}</div>}
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tables

export function Table({ head, rows, className = '', align }: { head: ReactNode[]; rows: ReactNode[][]; className?: string; align?: ('l' | 'r')[] }) {
  const right = (j: number) => (align ? align[j] === 'r' : j > 0);
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line bg-sunken text-left">
            {head.map((h, i) => (
              <th key={i} scope="col" className={`whitespace-nowrap px-5 py-2.5 text-xs font-medium text-ink-2 ${right(i) ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line-soft last:border-0 hover:bg-sunken/60">
              {r.map((c, j) => (
                <td key={j} className={`px-5 py-3 align-top ${right(j) ? 'text-right tabular-nums' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- controls

export function Button({
  children,
  onClick,
  primary,
  disabled,
  type = 'button',
  icon: Icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  icon?: LucideIcon;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        primary ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-surface text-ink shadow-card hover:bg-sunken'
      }`}
    >
      {Icon && <Icon size={15} aria-hidden />}
      {children}
    </button>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-sunken p-0.5 ring-1 ring-inset ring-line">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors ${value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-brand-500' : 'bg-line-strong'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
      {label}
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  suffix,
  width = 'w-28',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  width?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-2">{label}</span>
      <span className={`flex items-center rounded-lg bg-surface ring-1 ring-inset ring-line-strong focus-within:ring-2 focus-within:ring-brand-500 ${width}`}>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (e.target.value !== '' && Number.isFinite(v) && v >= min && (max === undefined || v <= max)) onChange(v);
          }}
          className="h-9 w-full min-w-0 rounded-lg bg-transparent px-2.5 text-right text-sm text-ink outline-none"
        />
        {suffix && <span className="pr-2.5 text-xs text-ink-3">{suffix}</span>}
      </span>
    </label>
  );
}

export function InlineNumber({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <input
      type="number"
      step="0.01"
      min={0}
      aria-label={label}
      value={value}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(v) && v >= 0) onChange(v);
      }}
      className="h-8 w-20 rounded-md bg-surface px-2 text-right text-[13px] tabular-nums ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand-500"
    />
  );
}

// ---------------------------------------------------------------- charts

// Tooltip: value first and strong, series name second, keyed with a short line.
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormat,
  unit,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; stroke?: string }[];
  label?: string | number;
  labelFormat?: (l: string | number) => string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-xs shadow-pop">
      <div className="mb-1 text-ink-3">{labelFormat && label !== undefined ? labelFormat(label) : label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="h-0.5 w-3 rounded" style={{ background: p.stroke ?? p.color }} />
          <span className="font-semibold tabular-nums text-ink">
            {typeof p.value === 'number' ? fmt(p.value, Math.abs(p.value) < 10 ? 2 : 0) : p.value}
            {unit ? ` ${unit}` : ''}
          </span>
          <span className="text-ink-2">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

export function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span className="h-0.5 w-4 rounded" style={{ background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : color }} />
      {label}
    </span>
  );
}

export const CHART = {
  grid: '#ecebe6',
  axis: '#c3c2b7',
  tick: { fontSize: 11, fill: '#77756f' },
  s1: '#2a78d6',
  s2: '#eb6834',
  crit: '#d03b3b',
};
