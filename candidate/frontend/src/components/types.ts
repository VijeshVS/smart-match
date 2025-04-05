export interface Education {
  college: string;
  degree: string;
  branchOfStudy: string;
  yearOfGraduation: number;
  gpa: number;
}

export interface Experience {
  company: string;
  role: string;
  duration: string;
  responsibilities: string[];
}

export interface CandidateData {
  name: string;
  email: string;
  phone: string;
  field: string;
  skills: string[];
  experience: number;
  education: Education[];
  previousExperience: Experience[];
}
