export type ChallengeContext = {
  sampleId: string
  keptClasses: number[]
  selectedFeatureKeys: string[]
  selectedFeatureBestJ: number
  pair: [number, number] | null
}

export type Challenge = {
  id: string
  text: string
  check: (context: ChallengeContext) => boolean
}

// Tuned against the bundled sample files. Values refer to analysis features, not classification accuracy.
export const challengesBySample: Record<string, Challenge[]> = {
  user_demo: [
    {
      id: 'pair',
      text: 'Keep Right Hand and Feet to compare this motor imagery pair.',
      check: context => context.keptClasses.length === 2 && context.keptClasses.includes(1) && context.keptClasses.includes(2),
    },
    {
      id: 'mu',
      text: 'In Features, select CP3 mu relative from the Fisher ranking.',
      check: context => context.pair?.[0] === 1 && context.pair?.[1] === 2 && context.selectedFeatureKeys.includes('CP3 mu relative'),
    },
    {
      id: 'fisher',
      text: 'Read its Fisher J in the ranking: the sample value is above 2.',
      check: context => context.pair?.[0] === 1 && context.pair?.[1] === 2 && context.selectedFeatureBestJ >= 2,
    },
  ],
  physionet_mi_s01: [
    {
      id: 'pair',
      text: 'Keep Both Hands and Feet to compare this motor imagery pair.',
      check: context => context.keptClasses.length === 2 && context.keptClasses.includes(3) && context.keptClasses.includes(4),
    },
    {
      id: 'csp',
      text: 'In Features, select CSP component 1 from the Fisher ranking.',
      check: context => context.pair?.[0] === 3 && context.pair?.[1] === 4 && context.selectedFeatureKeys.includes('CSP component 1 (selected pair)'),
    },
    {
      id: 'fisher',
      text: 'Read its Fisher J in the ranking: the sample value is above 5.',
      check: context => context.pair?.[0] === 3 && context.pair?.[1] === 4 && context.selectedFeatureBestJ >= 5,
    },
  ],
}
