import React, { useEffect, useState, useRef } from 'react';
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
  Banknote,
  CalendarDays,
  Trash2
} from 'lucide-react';
import './Dashboard.css'; 
import './DashboardGrid.css';
import DutySystem from './DutySystem';
import LeaveSystem from './LeaveSystem';
import RequestManagement from './RequestManagement';
import PersonnelSystem from './PersonnelSystem';
import SalarySystem from './SalarySystem';
import SystemSettings from './SystemSettings';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [announcement, setAnnouncement] = useState(null);
  
  // Notifications State
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifRef = useRef(null);
  const searchRef = useRef(null);

  const menuItems = [
    { id: 'dashboard', label: 'กระดานหลัก' },
    { id: 'general', label: 'ระบบรันคิวแพทย์' },
    { id: 'duty', label: 'ระบบเข้าเวรออกเวร' },
    { id: 'accident', label: 'ระบบลางาน' },
    { id: 'personnel', label: 'ระบบจัดการบุคลากรแพทย์', admin: true },
    { id: 'requests', label: 'ระบบจัดการคำร้อง', admin: true },
    { id: 'salary', label: 'ระบบคำนวณเงินเดือน', admin: true },
  ];

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setSearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results = menuItems.filter(item => {
      // Filter out admin items if user is not admin
      if (item.admin && profile?.role !== 'admin') return false;
      return item.label.toLowerCase().includes(lowerQuery);
    });

    setSearchResults(results);
  };

  const handleSelectSearchResult = (id) => {
    setActiveTab(id);
    setSearchQuery('');
    setSearchResults([]);
  };

  useEffect(() => {
    checkUser();
    fetchAnnouncement();
    
    let subscription;
    let notifSub;
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

        notifSub = supabase
          .channel('public:notifications')
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'notifications',
            filter: `discord_id=eq.${discordId}`
          }, () => {
            fetchNotifications(discordId);
          })
          .subscribe();
      }
    });

    const settingsSub = supabase
      .channel('app_settings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
        fetchAnnouncement();
      })
      .subscribe();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
      if (notifSub) supabase.removeChannel(notifSub);
      supabase.removeChannel(settingsSub);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchQuery('');
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async (discordId) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('discord_id', discordId)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (data) {
        setNotifications(data.map(n => ({
          id: n.id,
          title: n.title,
          desc: n.message,
          time: new Date(n.created_at).toLocaleString('th-TH'),
          unread: !n.is_read
        })));
      }
    } catch(e) {
      console.error(e);
    }
  };

  const markAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    } catch(e) {}
  };

  const markAllAsRead = async () => {
    if (!profile) return;
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('discord_id', profile.discord_id).eq('is_read', false);
    } catch(e) {}
  };

  const deleteNotification = async (e, id) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await supabase.from('notifications').delete().eq('id', id);
    } catch(e) {}
  };

  const fetchAnnouncement = async () => {
    try {
      const { data } = await supabase.from('app_settings').select('*');
      if (data) {
        let text = '';
        let active = false;
        data.forEach(item => {
          if (item.setting_key === 'announcement_text') text = item.setting_value;
          if (item.setting_key === 'announcement_active') active = item.setting_value === 'true';
        });
        if (active && text) {
          setAnnouncement(text);
        } else {
          setAnnouncement(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/');
        return;
      }

      const user = session.user;
      const discordId = user.user_metadata.provider_id || user.id;
      
      if (user.user_metadata?.avatar_url) {
        setAvatarUrl(user.user_metadata.avatar_url);
      }

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
      fetchNotifications(discordId);
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
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span>กระดานหลัก</span>
          </div>
          
          <div className="nav-divider" style={{ margin: '1rem 0', borderBottom: '1px solid var(--border)', opacity: 0.5 }}></div>
          <div style={{ padding: '0 1.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>MEDIC SERVICES</div>
          
          <div 
            className={`nav-item ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <LayoutGrid size={20} />
            <span>ระบบรันคิวแพทย์</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'duty' ? 'active' : ''}`}
            onClick={() => setActiveTab('duty')}
          >
            <Clock size={20} />
            <span>ระบบเข้าเวรออกเวร</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'accident' ? 'active' : ''}`}
            onClick={() => setActiveTab('accident')}
          >
            <CalendarDays size={20} />
            <span>ระบบลางาน</span>
          </div>

          {profile?.role === 'admin' && (
            <>
              <div className="nav-divider" style={{ margin: '1rem 0', borderBottom: '1px solid var(--border)', opacity: 0.5 }}></div>
              <div style={{ padding: '0 1.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>ADMIN ONLY</div>
              
              <div 
                className={`nav-item ${activeTab === 'personnel' ? 'active' : ''}`}
                onClick={() => setActiveTab('personnel')}
              >
                <Users size={20} />
                <span>ระบบจัดการบุคลากรแพทย์</span>
              </div>
              <div 
                className={`nav-item ${activeTab === 'requests' ? 'active' : ''}`}
                onClick={() => setActiveTab('requests')}
              >
                <UserCog size={20} />
                <span>ระบบจัดการคำร้อง</span>
              </div>
              <div 
                className={`nav-item ${activeTab === 'salary' ? 'active' : ''}`}
                onClick={() => setActiveTab('salary')}
              >
                <Banknote size={20} />
                <span>ระบบคำนวณเงินเดือน</span>
              </div>
            </>
          )}
          
          <div style={{ marginTop: 'auto' }}>
            {profile?.role === 'admin' && (
              <div 
                className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <Settings size={20} />
                <span>ตั้งค่าระบบ & รายงาน</span>
              </div>
            )}
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
          <div style={{ position: 'relative' }} ref={searchRef}>
            <div className="header-search">
              <Search size={18} color="var(--text-secondary)" />
              <input 
                type="text" 
                placeholder="ค้นหาเมนูการใช้งาน..." 
                value={searchQuery}
                onChange={handleSearch}
              />
            </div>
            
            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '110%',
                left: 0,
                width: '100%',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                border: '1px solid var(--border-color)',
                zIndex: 100,
                overflow: 'hidden'
              }}>
                {searchResults.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => handleSelectSearchResult(item.id)}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.95rem',
                      color: 'var(--text-primary)',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.target.style.background = 'white'}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            )}
            
            {searchQuery && searchResults.length === 0 && (
              <div style={{
                position: 'absolute',
                top: '110%',
                left: 0,
                width: '100%',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                border: '1px solid var(--border-color)',
                zIndex: 100,
                padding: '1rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem'
              }}>
                ไม่พบเมนูที่ค้นหา
              </div>
            )}
          </div>

          <div className="header-actions">
            
            {/* Notification Bell */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button 
                className="icon-btn" 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
              >
                <Bell size={22} />
                {notifications.filter(n => n.unread).length > 0 && (
                  <span className="icon-badge"></span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {isNotifOpen && (
                <div style={{
                  position: 'absolute',
                  top: '120%',
                  right: 0,
                  width: '320px',
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                  border: '1px solid var(--border-color)',
                  zIndex: 100,
                  overflow: 'hidden',
                  animation: 'slideUp 0.2s ease-out'
                }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>การแจ้งเตือน</h3>
                    {notifications.filter(n => n.unread).length > 0 && (
                      <span style={{ background: '#ef4444', color: 'white', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                        {notifications.filter(n => n.unread).length} ใหม่
                      </span>
                    )}
                  </div>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.length > 0 ? notifications.map(notif => (
                      <div key={notif.id} style={{ 
                        padding: '1rem', 
                        borderBottom: '1px solid var(--border-color)',
                        background: notif.unread ? '#f8fafc' : 'white',
                        display: 'flex',
                        gap: '1rem',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        position: 'relative'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseOut={(e) => e.currentTarget.style.background = notif.unread ? '#f8fafc' : 'white'}
                      onClick={() => markAsRead(notif.id)}
                      >
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: notif.unread ? '#3b82f6' : 'transparent', marginTop: '6px', flexShrink: 0 }}></div>
                        <div style={{ flex: 1, paddingRight: '1.5rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{notif.title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.4 }}>{notif.desc}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{notif.time}</div>
                        </div>
                        <button 
                          onClick={(e) => deleteNotification(e, notif.id)}
                          style={{
                            position: 'absolute',
                            right: '1rem',
                            top: '1rem',
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fee2e2'; }}
                          onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
                          title="ลบการแจ้งเตือน"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )) : (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        ไม่มีการแจ้งเตือนใหม่
                      </div>
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <div 
                      style={{ padding: '0.75rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' }}
                      onClick={markAllAsRead}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                    >
                      อ่านทั้งหมด
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="user-profile">
              <div className="user-info">
                <div className="user-name">{profile?.ic_name}</div>
                <div className="user-role">{profile?.position}</div>
              </div>
              <div className="user-avatar" style={{ padding: avatarUrl ? 0 : undefined, overflow: 'hidden' }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  getInitial(profile?.ic_name)
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="dashboard-content" style={{ padding: '3rem 2rem' }}>
          
          {activeTab === 'dashboard' && (
            <div className="hub-container animate-fade-in">
              
              {announcement && (
                <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '1.25rem 1.5rem', borderRadius: '0 12px 12px 0', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <div style={{ background: '#fef3c7', padding: '0.75rem', borderRadius: '50%', color: '#d97706' }}>
                    <Bell size={24} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: '#92400e', fontSize: '1.05rem' }}>ประกาศจากผู้ดูแลระบบ</h4>
                    <p style={{ margin: 0, color: '#b45309', whiteSpace: 'pre-wrap' }}>{announcement}</p>
                  </div>
                </div>
              )}

            {/* Medic Section */}
            <div className="hub-section">
              <h2 className="hub-section-title medic">ระบบปฏิบัติการแพทย์ (Medic Services)</h2>
              <div className="hub-grid">
                
                <div className="hub-card medic">
                  <div className="hub-icon-wrapper">
                    <LayoutGrid size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="hub-card-title">ระบบรันคิวแพทย์</h3>
                  <p className="hub-card-desc">ระบบจัดการคิวผู้ป่วย จัดลำดับการเข้ารับการรักษา และการเรียกคิวเข้าห้องตรวจ</p>
                  <button className="hub-btn" onClick={() => setActiveTab('general')}>เข้าใช้งาน</button>
                </div>

                <div className="hub-card medic">
                  <div className="hub-icon-wrapper">
                    <Clock size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="hub-card-title">ระบบเข้าเวรออกเวร</h3>
                  <p className="hub-card-desc">บันทึกการลงเวลาปฏิบัติงาน และตรวจสอบตารางเวรของแพทย์แต่ละท่าน</p>
                  <button className="hub-btn" onClick={() => setActiveTab('duty')}>เข้าใช้งาน</button>
                </div>

                <div className="hub-card medic">
                  <div className="hub-icon-wrapper">
                    <CalendarDays size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="hub-card-title">ระบบลางาน</h3>
                  <p className="hub-card-desc">ระบบส่งใบลาพักผ่อน ลาป่วย และตรวจสอบประวัติการลางานของบุคลากร</p>
                  <button className="hub-btn" onClick={() => setActiveTab('accident')}>เข้าใช้งาน</button>
                </div>

              </div>
            </div>

            {/* Admin Section (Conditional) */}
            {profile?.role === 'admin' && (
              <div className="hub-section">
                <h2 className="hub-section-title admin">ระบบจัดการภายในแพทย์ (Admin Only)</h2>
                <div className="hub-grid">
                  
                  <div className="hub-card admin">
                    <div className="hub-icon-wrapper">
                      <Users size={32} strokeWidth={1.5} />
                    </div>
                    <h3 className="hub-card-title">ระบบจัดการบุคลากรแพทย์</h3>
                    <p className="hub-card-desc">ฐานข้อมูลทะเบียนประวัติ และปรับเปลี่ยนสิทธิ์ (Role) เจ้าหน้าที่</p>
                    <button className="hub-btn" onClick={() => setActiveTab('personnel')}>เข้าสู่ระบบ</button>
                  </div>

                  <div className="hub-card admin">
                    <div className="hub-icon-wrapper">
                      <UserCog size={32} strokeWidth={1.5} />
                    </div>
                    <h3 className="hub-card-title">ระบบจัดการคำร้อง</h3>
                    <p className="hub-card-desc">ตรวจสอบ อนุมัติ และจัดการคำร้องต่างๆ ที่ถูกส่งเข้ามาจากบุคลากร</p>
                    <button className="hub-btn" onClick={() => setActiveTab('requests')}>เข้าสู่ระบบ</button>
                  </div>

                  <div className="hub-card admin">
                    <div className="hub-icon-wrapper">
                      <Banknote size={32} strokeWidth={1.5} />
                    </div>
                    <h3 className="hub-card-title">ระบบคำนวณเงินเดือน</h3>
                    <p className="hub-card-desc">คำนวณรายได้ สรุปยอดเงินเดือน โบนัส และค่าตอบแทนพิเศษของบุคลากร</p>
                    <button className="hub-btn" onClick={() => setActiveTab('salary')}>เข้าสู่ระบบ</button>
                  </div>

                </div>
              </div>
            )}

            {/* Related Links */}
            <div className="related-links-card">
              <h3 className="related-links-title"><Star size={20} color="#f59e0b" fill="#f59e0b" /> แนะนำเว็บไซต์ที่เกี่ยวข้อง</h3>
              <a href="#" className="related-link-btn">
                <ExternalLink size={18} />
                กฎหน่วยงานแพทย์ WIP TOWN
              </a>
            </div>

            </div>
          )}

          {activeTab === 'general' && (
            <div className="hub-container animate-fade-in">
              <div className="hub-section">
                <h2 className="hub-section-title medic">ระบบรันคิวแพทย์</h2>
                <div style={{ background: 'white', padding: '3rem', borderRadius: '24px', textAlign: 'center', width: '100%', boxShadow: '0 10px 40px -10px rgba(124, 58, 237, 0.1)' }}>
                  <LayoutGrid size={48} color="#7c3aed" style={{ marginBottom: '1rem' }} />
                  <h3>ระบบรันคิวแพทย์</h3>
                  <p style={{ color: '#64748b' }}>(กำลังอยู่ในระหว่างการพัฒนาในลูปต่อไป)</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'duty' && (
            <DutySystem profile={profile} avatarUrl={avatarUrl} />
          )}

          {activeTab === 'accident' && (
            <LeaveSystem profile={profile} />
          )}

          {activeTab === 'personnel' && (
            <PersonnelSystem profile={profile} />
          )}

          {activeTab === 'requests' && (
            <RequestManagement profile={profile} />
          )}

          {activeTab === 'salary' && (
            <SalarySystem profile={profile} />
          )}

          {activeTab === 'settings' && (
            <SystemSettings profile={profile} />
          )}

        </div>
      </main>
    </div>
  );
}
