import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function CSPTopomaps({ pair, channels, classNames }: { pair: [number, number] | null; channels: string[]; classNames: Record<number, string> }) {
  const [images, setImages] = useState<string[]>([])
  const [error, setError] = useState('')
  const ready = !!pair && channels.length >= 4
  useEffect(() => {
    if (!ready || !pair) { setImages([]); return }
    let live = true
    Promise.all([0, 1].map(filter_index => api.topomap({ class_a: pair[0], class_b: pair[1], channels, filter_index })))
      .then(result => { if (live) { setImages(result.map(item => item.png_base64)); setError('') } })
      .catch(reason => { if (live) setError((reason as Error).message) })
    return () => { live = false }
  }, [pair?.[0], pair?.[1], channels.join(','), ready])

  const label = pair ? `${classNames[pair[0]]} vs ${classNames[pair[1]]}` : 'no pair chosen'
  return <section className="card" data-formula="csp" aria-labelledby="csp-heading">
    <div className="card-head">
      <div>
        <h2 id="csp-heading">Spatial filters (CSP)</h2>
        <p>Scalp patterns of the two most discriminative spatial filters for <strong>{label}</strong>. Warm colours increase the filter’s output; cool colours decrease it.</p>
      </div>
    </div>
    {!pair && <p className="warning-note">Keep at least two classes to compute CSP.</p>}
    {pair && channels.length < 4 && <p className="warning-note">Include at least four channels in CSP to draw the patterns.</p>}
    {error && <p className="err">{error}</p>}
    <div className="topomap-pair">{images.map((src, index) => <figure key={index}>
      <img alt={`CSP spatial pattern, filter ${index + 1}`} src={'data:image/png;base64,' + src} />
      <figcaption><span>Filter {index + 1}</span><span className="mono">{index === 0 ? 'most for first class' : 'most for second class'}</span></figcaption>
    </figure>)}</div>
    {ready && !images.length && !error && <p className="hint">Computing spatial patterns…</p>}
  </section>
}
