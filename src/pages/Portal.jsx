import React from 'react';
import { supabase } from '../supabaseClient';
import './Portal.css';

export default function Portal() {
  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.origin + '/#/dashboard', 
      }
    });
    
    if (error) {
      console.error('Error logging in:', error.message);
      alert('เกิดข้อผิดพลาดในการล็อกอิน: ' + error.message);
    }
  };

  return (
    <div className="portal-container animate-fade-in">
      <div className="portal-content glass-panel animate-slide-up">
        <div className="logo-container">
          <img src="/logo.png" alt="MEDIC WIPTOWN" className="portal-logo" />
        </div>
        
        <h1 className="portal-title">MEDIC E - SERVICE</h1>
        <p className="portal-subtitle">หน่วยงานแพทย์ WIP TOWN</p>
        
        <button className="discord-btn" onClick={handleLogin}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 127.14 96.36"
            className="discord-icon"
          >
            <path
              fill="#fff"
              d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83A97.68 97.68 0 0 0 49 6.83 72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.73 56.6 2.67 80.21a104.73 104.73 0 0 0 32.14 16.15 77.7 77.7 0 0 0 6.89-11.1 67.57 67.57 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 60.11 0c.87.71 1.76 1.39 2.66 2a67.31 67.31 0 0 1-10.87 5.19 77.15 77.15 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.15c4.71-25.1-1.07-49.71-16.73-72.15zM42.79 65.43c-6.19 0-11.39-5.75-11.39-12.72s5.11-12.72 11.39-12.72c6.33 0 11.45 5.8 11.39 12.72.01 6.97-5.11 12.72-11.39 12.72zm41.56 0c-6.19 0-11.39-5.75-11.39-12.72s5.11-12.72 11.39-12.72c6.33 0 11.45 5.8 11.39 12.72s-5.1 12.72-11.39 12.72z"
            />
          </svg>
          Login with Discord
        </button>
      </div>

      <footer className="portal-footer">
        <p>(สงวนลิขสิทธิ์ © 2567 หน่วยงานแพทย์ WIP TOWN)</p>
      </footer>
    </div>
  );
}
