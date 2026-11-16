import type { ClassInfo } from '../api/client'
import { CLASS_COLORS } from '../theme/palette'

export function ClassToggles({ classes, kept, onChange }: { classes: ClassInfo[]; kept: number[]; onChange: (ids: number[]) => void }) {
  const allKept = kept.length === classes.length
  return <section className="rail-section" aria-labelledby="classes-heading">
    <div className="rail-head">
      <h2 id="classes-heading">Classes</h2>
      <button className="link-button" disabled={allKept} onClick={() => onChange(classes.map(item => item.event_id))}
        style={{ background: 'none', border: 0, color: 'var(--muted)', fontSize: 12, padding: 0 }}>Keep all</button>
    </div>
    <div className="class-grid">{classes.map((item, index) => {
      const active = kept.includes(item.event_id)
      return <button key={item.event_id} className="class-chip" aria-pressed={active}
        onClick={() => onChange(active ? kept.filter(id => id !== item.event_id) : [...kept, item.event_id])}
        title={`${active ? 'Hide' : 'Show'} ${item.name} in every view`}>
        <i style={{ background: CLASS_COLORS[index % CLASS_COLORS.length] }} />
        <span>{item.name}</span><small>{item.count}</small>
      </button>
    })}</div>
    <p className="hint">Turn classes off to remove them from every view. Pairwise CSP and ranking need at least two.</p>
  </section>
}
