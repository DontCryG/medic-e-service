import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Portal from './pages/Portal';
import Dashboard from './pages/Dashboard';
import ProfileSettings from './pages/ProfileSettings';

// Component to check for updates
function AutoUpdateChecker() {
  const [currentVersion, setCurrentVersion] = useState(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json?t=' + Date.now());
        if (response.ok) {
          const data = await response.json();
          if (currentVersion && currentVersion !== data.version) {
            console.log('New version detected! Reloading...', data.version);
            window.location.reload(true);
          } else if (!currentVersion) {
            setCurrentVersion(data.version);
          }
        }
      } catch (error) {
        console.error('Error checking version:', error);
      }
    };

    // Check version on initial load
    checkVersion();

    // Check version every 60 seconds
    const interval = setInterval(checkVersion, 60000);
    
    // Check version when user switches back to the tab
    window.addEventListener('focus', checkVersion);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkVersion);
    };
  }, [currentVersion]);

  return null;
}

function App() {
  return (
    <HashRouter>
      <AutoUpdateChecker />
      <Routes>
        <Route path="/" element={<Portal />} />
        <Route path="/profile-setup" element={<ProfileSettings />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
