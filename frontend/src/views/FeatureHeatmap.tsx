import { useEffect, useMemo, useState } from 'react'
import { api, type Candidate, type FeatureResponse } from '../api/client'
import { colorFor } from '../theme/palette'

export function FeatureHeatmap({ selected, ranked, classes, classOrder, pair }: {
  selected: Candidate[]; ranked: Candidate[]; classes: number[]; classOrder: number[]; pair: [number, number] | null
}) {
  const [sort, setSort] = useState<'class' | 'feature'>('class')
  const [data, setData] = useState<FeatureResponse | null>(null)
  const [error, setError] = useState('')
  const shown = (selected.length ? selected : ranked.slice(0, 6)).slice(0, 12)
  useEffect(() => {
    if (!pair || !shown.length) { setData(null); return }
    let live = true
    api.features({ specs: shown.map(item => item.spec), classes, pair }).then(result => {
      if (live) { setData(result); setError('') }
    }).catch(reason => { if (live) setError((reason as Error).message) })
    return () => { live = false }
  }, [shown.map(item => item.key).join('|'), classes.join(','), pair?.[0], pair?.[1]])

  const zscores = useMemo(() => {
    if (!data) return []
    return data.keys.map((_, col) => {
      const values = data.values.map(row => row[col])
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length
      const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length) || 1
      return values.map(v => (v - mean) / sd)
    })
  }, [data])

  const rows = useMemo(() => {
    if (!data) return []
    const output = data.values.map((_, index) => ({ index, label: data.labels[index] }))
    return output.sort((a, b) => sort === 'class' ? a.label - b.label || a.index - b.index : (zscores[0]?.[b.index] ?? 0) - (zscores[0]?.[a.index] ?? 0))
  }, [data, sort, zscores])

  if (!shown.length) return <p className="hint">Choose features in the ranked list to see which trials carry them.</p>

  const cell = 56, label = 150, rowH = 2.4, top = 92
  const width = label + data?.keys.length! * cell + 8
  const height = top + rows.length * rowH + 8
  const color = (value: number) => {
    const t = Math.max(-1, Math.min(1, value / 2.5))
    const base = [22, 26, 34]
    const target = t < 0 ? [50, 128, 218] : [232, 78, 66]
    return `rgb(${base.map((c, i) => Math.round(c + (target[i] - c) * Math.abs(t))).join(',')})`
  }

  return <div>
    <div className="rank-controls">
      <span className="hint">Rows are trials, grouped by class. Columns are features. Colour is the z-score within each feature.</span>
      <label className="field" style={{ marginLeft: 'auto' }}>Sort rows<select value={sort} onChange={event => setSort(event.target.value as 'class' | 'feature')}>
        <option value="class">By class</option><option value="feature">By first feature</option></select></label>
    </div>
    {error && <p className="err">{error}</p>}
    {data && <svg className="heat-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trial by feature heatmap">
      {data.keys.map((key, col) => <text key={key} x={label + col * cell + cell / 2} y={top - 10} textAnchor="start" transform={`rotate(-40 ${label + col * cell + cell / 2} ${top - 10})`}>{key.length > 22 ? key.slice(0, 21) + '…' : key}</text>)}
      {rows.map((row, index) => {
        const y = top + index * rowH
        const classColor = colorFor(classOrder, row.label)
        return <g key={row.index}>
          <rect x={label - 12} y={y} width="6" height={rowH} fill={classColor} />
          {data.keys.map((_, col) => <rect key={col} x={label + col * cell} y={y} width={cell - 3} height={rowH} fill={color(zscores[col][row.index])} />)}
        </g>
      })}
    </svg>}
  </div>
}
