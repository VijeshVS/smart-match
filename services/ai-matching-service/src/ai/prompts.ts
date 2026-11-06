import { TALENT_LEVEL_LABELS, type TalentLensFilters } from '@talent-ai/shared-types';
import type { AiProfile } from './types.js';

function compactProfile(profile: AiProfile): Record<string, unknown> {
  return {
    name: profile.name,
    field: profile.field,
    level: TALENT_LEVEL_LABELS[profile.level],
    experienceYears: profile.experienceYears,
    skills: profile.skills,
    education: (profile.education ?? []).map((entry) => ({
      degree: entry.degree,
      branchOfStudy: entry.branchOfStudy,
      college: entry.college,
      yearOfGraduation: entry.yearOfGraduation,
      ...(entry.gpa === undefined ? {} : { gpa: entry.gpa }),
    })),
    previousExperience: (profile.previousExperience ?? []).map((entry) => ({
      company: entry.company,
      role: entry.role,
      durationMonths: entry.durationMonths,
      responsibilities: entry.responsibilities,
    })),
    bio: profile.bio ?? null,
  };
}

export const SUMMARY_SYSTEM = `You are a senior technical recruiter for talent.ai.
Write a concise, factual candidate profile summary for a recruiter.
Do not invent skills, employers, degrees or achievements that are not in the profile.
Return only valid JSON with this exact shape:
{"summary":["bullet 1","bullet 2","bullet 3"]}
Use 3 to 5 bullets. Each bullet must be one sentence under 180 characters.`;

export function summaryPrompt(profile: AiProfile): string {
  return `Summarise this candidate profile:\n${JSON.stringify(compactProfile(profile), null, 2)}`;
}

export const SUGGESTIONS_SYSTEM = `You are a career coach for talent.ai.
Give personalised, actionable recommendations that help a candidate improve their
profile and career prospects. Ground every recommendation in the supplied skills,
experience, education and optional recruiter reviews. Never invent credentials.
Return only valid JSON with this exact shape:
{"suggestions":["recommendation 1","recommendation 2"]}
Use 4 to 6 recommendations. Each recommendation must be one specific action under
220 characters.`;

export function suggestionsPrompt(profile: AiProfile, reviews: string[]): string {
  return `Candidate profile:\n${JSON.stringify(compactProfile(profile), null, 2)}\n\nRecruiter reviews:\n${
    reviews.length > 0 ? reviews.map((review) => `- ${review}`).join('\n') : 'None provided'
  }`;
}

export const QUERY_SYSTEM = `You convert a recruiter's natural-language hiring prompt into a semantic
search query plus structured metadata filters. Allowed levels are LEVEL_1_ENTRY,
LEVEL_2_MID and LEVEL_3_LEAD. Only include filters that the prompt clearly implies.
Return only valid JSON with this exact shape:
{"semanticQuery":"search text","filters":{"skills":["..."],"level":"LEVEL_2_MID","minExperienceYears":3,"maxExperienceYears":8,"field":"..."}}
Omit filters that are not implied. Do not invent skills the recruiter did not mention.`;

export function queryPrompt(query: string, filters: TalentLensFilters): string {
  return `Recruiter prompt: ${query}\nExplicit filters already supplied: ${JSON.stringify(filters)}`;
}

export const RERANK_SYSTEM = `You score how well one candidate matches a recruiter's hiring prompt.
Be strict and evidence-based. Return only valid JSON with this exact shape:
{"score":0.0,"matchedSkills":["..."],"strengths":["..."],"rationale":"one sentence"}
score must be between 0 and 1. matchedSkills must only contain skills present on
the profile. strengths should be short phrases. rationale must be under 200 characters.`;

export function rerankPrompt(query: string, profile: AiProfile): string {
  return `Hiring prompt: ${query}\n\nCandidate:\n${JSON.stringify(
    compactProfile(profile),
    null,
    2,
  )}`;
}
