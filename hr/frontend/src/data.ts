import { Candidate } from './types';

export const candidates: Candidate[] = [
  {
    "id": "1",
    "name": "John Doe",
    "photo": "https://randomuser.me/api/portraits/men/1.jpg",
    "role": "Senior Software Engineer",
    "yearsOfExperience": 4,
    "email": "johndoe@example.com",
    "phone": "+1-234-567-8900",
    "field": "Software Engineering",
    "skills": ["JavaScript", "React", "Node.js", "MongoDB"],
    "experience": ["Led development of multiple web applications", "Implemented responsive UI components", "Optimized database queries for better performance"],
    "rightSwipes": 15,
    "leftSwipes": 3,
    "reviews": ["Excellent team player", "Very punctual", "Strong technical skills"],
    "level": 2,
    "education": [
      {
        "college": "ABC University",
        "degree": "Bachelor of Technology",
        "branchOfStudy": "Computer Science",
        "yearOfGraduation": 2020,
        "gpa": 8.7
      },
      {
        "college": "XYZ Institute of Technology",
        "degree": "Master of Science",
        "branchOfStudy": "Software Systems",
        "yearOfGraduation": 2022,
        "gpa": 9.1
      }
    ],
    "previousExperience": [
      {
        "company": "Tech Solutions Inc.",
        "role": "Frontend Developer",
        "duration": "2 years",
        "responsibilities": [
          "Developed responsive UI components",
          "Collaborated with design and backend teams",
          "Maintained code quality and conducted peer reviews"
        ]
      },
      {
        "company": "Tech Solutions Inc.",
        "role": "Frontend Developer",
        "duration": "2 years",
        "responsibilities": [
          "Developed responsive UI components",
          "Collaborated with design and backend teams",
          "Maintained code quality and conducted peer reviews"
        ]
      },
      {
        "company": "Innovatech Pvt Ltd",
        "role": "Full Stack Developer",
        "duration": "1.5 years",
        "responsibilities": [
          "Led full-stack development projects",
          "Implemented RESTful APIs",
          "Integrated third-party services and analytics"
        ]
      }
    ]
  }
];