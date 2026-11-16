export type ClassInfo = { name: string; event_id: number; count: number }
export type SessionMetadata = {
  id: string; source: 'sample' | 'upload'; original_filename: string; sfreq: number
  tmin: number; tmax: number; n_samples: number; channels: string[]
  channel_pos: Record<string, [number, number]>; classes: ClassInfo[]
  highpass: number | null; lowpass: number | null; line_freq: number | null; warnings: string[]
}
export type SampleInfo = { id: string; title: string; description: string; has_challenges: boolean }
export type FeatureSpec = {
  kind: 'band_power' | 'time' | 'csp'; channel?: string; band?: [number, number]
  relative?: boolean; log10?: boolean; feature?: string; window?: [number, number]
  channels?: string[]; component?: number
}
export type PSDResponse = { channel: string; freqs: number[]; series: { event_id: number; name: string; mean_psd: number[] }[] }
export type TFResponse = { channel: string; freqs: number[]; times: number[]; baseline: [number, number]; warnings: string[]; panels: { event_id: number; name: string; erd_ers: number[][] }[] }
export type CSPResponse = { class_a: number; class_b: number; channels: string[]; filters: number[][]; eigenvalues: number[]; patterns: number[][]; features: number[][] }
export type FeatureResponse = { keys: string[]; values: number[][]; labels: number[]; classes: ClassInfo[]; pair: [number, number]; fisher_j: number; fisher_scores: number[]; silhouette: number }
export type Candidate = { key: string; spec: FeatureSpec; fisher_j?: number }
export type DistributionResponse = { key: string; classes: { event_id: number; name: string; values: number[] }[] }
export type EpochSignal = { trial: number; event_id: number; channels: string[]; sfreq: number; tmin: number; times: number[]; values: number[][] }
export type ExportConfig = { specs: FeatureSpec[]; classes: number[]; pair: [number, number] }
export type ApiError = { error?: string; detail?: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    let message = response.statusText
    try {
      const body = await response.json() as ApiError
      message = body.detail ?? body.error ?? message
    } catch { /* keep the HTTP status message */ }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

async function requestText(path: string): Promise<string> {
  const response = await fetch(path)
  if (!response.ok) {
    const body = await response.json() as ApiError
    throw new Error(body.detail ?? body.error ?? response.statusText)
  }
  return response.text()
}

export const api = {
  health: () => request<{ ok: boolean }>('/api/health'),
  samples: () => request<SampleInfo[]>('/api/samples'),
  session: () => request<SessionMetadata>('/api/session'),
  epoch: (trial: number, channels: string[]) => request<EpochSignal>(`/api/session/epoch?${new URLSearchParams([['trial', String(trial)], ...channels.map(name => ['channels', name])])}`),
  loadSample: (id: string) => request<SessionMetadata>(`/api/samples/${encodeURIComponent(id)}/load`, { method: 'POST' }),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<SessionMetadata>('/api/upload', { method: 'POST', body: form })
  },
  psd: (channel: string, classes: number[]) => request<PSDResponse>(`/api/session/psd?${new URLSearchParams([['channel', channel], ...classes.map(id => ['classes', String(id)])])}`),
  tf: (body: { channel: string; classes: number[]; baseline: [number, number] | null; freq_range: [number, number] }) =>
    request<TFResponse>('/api/session/tf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  csp: (body: { class_a: number; class_b: number; channels: string[]; m?: number }) =>
    request<CSPResponse>('/api/session/csp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  candidates: (a: number, b: number, channels: string[]) => {
    const q = new URLSearchParams({ class_a: String(a), class_b: String(b) })
    channels.forEach(channel => q.append('channels', channel))
    return request<{ features: { key: string; spec: FeatureSpec }[] }>(`/api/session/feature-candidates?${q}`)
  },
  ranking: (classes: number[], pair: [number, number], channels: string[]) =>
    request<{ features: Candidate[] }>('/api/session/feature-ranking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classes, pair, channels }) }),
  features: (body: { specs: FeatureSpec[]; classes: number[]; pair: [number, number] }) =>
    request<FeatureResponse>('/api/session/features', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  distributions: (body: { spec: FeatureSpec; classes: number[]; pair: [number, number] }) =>
    request<DistributionResponse>('/api/session/distributions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  exportPython: (config: ExportConfig) => {
    const query = new URLSearchParams({ class_a: String(config.pair[0]), class_b: String(config.pair[1]), specs: JSON.stringify(config.specs) })
    config.classes.forEach(id => query.append('classes', String(id)))
    return requestText('/api/session/export?' + query.toString())
  },
  topomap: (body: { class_a: number; class_b: number; channels: string[]; filter_index: number }) =>
    request<{ png_base64: string }>('/api/session/topomap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
}
