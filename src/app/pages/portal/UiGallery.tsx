import { useState } from 'react';
import { Droplets, Landmark } from 'lucide-react';
import { useLang } from '@/i18n';
import { Badge, Button, Card, EmptyState, Input, Select, Skeleton, Stat } from '@/components/ui/core';
import { VerdictBadge, FindingCard, Timeline } from '@/components/ui/verdict';
import { Dialog, Sheet, useToast } from '@/components/ui/overlay';
import { Combobox, DataTable } from '@/components/ui/data';
import { Stepper, Tabs } from '@/components/ui/nav';

const rows = [
  { id: 1, plot: 'SCN-01', verdict: 'Clear', area: 12.5 }, { id: 2, plot: 'SCN-02', verdict: 'Stop', area: 8 },
  { id: 3, plot: 'SCN-08', verdict: 'Caution', area: 30 }, { id: 4, plot: 'SCN-09', verdict: 'Stop', area: 22.4 },
];

/** Dev-only gallery of every component (route /portal/_ui, not registered in production builds). */
export default function UiGallery() {
  const { t } = useLang(); const toast = useToast();
  const [dlg, setDlg] = useState(false); const [sheet, setSheet] = useState(false); const [tab, setTab] = useState<'a' | 'b'>('a'); const [cb, setCb] = useState<string | null>(null);
  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">{t('ui.title')}</h1>
      <section className="space-y-3"><h2 className="font-semibold">{t('ui.buttons')}</h2>
        <div className="flex flex-wrap gap-2"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button><Button loading>Loading</Button><Button disabled>Disabled</Button>
          <Button variant="secondary" onClick={() => setDlg(true)}>Dialog</Button><Button variant="secondary" onClick={() => setSheet(true)}>Sheet</Button><Button variant="secondary" onClick={() => toast('Saved', 'ok')}>Toast</Button></div>
        <div className="flex flex-wrap gap-2"><Badge>Neutral</Badge><Badge tone="brand">Brand</Badge><Badge tone="clear">Clear</Badge><Badge tone="caution">Caution</Badge><Badge tone="stop">Stop</Badge></div>
      </section>
      <section className="space-y-3"><h2 className="font-semibold">{t('ui.verdicts')}</h2>
        <div className="flex flex-wrap gap-3"><VerdictBadge verdict="clear" /><VerdictBadge verdict="caution" /><VerdictBadge verdict="stop" /></div><VerdictBadge verdict="stop" size="xl" /></section>
      <section className="space-y-3"><h2 className="font-semibold">{t('ui.findings')}</h2>
        <FindingCard severity="blocker" code="R07" title={t('ui.sampleFinding')} detail={t('ui.sampleDetail')} advice={t('ui.sampleAdvice')} evidence={['ownerships #1042', 'persons #77']} />
        <FindingCard severity="medium" code="R10" title="Mutation pending" /><FindingCard severity="info" code="R18" title="Agricultural land" /></section>
      <section className="grid gap-4 sm:grid-cols-2"><Stat label="Checks today" value="128" hint="+12%" icon={<Droplets className="h-5 w-5" />} /><Stat label="Open signals" value="7" icon={<Landmark className="h-5 w-5" />} /></section>
      <section className="space-y-3"><h2 className="font-semibold">{t('ui.timeline')}</h2>
        <Timeline items={[{ id: '1', date: '1962 · CS', title: 'CS khatian 112', tone: 'neutral' }, { id: '2', date: '1990 · gap', title: 'No record', gap: true }, { id: '3', date: '2019 · Deed 4412', title: 'Sale deed registered', tone: 'clear' }]} /></section>
      <section className="space-y-3"><h2 className="font-semibold">{t('ui.forms')}</h2>
        <Card className="grid gap-4 sm:grid-cols-2"><Input label="Khatian" hint="Printed on your porcha" /><Input label="Dag" error="Required" /><Select label="Survey"><option>CS</option><option>SA</option><option>RS</option><option>BS</option></Select>
          <Combobox label={t('ui.sampleCombo')} value={cb} onChange={setCb} options={[{ value: 'u', label: 'Uttara' }, { value: 'g', label: 'Gazipur Sadar' }, { value: 's', label: 'Sylhet Sadar' }]} /></Card>
        <Stepper steps={['Where', 'Who', 'Result']} current={1} /><Tabs<'a' | 'b'> label="demo" value={tab} onChange={setTab} tabs={[{ id: 'a', label: 'Overview' }, { id: 'b', label: 'Owners' }]} />
        <div className="space-y-2"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-20" /></div><EmptyState title={t('common.empty')} />
      </section>
      <section className="space-y-3"><h2 className="font-semibold">{t('ui.table')}</h2>
        <DataTable rows={rows} pageSize={3} columns={[{ key: 'plot', header: 'Plot', sortable: true }, { key: 'verdict', header: 'Verdict', sortable: true }, { key: 'area', header: 'Area', sortable: true }]} /></section>
      <Dialog open={dlg} onClose={() => setDlg(false)} title="Dialog">Body</Dialog><Sheet open={sheet} onClose={() => setSheet(false)} title="Sheet">Body</Sheet>
    </div>
  );
}
