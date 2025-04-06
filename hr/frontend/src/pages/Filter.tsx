import React, { useState } from "react";
import {
  Search,
  Briefcase,
  Mail,
  Phone,
  School,
  Star,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

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

interface Review {
  comment: string;
  swipe: "approve" | "reject";
}

interface Candidate {
  name: string;
  email: string;
  phone: string;
  field: string;
  skills: string[];
  experience: number;
  rightSwipes: number;
  leftSwipes: number;
  level: number;
  reviews: Review[];
  education: Education[];
  previousExperience: Experience[];
}

interface ApiResponse {
  results: Candidate[];
}

function Filter() {
  const [prompt, setPrompt] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:3001/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: prompt }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch candidates");
      }

      const data: ApiResponse = await response.json();
      setCandidates(data.results);
    } catch (err) {
      setError("Failed to fetch candidates. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Smart Match -{" "}
            <span className="relative inline-block text-blue-600 animate-lightning font-extrabold">
              hiring at speed of thoughts⚡
              <span className="absolute inset-0 blur-md opacity-75 animate-pulse text-blue-400">
                hiring at speed of thoughts⚡
              </span>
            </span>
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your requirements..."
                className="w-full h-32 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <Search className="absolute right-3 top-3 text-gray-400" />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            >
              {loading ? "Searching..." : "Search Candidates"}
            </button>
          </form>
          {error && <p className="mt-4 text-red-600">{error}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {candidates.map((candidate, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-md overflow-hidden"
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {candidate.name}
                </h2>
                <p className="text-gray-600 mb-4">{candidate.field}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-gray-600">
                    <Mail className="w-4 h-4 mr-2" />
                    <span className="text-sm">{candidate.email}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Phone className="w-4 h-4 mr-2" />
                    <span className="text-sm">{candidate.phone}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Briefcase className="w-4 h-4 mr-2" />
                    <span className="text-sm">
                      {candidate.experience} years experience
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Education
                  </h3>
                  {candidate.education.map((edu, idx) => (
                    <div key={idx} className="flex items-start space-x-2">
                      <School className="w-4 h-4 text-gray-600 mt-1" />
                      <div>
                        <p className="text-sm font-medium">{edu.college}</p>
                        <p className="text-xs text-gray-600">
                          {edu.degree} in {edu.branchOfStudy} (
                          {edu.yearOfGraduation})
                        </p>
                        <p className="text-xs text-gray-600">GPA: {edu.gpa}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center">
                    <ThumbsUp className="w-4 h-4 mr-1 text-green-600" />
                    <span>{candidate.rightSwipes}</span>
                  </div>
                  <div className="flex items-center">
                    <ThumbsDown className="w-4 h-4 mr-1 text-red-600" />
                    <span>{candidate.leftSwipes}</span>
                  </div>
                  <div className="flex items-center">
                    <Star className="w-4 h-4 mr-1 text-yellow-500" />
                    <span>Level {candidate.level}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Filter;
