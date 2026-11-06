import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Check, User, GraduationCap, Briefcase, ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import type { FormData } from '../types';
import { appConfig } from '../config';
import { apiClient } from '../lib/api';

const PREDEFINED_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'C++', 'Go', 'Rust', 'AWS',
  'Docker', 'Kubernetes', 'GraphQL', 'SQL', 'MongoDB',
  'Redis', 'Git', 'CI/CD', 'Machine Learning', 'Data Science',
  'DevOps', 'Cloud Computing', 'System Design', 'Microservices', 'Testing',
];

const STEPS = [
  { label: 'Personal Info', icon: User },
  { label: 'Education', icon: GraduationCap },
  { label: 'Experience', icon: Briefcase },
];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    field: '',
    skills: '',
    experience: 0,
    education: [
      { college: '', degree: '', branchOfStudy: '', yearOfGraduation: 2024, gpa: 0 },
    ],
    previousExperience: [
      { company: '', role: '', duration: '', responsibilities: '' },
    ],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'experience') {
      setFormData((prev) => ({ ...prev, [name]: Math.max(0, Number(value)) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleEducationChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const { name, value } = e.target;
    const updated = [...formData.education];
    const target = updated[index] as unknown as Record<string, unknown>;
    if (name === 'yearOfGraduation' || name === 'gpa') {
      target[name] = Math.max(0, Number(value));
    } else {
      target[name] = value;
    }
    setFormData((prev) => ({ ...prev, education: updated }));
  };

  const handleExperienceChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number
  ) => {
    const { name, value } = e.target;
    const updated = [...formData.previousExperience];
    const target = updated[index] as unknown as Record<string, unknown>;
    target[name] = value;
    setFormData((prev) => ({ ...prev, previousExperience: updated }));
  };

  const toggleSkill = (skill: string) => {
    const currentSkills = formData.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const updatedSkills = currentSkills.includes(skill)
      ? currentSkills.filter((s) => s !== skill)
      : [...currentSkills, skill];
    setFormData((prev) => ({ ...prev, skills: updatedSkills.join(', ') }));
  };

  const addEducation = () => {
    setFormData((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        { college: '', degree: '', branchOfStudy: '', yearOfGraduation: new Date().getFullYear(), gpa: 0 },
      ],
    }));
  };

  const removeEducation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  };

  const addExperience = () => {
    setFormData((prev) => ({
      ...prev,
      previousExperience: [
        ...prev.previousExperience,
        { company: '', role: '', duration: '', responsibilities: '' },
      ],
    }));
  };

  const removeExperience = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      previousExperience: prev.previousExperience.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      ...formData,
      skills: formData.skills.split(',').map((s) => s.trim()),
      education: formData.education.map((edu) => ({
        ...edu,
        yearOfGraduation: Number(edu.yearOfGraduation),
        gpa: Number(edu.gpa),
      })),
      previousExperience: formData.previousExperience.map((exp) => ({
        ...exp,
        responsibilities: exp.responsibilities.split(',').map((r) => r.trim()),
      })),
      experience: Number(formData.experience),
    };

    try {
      const res = await fetch(`${appConfig.legacyApiUrl}/api/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        alert('Submission failed. Please try again.');
      }
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSkills = formData.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="text-center glass-strong rounded-3xl p-12 max-w-md w-full animate-scale-in">
          <div className="w-20 h-20 rounded-full gradient-btn mx-auto mb-6 flex items-center justify-center animate-pulse-glow">
            <Check size={36} className="text-white relative z-10" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Profile Created!</h2>
          <p className="text-slate-400 mb-8">
            Your candidate profile has been submitted successfully. You can now view your dashboard.
          </p>
          <button
            onClick={() => navigate('/dashboard', { state: { email: formData.email } })}
            className="w-full py-3 rounded-xl gradient-btn flex items-center justify-center gap-2 text-base"
          >
            <span>Go to Dashboard</span>
            <ArrowRight size={18} className="relative z-10" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-10 animate-slide-up">
        <h1 className="text-4xl font-extrabold text-white mb-3">
          Create Your <span className="gradient-text">Profile</span>
        </h1>
        <p className="text-slate-400 text-lg">Complete the steps below to get started</p>
      </div>

      {/* Progress Stepper */}
      <div className="glass-strong rounded-2xl p-6 mb-8 animate-slide-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
        <div className="flex items-center justify-between mb-4">
          {STEPS.map(({ label, icon: Icon }, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isComplete = step > stepNum;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(stepNum)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'gradient-btn shadow-lg shadow-violet-500/20'
                    : isComplete
                    ? 'text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                {isComplete ? (
                  <Check size={16} className="relative z-10" />
                ) : (
                  <Icon size={16} className="relative z-10" />
                )}
                <span className="relative z-10 hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
        <div className="progress-track h-1.5">
          <div className="progress-fill" style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="glass-strong rounded-3xl p-8 animate-fade-in" key={step}>
          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-8 animate-slide-up">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="stat-card-icon">
                  <User size={20} className="text-accent-violet" />
                </div>
                Personal Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="onboard-name" className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                  <input
                    id="onboard-name"
                    type="text"
                    name="name"
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 rounded-xl glass-input"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="onboard-email" className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                  <input
                    id="onboard-email"
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl glass-input"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="onboard-phone" className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                  <input
                    id="onboard-phone"
                    type="tel"
                    name="phone"
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-3 rounded-xl glass-input"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="onboard-field" className="block text-sm font-medium text-slate-300 mb-2">Field of Work</label>
                  <input
                    id="onboard-field"
                    type="text"
                    name="field"
                    placeholder="e.g. Software Development"
                    className="w-full px-4 py-3 rounded-xl glass-input"
                    value={formData.field}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="onboard-experience" className="block text-sm font-medium text-slate-300 mb-2">Years of Experience</label>
                  <input
                    id="onboard-experience"
                    type="number"
                    name="experience"
                    placeholder="Enter years"
                    className="w-full px-4 py-3 rounded-xl glass-input"
                    value={formData.experience}
                    onChange={handleChange}
                    min="0"
                    required
                  />
                </div>
              </div>

              {/* Skills */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Technical Skills</h3>
                <div className="flex flex-wrap gap-2.5">
                  {PREDEFINED_SKILLS.map((skill) => {
                    const isSelected = selectedSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-250 ${
                          isSelected ? 'skill-chip-active' : 'skill-chip'
                        }`}
                      >
                        {skill}
                        {isSelected && <span className="ml-1.5 text-accent-cyan">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {selectedSkills.length > 0 && (
                  <p className="text-xs text-slate-500 mt-3">
                    {selectedSkills.length} skill{selectedSkills.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Education */}
          {step === 2 && (
            <div className="space-y-8 animate-slide-up">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <div className="stat-card-icon">
                    <GraduationCap size={20} className="text-accent-violet" />
                  </div>
                  Education History
                </h2>
                <button
                  type="button"
                  onClick={addEducation}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-btn text-sm"
                >
                  <Plus size={16} className="relative z-10" />
                  <span>Add Education</span>
                </button>
              </div>

              {formData.education.map((edu, idx) => (
                <div key={idx} className="glass rounded-2xl p-6 relative animate-fade-in">
                  {formData.education.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEducation(idx)}
                      className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Institution</label>
                      <input
                        type="text"
                        name="college"
                        placeholder="Enter institution name"
                        className="w-full px-4 py-3 rounded-xl glass-input"
                        value={edu.college}
                        onChange={(e) => handleEducationChange(e, idx)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Degree</label>
                      <input
                        type="text"
                        name="degree"
                        placeholder="e.g. Bachelor of Science"
                        className="w-full px-4 py-3 rounded-xl glass-input"
                        value={edu.degree}
                        onChange={(e) => handleEducationChange(e, idx)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Branch of Study</label>
                      <input
                        type="text"
                        name="branchOfStudy"
                        placeholder="e.g. Computer Science"
                        className="w-full px-4 py-3 rounded-xl glass-input"
                        value={edu.branchOfStudy}
                        onChange={(e) => handleEducationChange(e, idx)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Year of Graduation</label>
                      <input
                        type="number"
                        name="yearOfGraduation"
                        placeholder="Enter year"
                        className="w-full px-4 py-3 rounded-xl glass-input"
                        value={edu.yearOfGraduation}
                        onChange={(e) => handleEducationChange(e, idx)}
                        min="1900"
                        max={new Date().getFullYear() + 5}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">GPA</label>
                      <input
                        type="number"
                        step="0.01"
                        name="gpa"
                        placeholder="Enter GPA"
                        className="w-full px-4 py-3 rounded-xl glass-input"
                        value={edu.gpa}
                        onChange={(e) => handleEducationChange(e, idx)}
                        min="0"
                        max="10"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Experience */}
          {step === 3 && (
            <div className="space-y-8 animate-slide-up">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <div className="stat-card-icon">
                    <Briefcase size={20} className="text-accent-violet" />
                  </div>
                  Work Experience
                </h2>
                <button
                  type="button"
                  onClick={addExperience}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-btn text-sm"
                >
                  <Plus size={16} className="relative z-10" />
                  <span>Add Experience</span>
                </button>
              </div>

              {formData.previousExperience.map((exp, idx) => (
                <div key={idx} className="glass rounded-2xl p-6 relative animate-fade-in">
                  {formData.previousExperience.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExperience(idx)}
                      className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Company</label>
                      <input
                        type="text"
                        name="company"
                        placeholder="Enter company name"
                        className="w-full px-4 py-3 rounded-xl glass-input"
                        value={exp.company}
                        onChange={(e) => handleExperienceChange(e, idx)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                      <input
                        type="text"
                        name="role"
                        placeholder="e.g. Senior Developer"
                        className="w-full px-4 py-3 rounded-xl glass-input"
                        value={exp.role}
                        onChange={(e) => handleExperienceChange(e, idx)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Duration</label>
                      <input
                        type="text"
                        name="duration"
                        placeholder="e.g. 2 years"
                        className="w-full px-4 py-3 rounded-xl glass-input"
                        value={exp.duration}
                        onChange={(e) => handleExperienceChange(e, idx)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-300 mb-2">Key Responsibilities</label>
                      <textarea
                        name="responsibilities"
                        placeholder="Enter responsibilities (comma-separated)"
                        className="w-full px-4 py-3 rounded-xl glass-input resize-none"
                        value={exp.responsibilities}
                        onChange={(e) => handleExperienceChange(e, idx)}
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-all text-sm font-medium"
            >
              <ArrowLeft size={16} />
              <span>Previous</span>
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-btn text-sm"
            >
              <span>Next Step</span>
              <ArrowRight size={16} className="relative z-10" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-3 rounded-xl gradient-btn text-sm disabled:opacity-50"
            >
              <Rocket size={16} className="relative z-10" />
              <span>{submitting ? 'Submitting...' : 'Submit Application'}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default Onboarding;
