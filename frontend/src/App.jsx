import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './utils/firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPreloader, setShowPreloader] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(user);
      setLoading(false);
    });

    // 4.5 sec timer
    const timer = setTimeout(() => { setShowPreloader(false); }, 2000);
    return () => { unsubscribe(); clearTimeout(timer); };
  }, []);

  // Naya White Preloader with Circle & Curvy Text
  if (loading || showPreloader) {
    return (
      <div className="preloader-bg-white">
        <div className="brand-circle-wrapper">
          <div className="circle-spinner"></div>
          <div className="brand-text">
            <span className="text-gym">GYM</span>
            <span className="text-saathi">Saathi</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to={session ? "/dashboard" : "/auth"} />} />
        <Route path="/auth" element={session ? <Navigate to="/dashboard" /> : <Auth />} />
        <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/auth" />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Router>
  );
}

export default App;