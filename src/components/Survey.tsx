import { Building2, CalendarDays, MessageSquareText } from 'lucide-react';
import { SURVEY, SURVEY_INSTITUTIONS, SURVEY_LIMITS, SURVEY_N, SURVEY_WINDOW } from '@/lib/survey';
import { BarList, Kpi, Note, PageHeader, Panel } from './ui';

export function Survey() {
  return (
    <div className="space-y-6">
      <PageHeader title="Survey" description="What students in residential halls told us. Counts are shown exactly as they came in, without weighting." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon={MessageSquareText} tone="brand" label="Responses" value={SURVEY_N} sub="Google Forms, convenience sample" />
        <Kpi icon={Building2} label="Institutions" value={SURVEY_INSTITUTIONS.length} sub={SURVEY_INSTITUTIONS.slice(0, 6).join(', ') + ', …'} />
        <Kpi icon={CalendarDays} label="Collected" value={SURVEY_WINDOW} sub="October 2026" />
      </div>

      <Note title="Read with care">
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {SURVEY_LIMITS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Note>

      <div className="grid gap-4 lg:grid-cols-2">
        {SURVEY.map((q) => (
          <Panel
            key={q.id}
            title={q.en}
            description={
              <span lang="bn" className="text-ink-3">
                {q.bn}
              </span>
            }
          >
            <BarList items={q.options.map((o) => ({ label: o.en, value: o.count }))} max={SURVEY_N} format={(n) => `${n} of ${SURVEY_N}`} />
            {q.multi && <p className="mt-3 text-xs text-ink-3">More than one answer allowed, so counts add up to more than {SURVEY_N}.</p>}
          </Panel>
        ))}
      </div>

      <p className="text-xs text-ink-3">Institutions: {SURVEY_INSTITUTIONS.join(', ')}.</p>
    </div>
  );
}
