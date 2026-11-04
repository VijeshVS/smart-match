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
import { appConfig } from "../config";

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
  const [hasSearched, setHasSearched] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");
    setHasSearched(true);

    try {
      const response = await fetch(`${appConfig.legacyAiUrl}/evaluate`, {
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
    } catch {
      setError("Failed to fetch candidates. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 min-h-screen animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            TalentLens
          </h1>
          <p className="text-slate-400 mb-6">
            Describe your ideal hire in plain language and let AI surface the strongest matches.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 glass-strong rounded-2xl p-6">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Example: Need React + Node candidates with 3+ years experience, strong communication and startup background."
                className="w-full h-32 px-4 py-3 rounded-xl glass-input resize-none"
              />
              <Search className="absolute right-3 top-3 text-slate-500" />
            </div>
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className={`px-6 py-3 rounded-xl font-semibold transition-colors ${
                loading
                  ? "bg-violet-500/70 text-white cursor-wait"
                  : "gradient-btn"
              } ${
                !prompt.trim() ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {loading ? "Searching..." : "Search Candidates"}
            </button>
          </form>
          {error && <p className="mt-4 text-rose-400">{error}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
          {candidates.map((candidate, index) => (
            <div
              key={index}
              className="glass rounded-2xl overflow-hidden card-hover"
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold text-white mb-2">
                  {candidate.name}
                </h2>
                <p className="text-slate-400 mb-4">{candidate.field}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-slate-400">
                    <Mail className="w-4 h-4 mr-2 text-accent-violet" />
                    <span className="text-sm">{candidate.email}</span>
                  </div>
                  <div className="flex items-center text-slate-400">
                    <Phone className="w-4 h-4 mr-2 text-accent-violet" />
                    <span className="text-sm">{candidate.phone}</span>
                  </div>
                  <div className="flex items-center text-slate-400">
                    <Briefcase className="w-4 h-4 mr-2 text-accent-cyan" />
                    <span className="text-sm">
                      {candidate.experience} years experience
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-white mb-2">
                    Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs rounded-full skill-chip-active"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-white mb-2">
                    Education
                  </h3>
                  {candidate.education.map((edu, idx) => (
                    <div key={idx} className="flex items-start space-x-2">
                      <School className="w-4 h-4 text-accent-violet mt-1" />
                      <div>
                        <p className="text-sm font-medium text-slate-100">{edu.college}</p>
                        <p className="text-xs text-slate-400">
                          {edu.degree} in {edu.branchOfStudy} (
                          {edu.yearOfGraduation})
                        </p>
                        <p className="text-xs text-slate-500">GPA: {edu.gpa}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm text-slate-400 border-t border-white/10 pt-4">
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
        {!loading && hasSearched && !error && candidates.length === 0 && (
          <div className="glass-strong rounded-2xl p-10 text-center">
            <p className="text-white font-semibold mb-2">No matches were found</p>
            <p className="text-slate-400">
              No matches were found for this prompt.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Filter;
