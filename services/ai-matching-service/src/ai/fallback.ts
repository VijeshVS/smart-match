import {
  TALENT_LEVEL_LABELS,
  type TalentLensFilters,
  type TalentLevel,
} from '@talent-ai/shared-types';
import type { AiProfile, QueryInterpretation, RerankResult } from './types.js';

/**
 * Canonical technology / domain vocabulary used by the deterministic engine.
 * Keys are lowercase; values preserve the casing stored on profiles.
 */
const SKILL_VOCABULARY: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  react: 'React',
  'react native': 'React Native',
  'next.js': 'Next.js',
  nextjs: 'Next.js',
  vue: 'Vue',
  angular: 'Angular',
  svelte: 'Svelte',
  'node.js': 'Node.js',
  nodejs: 'Node.js',
  node: 'Node.js',
  express: 'Express',
  nestjs: 'NestJS',
  graphql: 'GraphQL',
  rest: 'REST',
  html: 'HTML',
  css: 'CSS',
  tailwind: 'Tailwind CSS',
  python: 'Python',
  django: 'Django',
  flask: 'Flask',
  fastapi: 'FastAPI',
  java: 'Java',
  spring: 'Spring',
  kotlin: 'Kotlin',
  go: 'Go',
  golang: 'Go',
  rust: 'Rust',
  'c++': 'C++',
  'c#': 'C#',
  '.net': '.NET',
  php: 'PHP',
  laravel: 'Laravel',
  ruby: 'Ruby',
  rails: 'Ruby on Rails',
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'GCP',
  'google cloud': 'GCP',
  terraform: 'Terraform',
  kubernetes: 'Kubernetes',
  k8s: 'Kubernetes',
  docker: 'Docker',
  devops: 'DevOps',
  'ci/cd': 'CI/CD',
  jenkins: 'Jenkins',
  'github actions': 'GitHub Actions',
  linux: 'Linux',
  sql: 'SQL',
  postgresql: 'PostgreSQL',
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
  redis: 'Redis',
  kafka: 'Kafka',
  rabbitmq: 'RabbitMQ',
  microservices: 'Microservices',
  'machine learning': 'Machine Learning',
  ml: 'Machine Learning',
  ai: 'Artificial Intelligence',
  tensorflow: 'TensorFlow',
  pytorch: 'PyTorch',
  pandas: 'Pandas',
  numpy: 'NumPy',
  'data science': 'Data Science',
  analytics: 'Analytics',
  tableau: 'Tableau',
  'power bi': 'Power BI',
  figma: 'Figma',
  'ui/ux': 'UI/UX',
  'product management': 'Product Management',
  agile: 'Agile',
  scrum: 'Scrum',
  salesforce: 'Salesforce',
  sap: 'SAP',
  seo: 'SEO',
  'content marketing': 'Content Marketing',
  accounting: 'Accounting',
  finance: 'Finance',
  recruitment: 'Recruitment',
  'human resources': 'Human Resources',
  testing: 'Testing',
  jest: 'Jest',
  vitest: 'Vitest',
  playwright: 'Playwright',
  cypress: 'Cypress',
  security: 'Security',
  observability: 'Observability',
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'is',
  'it',
  'looking',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'want',
  'we',
  'who',
  'with',
  'years',
  'year',
  'yrs',
  'experience',
  'experienced',
  'strong',
]);

