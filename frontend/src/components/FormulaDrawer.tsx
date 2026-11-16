import { useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

export const formulas: { key: string; tex: string; note: string }[] = [
  { key: 'tf', tex: '\\mathrm{ERD/ERS}(f,t)=100\\,\\frac{P(f,t)-P_{\\mathrm{base}}(f)}{P_{\\mathrm{base}}(f)}', note: 'Time-frequency power relative to the baseline window. Negative means desynchronisation (ERD); positive means synchronisation (ERS).' },
  { key: 'psd', tex: 'P_{xx}(f)=\\operatorname{Welch}(x)', note: 'Welch power spectral density: averaged windowed spectra of each trial.' },
  { key: 'band', tex: 'P_{[f_1,f_2]}=\\int_{f_1}^{f_2}P_{xx}(f)\\,df', note: 'Band power is the area under the PSD inside the band. Relative power divides by the 4–38 Hz total.' },
  { key: 'csp', tex: '\\Sigma_A w=\\lambda\\,(\\Sigma_A+\\Sigma_B)\\,w', note: 'Pairwise CSP: spatial filters that maximise variance for one class while minimising it for the other.' },
  { key: 'time', tex: '\\mathrm{ptp}(x)=\\max(x)-\\min(x),\\quad \\mathrm{Var}(x)=\\frac{1}{N}\\sum_n(x_n-\\bar x)^2', note: 'Time-window features summarise amplitude inside the selected window.' },
  { key: 'hjorth', tex: 'M=\\sqrt{\\frac{\\mathrm{Var}(\\Delta x)}{\\mathrm{Var}(x)}},\\quad C=\\frac{M(\\Delta x)}{M(x)}', note: 'Hjorth mobility and complexity use successive first differences.' },
  { key: 'fisher', tex: 'J=\\Delta\\mu^{\\mathsf T}(S_1+S_2+\\rho I)^{-1}\\Delta\\mu', note: 'Fisher J: between-class mean difference relative to within-class spread. Higher means more separable.' },
  { key: 'silhouette', tex: 's=\\frac{b-a}{\\max(a,b)}', note: 'Silhouette: a is the mean distance within a class, b the nearest other class. Ranges from −1 to 1; higher is better.' },
]

const byTab: Record<string, string[]> = {
  epochs: ['tf'],
  spectra: ['psd', 'band', 'csp'],
  features: ['time', 'hjorth', 'fisher', 'silhouette'],
}

export const formulaKeysForTab = (tab: string) => byTab[tab] ?? []

export function FormulaDrawer({ keys, highlight, setHighlight }: {
  keys: string[]; highlight: string | null; setHighlight: (key: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const shown = formulas.filter(item => keys.includes(item.key))
  if (!shown.length) return null
  return <footer className="formula-dock" aria-label="Formulas for this view">
    <div className="formula-dock-bar">
      <strong>Formulas</strong>
      <span>{open ? 'Hover a formula to highlight the part of this view it describes.' : `${shown.length} for this view`}</span>
      <button aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button>
    </div>
    {open && <div className="formula-list" onMouseLeave={() => setHighlight(null)}>
      {shown.map(item => <div key={item.key} className={highlight === item.key ? 'formula-item highlighted' : 'formula-item'}
        onMouseEnter={() => setHighlight(item.key)} onFocus={() => setHighlight(item.key)} onBlur={() => setHighlight(null)} tabIndex={0}>
        <span dangerouslySetInnerHTML={{ __html: katex.renderToString(item.tex, { throwOnError: true, displayMode: false }) }} />
        <small>{item.note}</small>
      </div>)}
    </div>}
  </footer>
}
