import React, { useState, KeyboardEvent } from 'react';
import { ChevronRight, ChevronLeft, GraduationCap, Briefcase, User, X, Plus } from 'lucide-react';
import type { UserData } from '../types';

interface Education {
  college: string;
  degree: string;
  branchOfStudy: string;
  yearOfGraduation: number;
  gpa: number;
}

interface Experience {
  company: string;
  role: string;
  duration: string;
  responsibilities: string[];
}

const OnboardingForm: React.FC = () => {
  const [step, setStep] = useState(1);
  const [currentSkill, setCurrentSkill] = useState('');
  const [formData, setFormData] = useState<UserData>({
    name: '',
    role: '',
    yearsOfExperience: 0,
    email: '',
    phone: '',
    field: '',
    skills: [],
    experience: [],
    level: 1,
    education: [{
      college: '',
      degree: '',
      branchOfStudy: '',
      yearOfGraduation: new Date().getFullYear(),
      gpa: 0
    }],
    previousExperience: [{
      company: '',
      role: '',
      duration: '',
      responsibilities: ['']
    }]
  });

  const handlePersonalDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSkillsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, skills: e.target.value.split(',').map(skill => skill.trim()) });
  };

  const handleEducationChange = (index: number, field: keyof Education, value: string | number) => {
    const newEducation = [...formData.education];
    newEducation[index] = { ...newEducation[index], [field]: value };
    setFormData({ ...formData, education: newEducation });
  };

  const addEducation = () => {
    setFormData({
      ...formData,
      education: [...formData.education, {
        college: '',
        degree: '',
        branchOfStudy: '',
        yearOfGraduation: new Date().getFullYear(),
        gpa: 0
      }]
    });
  };

  const handleExperienceChange = (index: number, field: keyof Experience, value: string | string[]) => {
    const newExperience = [...formData.previousExperience];
    newExperience[index] = { ...newExperience[index], [field]: value };
    setFormData({ ...formData, previousExperience: newExperience });
  };

  const addExperience = () => {
    setFormData({
      ...formData,
      previousExperience: [...formData.previousExperience, {
        company: '',
        role: '',
        duration: '',
        responsibilities: ['']
      }]
    });
  };

  const handleSkillInput = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && currentSkill.trim()) {
      e.preventDefault();
      if (!formData.skills.includes(currentSkill.trim())) {
        setFormData({
          ...formData,
          skills: [...formData.skills, currentSkill.trim()]
        });
      }
      setCurrentSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter(skill => skill !== skillToRemove)
    });
  };

  const addSkill = () => {
    if (currentSkill.trim() && !formData.skills.includes(currentSkill.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, currentSkill.trim()]
      });
      setCurrentSkill('');
    }
  };

  const handleSubmit = async () => {
    try {
      // Replace with your API endpoint
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) throw new Error('Failed to submit');
      
      // Handle success (e.g., redirect or show success message)
      console.log('Submitted successfully');
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf3e8] py-12 px-4 sm:px-6 lg:px-8 font-['Inter']">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-xl rounded-3xl p-8 border border-[#e8d5c4]">
          <div className="mb-10">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                {step === 1 && <User className="w-10 h-10 text-[#6f4e37]" />}
                {step === 2 && <GraduationCap className="w-10 h-10 text-[#6f4e37]" />}
                {step === 3 && <Briefcase className="w-10 h-10 text-[#6f4e37]" />}
                <h2 className="text-4xl font-bold text-[#3c2a21] tracking-tight font-['Space_Grotesk']">
                  {step === 1 && 'Personal Information'}
                  {step === 2 && 'Education Details'}
                  {step === 3 && 'Work Experience'}
                </h2>
              </div>
              <span className="px-6 py-3 bg-gradient-to-r from-[#e8d5c4] to-[#d4b8a5] text-[#3c2a21] rounded-full text-sm font-medium">
                Step {step} of 3
              </span>
            </div>
            
            {step === 1 && (
              <div className="space-y-8">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handlePersonalDataChange}
                    className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">Current Role</label>
                  <input
                    type="text"
                    name="role"
                    value={formData.role}
                    onChange={handlePersonalDataChange}
                    className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                    placeholder="e.g. Senior Software Engineer"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">Years of Experience</label>
                  <input
                    type="number"
                    name="yearsOfExperience"
                    value={formData.yearsOfExperience}
                    onChange={handlePersonalDataChange}
                    min="0"
                    className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                    placeholder="Enter years of experience"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handlePersonalDataChange}
                    className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handlePersonalDataChange}
                    className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-lg font-semibold text-[#3c2a21] mb-2">Technical Skills</label>
                  <div className="flex flex-wrap gap-2 p-2 min-h-[3rem] bg-[#faf3e8] rounded-xl border-2 border-[#e8d5c4] mb-2">
                    {formData.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-[#6f4e37] to-[#8b593e] text-white group hover:from-[#8b593e] hover:to-[#6f4e37] transition-all"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkill(skill)}
                          className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentSkill}
                      onChange={(e) => setCurrentSkill(e.target.value)}
                      onKeyDown={handleSkillInput}
                      className="flex-1 px-4 py-3 rounded-xl border-2 border-[#e8d5c4] bg-[#faf3e8] text-[#3c2a21] placeholder-[#8b593e]/50 focus:border-[#6f4e37] focus:ring-[#6f4e37] text-base transition-colors"
                      placeholder="Type a skill and press Enter"
                    />
                    <button
                      type="button"
                      onClick={addSkill}
                      className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-[#6f4e37] to-[#8b593e] text-white hover:from-[#8b593e] hover:to-[#6f4e37] transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm text-[#8b593e]">Press Enter or click the plus button to add a skill</p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                {formData.education.map((edu, index) => (
                  <div key={index} className="p-6 border border-gray-100 rounded-xl space-y-6 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Education #{index + 1}</h3>
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-medium">{index + 1}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">College/University</label>
                        <input
                          type="text"
                          value={edu.college}
                          onChange={(e) => handleEducationChange(index, 'college', e.target.value)}
                          className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                          placeholder="Enter institution name"
                        />
                      </div>
                      <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">Degree</label>
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => handleEducationChange(index, 'degree', e.target.value)}
                          className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                          placeholder="e.g. Bachelor of Science"
                        />
                      </div>
                      <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">Branch of Study</label>
                        <input
                          type="text"
                          value={edu.branchOfStudy}
                          onChange={(e) => handleEducationChange(index, 'branchOfStudy', e.target.value)}
                          className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                          placeholder="e.g. Computer Science"
                        />
                      </div>
                      <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">Year of Graduation</label>
                        <input
                          type="number"
                          value={edu.yearOfGraduation}
                          min={1900}
                          max={new Date().getFullYear() + 5}
                          onChange={(e) => handleEducationChange(index, 'yearOfGraduation', parseInt(e.target.value))}
                          className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                          placeholder="Enter graduation year"
                        />
                      </div>
                      <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">GPA</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="10"
                          value={edu.gpa}
                          onChange={(e) => handleEducationChange(index, 'gpa', parseFloat(e.target.value))}
                          className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                          placeholder="Enter GPA"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEducation}
                  className="mt-6 inline-flex items-center px-6 py-3 border border-gray-200 text-base font-medium rounded-xl text-blue-600 bg-white hover:bg-blue-50 transition-colors"
                >
                  + Add Another Education
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8">
                {formData.previousExperience.map((exp, index) => (
                  <div key={index} className="p-6 border border-gray-100 rounded-xl space-y-6 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Experience #{index + 1}</h3>
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-green-600 font-medium">{index + 1}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">Company</label>
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => handleExperienceChange(index, 'company', e.target.value)}
                          className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                          placeholder="Enter company name"
                        />
                      </div>
                      <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">Role</label>
                        <input
                          type="text"
                          value={exp.role}
                          onChange={(e) => handleExperienceChange(index, 'role', e.target.value)}
                          className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                          placeholder="e.g. Senior Developer"
                        />
                      </div>
                      <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">Duration</label>
                        <input
                          type="text"
                          value={exp.duration}
                          onChange={(e) => handleExperienceChange(index, 'duration', e.target.value)}
                          className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                          placeholder="e.g. 2 years"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-base font-semibold text-gray-700 mb-2">Key Responsibilities</label>
                        <textarea
                          value={exp.responsibilities.join('\n')}
                          onChange={(e) => handleExperienceChange(index, 'responsibilities', e.target.value.split('\n'))}
                          rows={4}
                          className="block w-full px-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                          placeholder="Enter each responsibility on a new line"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addExperience}
                  className="mt-6 inline-flex items-center px-6 py-3 border border-gray-200 text-base font-medium rounded-xl text-blue-600 bg-white hover:bg-blue-50 transition-colors"
                >
                  + Add Another Experience
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-10">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center px-6 py-3 border-2 border-[#e8d5c4] text-base font-medium rounded-xl text-[#6f4e37] bg-[#faf3e8] hover:bg-[#e8d5c4] transition-colors"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Previous
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="inline-flex items-center px-6 py-3 border-2 border-transparent text-base font-medium rounded-xl text-white bg-gradient-to-r from-[#6f4e37] to-[#8b593e] hover:from-[#8b593e] hover:to-[#6f4e37] transition-all ml-auto"
              >
                Next
                <ChevronRight className="w-5 h-5 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center px-8 py-3 border-2 border-transparent text-base font-medium rounded-xl text-white bg-gradient-to-r from-[#6f4e37] to-[#8b593e] hover:from-[#8b593e] hover:to-[#6f4e37] transition-all ml-auto"
              >
                Submit Application
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingForm;