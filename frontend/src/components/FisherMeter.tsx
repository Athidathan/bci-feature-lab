import { formatStat } from '../theme/palette'

export function FisherMeter({ fisher, silhouette }: { fisher: number | null; silhouette: number | null }) {
  return <div className="metrics" aria-live="polite">
    <span className="metric" data-formula="fisher" title="Between-class separation relative to within-class spread. Higher is more separable.">Fisher J <b>{formatStat(fisher)}</b></span>
    <span className="metric" data-formula="silhouette" title="Mean silhouette of the two classes in the chosen features. Ranges from −1 to 1; higher is better.">Silhouette <b>{formatStat(silhouette)}</b></span>
  </div>
}
