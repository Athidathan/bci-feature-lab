import type { SessionMetadata } from '../api/client'

export function FileInfo({ session }: { session: SessionMetadata }) {
  const duration = session.tmax - session.tmin
  return <div className="file-info">
    <strong>{session.original_filename}</strong>
    <span className="mono">{session.sfreq} Hz · {session.channels.length} EEG · {duration.toFixed(1)} s per epoch</span>
    <span className="mono">Filter {session.highpass ?? '—'}–{session.lowpass ?? '—'} Hz · Line {session.line_freq ?? 'not stored'}</span>
  </div>
}
