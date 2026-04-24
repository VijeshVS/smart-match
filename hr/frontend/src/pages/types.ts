export interface Education {
  college: string;
  degree: string;
  branchOfStudy: string;
  yearOfGraduation: number;
  gpa: number;
  _id?: string;
}

export interface Experience {
  company: string;
  role: string;
  duration: string;
  responsibilities: string[];
  _id?: string;
}

export interface ReviewEntry {
  comment: string;
  swipe: 'approve' | 'reject';
}

export interface Candidate {
  _id: string;
  id?: number;
  name: string;
  email: string;
  phone: string;
  field: string;
  skills: string[];
  experience: number;
  rightSwipes: number;
  leftSwipes: number;
  level: number;
  reviews: ReviewEntry[];
  education: Education[];
  previousExperience: Experience[];
  position?: string;
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
