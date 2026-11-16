import type { SampleInfo } from '../api/client'
import type { TabId } from '../state/store'

const stages: { id: TabId; label: string }[] = [
  { id: 'epochs', label: 'Epochs & time-frequency' },
  { id: 'spectra', label: 'Spectra & spatial' },
  { id: 'features', label: 'Features' },
]

export function TopBar({ tab, setTab, samples, dataset, datasetName, busy, error, warnings, canExport, onSample, onUpload, onExport }: {
  tab: TabId; setTab: (tab: TabId) => void; samples: SampleInfo[]; dataset: string; datasetName: string
  busy: boolean; error: string; warnings: string[]; canExport: boolean
  onSample: (id: string) => void; onUpload: (file: File) => void; onExport: () => void
}) {
  const isSample = samples.some(sample => sample.id === dataset)
  return <header className="topbar">
    <div className="brand"><strong>Separability Lab</strong><span>EEG feature extraction</span></div>
    <nav className="stage-nav" aria-label="Analysis stages">
      {stages.map((stage, index) => <button key={stage.id} aria-current={tab === stage.id ? 'page' : undefined} onClick={() => setTab(stage.id)}>
        <span className="step">{index + 1}</span>{stage.label}
      </button>)}
    </nav>
    <div className="top-actions">
      <label className="sr-only" htmlFor="dataset-select">Dataset</label>
      <select id="dataset-select" value={isSample ? dataset : 'uploaded'} disabled={busy}
        onChange={event => { if (event.target.value !== 'uploaded') onSample(event.target.value) }}>
        {samples.map(sample => <option key={sample.id} value={sample.id}>{sample.title}</option>)}
        {!isSample && dataset && <option value="uploaded">Uploaded: {datasetName}</option>}
      </select>
      <label className="upload-button" aria-disabled={busy} title="Load an epoched FIF file">
        {busy ? 'Loading…' : 'Upload .fif'}
        <input type="file" accept=".fif" disabled={busy} onChange={event => {
          const file = event.currentTarget.files?.[0]
          if (file) onUpload(file)
          event.currentTarget.value = ''
        }} />
      </label>
      <button className="btn btn-primary" disabled={!canExport || busy} onClick={onExport}
        title={canExport ? 'Download a Python script that reproduces the scatter plot' : 'Open Features and choose two axes first'}>Export .py</button>
      {busy && <span className="busy-dot" role="status" aria-label="Loading dataset" />}
    </div>
    {warnings.length > 0 && <details className="notice-toggle">
      <summary>ⓘ {warnings.length} notice{warnings.length === 1 ? '' : 's'}</summary>
      <div className="notice-panel">
        <strong>About this file</strong>
        <ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
      </div>
    </details>}
    {error && <div className="top-error" role="alert">{error}</div>}
  </header>
}
