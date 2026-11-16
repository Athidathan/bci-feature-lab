import { useEffect, useState } from 'react'
import { api, type Candidate } from '../api/client'

export function FisherRanking({ classes, pair, channels, selected, onSelected, onRanked }: {
  classes: number[]; pair: [number, number] | null; channels: string[]
  selected: Candidate[]; onSelected: (items: Candidate[]) => void; onRanked: (items: Candidate[]) => void
}) {
  const [ranked, setRanked] = useState<Candidate[]>([])
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  useEffect(() => {
    if (!pair || classes.length < 2) { setRanked([]); onRanked([]); return }
    let live = true
    api.ranking(classes, pair, channels).then(response => {
      if (live) { setRanked(response.features); onRanked(response.features); setError('') }
    }).catch(reason => { if (live) setError((reason as Error).message) })
    return () => { live = false }
  }, [classes.join(','), pair?.[0], pair?.[1], channels.join(',')])

  const isChosen = (item: Candidate) => selected.some(entry => entry.key === item.key)
  const toggle = (item: Candidate) => onSelected(isChosen(item) ? selected.filter(entry => entry.key !== item.key) : [...selected, item])
  const query = filter.trim().toLowerCase()
  const visible = ranked.filter(item => item.key.toLowerCase().includes(query))
  const max = ranked[0]?.fisher_j ?? 1

  return <section className="card" data-formula="time" data-formula-extra="hjorth" aria-labelledby="ranking-heading">
    <div className="card-head">
      <div>
        <h2 id="ranking-heading">Ranked features</h2>
        <p>{ranked.length} candidates, sorted by Fisher J for the chosen pair.</p>
      </div>
      <span className="mono muted">{selected.length} selected</span>
    </div>
    <div className="rank-controls">
      <input aria-label="Search features" placeholder="Search features…" value={filter} onChange={event => setFilter(event.target.value)} />
      <button className="btn" disabled={!ranked.length} onClick={() => onSelected(ranked.slice(0, 5))}>Top 5</button>
      <button className="btn" disabled={!selected.length} onClick={() => onSelected([])}>Clear</button>
    </div>
    {error && <p className="err">{error}</p>}
    <div className="rank-list" role="list">{visible.map((item, index) => {
      const active = isChosen(item)
      const width = max > 0 ? Math.max(0, (item.fisher_j ?? 0) / max * 100) : 0
      return <button key={item.key} role="listitem" className={`rank-row${active ? ' chosen' : ''}`} aria-pressed={active} onClick={() => toggle(item)}>
        <span className="rank-index mono">{index + 1}</span>
        <span className="rank-label">{item.key}<i style={{ width: `${width}%` }} /></span>
        <span className="rank-score mono">{(item.fisher_j ?? 0).toFixed(3)}</span>
        <span className="rank-mark" aria-hidden="true">{active ? '✓' : '+'}</span>
      </button>
    })}</div>
    {!visible.length && ranked.length > 0 && <p className="hint">No feature matches “{filter}”.</p>}
  </section>
}
