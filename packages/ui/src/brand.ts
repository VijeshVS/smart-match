import type { TalentLevel } from '@talent-ai/shared-types';

export const BRAND = {
  name: 'talent.ai',
  wordmark: { prefix: 'talent', suffix: '.ai' },
  tagline: 'Intelligent Hiring & Career Acceleration at the Speed of Thought',
  candidatePitch:
    'Accelerate your tech career with AI-driven profile insights and smart matching.',
  recruiterPitch:
    'Discover, evaluate, and hire verified high-signal talent in seconds with AI-assisted review.',
  siteUrl: 'https://talent.ai',
  candidatePortalUrl: 'https://app.talent.ai',
  recruiterPortalUrl: 'https://recruiter.talent.ai',
  adminPortalUrl: 'https://admin.talent.ai',
  apiUrl: 'https://api.talent.ai',
  supportEmail: 'hello@talent.ai',
} as const;

export const FEATURE_NAMES = {
  swipe: 'TalentSwipe™',
  lens: 'TalentLens™',
} as const;

export const CURRENCY = {
  code: 'TC',
  name: 'TalentCredits',
  plural: 'TalentCredits',
} as const;

export interface TalentTierDefinition {
  level: TalentLevel;
  label: string;
  shortLabel: string;
  description: string;
}

export const TALENT_TIERS: Record<TalentLevel, TalentTierDefinition> = {
  LEVEL_1_ENTRY: {
    level: 'LEVEL_1_ENTRY',
    label: 'Junior Fellow',
    shortLabel: 'Tier 1',
    description: 'Early-career talent with strong fundamentals and high growth potential.',
  },
  LEVEL_2_MID: {
    level: 'LEVEL_2_MID',
    label: 'Pro Engineer',
    shortLabel: 'Tier 2',
    description: 'Proven engineers shipping production systems independently.',
  },
  LEVEL_3_LEAD: {
    level: 'LEVEL_3_LEAD',
    label: 'Elite Principal',
    shortLabel: 'Tier 3',
    description: 'Principal-level leaders with deep specialisation and org-wide impact.',
  },
};

export const TALENT_TIER_ORDER: TalentLevel[] = [
  'LEVEL_1_ENTRY',
  'LEVEL_2_MID',
  'LEVEL_3_LEAD',
];
