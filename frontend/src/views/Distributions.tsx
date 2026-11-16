import { useEffect, useState } from 'react'
import { api, type Candidate, type DistributionResponse } from '../api/client'
import { colorFor, formatValue, niceTicks } from '../theme/palette'

const W = 360, H = 170, L = 12, R = 12, T = 12, B = 30

function densityPath(values: number[], lo: number, hi: number, bandwidth: number) {
  const points = Array.from({ length: 80 }, (_, index) => {
    const x = lo + (index / 79) * (hi - lo)
    const density = values.reduce((sum, value) => sum + Math.exp(-0.5 * ((x - value) / bandwidth) ** 2), 0) / (values.length * bandwidth * Math.sqrt(2 * Math.PI))
    return { x, density }
  })
  return points
}

export function Distributions({ selected, classes, classOrder, pair }: {
  selected: Candidate[]; classes: number[]; classOrder: number[]; pair: [number, number] | null
}) {
  const [data, setData] = useState<DistributionResponse[]>([])
  const [error, setError] = useState('')
  const shown = selected.slice(0, 4)
  useEffect(() => {
    if (!pair || !shown.length) { setData([]); return }
    let live = true
    Promise.all(shown.map(candidate => api.distributions({ spec: candidate.spec, classes, pair })))
      .then(results => { if (live) { setData(results); setError('') } })
      .catch(reason => { if (live) setError((reason as Error).message) })
    return () => { live = false }
  }, [shown.map(item => item.key).join('|'), classes.join(','), pair?.[0], pair?.[1]])

  if (!shown.length) return <p className="hint">Select features in the ranked list to compare their distributions here (up to four).</p>

  return <div className="grid-cards">{data.map(distribution => {
    const all = distribution.classes.flatMap(item => item.values)
    if (!all.length) return null
    const lo = Math.min(...all), hi = Math.max(...all)
    const span = hi - lo || 1
    const x0 = lo - 0.15 * span, x1 = hi + 0.15 * span
    const bandwidth = Math.max(1e-9, 1.06 * Math.sqrt(all.reduce((s, v) => s + (v - all.reduce((a, b) => a + b, 0) / all.length) ** 2, 0) / all.length) * Math.pow(all.length, -0.2))
    const curves = distribution.classes.map(item => ({ ...item, points: densityPath(item.values, x0, x1, bandwidth) }))
    const peak = Math.max(...curves.flatMap(curve => curve.points.map(point => point.density))) || 1
    const X = (value: number) => L + ((value - x0) / (x1 - x0)) * (W - L - R)
    const Y = (density: number) => H - B - (density / peak) * (H - B - T - 4)
    const ticks = niceTicks(x0, x1, 4)
    return <article className="card density-card" key={distribution.key}>
      <h3>{distribution.key}</h3>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Distribution of ${distribution.key} for each class`}>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="axis-line" />
        {ticks.map(tick => <text key={tick} x={X(tick)} y={H - B + 14} textAnchor="middle" className="axis-text">{formatValue(tick)}</text>)}
        {curves.map(curve => {
          const color = colorFor(classOrder, curve.event_id)
          const d = curve.points.map((point, index) => `${index ? 'L' : 'M'}${X(point.x).toFixed(1)},${Y(point.density).toFixed(1)}`).join(' ')
          return <g key={curve.event_id}><path d={`${d} L${X(x1).toFixed(1)},${H - B} L${X(x0).toFixed(1)},${H - B} Z`} fill={color} fillOpacity="0.12" />
            <path d={d} className="series" stroke={color} /></g>
        })}
      </svg>
      <div className="legend">{curves.map(curve => <span key={curve.event_id}><i className="swatch" style={{ background: colorFor(classOrder, curve.event_id) }} />{curve.name}</span>)}</div>
    </article>
  })}</div>
}
