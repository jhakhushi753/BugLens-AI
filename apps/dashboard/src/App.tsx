import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowLeft, ArrowUpRight, Bug, Check, ChevronDown,
  CircleHelp, Clock3, ExternalLink, FileCode2, FlaskConical, LayoutDashboard, ListChecks, Network, Plus,
  Search, Settings, ShieldCheck, Sparkles, Trash2, Upload, X,
} from 'lucide-react'
import { emptyFailure } from './investigator'
import type { FailureInput, InvestigationReport } from './types'

type Page = 'Overview' | 'Investigations' | 'Test runs' | 'Settings'
const storageKey = 'buglens-investigations-v1'
const legacyDemoReportIds = new Set([
  'BL-RUN-2841-TC-104',
  'BL-RUN-2838-TC-208',
  'BL-RUN-2834-TC-311',
])
const shopsphereApi = (import.meta as ImportMeta & { env: { VITE_SHOPSPHERE_API?: string } }).env.VITE_SHOPSPHERE_API || 'http://localhost:8000'
const analysisApi = (import.meta as ImportMeta & { env: { VITE_ANALYSIS_API?: string } }).env.VITE_ANALYSIS_API || 'http://localhost:8002'
const navItems: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Investigations', icon: ListChecks },
  { label: 'Test runs', icon: FlaskConical },
]

function readReports(): InvestigationReport[] {
  try {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return []
    const reports = JSON.parse(saved) as InvestigationReport[]
    return Array.isArray(reports) ? reports.filter((report) => !legacyDemoReportIds.has(report.bug_id)) : []
  } catch {
    localStorage.removeItem(storageKey)
  }
  return []
}

function timeAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function exportReport(report: InvestigationReport) {
  const file = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = `${report.bug_id.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function requestInvestigation(input: FailureInput): Promise<InvestigationReport> {
  const response = await fetch(`${analysisApi}/api/analyze-failure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const result = await response.json().catch(() => ({})) as InvestigationReport & { detail?: string }
  if (!response.ok) throw new Error(result.detail || `Investigator returned ${response.status}`)
  return result
}

function App() {
  const [reports, setReports] = useState<InvestigationReport[]>(readReports)
  const [page, setPage] = useState<Page>('Overview')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All failures')
  const [showNew, setShowNew] = useState(false)
  const [activeReport, setActiveReport] = useState<InvestigationReport | null>(null)
  const [integrationMessage, setIntegrationMessage] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [agentMode, setAgentMode] = useState<'checking' | 'claude' | 'rules-demo' | 'offline'>('checking')

  useEffect(() => localStorage.setItem(storageKey, JSON.stringify(reports)), [reports])
  useEffect(() => {
    fetch(`${analysisApi}/api/health`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Investigator unavailable')
        const health = await response.json() as { mode: 'claude' | 'rules-demo' }
        setAgentMode(health.mode)
      })
      .catch(() => setAgentMode('offline'))
  }, [])

  const filteredReports = useMemo(() => reports.filter((report) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [report.test_name, report.bug_title, report.bug_id, report.root_cause.affected_component, report.classification]
      .some((value) => value.toLowerCase().includes(query))
    const matchesFilter = filter === 'All failures' || (filter === 'Needs review'
      ? report.metadata.requires_human_review
      : report.classification === filter.toUpperCase().replaceAll(' ', '_'))
    return matchesSearch && matchesFilter
  }), [reports, search, filter])

  const needsReview = reports.filter((report) => report.metadata.requires_human_review).length
  const applicationBugs = reports.filter((report) => report.classification === 'APPLICATION_BUG').length
  const flaky = reports.filter((report) => report.flakiness_analysis.is_flaky).length

  async function addReport(input: FailureInput) {
    const report = await requestInvestigation(input)
    setReports((current) => [report, ...current])
    setShowNew(false)
    setPage('Investigations')
    setActiveReport(report)
  }

  async function importShopSphereFailures() {
    setIsImporting(true)
    setIntegrationMessage('')
    try {
      const response = await fetch(`${shopsphereApi}/api/buglens/failures`)
      if (!response.ok) throw new Error(`ShopSphere returned ${response.status}`)
      const failures = await response.json() as FailureInput[]
      const imported = await Promise.all(failures.map((failure) => requestInvestigation({ ...emptyFailure, ...failure })))
      const known = new Set(reports.map((report) => report.bug_id))
      const newReports = imported.filter((report) => !known.has(report.bug_id))
      if (newReports.length) setReports((current) => [...newReports.filter((report) => !current.some((saved) => saved.bug_id === report.bug_id)), ...current])
      setIntegrationMessage(newReports.length ? `Imported ${newReports.length} ShopSphere failure${newReports.length === 1 ? '' : 's'}.` : 'ShopSphere failures are already up to date.')
    } catch (error) {
      setIntegrationMessage(error instanceof Error ? `Could not import and analyze ShopSphere failures: ${error.message}` : 'Could not import and analyze ShopSphere failures.')
    } finally {
      setIsImporting(false)
    }
  }

  async function exportShopSphere() {
    setIsExporting(true)
    setIntegrationMessage('')
    try {
      const response = await fetch(`${shopsphereApi}/api/export`)
      if (!response.ok) throw new Error(`ShopSphere returned ${response.status}`)
      const file = new Blob([await response.blob()], { type: 'application/zip' })
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = 'ShopSphere-source.zip'
      link.click()
      URL.revokeObjectURL(url)
      setIntegrationMessage('ShopSphere source ZIP downloaded.')
    } catch (error) {
      setIntegrationMessage(error instanceof Error ? `Could not export ShopSphere: ${error.message}` : 'Could not export ShopSphere.')
    } finally {
      setIsExporting(false)
    }
  }

  const pageTitle = page === 'Overview' ? 'Failure intelligence' : page
  const pageDescription = page === 'Overview'
    ? 'A clear read on what broke, where, and what needs a closer look.'
    : page === 'Investigations'
      ? 'Every failure, evidence bundle, and root-cause report in one place.'
      : page === 'Test runs'
        ? 'Failure records grouped by their originating test run.'
        : 'Manage your local workspace and investigation data.'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setPage('Overview') }}>
          <span className="brand-mark"><Bug size={19} strokeWidth={2.3} /></span>
          <span className="brand-name">buglens<span>.</span></span>
          <span className="brand-edition">AI</span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">S</span>
          <span className="workspace-copy"><strong>ShopSphere</strong><small>Workspace</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => { setPage(label); setFilter('All failures') }}>
              <Icon size={17} strokeWidth={1.9} /><span>{label}</span>
              {label === 'Investigations' && <span className="nav-count">{reports.length}</span>}
            </button>
          ))}
        </nav>
        <div className="nav-label recent-label">RECENT INVESTIGATIONS</div>
        <div className="recent-nav">
          {reports.slice(0, 3).map((report) => (
            <button key={report.bug_id} className="recent-item" onClick={() => setActiveReport(report)}>
              <span className={`recent-dot ${report.severity.toLowerCase()}`} />
              <span>{report.test_name}</span>
            </button>
          ))}
          {!reports.length && <span className="empty-recent">No reports yet</span>}
        </div>
        <div className="sidebar-bottom">
          <button className={`nav-item ${page === 'Settings' ? 'active' : ''}`} onClick={() => setPage('Settings')}><Settings size={17} /><span>Settings</span></button>
          <div className="analyst-card">
            <div className="analyst-avatar">BL</div>
            <span className="analyst-copy"><strong>AI Investigator</strong><small>{agentMode === 'claude' ? 'Claude agent' : agentMode === 'rules-demo' ? 'Rules demo · no key' : agentMode === 'offline' ? 'Service offline' : 'Connecting...'}</small></span>
            <span className={`online-dot ${agentMode === 'offline' ? 'offline' : ''}`} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>ShopSphere</span><span className="crumb-slash">/</span><strong>{page}</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search failures" aria-label="Search failures" /><kbd>/</kbd></label>
            <button className="icon-button help-button" title="Help"><CircleHelp size={17} /></button>
            <span className="top-avatar">JD</span>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> TEST FAILURE OPERATIONS</div>
              <h1>{pageTitle}</h1>
              <p>{pageDescription}</p>
            </div>
            <div className="page-actions">
              <a className="secondary-button" href="http://localhost:3000" target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open ShopSphere</a>
              <button className="secondary-button" onClick={() => void importShopSphereFailures()} disabled={isImporting}><Upload size={15} /> {isImporting ? 'Importing...' : 'Import ShopSphere'}</button>
              <button className="secondary-button" onClick={() => void exportShopSphere()} disabled={isExporting}><ArrowDownToLine size={15} /> {isExporting ? 'Preparing...' : 'Export application'}</button>
              <button className="primary-button" onClick={() => setShowNew(true)}><Plus size={17} /> New investigation</button>
            </div>
          </div>
          {integrationMessage && <div className={`integration-status ${integrationMessage.startsWith('Could not') ? 'error' : 'success'}`} role="status">{integrationMessage}<button onClick={() => setIntegrationMessage('')} aria-label="Dismiss message"><X size={13} /></button></div>}

          {page === 'Settings' ? (
            <section className="settings-content">
              <div className="settings-section">
                <div className="section-heading"><div><h2>Workspace</h2><p>Current project and local data preferences.</p></div></div>
                <div className="setting-row"><div><strong>Active application</strong><span>ShopSphere</span></div><span className="setting-value">Local workspace</span></div>
                <div className="setting-row"><div><strong>Report storage</strong><span>Saved in this browser using local storage.</span></div><span className="setting-value status-local"><span className="online-dot" /> On this device</span></div>
                <div className="setting-row"><div><strong>Analysis engine</strong><span>{agentMode === 'claude' ? 'Claude analyzes evidence using a structured report schema.' : agentMode === 'rules-demo' ? 'Evidence-based rules are active. Set ANTHROPIC_API_KEY to enable Claude.' : agentMode === 'offline' ? 'The investigator API is unavailable on port 8002.' : 'Checking investigator service...'}</span></div><span className="setting-value">{agentMode === 'claude' ? 'Claude' : agentMode === 'rules-demo' ? 'Rules demo' : agentMode === 'offline' ? 'Offline' : 'Checking'}</span></div>
              </div>
              <div className="settings-section danger-section">
                <div className="section-heading"><div><h2>Investigation data</h2><p>Clear reports saved in this browser.</p></div></div>
                <div className="setting-row"><div><strong>Clear all reports</strong><span>This only affects data stored in this browser.</span></div><button className="danger-button" onClick={() => { if (window.confirm('Delete all investigations saved in this browser?')) setReports([]) }}><Trash2 size={15} /> Clear records</button></div>
              </div>
            </section>
          ) : (
            <>
              {(page === 'Overview' || page === 'Test runs') && (
                <section className="metrics-grid" aria-label="Investigation summary">
                  <Metric icon={Activity} label="Investigations" value={String(reports.length).padStart(2, '0')} note="Reports in this workspace" color="green" />
                  <Metric icon={Bug} label="Application bugs" value={String(applicationBugs).padStart(2, '0')} note="Classified from evidence" color="coral" />
                  <Metric icon={ShieldCheck} label="Needs review" value={String(needsReview).padStart(2, '0')} note="Confidence below 70%" color="yellow" />
                  <Metric icon={Clock3} label="Flaky patterns" value={String(flaky).padStart(2, '0')} note="Intermittence in failure history" color="blue" />
                </section>
              )}

              {page === 'Overview' && (
                <section className="overview-strip">
                  <div className="overview-intro"><span className="strip-icon"><Sparkles size={17} /></span><div><strong>Evidence first. Conclusions second.</strong><span>Reports with incomplete evidence are sent to human review.</span></div></div>
                  <div className="classification-strip">
                    {(['APPLICATION_BUG', 'TEST_BUG', 'FLAKY', 'EXTERNAL_SERVICE'] as const).map((kind) => {
                      const count = reports.filter((report) => report.classification === kind).length
                      return <button key={kind} className="class-count" onClick={() => { setPage('Investigations'); setFilter(kind.replaceAll('_', ' ')) }}><span className={`mini-dot ${kind.toLowerCase()}`} /><span>{kind.replaceAll('_', ' ')}</span><strong>{count}</strong></button>
                    })}
                  </div>
                </section>
              )}

              <section className="reports-section">
                <div className="reports-heading">
                  <div><h2>{page === 'Test runs' ? 'Recent test run failures' : page === 'Overview' ? 'Latest investigations' : 'All investigations'} <span className="heading-count">{filteredReports.length}</span></h2><p>Failure reports, prioritized by recency</p></div>
                  <div className="table-controls">
                    <label className="filter-control"><span>Show</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All failures</option><option>Needs review</option><option>APPLICATION BUG</option><option>TEST BUG</option><option>FLAKY</option><option>EXTERNAL SERVICE</option></select><ChevronDown size={14} /></label>
                    {page === 'Overview' && <button className="text-button" onClick={() => setPage('Investigations')}>View all <ArrowUpRight size={14} /></button>}
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>TEST / FAILURE</th><th>CLASSIFICATION</th><th>SEVERITY</th><th>CONFIDENCE</th><th>DETECTED</th><th aria-label="Open report" /></tr></thead>
                    <tbody>
                      {filteredReports.slice(0, page === 'Overview' ? 5 : undefined).map((report) => <ReportRow key={report.bug_id} report={report} onClick={() => setActiveReport(report)} />)}
                    </tbody>
                  </table>
                  {!filteredReports.length && <div className="empty-state"><span className="empty-icon"><Search size={19} /></span><strong>No matching investigations</strong><span>Try a different search or start a new investigation.</span><button className="text-button" onClick={() => { setSearch(''); setFilter('All failures') }}>Clear filters</button></div>}
                </div>
                <div className="table-foot"><span>Showing {Math.min(filteredReports.length, page === 'Overview' ? 5 : filteredReports.length)} of {filteredReports.length} reports</span><span className="freshness"><span className="online-dot" /> Updated just now</span></div>
              </section>
              <footer className="page-footer"><span>BUGLENS <span className="footer-dot">/</span> FAILURE INTELLIGENCE</span><span>Evidence-led investigation workspace</span></footer>
            </>
          )}
        </div>
      </main>

      {showNew && <NewInvestigation onClose={() => setShowNew(false)} onSubmit={addReport} agentMode={agentMode} />}
      {activeReport && <ReportDetail report={activeReport} onClose={() => setActiveReport(null)} onExport={() => exportReport(activeReport)} />}
    </div>
  )
}

