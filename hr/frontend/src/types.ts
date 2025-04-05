export interface Candidate {
  id: string;
  name: string;
  photo: string;
  role: string;
  skills: string[];
  experience: number;
  email?: string;
  phone?: string;
  field?: string;
  rightSwipes?: number;
  leftSwipes?: number;
  reviews?: string[];
  level?: number;
  education?: {
    college: string;
    degree: string;
    branchOfStudy: string;
    yearOfGraduation: number;
    gpa: number;
  }[];
  previousExperience?: {
    company: string;
    role: string;
    duration: string;
    responsibilities: string[];
  }[];
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