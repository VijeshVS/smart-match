import type { ISODateString, UUID } from './common.js';
import type { TalentLevel } from './talent.js';

export interface CandidateAnalytics {
  talentId: UUID;
  rightSwipes: number;
  leftSwipes: number;
  acceptanceRatio: number;
  totalReviews: number;
  averageRating?: number;
  updatedAt: ISODateString;
}

export interface FunnelAggregate {
  periodStart: ISODateString;
  periodEnd: ISODateString;
  profilesCreated: number;
  swipesRecorded: number;
  reviewsSubmitted: number;
  tier3Unlocks: number;
  approvalRate: number;
}

export interface SkillAnalytics {
  skill: string;
  demandCount: number;
  supplyCount: number;
  averageExperienceYears: number;
}

export interface RecruiterLeaderboardEntry {
  recruiterId: UUID;
  reviewsSubmitted: number;
  actionableFeedbackCount: number;
  creditsEarned: number;
  rank: number;
}

export interface RecruiterDashboard {
  recruiterId: UUID;
  organizationId?: UUID;
  openJobs: number;
  candidatesReviewed: number;
  approvals: number;
  rejections: number;
  creditsEarned: number;
  averageTimeToMatchHours?: number;
  topSkills: SkillAnalytics[];
  updatedAt: ISODateString;
}

export interface TalentLevelDistribution {
  level: TalentLevel;
  count: number;
}
