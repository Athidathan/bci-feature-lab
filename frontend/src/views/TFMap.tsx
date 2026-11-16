import { useEffect, useMemo, useState } from 'react'
import { api, type TFResponse } from '../api/client'
import { colorFor } from '../theme/palette'

function defaultBaseline(tmin: number, tmax: number): [number, number] {
  return tmin <= -0.5 && tmax >= 0 ? [-0.5, 0] : [tmin, Math.min(tmax, tmin + 0.5)]
}

/** Fixed, symmetric ERD/ERS scale: ±50 % (the range most ERD/ERS papers use). Values beyond it are clipped. */
export const ERD_SCALE = 50

/** Blue = ERD (power decrease), red = ERS (power increase), a dark neutral at zero so it reads as background. */
function erdColor(value: number) {
  const t = Math.max(-1, Math.min(1, value / ERD_SCALE))
  const neutral = [36, 41, 52]
  const target = t < 0 ? [50, 128, 218] : [232, 78, 66]
  const k = Math.abs(t)
  return `rgb(${neutral.map((c, i) => Math.round(c + (target[i] - c) * k)).join(',')})`
}

export function TFMap({ channel, classes, classOrder, tmin, tmax, band }: {
  channel: string; classes: number[]; classOrder: number[]; tmin: number; tmax: number; band: [number, number]
}) {
  const [baseline, setBaseline] = useState<[number, number]>(() => defaultBaseline(tmin, tmax))
  const [baselineEdited, setBaselineEdited] = useState(false)
  const [freqRange, setFreqRange] = useState<[number, number]>(band)
  const [data, setData] = useState<TFResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { setBaseline(defaultBaseline(tmin, tmax)); setBaselineEdited(false) }, [tmin, tmax])
  useEffect(() => { setFreqRange(band) }, [band[0], band[1]])
  useEffect(() => {
    if (!channel || !classes.length) return
    let live = true
    api.tf({ channel, classes, baseline: baselineEdited ? baseline : null, freq_range: freqRange })
      .then(value => { if (live) { setData(value); setError('') } })
      .catch(reason => { if (live) setError((reason as Error).message) })
    return () => { live = false }
  }, [channel, classes.join(','), baseline[0], baseline[1], baselineEdited, freqRange[0], freqRange[1]])

  const scale = ERD_SCALE
  const clipped = useMemo(() => {
    const values = data?.panels.flatMap(panel => panel.erd_ers.flat()) ?? []
    return values.filter(value => Math.abs(value) > ERD_SCALE).length
  }, [data])
  const setBound = (index: 0 | 1, value: number) => {
    setBaselineEdited(true)
    setBaseline(current => {
      const next: [number, number] = [...current] as [number, number]
      next[index] = value
      if (next[0] >= next[1]) next[index === 0 ? 1 : 0] = value + (index === 0 ? 0.05 : -0.05)
      return next
    })
  }

  return <section className="card" data-formula="tf" aria-labelledby="tf-heading">
    <div className="card-head">
      <div>
        <h2 id="tf-heading">Time–frequency power change</h2>
        <p>Power in each frequency and time, compared with the baseline window. Channel: <span className="mono">{channel || '—'}</span></p>
      </div>
      {data && <div className="colorbar" aria-hidden="true"><span>−{scale.toFixed(0)}%</span><i /><span>+{scale.toFixed(0)}%</span></div>}
    </div>
    <div className="controls">
      <label className="control">
        <span className="control-label">Baseline start <output>{(data?.baseline[0] ?? baseline[0]).toFixed(2)} s</output></span>
        <input type="range" min={tmin} max={tmax - 0.1} step="0.05" value={baseline[0]} onChange={event => setBound(0, Number(event.target.value))} />
      </label>
      <label className="control">
        <span className="control-label">Baseline end <output>{(data?.baseline[1] ?? baseline[1]).toFixed(2)} s</output></span>
        <input type="range" min={tmin + 0.05} max={tmax} step="0.05" value={baseline[1]} onChange={event => setBound(1, Number(event.target.value))} />
      </label>
      <label className="control">
        <span className="control-label">Lowest frequency <output>{freqRange[0]} Hz</output></span>
        <input type="range" min={band[0]} max={freqRange[1] - 2} step="1" value={freqRange[0]} onChange={event => setFreqRange([Number(event.target.value), freqRange[1]])} />
      </label>
      <label className="control">
        <span className="control-label">Highest frequency <output>{freqRange[1]} Hz</output></span>
        <input type="range" min={freqRange[0] + 2} max={band[1]} step="1" value={freqRange[1]} onChange={event => setFreqRange([freqRange[0], Number(event.target.value)])} />
      </label>
    </div>
    {data?.warnings.map(warning => <p className="warning-note" key={warning} style={{ marginBottom: 12 }}>ⓘ {warning}</p>)}
    {error && <p className="err">{error}</p>}
    {data && <div className="grid-cards">{data.panels.map(panel => {
      const rows = panel.erd_ers, nFreq = data.freqs.length, nTime = data.times.length
      const color = colorFor(classOrder, panel.event_id)
      const freqTicks = [4, 8, 12, 20, 30, 38].filter(f => f >= freqRange[0] && f <= freqRange[1])
      const timeTicks = [0, 0.25, 0.5, 0.75, 1].map(fraction => data.times[0] + fraction * (data.times[nTime - 1] - data.times[0]))
      return <div className="tf-panel" key={panel.event_id}>
        <h3><i className="swatch" style={{ background: color }} />{panel.name}</h3>
        <div className="heat-frame">
          <svg viewBox={`0 0 ${nTime} ${nFreq}`} preserveAspectRatio="none" role="img" aria-label={`ERD/ERS map for ${panel.name}`}>
            {rows.flatMap((row, fi) => row.map((value, ti) => (
              <rect key={`${fi}-${ti}`} x={ti} y={nFreq - 1 - fi} width="1.02" height="1.02" fill={erdColor(value)} />
            )))}
          </svg>
          <div className="heat-axis-y" aria-hidden="true">{freqTicks.map(f => {
            const fi = data.freqs.reduce((best, value, index) => Math.abs(value - f) < Math.abs(data.freqs[best] - f) ? index : best, 0)
            const top = (1 - (fi + 0.5) / nFreq) * 100
            return <span key={f} style={{ top: `${top}%` }}>{f}</span>
          })}</div>
          <div className="heat-axis-x" aria-hidden="true">{timeTicks.map(t => <span key={t}>{t.toFixed(1)} s</span>)}</div>
        </div>
      </div>
    })}</div>}
    {data && <p className="hint" style={{ marginTop: 10 }}>Frequency runs up the vertical axis (Hz). All classes share one colour scale, fixed at ±{ERD_SCALE}%. {clipped > 0 ? `${clipped} values beyond the scale are shown at full colour.` : 'No values exceed the scale.'}</p>}
  </section>
}
