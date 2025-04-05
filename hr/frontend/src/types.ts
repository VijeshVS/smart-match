export interface Candidate {
  id: string;
  name: string;
  photo: string;
  role: string;
  experience: string[];
  skills: string[];
  yearsOfExperience: number;
}

export interface Review {
  candidateId: string;
  decision: 'approve' | 'reject';
  feedback?: string;
}

export interface UserStats {
  coins: number;
  reviewsWithFeedback: number;
  totalReviews: number;
}