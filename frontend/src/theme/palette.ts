// One place for colours and number formatting, shared by every view.
export const CLASS_COLORS = ['#58C4DD', '#83C167', '#F0A04B', '#B99AE8', '#E8788A', '#7FD1B9']

/** Colour for a class, by its position in the file's class order (stable across views). */
export function colorFor(classOrder: number[], eventId: number): string {
  const index = Math.max(0, classOrder.indexOf(eventId))
  return CLASS_COLORS[index % CLASS_COLORS.length]
}

/** "Nice" axis ticks covering [lo, hi] with roughly `count` steps. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [lo]
  const raw = (hi - lo) / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalised = raw / magnitude
  const step = (normalised < 1.5 ? 1 : normalised < 3 ? 2 : normalised < 7 ? 5 : 10) * magnitude
  const ticks: number[] = []
  for (let value = Math.ceil(lo / step) * step; value <= hi + step * 1e-9; value += step) {
    ticks.push(Number(value.toFixed(10)))
  }
  return ticks
}

export function formatValue(value: number): string {
  const abs = Math.abs(value)
  if (abs === 0) return '0'
  if (abs >= 1000 || abs < 0.01) return value.toExponential(1)
  if (abs >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

/** Fisher J and silhouette are shown with three decimals everywhere. */
export const formatStat = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? '—' : value.toFixed(3))