function Metric({ icon: Icon, label, value, note, color }: { icon: typeof Activity; label: string; value: string; note: string; color: string }) {
  return <div className="metric"><div className="metric-top"><span className={`metric-icon ${color}`}><Icon size={17} /></span><span className="metric-label">{label}</span><ArrowUpRight className="metric-arrow" size={15} /></div><div className="metric-number">{value}</div><div className="metric-note">{note}</div></div>
}

function ReportRow({ report, onClick }: { report: InvestigationReport; onClick: () => void }) {
  return <tr onClick={onClick} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onClick() }}>
    <td><div className="test-cell"><span className={`severity-marker ${report.severity.toLowerCase()}`} /><span className="test-details"><strong>{report.test_name || 'Unidentified test'}</strong><small>{report.root_cause.affected_component} <span>/</span> {report.bug_id}</small></span></div></td>
    <td><span className={`classification-badge ${report.classification.toLowerCase()}`}>{report.classification.replaceAll('_', ' ')}</span></td>
    <td><span className={`severity-text ${report.severity.toLowerCase()}`}>{report.severity}</span><span className="priority-label">{report.priority}</span></td>
    <td><div className="confidence-cell"><span className="confidence-track"><span style={{ width: `${Math.round(report.confidence_score * 100)}%` }} /></span><span>{Math.round(report.confidence_score * 100)}%</span></div></td>
    <td><span className="time-text">{timeAgo(report.executed_at)}</span></td>
    <td><button className="row-open" title="Open investigation" onClick={(event) => { event.stopPropagation(); onClick() }}><ArrowUpRight size={15} /></button></td>
  </tr>
}

