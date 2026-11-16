import { useState } from 'react'
import { challengesBySample, type ChallengeContext } from '../challenges/data'

export function ChallengeStrip({ context }: { context: ChallengeContext }) {
  const [open, setOpen] = useState(false)
  const challenges = challengesBySample[context.sampleId]
  if (!challenges) return null
  const done = challenges.filter(challenge => challenge.check(context)).length
  const finished = done >= challenges.length
  const current = challenges[done]
  return <section className="challenge-strip" aria-label="Guided steps for this sample">
    <span className="count">{finished ? 'Done' : `Step ${done + 1} of ${challenges.length}`}</span>
    <p className="text">{finished ? 'All guided steps complete. The selected feature separates this sample pair.' : current.text}</p>
    {finished && <span className="done-note">✓ Complete</span>}
    <details open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{open ? 'Hide steps' : 'All steps'}</summary>
      <ol className="challenge-steps">{challenges.map((challenge, index) => <li key={challenge.id} className={index < done ? 'done' : index === done ? 'current' : ''}>
        <span>{index < done ? '✓' : String(index + 1).padStart(2, '0')}</span>{challenge.text}
      </li>)}</ol>
    </details>
  </section>
}
