import { useState } from "react";
import { Plus, X } from "lucide-react";

const PREDEFINED_SKILLS = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'C++', 'Go', 'Rust', 'AWS',
    'Docker', 'Kubernetes', 'GraphQL', 'SQL', 'MongoDB',
    'Redis', 'Git', 'CI/CD', 'Machine Learning', 'Data Science',
    'DevOps', 'Cloud Computing', 'System Design', 'Microservices', 'Testing'
];

const CandidateForm = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        field: "",
        skills: "",
        experience: 0,
        education: [
            {
                college: "",
                degree: "",
                branchOfStudy: "",
                yearOfGraduation: 2024,
                gpa: 0,
            },
        ],
        previousExperience: [
            {
                company: "",
                role: "",
                duration: "",
                responsibilities: "",
            },
        ],
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'experience') {
            const numValue = Math.max(0, Number(value));
            setFormData((prev) => ({ ...prev, [name]: numValue }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleEducationChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const { name, value } = e.target;
        const updated = [...formData.education];
        if (name === 'yearOfGraduation' || name === 'gpa') {
            (updated[index] as any)[name] = Math.max(0, Number(value));
        } else {
            (updated[index] as any)[name] = value;
        }
        setFormData((prev) => ({ ...prev, education: updated }));
    };

    const handleExperienceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, index: number) => {
        const { name, value } = e.target;
        const updated = [...formData.previousExperience];
        (updated[index] as any)[name] = value;
        setFormData((prev) => ({ ...prev, previousExperience: updated }));
    };

    const toggleSkill = (skill: string) => {
        const currentSkills = formData.skills.split(',').map(s => s.trim()).filter(Boolean);
        const updatedSkills = currentSkills.includes(skill)
            ? currentSkills.filter(s => s !== skill)
            : [...currentSkills, skill];
        setFormData(prev => ({ ...prev, skills: updatedSkills.join(', ') }));
    };

    const addEducation = () => {
        setFormData(prev => ({
            ...prev,
            education: [
                ...prev.education,
                {
                    college: "",
                    degree: "",
                    branchOfStudy: "",
                    yearOfGraduation: new Date().getFullYear(),
                    gpa: 0,
                }
            ]
        }));
    };

    const addExperience = () => {
        setFormData(prev => ({
            ...prev,
            previousExperience: [
                ...prev.previousExperience,
                {
                    company: "",
                    role: "",
                    duration: "",
                    responsibilities: "",
                }
            ]
        }));
    };

    const removeEducation = (index: number) => {
        setFormData(prev => ({
            ...prev,
            education: prev.education.filter((_, i) => i !== index)
        }));
    };

    const removeExperience = (index: number) => {
        setFormData(prev => ({
            ...prev,
            previousExperience: prev.previousExperience.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            ...formData,
            skills: formData.skills.split(",").map((s) => s.trim()),
            education: formData.education.map((edu) => ({
                ...edu,
                yearOfGraduation: Number(edu.yearOfGraduation),
                gpa: Number(edu.gpa),
            })),
            previousExperience: formData.previousExperience.map((exp) => ({
                ...exp,
                responsibilities: exp.responsibilities.split(",").map((r) => r.trim()),
            })),
            experience: Number(formData.experience),
        };

        try {
            const res = await fetch("http://localhost:3000/api/candidates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                alert("✅ Candidate submitted successfully!");
                setFormData({
                    name: "",
                    email: "",
                    phone: "",
                    field: "",
                    skills: "",
                    experience: 0,
                    education: [{ college: "", degree: "", branchOfStudy: "", yearOfGraduation: 2024, gpa: 0 }],
                    previousExperience: [{ company: "", role: "", duration: "", responsibilities: "" }],
                });
            } else {
                alert("❌ Submission failed");
            }
        } catch (err) {
            console.error(err);
            alert("❌ Something went wrong");
        }
    };

    return (
        <div className="min-h-screen bg-blue-50 py-12 px-4 sm:px-6 lg:px-8">
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="bg-white shadow-xl rounded-3xl p-8 border-2 ">
            <h2 className="text-4xl font-bold mb-8 text-center text-black font-montserrat">
                Candidate Registration
            </h2>

            {/* Navigation Steps */}
            <div className="flex justify-between items-center mb-12 bg-gray-100 p-2 rounded-full">
                <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={`flex-1 px-4 py-2 rounded-full font-medium transition-all font-montserrat ${
                        step === 1 
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg' 
                            : 'hover:bg-gray-200 text-black'
                    }`}
                >
                    Personal Info
                </button>
                <button
                    type="button"
                    onClick={() => setStep(2)}
                    className={`flex-1 mx-2 px-4 py-2 rounded-full font-medium transition-all font-montserrat ${
                        step === 2 
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg' 
                            : 'hover:bg-gray-200 text-black'
                    }`}
                >
                    Education
                </button>
                <button
                    type="button"
                    onClick={() => setStep(3)}
                    className={`flex-1 px-4 py-2 rounded-full font-medium transition-all font-montserrat ${
                        step === 3 
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg' 
                            : 'hover:bg-gray-200 text-black'
                    }`}
                >
                    Experience
                </button>
            </div>

            <div className="mb-8">
                {step === 1 && (
                    <div className="space-y-6">
                        <h3 className="text-3xl font-bold text-black mb-8 font-montserrat">Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-lg font-semibold text-blue-900 font-montserrat">Full Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    placeholder="Enter your full name"
                                    className="w-full px-4 py-2 rounded-xl border-2 text-black text-lg "
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-lg font-semibold text-blue-900 font-montserrat">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="you@example.com"
                                    className="w-full px-4 py-2 rounded-xl border-2 text-black text-lg"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-lg font-semibold text-blue-900 font-montserrat">Phone</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    placeholder="+1 (555) 000-0000"
                                    className="w-full px-4 py-2 rounded-xl border-2 text-black text-lg"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-lg font-semibold text-blue-900 font-montserrat">Field of Work</label>
                                <input
                                    type="text"
                                    name="field"
                                    placeholder="e.g. Software Development"
                                    className="w-full px-4 py-2 rounded-xl border-2 text-black text-lg"
                                    value={formData.field}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-lg font-semibold text-blue-900 font-montserrat">Years of Experience</label>
                                <input
                                    type="number"
                                    name="experience"
                                    placeholder="Enter years"
                                    className="w-full px-4 py-2 rounded-xl border-2 text-black text-lg"
                                    value={formData.experience}
                                    onChange={handleChange}
                                    min="0"
                                    required
                                />
                            </div>
                        </div>

                        <div className="mt-12">
                            <label className="block text-2xl font-bold text-black mb-6 font-montserrat">Technical Skills</label>
                            <div className="flex flex-wrap gap-3 p-6 rounded-xl">
                                {PREDEFINED_SKILLS.map((skill) => {
                                    const isSelected = formData.skills.includes(skill);
                                    return (
                                        <button
                                            key={skill}
                                            type="button"
                                            onClick={() => toggleSkill(skill)}
                                            className={`px-4 py-2 rounded-full text-base font-medium transition-all duration-200 ${
                                                isSelected
                                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                                                    : 'bg-white hover:bg-gray-200 text-black border'
                                            }`}
                                        >
                                            {skill}
                                            {isSelected && (
                                                <span className="ml-2 text-white/80">✓</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-8">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-3xl font-bold text-black font-montserrat">Education History</h3>
                            <button
                                type="button"
                                onClick={addEducation}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white transition-all flex items-center gap-2 font-montserrat"
                            >
                                <Plus className="w-5 h-5" />
                                Add Education
                            </button>
                        </div>
                        {formData.education.map((edu, idx) => (
                            <div key={idx} className="p-8 rounded-xl border-2 space-y-6 relative">
                                {formData.education.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeEducation(idx)}
                                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#e8d5c4] text-blue-800"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-lg font-semibold text-blue-900 font-montserrat">Institution</label>
                                        <input
                                            type="text"
                                            name="college"
                                            placeholder="Enter institution name"
                                            className="w-full px-4 py-2 rounded-xl bg-white border-2 text-black text-lg transition-colors"
                                            value={edu.college}
                                            onChange={(e) => handleEducationChange(e, idx)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-lg font-semibold text-blue-900 font-montserrat">Degree</label>
                                        <input
                                            type="text"
                                            name="degree"
                                            placeholder="e.g. Bachelor of Science"
                                            className="w-full px-4 py-2 rounded-xl bg-white border-2 text-lg transition-colors"
                                            value={edu.degree}
                                            onChange={(e) => handleEducationChange(e, idx)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-lg font-semibold text-blue-900 font-montserrat">Branch of Study</label>
                                        <input
                                            type="text"
                                            name="branchOfStudy"
                                            placeholder="e.g. Computer Science"
                                            className="w-full px-4 py-2 rounded-xl bg-white border-2 text-lg transition-colors"
                                            value={edu.branchOfStudy}
                                            onChange={(e) => handleEducationChange(e, idx)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-lg font-semibold text-blue-900 font-montserrat">Year of Graduation</label>
                                        <input
                                            type="number"
                                            name="yearOfGraduation"
                                            placeholder="Enter year"
                                            className="w-full px-4 py-2 rounded-xl border-2 bg-white text-lg transition-colors"
                                            value={edu.yearOfGraduation}
                                            onChange={(e) => handleEducationChange(e, idx)}
                                            min="1900"
                                            max={new Date().getFullYear() + 5}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-lg font-semibold text-blue-900 font-montserrat">GPA</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            name="gpa"
                                            placeholder="Enter GPA"
                                            className="w-full px-4 py-2 rounded-xl border-2 bg-white border-2text-lg transition-colors"
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

                {step === 3 && (
                    <div className="space-y-8">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-3xl font-bold text-black font-montserrat">Work Experience</h3>
                            <button
                                type="button"
                                onClick={addExperience}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white transition-all flex items-center gap-2 font-montserrat"
                            >
                                <Plus className="w-5 h-5" />
                                Add Experience
                            </button>
                        </div>
                        {formData.previousExperience.map((exp, idx) => (
                            <div key={idx} className="p-8 rounded-xl  border-2 space-y-6 relative">
                                {formData.previousExperience.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeExperience(idx)}
                                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#e8d5c4] text-blue-800"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-lg font-semibold text-blue-900 font-montserrat">Company</label>
                                        <input
                                            type="text"
                                            name="company"
                                            placeholder="Enter company name"
                                            className="w-full px-4 py-2 rounded-xl bg-white border-2  text-lg transition-colors"
                                            value={exp.company}
                                            onChange={(e) => handleExperienceChange(e, idx)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-lg font-semibold text-blue-900 font-montserrat">Role</label>
                                        <input
                                            type="text"
                                            name="role"
                                            placeholder="e.g. Senior Developer"
                                            className="w-full px-4 py-2 rounded-xl bg-white border-2  text-lg transition-colors"
                                            value={exp.role}
                                            onChange={(e) => handleExperienceChange(e, idx)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-lg font-semibold text-blue-900 font-montserrat">Duration</label>
                                        <input
                                            type="text"
                                            name="duration"
                                            placeholder="e.g. 2 years"
                                            className="w-full px-4 py-2 rounded-xl bg-white border-2  text-lg transition-colors"
                                            value={exp.duration}
                                            onChange={(e) => handleExperienceChange(e, idx)}
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="block text-lg font-semibold text-blue-900 font-montserrat">Key Responsibilities</label>
                                        <textarea
                                            name="responsibilities"
                                            placeholder="Enter responsibilities (comma-separated)"
                                            className="w-full px-4 py-2 rounded-xl bg-white border-2  text-lg transition-colors resize-none"
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

            <div className="flex justify-between mt-12 gap-12">
                {step > 1 && (
                    <button
                        type="button"
                        onClick={() => setStep(step - 1)}
                        className="px-4 py-2 border-2 text-lg font-medium rounded-xl text-black  transition-colors font-montserrat"
                    >
                        Previous
                    </button>
                )}
                {step < 3 ? (
                    <button
                        type="button"
                        onClick={() => setStep(step + 1)}
                        className="px-4 py-2 text-lg font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 transition-all ml-auto font-montserrat"
                    >
                        Next
                    </button>
                ) : (
                    <button
                        type="submit"
                        className="w-full px-4 py-2 text-lg font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 transition-all font-montserrat"
                    >
                        Submit Application
                    </button>
                )}
            </div>
        </div>
    </form>
</div>
    );
};

export default CandidateForm;
