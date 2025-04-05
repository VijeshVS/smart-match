import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, Shuffle, BriefcaseIcon } from 'lucide-react';

function Sidebar() {
  return (
    <div className="w-64 bg-white h-screen shadow-lg">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <BriefcaseIcon className="h-8 w-8 text-blue-600" />
          <span className="text-xl font-bold text-gray-800">SmartMatch</span>
        </div>
        <nav className="space-y-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </NavLink>
          <NavLink
            to="/candidates"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            <Users className="h-5 w-5" />
            <span>Candidates</span>
          </NavLink>
          <NavLink
            to="/jumble"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            <Shuffle className="h-5 w-5" />
            <span>Jumble</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
}

export default Sidebar