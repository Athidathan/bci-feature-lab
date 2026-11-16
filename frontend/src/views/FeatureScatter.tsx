import { useEffect, useMemo, useState } from 'react'
import { api, type Candidate, type ExportConfig, type FeatureResponse } from '../api/client'
import { colorFor, niceTicks, formatValue } from '../theme/palette'

const W = 720, H = 440, L = 70, R = 24, T = 20, B = 56

export function FeatureScatter({ ranked, classes, classOrder, pair, onMetrics, onExportConfig }: {
  ranked: Candidate[]; classes: number[]; classOrder: number[]; pair: [number, number] | null
  onMetrics: (data: FeatureResponse | null) => void; onExportConfig: (config: ExportConfig | null) => void
}) {
  const options = ranked.slice(0, 40)
  const [xKey, setXKey] = useState('')
  const [yKey, setYKey] = useState('')
  const [data, setData] = useState<FeatureResponse | null>(null)
  const [error, setError] = useState('')

  // Default axes: the top-ranked feature against the best feature that is not a CSP component.
  // The two CSP components trade off against each other (their normalised log-variances sum to a constant
  // per class pair), so plotting them together only traces a curve.
  useEffect(() => {
    if (!ranked.length) return
    const top = ranked[0].key
    const partner = ranked.find(item => !item.key.startsWith('CSP') && item.key !== top)?.key ?? ranked.find(item => item.key !== top)?.key ?? top
    setXKey(current => ranked.some(item => item.key === current) ? current : top)
    setYKey(current => ranked.some(item => item.key === current) ? current : partner)
  }, [ranked])

  const xAxis = options.find(item => item.key === xKey), yAxis = options.find(item => item.key === yKey)
  useEffect(() => {
    if (!pair || !xAxis || !yAxis) { setData(null); onMetrics(null); onExportConfig(null); return }
    let live = true
    const specs = [xAxis.spec, yAxis.spec]
    api.features({ specs, classes, pair }).then(result => {
      if (live) { setData(result); onMetrics(result); onExportConfig({ specs, classes, pair }); setError('') }
    }).catch(reason => { if (live) setError((reason as Error).message) })
    return () => { live = false }
  }, [xAxis?.key, yAxis?.key, classes.join(','), pair?.[0], pair?.[1]])

  const plot = useMemo(() => {
    if (!data?.values.length) return null
    const xs = data.values.map(row => row[0]), ys = data.values.map(row => row[1])
    const xTicks = niceTicks(Math.min(...xs), Math.max(...xs), 5), yTicks = niceTicks(Math.min(...ys), Math.max(...ys), 5)
    const x0 = xTicks[0], x1 = xTicks[xTicks.length - 1], y0 = yTicks[0], y1 = yTicks[yTicks.length - 1]
    const x = (v: number) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R)
    const y = (v: number) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0 || 1))
    return { x, y, xTicks, yTicks, points: data.values.map((row, index) => ({ x: x(row[0]), y: y(row[1]), cls: data.labels[index] })) }
  }, [data])

  const groups = data ? [...new Set(data.labels)] : []
  const name = (eventId: number) => data?.classes.find(item => item.event_id === eventId)?.name ?? String(eventId)

  return <section className="scatter-wrap" aria-labelledby="scatter-heading" data-formula="fisher">
    <div className="axis-controls">
      <label className="field">Horizontal axis<select value={xKey} onChange={event => setXKey(event.target.value)}>
        {options.map(item => <option key={item.key} value={item.key}>{item.key}</option>)}</select></label>
      <label className="field">Vertical axis<select value={yKey} onChange={event => setYKey(event.target.value)}>
        {options.map(item => <option key={item.key} value={item.key}>{item.key}</option>)}</select></label>
    </div>
    <h2 id="scatter-heading" className="sr-only">Feature scatter</h2>
    {error && <p className="err">{error}</p>}
    {!ranked.length && <p className="hint">Choose two classes to see the feature space.</p>}
    {xKey.startsWith('CSP') && yKey.startsWith('CSP') && <p className="warning-note">Both axes are CSP components. They trade off against each other, so the points fall on a curve. Pair one with a different feature to see independent information.</p>}
    {plot && <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Each trial plotted by ${xAxis?.key} and ${yAxis?.key}`}>
        {plot.yTicks.map(tick => <g key={`y${tick}`}><line x1={L} x2={W - R} y1={plot.y(tick)} y2={plot.y(tick)} className="grid-line" />
          <text x={L - 8} y={plot.y(tick) + 4} textAnchor="end" className="axis-text">{formatValue(tick)}</text></g>)}
        {plot.xTicks.map(tick => <g key={`x${tick}`}><line x1={plot.x(tick)} x2={plot.x(tick)} y1={T} y2={H - B} className="grid-line" />
          <text x={plot.x(tick)} y={H - B + 18} textAnchor="middle" className="axis-text">{formatValue(tick)}</text></g>)}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="axis-line" />
        <line x1={L} x2={L} y1={T} y2={H - B} className="axis-line" />
        {groups.map(eventId => {
          const color = colorFor(classOrder, eventId)
          const points = plot.points.filter(point => point.cls === eventId)
          const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length
          const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length
          const vx = points.reduce((sum, point) => sum + (point.x - cx) ** 2, 0) / points.length
          const vy = points.reduce((sum, point) => sum + (point.y - cy) ** 2, 0) / points.length
          const cov = points.reduce((sum, point) => sum + (point.x - cx) * (point.y - cy), 0) / points.length
          const angle = 0.5 * Math.atan2(2 * cov, vx - vy) * 180 / Math.PI
          const root = Math.sqrt((vx - vy) ** 2 + 4 * cov ** 2)
          const major = Math.sqrt(Math.max(0, (vx + vy + root) / 2)), minor = Math.sqrt(Math.max(0, (vx + vy - root) / 2))
          return <g key={eventId}>
            <ellipse cx={cx} cy={cy} rx={major * 1.5} ry={minor * 1.5} transform={`rotate(${angle} ${cx} ${cy})`} fill={color} fillOpacity="0.08" stroke={color} strokeWidth="1.2" strokeOpacity="0.6" />
            {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3.4" fill={color} fillOpacity="0.75" />)}
            <circle cx={cx} cy={cy} r="5" fill="none" stroke="var(--text)" strokeWidth="1.5" />
          </g>
        })}
        <text x={(L + W - R) / 2} y={H - 10} textAnchor="middle" className="axis-title">{xAxis?.key}</text>
        <text transform={`translate(16 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">{yAxis?.key}</text>
      </svg>
      <div className="legend">{groups.map(eventId => <span key={eventId}><i className="swatch" style={{ background: colorFor(classOrder, eventId) }} />{name(eventId)}</span>)}
        <span>○ class centre · ellipse ≈ 1.5 standard deviations</span></div>
    </>}
  </section>
}
