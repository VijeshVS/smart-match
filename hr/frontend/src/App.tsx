import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Candidates from './pages/Candidates';
import Jumble from './pages/Jumble';
import Filter from './pages/Filter';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hrEmail, setHrEmail] = useState('');

  return (
    <Router>
      <div className="relative min-h-screen">
        <div className="mesh-bg" />
        <div className="relative z-10 flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0">
            <Routes>
              <Route
                path="/"
                element={
                  <Home
                    isAuthenticated={isAuthenticated}
                    setIsAuthenticated={setIsAuthenticated}
                    hrEmail={hrEmail}
                    setHrEmail={setHrEmail}
                  />
                }
              />
              <Route
                path="/candidates"
                element={isAuthenticated ? <Candidates /> : <Navigate to="/" replace />}
              />
              <Route
                path="/jumble"
                element={isAuthenticated ? <Jumble /> : <Navigate to="/" replace />}
              />
              <Route
                path="/filter"
                element={isAuthenticated ? <Filter /> : <Navigate to="/" replace />}
              />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;