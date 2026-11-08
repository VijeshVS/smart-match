import { createHash } from 'node:crypto';

/**
 * Mirrors the AI service's deterministic local embedding provider
 * (`services/ai-matching-service/src/ai/embedding.ts`), so seeded Qdrant
 * points are searchable with the offline `EMBEDDING_PROVIDER=local` default.
 */
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

function tokenize(value) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function hashToken(token) {
  return createHash('sha256').update(token).digest().readUInt32BE(0);
}

function normalize(vector) {
  let magnitude = 0;
  for (const value of vector) magnitude += value * value;
  magnitude = Math.sqrt(magnitude);

  if (magnitude === 0) {
    return vector.map((_, index) => (index === 0 ? 1 : 0));
  }

  return vector.map((value) => value / magnitude);
}

export function buildEmbeddingText(profile) {
  const education = (profile.education ?? [])
    .map((entry) => `${entry.degree} in ${entry.branchOfStudy} from ${entry.college}`)
    .join('; ');
  const experience = (profile.previousExperience ?? [])
    .map((entry) => `${entry.role} at ${entry.company}: ${entry.responsibilities.join(', ')}`)
    .join('; ');

  return [
    `Candidate: ${profile.name}`,
    `Field: ${profile.field}`,
    `Level: ${profile.level}`,
    `Experience: ${profile.experienceYears} years`,
    `Skills: ${profile.skills.join(', ')}`,
    education ? `Education: ${education}` : '',
    experience ? `Experience history: ${experience}` : '',
    profile.bio ? `Bio: ${profile.bio}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function localEmbedding(text, dimensions) {
  const vector = new Array(dimensions).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    vector[hashToken(token) % dimensions] += 1;
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const bigram = `${tokens[index]} ${tokens[index + 1]}`;
    vector[hashToken(bigram) % dimensions] += 0.5;
  }

  return normalize(vector);
}
