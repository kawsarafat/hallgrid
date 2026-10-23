'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, Zap } from 'lucide-react';
import { ISSUES, SPOTS } from '@/lib/report';

export default function ReportPage() {
  const [zone, setZone] = useState('');
  const [spot, setSpot] = useState('');
  const [issue, setIssue] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'done' | 'error'; text?: string }>({ kind: 'idle' });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setZone(q.get('zone') ?? '');
    setSpot(q.get('spot') ?? '');
  }, []);

  const spotName = SPOTS.find((s) => s.id === spot)?.name;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ kind: 'sending' });
    try {
      const r = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone, spot, issue, note }),
      });
      const j = (await r.json()) as { ok: boolean; id?: number; forwarded?: boolean; error?: string };
      if (j.ok) {
        setState({
          kind: 'done',
          text: j.forwarded ? `Report #${j.id} has been sent to the hall electrician.` : `Report #${j.id} is saved. (Alerts are not connected on this demo server.)`,
        });
      } else {
        setState({ kind: 'error', text: j.error ?? `Something went wrong (HTTP ${r.status}).` });
      }
    } catch {
      setState({ kind: 'error', text: 'No connection. Please try again.' });
    }
  };

  if (!zone || !spotName) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-ink">Report a problem</h1>
        <p className="mt-2 text-sm text-ink-2">This page opens from a QR sticker in the hall. The link you used does not include a location.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-lg font-semibold text-ink">Report a problem</h1>
      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-2">
        <MapPin size={14} aria-hidden />
        {zone}, {spotName}
      </p>

      {state.kind === 'done' ? (
        <div className="mt-6 flex gap-3 rounded-xl bg-good-bg p-4 text-sm text-good-ink ring-1 ring-inset ring-good-line">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Thank you.</p>
            <p className="mt-1">{state.text}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-ink">What is wrong?</legend>
            {ISSUES.map((i) => (
              <label
                key={i.id}
                className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm ring-1 ring-inset transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${issue === i.id ? 'bg-brand-50 font-medium text-brand-800 ring-brand-500' : 'bg-surface text-ink ring-line-strong hover:bg-sunken'}`}
              >
                <input type="radio" name="issue" className="h-4 w-4 accent-brand-500" value={i.id} checked={issue === i.id} onChange={() => setIssue(i.id)} />
                {i.name}
              </label>
            ))}
          </fieldset>
          <label className="block text-sm font-medium text-ink">
            Anything else? (optional)
            <textarea className="mt-1.5 block w-full rounded-lg p-2.5 text-sm font-normal ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand-500" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {state.kind === 'error' && <p role="alert" className="rounded-lg bg-crit-bg px-3 py-2 text-sm text-crit-ink ring-1 ring-inset ring-crit-line">{state.text}</p>}
          <button type="submit" disabled={!issue || state.kind === 'sending'} className="h-11 w-full rounded-lg bg-brand-600 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            {state.kind === 'sending' ? 'Sending...' : 'Send report'}
          </button>
          <p className="text-center text-xs text-ink-3">No name or phone number is collected.</p>
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <header className="bg-side px-5 py-3.5">
        <div className="mx-auto flex max-w-md items-center gap-2 text-sm font-semibold text-white">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-500">
            <Zap size={13} strokeWidth={2.5} aria-hidden />
          </span>
          HallGrid
        </div>
      </header>
      <main className="mx-auto max-w-md p-5">
        <div className="rounded-xl bg-surface p-5 shadow-card">{children}</div>
      </main>
    </div>
  );
}
