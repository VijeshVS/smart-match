import { useState } from "react";

const CandidateForm = () => {
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
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleEducationChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const { name, value } = e.target;
        const updated = [...formData.education];
        (updated[index] as any)[name] = value;
        setFormData((prev) => ({ ...prev, education: updated }));
    };

    const handleExperienceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, index: number) => {
        const { name, value } = e.target;
        const updated = [...formData.previousExperience];
        (updated[index] as any)[name] = value;
        setFormData((prev) => ({ ...prev, previousExperience: updated }));
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
            const res = await fetch("http://localhost:5000/api/candidates", {
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
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-8 bg-white shadow-xl rounded-2xl space-y-8">
            <h2 className="text-2xl font-bold mb-4 text-center">Candidate Registration</h2>

            {/* 🔹 Basic Info */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold">Basic Info</h3>
                <input type="text" name="name" placeholder="Full Name" className="input" value={formData.name} onChange={handleChange} required />
                <input type="email" name="email" placeholder="Email" className="input" value={formData.email} onChange={handleChange} required />
                <input type="tel" name="phone" placeholder="Phone" className="input" value={formData.phone} onChange={handleChange} required />
                <input type="text" name="field" placeholder="Field of Work" className="input" value={formData.field} onChange={handleChange} required />
                <input type="text" name="skills" placeholder="Skills (comma-separated)" className="input" value={formData.skills} onChange={handleChange} required />
                <input type="number" name="experience" placeholder="Years of Experience" className="input" value={formData.experience} onChange={handleChange} required />
            </div>

            {/* 🔹 Education Section */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold">Education</h3>
                {formData.education.map((edu, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-4">
                        <input type="text" name="college" placeholder="College" className="input" value={edu.college} onChange={(e) => handleEducationChange(e, idx)} />
                        <input type="text" name="degree" placeholder="Degree" className="input" value={edu.degree} onChange={(e) => handleEducationChange(e, idx)} />
                        <input type="text" name="branchOfStudy" placeholder="Branch of Study" className="input" value={edu.branchOfStudy} onChange={(e) => handleEducationChange(e, idx)} />
                        <input type="number" name="yearOfGraduation" placeholder="Graduation Year" className="input" value={edu.yearOfGraduation} onChange={(e) => handleEducationChange(e, idx)} />
                        <input type="number" step="0.01" name="gpa" placeholder="GPA" className="input" value={edu.gpa} onChange={(e) => handleEducationChange(e, idx)} />
                    </div>
                ))}
            </div>

            {/* 🔹 Experience Section */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold">Previous Experience</h3>
                {formData.previousExperience.map((exp, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-4">
                        <input type="text" name="company" placeholder="Company" className="input" value={exp.company} onChange={(e) => handleExperienceChange(e, idx)} />
                        <input type="text" name="role" placeholder="Role" className="input" value={exp.role} onChange={(e) => handleExperienceChange(e, idx)} />
                        <input type="text" name="duration" placeholder="Duration" className="input" value={exp.duration} onChange={(e) => handleExperienceChange(e, idx)} />
                        <textarea name="responsibilities" placeholder="Responsibilities (comma-separated)" className="input" value={exp.responsibilities} onChange={(e) => handleExperienceChange(e, idx)} />
                    </div>
                ))}
            </div>

            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-all">
                Submit Candidate
            </button>
        </form>
    );
};

export default CandidateForm;
