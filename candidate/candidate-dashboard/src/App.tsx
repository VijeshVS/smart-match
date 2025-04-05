import React, { useState } from 'react';
import { UserCircle, ThumbsUp, ThumbsDown, TrendingUp, Mail, Phone, Code, Briefcase, GraduationCap, X, Lightbulb } from 'lucide-react';
import axios from 'axios';
import { CheckCircle, XCircle } from 'lucide-react';
interface Education {
  college: string;
  degree: string;
  branchOfStudy: string;
  yearOfGraduation: number;
  gpa: number;
  _id: string;
}

interface Experience {
  company: string;
  role: string;
  duration: string;
  responsibilities: string[];
  _id: string;
}

interface UserData {
  _id: string;
  name: string;
  email: string;
  phone: string;
  field: string;
  skills: string[];
  experience: number;
  rightSwipes: number;
  leftSwipes: number;
  reviews: string[];
  level: number;
  education: Education[];
  previousExperience: Experience[];
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
}

interface ReviewCardProps {
  review: string;
}

interface EducationCardProps {
  education: Education;
}

interface ExperienceCardProps {
  experience: Experience;
}

interface ContactInfoProps {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
}

interface SuggestionCardProps {
  title: string;
  suggestions: string[];
}

function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
        <Icon className="text-blue-500" size={24} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function ReviewCard({ review }: ReviewCardProps) {
  const isApproved = review.swipe === 'approve';
  const borderColor = isApproved ? 'border-green-500' : 'border-red-500';
  const iconColor = isApproved ? 'text-green-500' : 'text-red-500';
  const label = isApproved ? 'Approved' : 'Rejected';
  const Icon = isApproved ? CheckCircle : XCircle;

  return (
    <div
      className={`bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border-l-4 ${borderColor} mb-4`}
    >
      <div className="flex items-center mb-3">
        <Icon className={`w-5 h-5 mr-2 ${iconColor}`} />
        <span className={`text-sm font-medium ${iconColor}`}>{label}</span>
      </div>
      <p className="text-gray-700 leading-relaxed text-base">{review.comment}</p>
    </div>
  );
}


function EducationCard({ education }: EducationCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 mb-4">
      <div className="flex items-center space-x-2 mb-3">
        <GraduationCap className="text-blue-500" />
        <h4 className="font-semibold text-gray-800">{education.college}</h4>
      </div>
      <div className="space-y-2 text-gray-600">
        <p><span className="font-medium">Degree:</span> {education.degree} in {education.branchOfStudy}</p>
        <p><span className="font-medium">Graduation Year:</span> {education.yearOfGraduation}</p>
        <p><span className="font-medium">GPA:</span> {education.gpa}</p>
      </div>
    </div>
  );
}

function ExperienceCard({ experience }: ExperienceCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 mb-4">
      <div className="flex items-center space-x-2 mb-3">
        <Briefcase className="text-blue-500" />
        <h4 className="font-semibold text-gray-800">{experience.company}</h4>
      </div>
      <div className="space-y-2 text-gray-600">
        <p><span className="font-medium">Role:</span> {experience.role}</p>
        <p><span className="font-medium">Duration:</span> {experience.duration}</p>
        <div>
          <p className="font-medium mb-1">Responsibilities:</p>
          <ul className="list-disc list-inside pl-2">
            {experience.responsibilities.map((resp, index) => (
              <li key={index}>{resp}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ContactInfo({ icon: Icon, label, value }: ContactInfoProps) {
  return (
    <div className="flex items-center space-x-3 text-gray-600">
      <Icon size={20} className="text-blue-500" />
      <span className="font-medium">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function SuggestionCard({ title, suggestions }: SuggestionCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 mb-4">
      <div className="flex items-center space-x-2 mb-4">
        <Lightbulb className="text-yellow-500" size={24} />
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      </div>
      <ul className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <li key={index} className="flex items-start space-x-2">
            <span className="text-yellow-500 mt-1">•</span>
            <span className="text-gray-600">{suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


function App() {
  const [email, setEmail] = useState('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [summary,setSummary] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:3000/api/candidates');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const data = await response.json();
      const user = data.find((u: UserData) => u.email.toLowerCase() === email.toLowerCase());

      console.log(user)

      const res = await axios.post('http://localhost:3000/suggestProfile',{
        profile: user
      })
      const res2 = await axios.post('http://localhost:3000/summariseProfile',{
        profile: user
      })

      setSuggestions(res.data.suggestions);
      setSummary(res2.data.summary);

      console.log(user)

      if (user) {
        setUserData(user);
        setIsModalOpen(false);
      } else {
        setError('No user found with this email');
        setUserData(null);
      }
    } catch (err) {
      setError('Failed to fetch user data');
      setUserData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Your Dashboard</h2>
          <p className="text-gray-600">Enter your email to view your profile</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            className="w-full px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Searching...' : 'View Profile'}
          </button>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
      </Modal>

      {userData && (
        <>
          <div className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex items-center space-x-4 mb-4 md:mb-0">
                  <div className="bg-blue-50 p-3 rounded-xl">
                    <UserCircle size={48} className="text-blue-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{userData.name}</h1>
                    <div className="flex items-center space-x-2 mt-1">
                      <Code size={16} className="text-blue-500" />
                      <span className="text-blue-600 font-medium">{userData.field}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <ContactInfo icon={Mail} label="Email" value={userData.email} />
                  <ContactInfo icon={Phone} label="Phone" value={userData.phone} />
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard 
                title="Approvals" 
                value={userData.rightSwipes}
                icon={ThumbsUp}
              />
              <StatCard 
                title="Rejections" 
                value={userData.leftSwipes}
                icon={ThumbsDown}
              />
              <StatCard 
                title="Experience" 
                value={`${userData.experience} years`}
                icon={TrendingUp}
              />
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {userData.skills.map((skill, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
              
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Summary</h2>
              <SuggestionCard
                title="Concised Summary"
                suggestions={summary}
              />
            </div>  

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Suggestions</h2>
              <SuggestionCard
                title="Areas for Improvement"
                suggestions={suggestions}
              />
            </div>

            

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Education</h2>
                {userData.education.map((edu, index) => (
                  <EducationCard key={index} education={edu} />
                ))}

                <h2 className="text-xl font-semibold text-gray-900 mb-4 mt-8">Experience</h2>
                {userData.previousExperience.map((exp, index) => (
                  <ExperienceCard key={index} experience={exp} />
                ))}
              </div>

              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Reviews</h2>
                {userData.reviews && userData.reviews.length > 0 ? (
                  userData.reviews.map((review, index) => (
                    <ReviewCard key={index} review={review} />
                  ))
                ) : (
                  <p className="text-gray-600">No reviews yet</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;