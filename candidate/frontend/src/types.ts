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

export interface UserData {
  name: string;
  role: string;
  yearsOfExperience: number;
  email: string;
  phone: string;
  field: string;
  skills: string[];
  experience: string[];
  level: number;
  education: Education[];
  previousExperience: Experience[];
}