import { useCallback, useEffect, useState } from 'react'
import { api, type ExportConfig, type SampleInfo, type SessionMetadata } from './api/client'
import { challengesBySample } from './challenges/data'
import { ChallengeStrip } from './components/ChallengeStrip'
import { ChannelMontage } from './components/ChannelMontage'
import { ClassToggles } from './components/ClassToggles'
import { FileInfo } from './components/FileInfo'
import { FormulaDrawer, formulaKeysForTab } from './components/FormulaDrawer'
import { PairSelector } from './components/PairSelector'
import { TopBar } from './components/TopBar'
import { CSPTopomaps } from './views/CSPTopomaps'
import { EpochWaveform } from './views/EpochWaveform'
import { FeaturesView } from './views/FeaturesView'
import { PSDView } from './views/PSDView'
import { TFMap } from './views/TFMap'
import { stateForSession, type AppState, type TabId } from './state/store'

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [samples, setSamples] = useState<SampleInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [highlight, setHighlight] = useState<string | null>(null)
  const [exportConfig, setExportConfig] = useState<ExportConfig | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([api.session(), api.samples()]).then(([session, available]) => {
      if (active) { setState(stateForSession(session)); setSamples(available); setLoading(false) }
    }).catch(reason => {
      if (active) { setError((reason as Error).message); setLoading(false) }
    })
    return () => { active = false }
  }, [])

  const activateSession = useCallback((session: SessionMetadata) => {
    setState(previous => stateForSession(session, previous?.activeTab ?? 'epochs'))
    setExportConfig(null)
    setError('')
  }, [])

  const loadSample = useCallback(async (id: string) => {
    setLoading(true); setError('')
    try { activateSession(await api.loadSample(id)) }
    catch (reason) { setError((reason as Error).message) }
    finally { setLoading(false) }
  }, [activateSession])

  const upload = useCallback(async (file: File) => {
    setLoading(true); setError('')
    try { activateSession(await api.upload(file)) }
    catch (reason) { setError((reason as Error).message) }
    finally { setLoading(false) }
  }, [activateSession])

  const setTab = (activeTab: TabId) => setState(current => current ? { ...current, activeTab } : current)
  const setKeptClasses = (keptClasses: number[]) => {
    setExportConfig(null)
    setState(current => {
      if (!current) return current
      const stillValid = current.pair && current.pair.every(id => keptClasses.includes(id))
      const pair = stillValid ? current.pair : keptClasses.length >= 2 ? [keptClasses[0], keptClasses[1]] as [number, number] : null
      return { ...current, keptClasses, pair }
    })
  }
  const setPair = (pair: [number, number] | null) => { setExportConfig(null); setState(current => current ? { ...current, pair } : current) }
  const exportPython = async () => {
    if (!exportConfig) return
    try {
      const source = await api.exportPython(exportConfig)
      const url = URL.createObjectURL(new Blob([source], { type: 'text/x-python' }))
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'separability_reproduction.py'; anchor.click()
      URL.revokeObjectURL(url)
      setError('')
    } catch (reason) { setError((reason as Error).message) }
  }

  if (loading && !state) return <div className="boot">Loading EEG session…</div>
  if (!state) return <div className="boot err">{error || 'Could not connect to the EEG backend. Start it with run.ps1.'}</div>

  const session = state.session
  const classOrder = session?.classes.map(item => item.event_id) ?? []
  const classNames = Object.fromEntries(session?.classes.map(item => [item.event_id, item.name]) ?? [])
  const challengeContext = {
    sampleId: session?.source === 'sample' ? session.id : '',
    keptClasses: state.keptClasses,
    selectedFeatureKeys: state.selectedFeatures,
    selectedFeatureBestJ: state.selectedFeatureFisherJ,
    pair: state.pair,
  }
  const hasSample = !!session && !!challengesBySample[session.id]
  // The backend caches 4–38 Hz. Display follows the file's own filter so no empty band is drawn.
  const band: [number, number] = [Math.max(4, Math.ceil(session?.highpass ?? 4)), Math.min(38, Math.floor(session?.lowpass ?? 38))]

  return <div className="app-shell" data-hl={highlight ?? ''}>
    <TopBar tab={state.activeTab} setTab={setTab} samples={samples} dataset={session?.id ?? ''} datasetName={session?.original_filename ?? ''}
      busy={loading} error={error} warnings={session?.warnings ?? []} canExport={state.activeTab === 'features' && !!exportConfig}
      onSample={loadSample} onUpload={upload} onExport={exportPython} />
    {hasSample && <ChallengeStrip context={challengeContext} />}
    <div className="workspace">
      <aside className="rail" aria-label="Analysis controls">
        {session && <>
          <ClassToggles classes={session.classes} kept={state.keptClasses} onChange={setKeptClasses} />
          <PairSelector classes={session.classes} kept={state.keptClasses} pair={state.pair} onChange={setPair} />
          <ChannelMontage session={session} csp={state.channels} current={state.channel}
            onCsp={channels => setState(current => current ? { ...current, channels } : current)}
            onCurrent={channel => setState(current => current ? { ...current, channel } : current)} />
          <FileInfo session={session} />
        </>}
      </aside>
      <main className="main" id="main">
        <div className="main-inner">
          {state.keptClasses.length === 0 && <div className="empty-state"><h1>No classes selected</h1><p>Turn on at least one class in the left panel to explore its features.</p></div>}
          {state.keptClasses.length > 0 && session && state.activeTab === 'epochs' && <>
            <header className="view-header">
              <p className="eyebrow">1 · Epochs & time–frequency</p>
              <h1>When does power change?</h1>
              <p className="lede">Look at individual trials first, then at how each class’s power moves in time and frequency relative to a baseline.</p>
            </header>
            <EpochWaveform session={session} channel={state.channel} kept={state.keptClasses} classOrder={classOrder} />
            <TFMap channel={state.channel} classes={state.keptClasses} classOrder={classOrder} tmin={session.tmin} tmax={session.tmax} band={band} />
          </>}
          {state.keptClasses.length > 0 && session && state.activeTab === 'spectra' && <>
            <header className="view-header">
              <p className="eyebrow">2 · Spectra & spatial</p>
              <h1>Which frequencies and scalp regions carry the classes?</h1>
              <p className="lede">Compare each class’s power spectrum on one channel, then see where the pairwise CSP filters place their weight on the scalp.</p>
            </header>
            <PSDView channel={state.channel} classes={state.keptClasses} classOrder={classOrder} band={band} />
            <CSPTopomaps pair={state.pair} channels={state.channels} classNames={classNames} />
          </>}
          {state.keptClasses.length > 0 && session && state.activeTab === 'features' && <FeaturesView classes={state.keptClasses} classOrder={classOrder} pair={state.pair}
            channels={state.channels} classNames={classNames} selectedKeys={state.selectedFeatures}
            onSelectedKeysChange={selectedFeatures => setState(current => current ? { ...current, selectedFeatures } : current)}
            onChallengeProgress={(selectedFeatures, selectedFeatureFisherJ) => setState(current => current ? { ...current, selectedFeatures, selectedFeatureFisherJ } : current)}
            onExportConfig={setExportConfig} />}
        </div>
      </main>
    </div>
    <FormulaDrawer keys={formulaKeysForTab(state.activeTab)} highlight={highlight} setHighlight={setHighlight} />
  </div>
}