function NewInvestigation({ onClose, onSubmit, agentMode }: { onClose: () => void; onSubmit: (input: FailureInput) => Promise<void>; agentMode: 'checking' | 'claude' | 'rules-demo' | 'offline' }) {
  const [form, setForm] = useState<FailureInput>({ ...emptyFailure, run_id: `RUN-${Math.floor(2900 + Math.random() * 99)}`, test_id: `TC-${Math.floor(100 + Math.random() * 899)}` })
  const [showMore, setShowMore] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const set = (key: keyof FailureInput, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const requiredMissing = !form.test_name.trim() || !form.failure_message.trim()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (requiredMissing) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await onSubmit(form)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'The investigator could not analyze this failure.')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="form-modal" role="dialog" aria-modal="true" aria-labelledby="new-investigation-title">
      <header className="modal-header"><div><span className="modal-kicker"><span className="eyebrow-line" /> FAILURE INTAKE</span><h2 id="new-investigation-title">New AI investigation</h2><p>{agentMode === 'claude' ? 'Claude will analyze the evidence and return a structured report.' : agentMode === 'rules-demo' ? 'The agent is in rules-demo mode until an Anthropic key is configured.' : 'Submit failure evidence to the investigator service.'}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
      <form onSubmit={submit}>
        <div className="form-scroll">
          <div className="form-section-label">TEST CONTEXT</div>
          <div className="form-grid">
            <FormField label="Test name *" value={form.test_name} onChange={(value) => set('test_name', value)} placeholder="test_checkout_total" />
            <FormField label="Test suite" value={form.test_suite} onChange={(value) => set('test_suite', value)} placeholder="checkout-regression" />
            <FormField label="Test ID" value={form.test_id} onChange={(value) => set('test_id', value)} placeholder="TC-104" />
            <FormField label="Test run ID" value={form.run_id} onChange={(value) => set('run_id', value)} placeholder="RUN-2901" />
            <FormField label="Application" value={form.app_name} onChange={(value) => set('app_name', value)} placeholder="ShopSphere" />
            <FormField label="Environment" value={form.environment} onChange={(value) => set('environment', value)} placeholder="Staging" />
            <FormField label="Browser" value={form.browser} onChange={(value) => set('browser', value)} placeholder="Chromium" />
            <FormField label="Affected module" value={form.module} onChange={(value) => set('module', value)} placeholder="Checkout" />
          </div>
          <label className="form-field full-field"><span>Failure message *</span><textarea required rows={3} value={form.failure_message} onChange={(event) => set('failure_message', event.target.value)} placeholder="Paste the assertion or error message" /></label>
          <div className="form-section-label evidence-label">EVIDENCE <span>More evidence means a more useful report</span></div>
          <label className="form-field full-field"><span><FileCode2 size={13} /> Stack trace</span><textarea rows={4} value={form.stack_trace} onChange={(event) => set('stack_trace', event.target.value)} placeholder="Paste the relevant stack trace" /></label>
          <label className="form-field full-field"><span><Activity size={13} /> Application &amp; test logs</span><textarea rows={3} value={form.logs} onChange={(event) => set('logs', event.target.value)} placeholder="Relevant log lines" /></label>
          <button type="button" className="expand-form" onClick={() => setShowMore((value) => !value)}>{showMore ? '- Hide additional context' : '+ Add network, screenshot & history evidence'}</button>
          {showMore && <div className="additional-evidence">
            <label className="form-field full-field"><span><Network size={13} /> Network requests &amp; responses</span><textarea rows={2} value={form.network_logs} onChange={(event) => set('network_logs', event.target.value)} placeholder="Method, endpoint, status, response excerpt" /></label>
            <label className="form-field full-field"><span>Screenshot summary</span><textarea rows={2} value={form.screenshot_summary} onChange={(event) => set('screenshot_summary', event.target.value)} placeholder="Describe what the screenshot shows" /></label>
            <div className="form-grid">
              <FormField label="Previous failures" value={form.failure_count} onChange={(value) => set('failure_count', value)} placeholder="0" />
              <FormField label="Failure pattern" value={form.failure_pattern} onChange={(value) => set('failure_pattern', value)} placeholder="Consistent / intermittent" />
              <FormField label="Last successful run" value={form.last_success} onChange={(value) => set('last_success', value)} placeholder="Date or run ID" />
              <FormField label="Recent code changes" value={form.recent_commits} onChange={(value) => set('recent_commits', value)} placeholder="Commit or change summary" />
            </div>
            <FormField label="Artifact paths" value={form.artifact_paths} onChange={(value) => set('artifact_paths', value)} placeholder="Screenshot, video, trace paths" />
          </div>}
        </div>
        <footer className="form-footer"><span><ShieldCheck size={14} /> Incomplete evidence will be flagged for review.</span><div>{submitError && <span className="form-error" role="alert">{submitError}</span>}<button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={requiredMissing || submitting}><Sparkles size={15} /> {submitting ? 'Analyzing...' : 'Analyze failure'}</button></div></footer>
      </form>
    </section>
  </div>
}

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="form-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

function ReportDetail({ report, onClose, onExport }: { report: InvestigationReport; onClose: () => void; onExport: () => void }) {
  return <div className="modal-backdrop detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <article className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <header className="detail-topbar"><button className="back-button" onClick={onClose}><ArrowLeft size={16} /> All investigations</button><div className="detail-actions"><button className="secondary-button" onClick={onExport}><ArrowDownToLine size={15} /> Export JSON</button><button className="icon-button" onClick={onClose} aria-label="Close report"><X size={19} /></button></div></header>
      <div className="detail-scroll">
        <div className="detail-eyebrow">{report.bug_id}<span className="detail-separator">/</span>{report.test_suite || 'UNASSIGNED SUITE'}<span className="detail-separator">/</span>{report.environment}</div>
        <div className="detail-title-row"><div><h2 id="report-title">{report.bug_title}</h2><p>{report.test_name} <span>|</span> {report.app_name} <span>|</span> {new Date(report.executed_at).toLocaleString()}</p></div><span className={`classification-badge large ${report.classification.toLowerCase()}`}>{report.classification.replaceAll('_', ' ')}</span></div>
        {report.metadata.requires_human_review && <div className="review-banner"><AlertTriangle size={16} /><span><strong>Human review recommended</strong> Evidence confidence is {Math.round(report.confidence_score * 100)}%. {report.metadata.missing_evidence.length > 0 && `Missing: ${report.metadata.missing_evidence.join(', ')}.`}</span></div>}
        <section className="detail-stats"><div><span>SEVERITY</span><strong className={`severity-text ${report.severity.toLowerCase()}`}>{report.severity} <small>{report.priority}</small></strong></div><div><span>CONFIDENCE</span><strong>{Math.round(report.confidence_score * 100)}%</strong></div><div><span>ERROR TYPE</span><strong>{report.root_cause.error_type}</strong></div><div><span>AFFECTED COMPONENT</span><strong>{report.root_cause.affected_component}</strong></div></section>
        <section className="detail-section"><SectionTitle icon={Bug} title="Root cause" /><p className="root-summary">{report.root_cause.summary}</p><p className="detail-body">{report.root_cause.technical_details}</p><div className="failure-point"><span>FAILURE POINT</span><code>{report.root_cause.failure_point}</code></div></section>
        <section className="detail-section"><SectionTitle icon={Search} title="How it was found" /><p className="detail-body">{report.how_was_it_found}</p><div className="evidence-chips">{[['Stack trace', report.evidence_used.used_stack_trace], ['Logs', report.evidence_used.used_logs], ['Screenshot', report.evidence_used.used_screenshot], ['Network', report.evidence_used.used_network_logs], ['History', report.evidence_used.used_failure_history]].map(([label, present]) => <span key={String(label)} className={present ? 'evidence-present' : 'evidence-missing'}>{present ? <Check size={12} /> : <X size={12} />}{String(label)}</span>)}</div>{report.evidence_used.key_evidence.length > 0 && <pre className="evidence-code">{report.evidence_used.key_evidence.join('\n')}</pre>}</section>
        <section className="detail-section"><SectionTitle icon={ArrowUpRight} title="Recommended fix" /><p className="root-summary">{report.remediation.fix_summary}</p><ul className="recommendations">{report.remediation.recommended_fix_steps.map((step) => <li key={step}>{step}</li>)}</ul><div className="code-suggestion"><span>CODE SUGGESTION</span><code>{report.remediation.code_suggestion}</code></div></section>
        <section className="detail-section lower-detail"><div><SectionTitle icon={FlaskConical} title="Reproduction" /><ol className="recommendations ordered">{report.steps_to_reproduce.map((step) => <li key={step}>{step}</li>)}</ol></div><div><SectionTitle icon={ShieldCheck} title="Impact" /><p className="detail-body">{report.impact_analysis.business_impact}</p><span className={`scope-label ${report.impact_analysis.affected_scope.toLowerCase()}`}>AFFECTED SCOPE / {report.impact_analysis.affected_scope}</span></div></section>
        <section className="detail-section ml-section"><SectionTitle icon={Sparkles} title="ML-ready signals" /><div className="ml-keywords">{report.ml_ready_data.error_keywords.length ? report.ml_ready_data.error_keywords.map((word) => <span key={word}>{word}</span>) : <span>No error keywords extracted</span>}</div><p className="detail-body">{report.ml_ready_data.feature_vector_reason}</p><div className="embedding-text">{report.ml_ready_data.failure_text_for_embedding}</div></section>
      </div>
    </article>
  </div>
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Bug; title: string }) {
  return <div className="detail-section-title"><span><Icon size={15} /></span><h3>{title}</h3></div>
}

export default App