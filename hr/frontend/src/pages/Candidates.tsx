import React, { useEffect, useState } from 'react';
import { Mail, Phone, Briefcase, Calendar } from 'lucide-react';

function Candidates() {

  const [candidates, setCandidates] = useState<{ id: number; education?: { college: string; degree: string; branchOfStudy: string; yearOfGraduation: string; gpa: string; }[]; previousExperience?: { company: string; role: string; duration: string; responsibilities: string[]; }[]; name: string; }[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/candidates"); // update port if needed
        const data = await res.json();
        setCandidates(data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch candidates", err);
      }
    };

    fetchCandidates();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600 text-xl">
        Loading candidates...
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Candidates</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {candidates.map((candidate) => (
          <div key={candidate.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-4">
                <div className='w-12 h-12 rounded-full bg-green- flex justify-center text-center items-center text-white font-semibold text-lg'>{getInitials(candidate.name)}</div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{candidate.name}</h2>
                  <p className="text-sm text-gray-500">{candidate.position}</p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <div className="flex items-center text-gray-600">
                  <Mail className="h-5 w-5 mr-3" />
                  <span className="text-sm">{candidate.email}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Phone className="h-5 w-5 mr-3" />
                  <span className="text-sm">{candidate.phone}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Briefcase className="h-5 w-5 mr-3" />
                  <span className="text-sm">{candidate.field}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Calendar className="h-5 w-5 mr-3" />
                  <span className="text-sm">{candidate.experience} experience</span>
                </div>
              </div>
              <div className="mt-6">
                <button className="w-full bg-teal-500 text-white py-2 px-4 rounded-lg hover:bg-purple-950 transition-colors">
                  View Profile
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Candidates