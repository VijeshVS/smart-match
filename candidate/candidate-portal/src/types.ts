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

export interface Review {
  swipe: 'approve' | 'reject';
  comment: string;
}

export interface UserData {
  _id: string;
  name: string;
  email: string;
  phone: string;
  field: string;
  skills: string[];
  experience: number;
  rightSwipes: number;
  leftSwipes: number;
  reviews: Review[];
  level: number;
  education: Education[];
  previousExperience: Experience[];
}

export interface FormEducation {
  college: string;
  degree: string;
  branchOfStudy: string;
  yearOfGraduation: number;
  gpa: number;
}

export interface FormExperience {
  company: string;
  role: string;
  duration: string;
  responsibilities: string;
}

export interface FormData {
  name: string;
  email: string;
  phone: string;
  field: string;
  skills: string;
  experience: number;
  education: FormEducation[];
  previousExperience: FormExperience[];
}
