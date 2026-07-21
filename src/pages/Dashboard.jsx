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
  Stethoscope,
  Activity,
  FileText,
  LayoutGrid,
  Star,
  ExternalLink,
  Clock,
  BriefcaseMedical,
  ClipboardList,
  UserCog,
  UserPlus,
  Ban,
  FileCheck2
} from 'lucide-react';
import './Dashboard.css'; 
import './DashboardGrid.css';

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
        <div className="dashboard-content" style={{ padding: '3rem 2rem' }}>
          
          <div className="hub-container">
            {/* Medic Section */}
            <div className="hub-section">
              <h2 className="hub-section-title medic">ระบบปฏิบัติการแพทย์ (Medic Services)</h2>
              <div className="hub-grid">
                
                <div className="hub-card medic">
                  <div className="hub-icon-wrapper">
                    <LayoutGrid size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="hub-card-title">ศูนย์กลางบริการทั่วไป</h3>
                  <p className="hub-card-desc">กระดานรวมบริการ และสรุปภาพรวมการทำงานของบุคลากรทางการแพทย์</p>
                  <button className="hub-btn">เข้าใช้งาน</button>
                </div>

                <div className="hub-card medic">
                  <div className="hub-icon-wrapper">
                    <Clock size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="hub-card-title">ระบบเข้าเวรออกเวร</h3>
                  <p className="hub-card-desc">บันทึกการลงเวลาปฏิบัติงาน และตรวจสอบตารางเวรของแพทย์แต่ละท่าน</p>
                  <button className="hub-btn">เข้าใช้งาน</button>
                </div>

                <div className="hub-card medic">
                  <div className="hub-icon-wrapper">
                    <BriefcaseMedical size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="hub-card-title">ระบบเบิกจ่ายคลัง</h3>
                  <p className="hub-card-desc">จัดการการเบิกจ่ายอุปกรณ์ทางการแพทย์ และยารักษาโรคจากคลังกลาง</p>
                  <button className="hub-btn">เข้าใช้งาน</button>
                </div>

                <div className="hub-card medic">
                  <div className="hub-icon-wrapper">
                    <ClipboardList size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="hub-card-title">ระบบบันทึกเคสอุบัติเหตุ</h3>
                  <p className="hub-card-desc">บันทึกประวัติการรักษา รายงานอุบัติเหตุ และผู้ป่วยฉุกเฉิน</p>
                  <button className="hub-btn">เข้าใช้งาน</button>
                </div>

                <div className="hub-card medic">
                  <div className="hub-icon-wrapper">
                    <UserPlus size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="hub-card-title">ทำทะเบียนประวัติผู้ป่วย</h3>
                  <p className="hub-card-desc">สร้างและแก้ไขข้อมูลประวัติผู้ป่วยใหม่ลงในระบบส่วนกลางของโรงพยาบาล</p>
                  <button className="hub-btn">เข้าใช้งาน</button>
                </div>

                <div className="hub-card medic">
                  <div className="hub-icon-wrapper">
                    <Ban size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="hub-card-title">ระบบยกเลิกเคสรักษา</h3>
                  <p className="hub-card-desc">ยกเลิกเคสการรักษาที่ผิดพลาด หรือส่งต่อเคสให้แพทย์ผู้เชี่ยวชาญอื่น</p>
                  <button className="hub-btn">เข้าใช้งาน</button>
                </div>

              </div>
            </div>

            {/* Admin Section (Conditional) */}
            {profile?.role === 'admin' && (
              <div className="hub-section">
                <h2 className="hub-section-title admin">ระบบจัดการภายในสภา (Council Only)</h2>
                <div className="hub-grid">
                  
                  <div className="hub-card admin">
                    <div className="hub-icon-wrapper">
                      <Users size={32} strokeWidth={1.5} />
                    </div>
                    <h3 className="hub-card-title">ระบบจัดการสมาชิกสภา</h3>
                    <p className="hub-card-desc">ฐานข้อมูลทะเบียนประวัติ และปรับเปลี่ยนสิทธิ์ (Role) เจ้าหน้าที่</p>
                    <button className="hub-btn">เข้าสู่ระบบ</button>
                  </div>

                  <div className="hub-card admin">
                    <div className="hub-icon-wrapper">
                      <UserCog size={32} strokeWidth={1.5} />
                    </div>
                    <h3 className="hub-card-title">ระบบจัดการคำร้อง</h3>
                    <p className="hub-card-desc">ตรวจสอบ อนุมัติ และจัดการคำร้องต่างๆ ที่ถูกส่งเข้ามาจากบุคลากร</p>
                    <button className="hub-btn">เข้าสู่ระบบ</button>
                  </div>

                  <div className="hub-card admin">
                    <div className="hub-icon-wrapper">
                      <FileCheck2 size={32} strokeWidth={1.5} />
                    </div>
                    <h3 className="hub-card-title">ตรวจสอบประวัติเบิกจ่าย</h3>
                    <p className="hub-card-desc">เรียกดูรายงานการเบิกจ่ายคลังย้อนหลังทั้งหมดของหน่วยงานแพทย์</p>
                    <button className="hub-btn">เข้าสู่ระบบ</button>
                  </div>

                </div>
              </div>
            )}

            {/* Related Links */}
            <div className="related-links-card">
              <h3 className="related-links-title"><Star size={20} color="#f59e0b" fill="#f59e0b" /> แนะนำเว็บไซต์ที่เกี่ยวข้อง</h3>
              <a href="#" className="related-link-btn">
                <ExternalLink size={18} />
                กฎหน่วยงานสภา WIP TOWN
              </a>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
