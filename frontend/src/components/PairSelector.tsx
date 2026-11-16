import type { ClassInfo } from '../api/client'

export function PairSelector({ classes, kept, pair, onChange }: {
  classes: ClassInfo[]; kept: number[]; pair: [number, number] | null; onChange: (pair: [number, number] | null) => void
}) {
  const available = classes.filter(item => kept.includes(item.event_id))
  const first = pair?.[0] ?? available[0]?.event_id
  const second = pair?.[1] ?? available[1]?.event_id
  const choose = (next: number, slot: 'a' | 'b') => {
    const fixed = slot === 'a' ? second : first
    if (next === fixed) {
      const other = available.find(item => item.event_id !== next)?.event_id
      if (other == null) return
      onChange(slot === 'a' ? [next, other] : [other, next])
      return
    }
    onChange(slot === 'a' ? [next, second as number] : [first as number, next])
  }
  return <section className="rail-section" aria-labelledby="pair-heading">
    <div className="rail-head"><h2 id="pair-heading">CSP pair</h2><span className="mono muted">pairwise</span></div>
    {available.length < 2
      ? <p className="hint">Keep two classes to choose a pair.</p>
      : <div className="pair-selects">
        <label className="field">Class A<select value={first} onChange={event => choose(Number(event.target.value), 'a')}>
          {available.map(item => <option key={item.event_id} value={item.event_id}>{item.name}</option>)}
        </select></label>
        <label className="field">Class B<select value={second} onChange={event => choose(Number(event.target.value), 'b')}>
          {available.map(item => <option key={item.event_id} value={item.event_id}>{item.name}</option>)}
        </select></label>
      </div>}
  </section>
}
