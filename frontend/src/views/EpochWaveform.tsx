import { useEffect, useState } from 'react'
import { api, type EpochSignal, type SessionMetadata } from '../api/client'
import { colorFor, formatValue, niceTicks } from '../theme/palette'

const W = 900, H = 200, L = 52, R = 16, T = 14, B = 26

export function EpochWaveform({ session, channel, kept, classOrder }: {
  session: SessionMetadata; channel: string; kept: number[]; classOrder: number[]
}) {
  const trialCount = session.classes.reduce((sum, item) => sum + item.count, 0)
  const [trial, setTrial] = useState(0)
  const [signal, setSignal] = useState<EpochSignal | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { setTrial(0) }, [session.id])
  useEffect(() => {
    if (!channel) return
    let live = true
    api.epoch(trial, [channel]).then(data => { if (live) { setSignal(data); setError('') } })
      .catch(reason => { if (live) setError((reason as Error).message) })
    return () => { live = false }
  }, [trial, channel, session.id])

  const values = signal?.values[0] ?? []
  const times = signal?.times ?? []
  const max = Math.max(1e-12, ...values.map(Math.abs))
  const plotH = H - T - B
  const x = (index: number) => L + (index / Math.max(values.length - 1, 1)) * (W - L - R)
  const y = (value: number) => T + plotH / 2 - (value / max) * (plotH / 2) * 0.92
  const path = values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
  const className = signal ? session.classes.find(item => item.event_id === signal.event_id)?.name ?? 'Unknown class' : ''
  const isKept = signal ? kept.includes(signal.event_id) : true
  const color = signal ? colorFor(classOrder, signal.event_id) : 'var(--muted)'
  const tMin = times[0] ?? session.tmin, tMax = times[times.length - 1] ?? session.tmax
  const cueInWindow = session.tmin <= 0 && session.tmax >= 0

  return <section className="card" data-formula="time" aria-labelledby="waveform-heading">
    <div className="card-head">
      <div>
        <h2 id="waveform-heading">Single epoch</h2>
        <p>One trial from <span className="mono">{channel || 'the selected channel'}</span>. {cueInWindow ? 'Time 0 is the cue.' : `Times are relative to the cue; this epoch starts at ${session.tmin.toFixed(1)} s, after it.`} Amplitude is in the file’s own units.</p>
      </div>
      <span className="class-badge" style={{ borderColor: color, color }}><i className="swatch" style={{ background: color }} />{className}</span>
    </div>
    {error && <p className="err">{error}</p>}
    {!isKept && signal && <p className="warning-note">This trial’s class is turned off. Move the slider to a trial from a kept class.</p>}
    {signal && <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Trial ${trial + 1} from ${channel}, class ${className}`}>
      {niceTicks(-max, max, 2).map(tick => <line key={tick} x1={L} x2={W - R} y1={y(tick)} y2={y(tick)} className="grid-line" />)}
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="axis-line" />
      {niceTicks(tMin, tMax, 4).map(tick => <text key={tick} x={L + ((tick - tMin) / (tMax - tMin || 1)) * (W - L - R)} y={H - 6} textAnchor="middle" className="axis-text">{tick.toFixed(1)} s</text>)}
      <path d={path} className="series" stroke={color} style={{ opacity: isKept ? 1 : 0.4 }} />
      <text x={L - 8} y={T + 10} textAnchor="end" className="axis-text">{formatValue(max)}</text>
      <text x={L - 8} y={H - B} textAnchor="end" className="axis-text">{formatValue(-max)}</text>
    </svg>}
    <div className="trial-nav">
      <button aria-label="Previous trial" onClick={() => setTrial(current => Math.max(0, current - 1))} disabled={trial === 0}>‹</button>
      <input aria-label="Trial" type="range" min={0} max={Math.max(0, trialCount - 1)} value={trial} onChange={event => setTrial(Number(event.target.value))} />
      <button aria-label="Next trial" onClick={() => setTrial(current => Math.min(trialCount - 1, current + 1))} disabled={trial >= trialCount - 1}>›</button>
      <span className="mono muted">Trial {trial + 1} of {trialCount}</span>
    </div>
  </section>
}
