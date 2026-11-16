import { useState } from 'react'
import type { Candidate, ExportConfig, FeatureResponse } from '../api/client'
import { FisherMeter } from '../components/FisherMeter'
import { Distributions } from './Distributions'
import { FeatureHeatmap } from './FeatureHeatmap'
import { FeatureScatter } from './FeatureScatter'
import { FisherRanking } from './FisherRanking'

type Detail = 'scatter' | 'distributions' | 'heatmap'
const details: { id: Detail; label: string }[] = [
  { id: 'scatter', label: 'Two features' },
  { id: 'distributions', label: 'Distributions' },
  { id: 'heatmap', label: 'Trial heatmap' },
]

export function FeaturesView({ classes, classOrder, pair, channels, classNames, selectedKeys, onSelectedKeysChange, onChallengeProgress, onExportConfig }: {
  classes: number[]; classOrder: number[]; pair: [number, number] | null; channels: string[]; classNames: Record<number, string>
  selectedKeys: string[]; onSelectedKeysChange: (keys: string[]) => void
  onChallengeProgress: (keys: string[], bestJ: number) => void; onExportConfig: (config: ExportConfig | null) => void
}) {
  const [ranked, setRanked] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Candidate[]>([])
  const [metrics, setMetrics] = useState<FeatureResponse | null>(null)
  const [detail, setDetail] = useState<Detail>('scatter')

  const refreshRanking = (items: Candidate[]) => {
    setRanked(items)
    const next = items.filter(item => selectedKeys.includes(item.key))
    setSelected(next)
    onChallengeProgress(selectedKeys, Math.max(0, ...next.map(item => item.fisher_j ?? 0)))
  }
  const updateSelection = (items: Candidate[]) => {
    setSelected(items)
    const keys = items.map(item => item.key)
    onSelectedKeysChange(keys)
    onChallengeProgress(keys, Math.max(0, ...items.map(item => item.fisher_j ?? 0)))
  }
  const pairLabel = pair ? `${classNames[pair[0]]} vs ${classNames[pair[1]]}` : 'choose two classes'

  return <section className="main-inner" aria-labelledby="features-heading" data-formula="fisher">
    <header className="view-header">
      <p className="eyebrow">3 · Features</p>
      <h1 id="features-heading">What makes these classes separable?</h1>
      <p className="lede">Rank candidate measurements for {pairLabel}. Select some to compare them two at a time, see how their values spread, or check individual trials.</p>
      <FisherMeter fisher={metrics?.fisher_j ?? null} silhouette={metrics?.silhouette ?? null} />
    </header>
    <div className="features-grid">
      <FisherRanking classes={classes} pair={pair} channels={channels} selected={selected} onSelected={updateSelection} onRanked={refreshRanking} />
      <div className="card" style={{ minWidth: 0 }}>
        <div className="feature-tabs" role="tablist" aria-label="Feature detail">
          {details.map(item => <button key={item.id} role="tab" aria-selected={detail === item.id} onClick={() => setDetail(item.id)}>{item.label}</button>)}
        </div>
        <div role="tabpanel">
          {detail === 'scatter' && <FeatureScatter ranked={ranked} classes={classes} classOrder={classOrder} pair={pair} onMetrics={setMetrics} onExportConfig={onExportConfig} />}
          {detail === 'distributions' && <Distributions selected={selected} classes={classes} classOrder={classOrder} pair={pair} />}
          {detail === 'heatmap' && <FeatureHeatmap selected={selected} ranked={ranked} classes={classes} classOrder={classOrder} pair={pair} />}
        </div>
      </div>
    </div>
  </section>
}
