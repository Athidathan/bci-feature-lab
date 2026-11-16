import type { SessionMetadata } from '../api/client'

export type TabId = 'epochs' | 'spectra' | 'features'
export type AppState = {
  session: SessionMetadata | null
  activeTab: TabId
  keptClasses: number[]
  pair: [number, number] | null
  channel: string
  channels: string[]
  selectedFeatures: string[]
  selectedFeatureFisherJ: number
  error: string
  busy: boolean
}

export function stateForSession(session: SessionMetadata, activeTab: TabId = 'epochs'): AppState {
  const keptClasses = session.classes.map(item => item.event_id)
  return {
    session, activeTab, keptClasses,
    pair: keptClasses.length >= 2 ? [keptClasses[0], keptClasses[1]] : null,
    channel: session.channels[0] ?? '',
    channels: [...session.channels],
    selectedFeatures: [], selectedFeatureFisherJ: 0, error: '', busy: false,
  }
}