const LEVEL_HINTS: Array<{ pattern: RegExp; level: TalentLevel }> = [
  { pattern: /\b(junior|entry[- ]level|fresher|graduate|intern)\b/i, level: 'LEVEL_1_ENTRY' },
  { pattern: /\b(mid|intermediate|pro engineer)\b/i, level: 'LEVEL_2_MID' },
  { pattern: /\b(senior|lead|principal|elite|staff|architect)\b/i, level: 'LEVEL_3_LEAD' },
];

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeForMatching(value: string): string {
  return ` ${value
    .toLowerCase()
    .replace(/[^a-z0-9+#./ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

export function extractSkills(text: string): string[] {
  const normalized = normalizeForMatching(text);
  const found: string[] = [];
  const seen = new Set<string>();

  // Longest keys first so "react native" wins over "react".
  for (const key of Object.keys(SKILL_VOCABULARY).sort((a, b) => b.length - a.length)) {
    if (!normalized.includes(` ${key} `)) continue;
    const canonical = SKILL_VOCABULARY[key];
    if (!canonical) continue;
    const lower = canonical.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    found.push(canonical);
  }

  return found;
}

function extractLevel(text: string): TalentLevel | undefined {
  for (const hint of LEVEL_HINTS) {
    if (hint.pattern.test(text)) return hint.level;
  }
  return undefined;
}

function extractExperienceRange(text: string): {
  minExperienceYears?: number;
  maxExperienceYears?: number;
} {
  const between = text.match(/between\s+(\d{1,2})\s+and\s+(\d{1,2})\s*(?:years|yrs)/i);
  if (between) {
    const first = Number(between[1]);
    const second = Number(between[2]);
    return {
      minExperienceYears: Math.min(first, second),
      maxExperienceYears: Math.max(first, second),
    };
  }

  const range = text.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(?:years|yrs)/i);
  if (range) {
    const first = Number(range[1]);
    const second = Number(range[2]);
    return {
      minExperienceYears: Math.min(first, second),
      maxExperienceYears: Math.max(first, second),
    };
  }

  const single = text.match(/(\d{1,2})\s*(?:\+|plus)?\s*(?:years|yrs)/i);
  if (!single) return {};

  const years = Number(single[1]);
  if (/\b(up to|less than|under|at most|maximum)\b/i.test(text)) {
    return { maxExperienceYears: years };
  }
  return { minExperienceYears: years };
}

/**
 * Deterministic interpretation of a recruiter prompt. Explicit filters always
 * win over inferred values.
 */
export function extractQueryFilters(
  query: string,
  explicitFilters: TalentLensFilters = {},
): QueryInterpretation {
  const filters: TalentLensFilters = { ...explicitFilters };
  const extractedSkills = extractSkills(query);

  if ((!filters.skills || filters.skills.length === 0) && extractedSkills.length > 0) {
    filters.skills = extractedSkills.slice(0, 10);
  }

  if (!filters.level) {
    const level = extractLevel(query);
    if (level) filters.level = level;
  }

  const range = extractExperienceRange(query);
  if (filters.minExperienceYears === undefined && range.minExperienceYears !== undefined) {
    filters.minExperienceYears = range.minExperienceYears;
  }
  if (filters.maxExperienceYears === undefined && range.maxExperienceYears !== undefined) {
    filters.maxExperienceYears = range.maxExperienceYears;
  }

  if (
    filters.minExperienceYears !== undefined &&
    filters.maxExperienceYears !== undefined &&
    filters.minExperienceYears > filters.maxExperienceYears
  ) {
    delete filters.minExperienceYears;
    delete filters.maxExperienceYears;
  }

  const semanticQuery = [query, ...(filters.skills ?? [])].join(' ').trim();

  return { semanticQuery, filters };
}

function educationSummary(profile: AiProfile): string | undefined {
  const education = profile.education ?? [];
  if (education.length === 0) return undefined;
  const first = education[0];
  if (!first) return undefined;
  return `Education: ${first.degree} in ${first.branchOfStudy} from ${first.college}.`;
}

function experienceSummary(profile: AiProfile): string | undefined {
  const experience = profile.previousExperience ?? [];
  if (experience.length === 0) return undefined;
  const first = experience[0];
  if (!first) return undefined;
  return `Recent role: ${first.role} at ${first.company} (${first.durationMonths} months).`;
}

/** Deterministic profile summary used when the provider circuit is open. */
export function localSummary(profile: AiProfile): string[] {
  const levelLabel = TALENT_LEVEL_LABELS[profile.level];
  const topSkills = profile.skills.slice(0, 6).join(', ');

  const summary = [
    `${profile.name} is a ${levelLabel} ${profile.field} professional with ${profile.experienceYears} years of experience.`,
    topSkills
      ? `Core skills include ${topSkills}.`
      : 'No technical skills are listed on the profile yet.',
  ];

  const education = educationSummary(profile);
  if (education) summary.push(education);

  const experience = experienceSummary(profile);
  if (experience) summary.push(experience);

  if (profile.bio && profile.bio.trim().length > 0) {
    summary.push(profile.bio.trim().slice(0, 220));
  } else if (profile.skills.length >= 8) {
    summary.push(
      `Broad skill coverage across ${profile.skills.length} technologies with a ${profile.field} focus.`,
    );
  }

  return summary.slice(0, 5);
}

/** Deterministic, actionable career suggestions. */
export function localSuggestions(profile: AiProfile, reviews: string[] = []): string[] {
  const suggestions: string[] = [];
  const skills = new Set(profile.skills.map((skill) => skill.toLowerCase()));
  const hasCloud = ['aws', 'azure', 'gcp', 'google cloud'].some((skill) => skills.has(skill));

  if (profile.bio === undefined || profile.bio.trim().length < 40) {
    suggestions.push(
      'Add a concise professional summary that states your specialisation, strongest impact and the roles you want next.',
    );
  }

  if (!hasCloud) {
    suggestions.push(
      'Add a cloud platform (AWS, Azure or GCP) to your core skills and back it with one deployed project.',
    );
  }

  if (skills.size < 6) {
    suggestions.push(
      'Broaden your core stack with two adjacent technologies that appear in target job descriptions.',
    );
  }

  if ((profile.education ?? []).length === 0) {
    suggestions.push(
      'Add your education or equivalent certifications so recruiters can verify your background.',
    );
  }

  if ((profile.previousExperience ?? []).length === 0) {
    suggestions.push(
      'Add at least one role with measurable outcomes — scope, technologies and business impact.',
    );
  } else {
    suggestions.push(
      'Rewrite experience bullets to quantify impact (latency, revenue, users or cost) instead of listing duties.',
    );
  }

  if (!skills.has('testing') && !skills.has('jest') && !skills.has('vitest')) {
    suggestions.push(
      'Show evidence of automated testing (Jest, Vitest or Playwright) in a public project.',
    );
  }

  const actionableReview = reviews
    .map((review) => review.trim())
    .find((review) => review.length > 0);
  if (actionableReview) {
    suggestions.push(`Address recurring review feedback: "${actionableReview.slice(0, 140)}"`);
  }

  suggestions.push(
    `Target ${TALENT_LEVEL_LABELS[profile.level]} roles in ${profile.field} and mirror their vocabulary in your profile.`,
  );

  return [...new Set(suggestions)].slice(0, 6);
}

/**
 * Lexical reranker used as the deterministic fallback for provider scoring.
 * Skill overlap dominates; experience and level only nudge the score.
 */
export function localRerank(
  query: string,
  profile: AiProfile,
  filters: TalentLensFilters = {},
): RerankResult {
  const queryTerms = tokenize(query);
  const extractedSkills = extractSkills(query);
  const profileSkillsLower = new Map(profile.skills.map((skill) => [skill.toLowerCase(), skill]));

  const matchedSkills = extractedSkills.filter((skill) =>
    profileSkillsLower.has(skill.toLowerCase()),
  );

  if (matchedSkills.length === 0) {
    for (const skill of profile.skills) {
      const normalized = normalizeForMatching(skill);
      if (queryTerms.some((term) => normalized.includes(` ${term} `))) {
        matchedSkills.push(skill);
      }
    }
  }

  const profileText = [
    profile.name,
    profile.field,
    ...profile.skills,
    profile.bio ?? '',
    ...(profile.previousExperience ?? []).flatMap((entry) => [
      entry.role,
      entry.company,
      ...entry.responsibilities,
    ]),
  ].join(' ');

  const profileTerms = new Set(tokenize(profileText));
  const commonTerms = queryTerms.filter((term) => profileTerms.has(term));
  const lexicalScore = queryTerms.length === 0 ? 0 : commonTerms.length / queryTerms.length;
  const skillScore =
    extractedSkills.length === 0
      ? lexicalScore
      : matchedSkills.length / Math.max(1, extractedSkills.length);

  let experienceScore = 0.5;
  if (filters.minExperienceYears !== undefined || filters.maxExperienceYears !== undefined) {
    const min = filters.minExperienceYears ?? 0;
    const max = filters.maxExperienceYears ?? 60;
    experienceScore = profile.experienceYears >= min && profile.experienceYears <= max ? 1 : 0;
  }

  const levelScore = filters.level === undefined ? 0.5 : profile.level === filters.level ? 1 : 0;

  const score = clamp(
    0.12 + 0.58 * skillScore + 0.18 * lexicalScore + 0.07 * experienceScore + 0.05 * levelScore,
  );

  const strengths = [
    ...matchedSkills.slice(0, 3).map((skill) => `Hands-on ${skill}`),
    `${profile.experienceYears} years in ${profile.field}`,
    TALENT_LEVEL_LABELS[profile.level],
  ].slice(0, 4);

  const rationale =
    matchedSkills.length > 0
      ? `Direct overlap with ${matchedSkills.slice(0, 4).join(', ')} and ${profile.experienceYears} years of ${profile.field} experience.`
      : `Adjacent ${profile.field} background with ${
          profile.skills.slice(0, 3).join(', ') || 'transferable skills'
        }.`;

  return {
    score: Number(score.toFixed(4)),
    matchedSkills: [...new Set(matchedSkills)].slice(0, 8),
    strengths,
    rationale,
  };
}
