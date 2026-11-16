import type { SessionMetadata } from '../api/client'

const LABEL_LIMIT = 32

/** Two separate choices: which channels feed CSP (multi-select on the montage), and the one channel shown in TF and PSD. */
export function ChannelMontage({ session, csp, current, onCsp, onCurrent }: {
  session: SessionMetadata; csp: string[]; current: string
  onCsp: (channels: string[]) => void; onCurrent: (channel: string) => void
}) {
  const coords = (name: string): [number, number] => {
    const [x, y] = session.channel_pos[name] ?? [0, 0]
    return [130 + x * 92, 126 - y * 92]
  }
  const toggle = (name: string) => onCsp(csp.includes(name) ? csp.filter(item => item !== name) : [...csp, name])
  const dense = session.channels.length > LABEL_LIMIT
  const showLabels = !dense
  return <section className="rail-section" aria-labelledby="channels-heading">
    <div className="rail-head"><h2 id="channels-heading">Channels</h2><span className="mono muted">{csp.length} / {session.channels.length} for CSP</span></div>
    <svg className="montage" viewBox="0 0 260 252" role="group" aria-label="EEG electrode map. Click to include or exclude a channel from CSP.">
      <ellipse cx="130" cy="126" rx="100" ry="108" className="head-outline" />
      <path d="M116 18 L130 4 L144 18" className="head-mark" />
      <path d="M30 88 Q10 126 30 164 M230 88 Q250 126 230 164" className="head-mark" />
      {session.channels.map(name => {
        const [x, y] = coords(name)
        const selected = csp.includes(name)
        const isCurrent = name === current
        const classes = `electrode${selected ? ' selected' : ''}${isCurrent ? ' current' : ''}`
        return <g key={name} className={classes} role="button" tabIndex={0} aria-pressed={selected}
          aria-label={`${name}: ${selected ? 'in CSP' : 'not in CSP'}${isCurrent ? ', current channel' : ''}`}
          onClick={() => toggle(name)} onDoubleClick={() => onCurrent(name)}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(name) } }}>
          <title>{`${name}: click to ${selected ? 'remove from' : 'add to'} CSP; double-click to show in TF and PSD`}</title>
          <circle cx={x} cy={y} r={isCurrent ? 8 : dense ? 4.5 : 6.5} />
          {(showLabels || isCurrent) && <text x={x} y={y + (dense ? 13 : 17)}>{name}</text>}
        </g>
      })}
    </svg>
    <div className="field">
      <label htmlFor="current-channel">Channel for time-frequency and spectra</label>
      <select id="current-channel" value={current} onChange={event => onCurrent(event.target.value)}>
        {session.channels.map(name => <option key={name} value={name}>{name}</option>)}
      </select>
    </div>
    <div className="chip-row">
      <button className="link-button" disabled={csp.length === session.channels.length} onClick={() => onCsp(session.channels)}
        style={{ background: 'none', border: 0, color: 'var(--muted)', fontSize: 12, padding: 0 }}>All to CSP</button>
      <span className="muted" style={{ fontSize: 12 }}>·</span>
      <button className="link-button" disabled={csp.length < 2} onClick={() => onCsp(csp.slice(0, 2))}
        style={{ background: 'none', border: 0, color: 'var(--muted)', fontSize: 12, padding: 0 }}>Keep first two</button>
    </div>
  </section>
}
