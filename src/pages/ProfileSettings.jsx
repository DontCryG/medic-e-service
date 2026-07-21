import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './Portal.css'; // Reuse some portal styles for consistency

export default function ProfileSettings() {
  const navigate = useNavigate();
  const [icName, setIcName] = useState('');
  const [icPhone, setIcPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate('/');
      }
    });
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!icName || !icPhone) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setLoading(true);
    
    try {
      const user = session?.user;
      
      // Save profile to Supabase
      const { error } = await supabase
        .from('users')
        .upsert({
          discord_id: user.user_metadata.provider_id || user.id,
          ic_name: icName,
          ic_phone: icPhone,
          role: 'user', // Default system role
          position: 'นักเรียนแพทย์' // Default display position
        });

      if (error) throw error;
      
      // Go to dashboard after saving
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving profile:', error.message);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-container animate-fade-in">
      <div className="portal-content glass-panel animate-slide-up" style={{ width: '500px', padding: '2.5rem' }}>
        <h2 className="portal-title" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>ตั้งค่าโปรไฟล์</h2>
        <p className="portal-subtitle" style={{ marginBottom: '2rem' }}>กรุณากรอกข้อมูลตัวละคร (IC) ของคุณ</p>
        
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-primary)' }}>ชื่อ-นามสกุล IC</label>
            <input 
              type="text" 
              value={icName}
              onChange={(e) => setIcName(e.target.value)}
              placeholder="เช่น สมชาย ใจดี"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                outline: 'none',
                fontFamily: 'inherit',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-primary)' }}>เบอร์โทร IC</label>
            <input 
              type="text" 
              value={icPhone}
              onChange={(e) => setIcPhone(e.target.value)}
              placeholder="เช่น 123-4567"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                outline: 'none',
                fontFamily: 'inherit',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-primary)' }}>ตำแหน่ง</label>
            <input 
              type="text" 
              value="นักเรียนแพทย์"
              disabled
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: '#f1f5f9',
                color: 'var(--text-secondary)',
                outline: 'none',
                fontFamily: 'inherit',
                fontSize: '1rem',
                cursor: 'not-allowed'
              }}
            />
            <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.5rem' }}>
              *ตำแหน่งเริ่มต้นสำหรับผู้สมัครใหม่
            </small>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              backgroundColor: 'var(--primary)',
              color: 'white',
              border: 'none',
              padding: '0.875rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '1rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              marginTop: '1rem',
              transition: 'var(--transition-normal)'
            }}
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลและเข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}
