import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
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
            setCurrentVersion(data.version); // Prevent multiple triggers
            
            // Show SweetAlert notification with 5-second countdown
            let timerInterval;
            Swal.fire({
              title: 'มีการอัปเดตระบบใหม่! 🚀',
              html: 'ระบบกำลังจะรีเฟรชเพื่ออัปเดตข้อมูลในอีก <b>5</b> วินาที...',
              icon: 'info',
              timer: 5000,
              timerProgressBar: true,
              showConfirmButton: true,
              confirmButtonText: 'อัปเดตทันที',
              confirmButtonColor: '#0ea5e9',
              allowOutsideClick: false,
              allowEscapeKey: false,
              didOpen: () => {
                const b = Swal.getHtmlContainer().querySelector('b');
                timerInterval = setInterval(() => {
                  if (b) b.textContent = Math.ceil(Swal.getTimerLeft() / 1000);
                }, 1000);
              },
              willClose: () => {
                clearInterval(timerInterval);
              }
            }).then(() => {
              window.location.reload(true);
            });
            
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
