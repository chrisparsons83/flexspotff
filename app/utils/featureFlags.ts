/**
 * Every flag the site knows about. The key is what is stored; the label and
 * description are what the admin Data Updates page shows beside the toggle.
 */
export const FEATURE_FLAGS = {
  memberProfiles: {
    label: 'Member Profiles',
    description:
      'Opens /members profile pages, and the links to them from standings, ' +
      'leaderboards and records, to every signed-in member. While off, only ' +
      'admins can see them.',
  },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export const isFeatureFlagKey = (key: string): key is FeatureFlagKey =>
  Object.hasOwn(FEATURE_FLAGS, key);
