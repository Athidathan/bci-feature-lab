import { useEffect, useMemo, useState } from 'react'
import { api, type PSDResponse } from '../api/client'
import { colorFor, niceTicks } from '../theme/palette'

const W = 900, H = 330, L = 60, R = 18, T = 16, B = 40

function BandControl({ label, value, min, max, onChange }: {
  label: string; value: [number, number]; min: number; max: number; onChange: (value: [number, number]) => void
}) {
  return <div className="band-control">
    <div className="control-label"><span>{label}</span><output className="mono">{value[0]}–{value[1]} Hz</output></div>
    <label className="mini-slider"><span>from</span><input type="range" min={min} max={value[1] - 1} value={value[0]} onChange={event => onChange([Number(event.target.value), value[1]])} aria-label={`${label} lower edge`} /></label>
    <label className="mini-slider"><span>to</span><input type="range" min={value[0] + 1} max={max} value={value[1]} onChange={event => onChange([value[0], Number(event.target.value)])} aria-label={`${label} upper edge`} /></label>
  </div>
}

export function PSDView({ channel, classes, classOrder, band }: { channel: string; classes: number[]; classOrder: number[]; band: [number, number] }) {
  const [data, setData] = useState<PSDResponse | null>(null)
  const [log, setLog] = useState(true)
  const [mu, setMu] = useState<[number, number]>([Math.max(8, band[0]), Math.min(12, band[1])])
  const [beta, setBeta] = useState<[number, number]>([Math.max(13, band[0]), Math.min(30, band[1])])
  const [FREQ_MIN, FREQ_MAX] = band
  const [hidden, setHidden] = useState<number[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!channel) return
    let live = true
    api.psd(channel, classes).then(result => { if (live) { setData(result); setError('') } })
      .catch(reason => { if (live) setError((reason as Error).message) })
    return () => { live = false }
  }, [channel, classes.join(',')])

  const chart = useMemo(() => {
    if (!data) return null
    const transform = (value: number) => (log ? Math.log10(Math.max(value, 1e-12)) : value)
    const visible = data.series.filter(series => !hidden.includes(series.event_id))
    const all = visible.flatMap(series => series.mean_psd.map(transform))
    if (!all.length) return null
    const lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo || 1) * 0.08
    const yMin = lo - pad, yMax = hi + pad
    const x = (f: number) => L + ((f - band[0]) / (band[1] - band[0] || 1)) * (W - L - R)
    const y = (v: number) => T + (H - T - B) * (1 - (v - yMin) / (yMax - yMin))
    const paths = visible.map(series => ({
      id: series.event_id, name: series.name, color: colorFor(classOrder, series.event_id),
      d: series.mean_psd.map((value, index) => `${index ? 'L' : 'M'}${x(data.freqs[index]).toFixed(1)},${y(transform(value)).toFixed(1)}`).join(' '),
    }))
    return { x, y, paths, yTicks: niceTicks(yMin, yMax, 4) }
  }, [data, log, hidden, classOrder, band[0], band[1]])

  const toggleHidden = (id: number) => setHidden(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const legend = data?.series.map(series => ({ id: series.event_id, name: series.name, color: colorFor(classOrder, series.event_id) })) ?? []

  return <section className="card" data-formula="psd" aria-labelledby="psd-heading">
    <div className="card-head">
      <div>
        <h2 id="psd-heading">Power spectrum by class</h2>
        <p>Average Welch spectrum of each class on <span className="mono">{channel || '—'}</span>. Shaded bands show the mu and beta ranges used for band power.</p>
      </div>
      <label className="check"><input type="checkbox" checked={log} onChange={event => setLog(event.target.checked)} /> Log scale</label>
    </div>
    <div className="band-controls" data-formula="band">
      <BandControl label="Mu band" value={mu} min={FREQ_MIN} max={FREQ_MAX} onChange={setMu} />
      <BandControl label="Beta band" value={beta} min={FREQ_MIN} max={FREQ_MAX} onChange={setBeta} />
    </div>
    {error && <p className="err">{error}</p>}
    {chart && <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Power spectral density for each kept class">
        <rect x={chart.x(mu[0])} y={T} width={Math.max(0, chart.x(mu[1]) - chart.x(mu[0]))} height={H - T - B} fill="#58C4DD" opacity="0.1" />
        <rect x={chart.x(beta[0])} y={T} width={Math.max(0, chart.x(beta[1]) - chart.x(beta[0]))} height={H - T - B} fill="#F4D03F" opacity="0.07" />
        {chart.yTicks.map(tick => <g key={tick}><line x1={L} x2={W - R} y1={chart.y(tick)} y2={chart.y(tick)} className="grid-line" />
          <text x={L - 8} y={chart.y(tick) + 4} textAnchor="end" className="axis-text">{tick.toFixed(1)}</text></g>)}
        {niceTicks(band[0], band[1], 6).map(freq => <text key={freq} x={chart.x(freq)} y={H - B + 18} textAnchor="middle" className="axis-text">{freq}</text>)}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="axis-line" />
        {chart.paths.map(path => <path key={path.id} d={path.d} className="series" stroke={path.color} />)}
        <text x={L} y={H - 6} className="axis-title">Frequency (Hz)</text>
        <text x={12} y={T + 4} className="axis-title">{log ? 'log₁₀ power' : 'power'}</text>
      </svg>
      <div className="legend" role="group" aria-label="Show or hide classes">{legend.map(item => <button key={item.id} aria-pressed={!hidden.includes(item.id)} onClick={() => toggleHidden(item.id)}>
        <i style={{ background: item.color }} />{item.name}
      </button>)}</div>
    </>}
  </section>
}
