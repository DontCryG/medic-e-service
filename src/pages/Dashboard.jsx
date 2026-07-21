import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  Search, 
  Bell,
  Stethoscope
} from 'lucide-react';
import './Dashboard.css'; 

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    checkUser();
    
    // Subscribe to realtime changes for this user's profile
    let subscription;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const discordId = session.user.user_metadata.provider_id || session.user.id;
        subscription = supabase
          .channel('public:users')
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'users',
            filter: `discord_id=eq.${discordId}`
          }, (payload) => {
            setProfile(payload.new);
          })
          .subscribe();
      }
    });

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/');
        return;
      }

      const user = session.user;
      const discordId = user.user_metadata.provider_id || user.id;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('discord_id', discordId)
        .single();

      if (error || !data) {
        navigate('/profile-setup');
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="portal-container">
        <h2 style={{ color: 'var(--primary)' }}>กำลังโหลด...</h2>
      </div>
    );
  }

  // Access Denied for 'user' role
  if (profile?.role === 'user') {
    return (
      <div className="portal-container animate-fade-in" style={{ backgroundColor: '#fef2f2' }}>
        <div className="portal-content glass-panel animate-slide-up" style={{ width: '450px', padding: '3rem', border: '1px solid #fecaca', boxShadow: '0 8px 32px 0 rgba(239, 68, 68, 0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', color: '#ef4444' }}>
            <ShieldAlert size={64} />
          </div>
          <h2 style={{ color: '#b91c1c', fontSize: '1.75rem', marginBottom: '1rem', fontWeight: 600 }}>ไม่มีสิทธิ์เข้าถึง</h2>
          <p style={{ color: '#7f1d1d', marginBottom: '2rem', fontSize: '1.05rem' }}>
            คุณ ({profile.ic_name}) ลงทะเบียนสำเร็จแล้ว<br/>แต่ยังไม่ได้รับการอนุมัติสิทธิ์ให้เข้าใช้งานระบบ
          </p>
          <button 
            onClick={handleLogout}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '0.75rem 2rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '1rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              fontWeight: 500
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    );
  }

  // Get first letter of name for avatar
  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : 'M';

  // Actual Dashboard Layout
  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Logo" />
          <h2>MEDIC<br/>WIPTOWN</h2>
        </div>
        
        <nav className="sidebar-nav">
          <div className="nav-item active">
            <LayoutDashboard size={20} />
            <span>กระดานหลัก</span>
          </div>
          <div className="nav-item">
            <Users size={20} />
            <span>จัดการบุคลากร</span>
          </div>
          <div className="nav-item">
            <Stethoscope size={20} />
            <span>ข้อมูลการรักษา</span>
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <div className="nav-item">
              <Settings size={20} />
              <span>ตั้งค่าระบบ</span>
            </div>
            <div className="nav-item" onClick={handleLogout} style={{ color: '#ef4444', marginTop: '0.5rem' }}>
              <LogOut size={20} />
              <span>ออกจากระบบ</span>
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Area */}
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-search">
            <Search size={18} color="var(--text-secondary)" />
            <input type="text" placeholder="ค้นหาข้อมูล..." />
          </div>

          <div className="header-actions">
            <button className="icon-btn">
              <Bell size={22} />
              <span className="icon-badge"></span>
            </button>
            
            <div className="user-profile">
              <div className="user-info">
                <div className="user-name">{profile?.ic_name}</div>
                <div className="user-role">{profile?.position}</div>
              </div>
              <div className="user-avatar">
                {getInitial(profile?.ic_name)}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="dashboard-content">
          <div className="page-header">
            <h1 className="page-title">ยินดีต้อนรับ, {profile?.ic_name}</h1>
            <p className="page-subtitle">ดูภาพรวมและจัดการข้อมูลของหน่วยงานแพทย์</p>
          </div>

          <div className="content-panel">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>ภาพรวมระบบ (รอพัฒนาในลูปที่ 4)</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              ในส่วนนี้จะแสดงการ์ดสรุปข้อมูล (เช่น จำนวนแพทย์เวร, เคสฉุกเฉิน) และตารางรายการต่างๆ
              ระบบออกแบบมารองรับข้อมูลแบบ Real-time แล้ว 
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
