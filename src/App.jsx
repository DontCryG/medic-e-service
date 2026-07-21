import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Portal from './pages/Portal';
import Dashboard from './pages/Dashboard';
import ProfileSettings from './pages/ProfileSettings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Portal />} />
        <Route path="/profile-setup" element={<ProfileSettings />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
