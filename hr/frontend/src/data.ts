import { Candidate } from './types';

export const candidates: Candidate[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    photo: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e',
    role: 'Senior Frontend Developer',
    experience: [
      'Led frontend development at Tesla',
      'Built scalable React applications at Google',
      'Developed component libraries used by 100+ teams'
    ],
    skills: ['React', 'TypeScript', 'GraphQL', 'Next.js', 'TailwindCSS'],
    yearsOfExperience: 8
  },
  {
    id: '2',
    name: 'Michael Rodriguez',
    photo: 'https://images.unsplash.com/photo-1556157382-97eda2f9e2bf',
    role: 'Full Stack Engineer',
    experience: [
      'Backend architect at Stripe',
      'Full stack developer at Airbnb',
      'Created high-performance APIs serving millions of users'
    ],
    skills: ['Node.js', 'Python', 'React', 'AWS', 'MongoDB'],
    yearsOfExperience: 6
  },
  {
    id: '3',
    name: 'Emily Watson',
    photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956',
    role: 'DevOps Engineer',
    experience: [
      'Lead DevOps at Netflix',
      'Infrastructure automation at Amazon',
      'Implemented CI/CD pipelines for 200+ services'
    ],
    skills: ['Kubernetes', 'Docker', 'AWS', 'Terraform', 'Jenkins'],
    yearsOfExperience: 7
  }
];