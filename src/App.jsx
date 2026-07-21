import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Portal from './pages/Portal';
import Dashboard from './pages/Dashboard';
import ProfileSettings from './pages/ProfileSettings';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Portal />} />
        <Route path="/profile-setup" element={<ProfileSettings />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
