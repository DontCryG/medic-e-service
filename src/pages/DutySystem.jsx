import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Play, Pause, Square, Clock, Users, Activity, Filter, RefreshCw } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Swal from 'sweetalert2';
import './DutySystem.css';

export default function DutySystem({ profile, avatarUrl }) {
  const [currentSession, setCurrentSession] = useState(null);
  const [liveUsers, setLiveUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [endDate, setEndDate] = useState(new Date());
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const itemsPerPage = 50;
  
  // Timer state
  const [dutyTime, setDutyTime] = useState(0);

  useEffect(() => {
    if (profile) {
      fetchCurrentSession();
      fetchLiveUsers();
      fetchHistory();
      
      // Subscribe to live users changes
      const subscription = supabase
        .channel('live-duty')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'duty_sessions'
        }, () => {
          fetchLiveUsers();
          fetchCurrentSession(); // In case admin changes it or it updates elsewhere
          fetchHistory();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [profile, startDate, endDate, historyPage]);

  // Timer effect
  useEffect(() => {
    let interval;
    if (currentSession && currentSession.status === 'on_duty') {
      interval = setInterval(() => {
        const start = new Date(currentSession.clock_in).getTime();
        const now = new Date().getTime();
        let breakMs = currentSession.total_break_minutes * 60000;
        
        // Calculate total time minus break time
        setDutyTime(Math.floor((now - start - breakMs) / 1000));
      }, 1000);
    } else if (currentSession && currentSession.status === 'on_break') {
      // Just keep the last duty time static while on break
      const start = new Date(currentSession.clock_in).getTime();
      const breakStart = new Date(currentSession.last_break_start).getTime();
      let prevBreakMs = currentSession.total_break_minutes * 60000;
      setDutyTime(Math.floor((breakStart - start - prevBreakMs) / 1000));
    } else {
      setDutyTime(0);
    }
    return () => clearInterval(interval);
  }, [currentSession]);

  const fetchCurrentSession = async () => {
    try {
      const { data, error } = await supabase
        .from('duty_sessions')
        .select('*')
        .eq('discord_id', profile.discord_id)
        .in('status', ['on_duty', 'on_break'])
        .order('clock_in', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching current session:', error);
      } else {
        setCurrentSession(data || null);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveUsers = async () => {
    try {
      // Join with users table to get names
      const { data, error } = await supabase
        .from('duty_sessions')
        .select(`
          *,
          users (
            ic_name,
            position,
            avatar_url
          )
        `)
        .in('status', ['on_duty', 'on_break'])
        .order('clock_in', { ascending: false });

      if (error) throw error;
      setLiveUsers(data || []);
    } catch (err) {
      console.error('Error fetching live users:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      let query = supabase
        .from('duty_sessions')
        .select('*', { count: 'exact' })
        .eq('discord_id', profile.discord_id)
        .eq('status', 'completed')
        .order('clock_in', { ascending: false });

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        query = query.gte('clock_in', start.toISOString());
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23,59,59,999);
        query = query.lte('clock_in', end.toISOString());
      }

      const from = (historyPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      setHistory(data || []);
      if (count !== null) setHistoryTotal(count);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleClockIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('duty_sessions')
        .insert([{
          discord_id: profile.discord_id,
          status: 'on_duty'
        }]);
      if (error) throw error;
      fetchCurrentSession();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'เข้าเวรไม่สำเร็จ: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleBreak = async () => {
    if (!currentSession) return;
    setLoading(true);
    try {
      if (currentSession.status === 'on_duty') {
        // Take break
        const { error } = await supabase
          .from('duty_sessions')
          .update({ 
            status: 'on_break',
            last_break_start: new Date().toISOString()
          })
          .eq('id', currentSession.id);
        if (error) throw error;
      } else {
        // Return from break
        const breakStart = new Date(currentSession.last_break_start).getTime();
        const now = new Date().getTime();
        const breakMinutes = Math.floor((now - breakStart) / 60000);
        
        const { error } = await supabase
          .from('duty_sessions')
          .update({ 
            status: 'on_duty',
            total_break_minutes: currentSession.total_break_minutes + breakMinutes,
            last_break_start: null
          })
          .eq('id', currentSession.id);
        if (error) throw error;
      }
      fetchCurrentSession();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'เปลี่ยนสถานะไม่สำเร็จ: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentSession) return;
    setLoading(true);
    try {
      let finalBreakMinutes = currentSession.total_break_minutes;
      
      // If they are on break when they clock out, calculate the last break segment
      if (currentSession.status === 'on_break') {
        const breakStart = new Date(currentSession.last_break_start).getTime();
        const now = new Date().getTime();
        finalBreakMinutes += Math.floor((now - breakStart) / 60000);
      }

      const { error } = await supabase
        .from('duty_sessions')
        .update({ 
          status: 'completed',
          clock_out: new Date().toISOString(),
          total_break_minutes: finalBreakMinutes
        })
        .eq('id', currentSession.id);
      
      if (error) throw error;
      
      fetchCurrentSession();
      fetchHistory();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ออกเวรไม่สำเร็จ: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminToggleBreak = async (session) => {
    const result = await Swal.fire({
      title: 'ยืนยันการทำรายการ',
      text: `ต้องการเปลี่ยนสถานะการพักเบรกของ ${session.users?.ic_name} ใช่หรือไม่?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก'
    });
    if (!result.isConfirmed) return;
    
    setLoading(true);
    try {
      if (session.status === 'on_duty') {
        await supabase
          .from('duty_sessions')
          .update({ 
            status: 'on_break',
            last_break_start: new Date().toISOString()
          })
          .eq('id', session.id);
      } else {
        const breakStart = new Date(session.last_break_start).getTime();
        const now = new Date().getTime();
        const breakMinutes = Math.floor((now - breakStart) / 60000);
        
        await supabase
          .from('duty_sessions')
          .update({ 
            status: 'on_duty',
            total_break_minutes: session.total_break_minutes + breakMinutes,
            last_break_start: null
          })
          .eq('id', session.id);
      }
      fetchLiveUsers();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminClockOut = async (session) => {
    const result = await Swal.fire({
      title: 'ยืนยันการทำรายการ',
      text: `ต้องการให้ ${session.users?.ic_name} ออกเวรใช่หรือไม่?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444'
    });
    if (!result.isConfirmed) return;
    
    setLoading(true);
    try {
      let finalBreakMinutes = session.total_break_minutes;
      if (session.status === 'on_break') {
        const breakStart = new Date(session.last_break_start).getTime();
        const now = new Date().getTime();
        finalBreakMinutes += Math.floor((now - breakStart) / 60000);
      }

      await supabase
        .from('duty_sessions')
        .update({ 
          status: 'completed',
          clock_out: new Date().toISOString(),
          total_break_minutes: finalBreakMinutes
        })
        .eq('id', session.id);
      
      fetchLiveUsers();
      if (session.discord_id === profile.discord_id) {
         fetchCurrentSession();
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDateString = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('th-TH', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : 'M';

  if (!profile) return null;

  return (
    <div className="duty-container">
      
      {/* Control Panel */}
      <div className="duty-action-panel">
        <div className="duty-user-info">
          <div className="duty-avatar" style={{ padding: avatarUrl ? 0 : undefined, overflow: 'hidden' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              getInitial(profile.ic_name)
            )}
          </div>
          <div className="duty-details">
            <h2>{profile.ic_name}</h2>
            <p>{profile.position}</p>
            {currentSession && (
              <div className={`duty-timer ${currentSession.status === 'on_break' ? 'break' : ''}`}>
                <Clock size={18} />
                {currentSession.status === 'on_break' ? 'กำลังพักเบรก' : 'เวลาเข้าเวร:'} 
                {currentSession.status === 'on_duty' && <span style={{ marginLeft: '5px' }}>{formatTime(dutyTime)}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="duty-actions">
          {!currentSession ? (
            <button 
              className="duty-btn btn-clock-in" 
              onClick={handleClockIn} 
              disabled={loading}
            >
              <Play size={20} /> เข้าเวร
            </button>
          ) : (
            <>
              <button 
                className="duty-btn btn-break" 
                onClick={handleBreak} 
                disabled={loading}
              >
                {currentSession.status === 'on_break' ? (
                  <><RefreshCw size={20} /> กลับมาเข้าเวร</>
                ) : (
                  <><Pause size={20} /> พักเบรก</>
                )}
              </button>
              <button 
                className="duty-btn btn-clock-out" 
                onClick={handleClockOut} 
                disabled={loading}
              >
                <Square size={20} /> ออกเวร
              </button>
            </>
          )}
        </div>
      </div>

      <div className="duty-content-grid">
        {/* Live Status */}
        <div className="duty-card">
          <div className="duty-card-header">
            <h3 className="duty-card-title"><Activity size={22} color="#7c3aed" /> กำลังเข้าเวร <span className="live-badge">LIVE</span></h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="duty-table">
              <thead>
                <tr>
                  <th>ชื่อแพทย์</th>
                  <th>สถานะ</th>
                  <th>เวลาเริ่ม</th>
                  {profile.role === 'admin' && <th style={{ textAlign: 'right' }}>จัดการ (แอดมิน)</th>}
                </tr>
              </thead>
              <tbody>
                {liveUsers.length > 0 ? liveUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.users?.ic_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user.users?.position}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${user.status}`}>
                        {user.status === 'on_duty' ? 'ปฏิบัติหน้าที่' : 'พักเบรก'}
                      </span>
                    </td>
                    <td>{new Date(user.clock_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
                    {profile.role === 'admin' && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button 
                            className="duty-btn btn-break" 
                            style={{ 
                              padding: '6px 16px', 
                              fontSize: '0.85rem', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              minWidth: '90px', 
                              justifyContent: 'center',
                              borderRadius: '9999px',
                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                              color: 'white',
                              border: 'none',
                              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.4)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)'; }}
                            onClick={() => handleAdminToggleBreak(user)}
                            disabled={loading}
                          >
                            {user.status === 'on_break' ? <><Play size={14} /> กลับ</> : <><Pause size={14} /> พัก</>}
                          </button>
                          <button 
                            className="duty-btn btn-clock-out" 
                            style={{ 
                              padding: '6px 16px', 
                              fontSize: '0.85rem', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              justifyContent: 'center',
                              borderRadius: '9999px',
                              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                              color: 'white',
                              border: 'none',
                              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)'; }}
                            onClick={() => handleAdminClockOut(user)}
                            disabled={loading}
                          >
                            <Square size={14} /> ออกเวร
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={profile.role === 'admin' ? "4" : "3"} style={{ textAlign: 'center', padding: '2rem' }}>ไม่มีผู้เข้าเวรในขณะนี้</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Duty History */}
        <div className="duty-card">
          <div className="duty-card-header">
            <h3 className="duty-card-title"><Clock size={22} color="#7c3aed" /> ประวัติการเข้าเวรของคุณ</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Filter size={18} color="var(--text-secondary)" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ตั้งแต่:</span>
                <DatePicker 
                  selected={startDate} 
                  onChange={(date) => { setStartDate(date); setHistoryPage(1); }} 
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  placeholderText="วว/ดด/ปปปป"
                  className="filter-input date-picker-custom"
                  dateFormat="dd/MM/yyyy"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ถึง:</span>
                <DatePicker 
                  selected={endDate} 
                  onChange={(date) => { setEndDate(date); setHistoryPage(1); }} 
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate}
                  placeholderText="วว/ดด/ปปปป"
                  className="filter-input date-picker-custom"
                  dateFormat="dd/MM/yyyy"
                />
              </div>
              <button 
                onClick={() => {
                  setStartDate(null);
                  setEndDate(null);
                  setHistoryPage(1);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-color)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ดูทั้งหมด
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="duty-table">
              <thead>
                <tr>
                  <th>วันที่เข้าเวร</th>
                  <th>เวลาออกเวร</th>
                  <th>พักเบรก (นาที)</th>
                  <th>รวมเวลา</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? history.map(log => {
                  const start = new Date(log.clock_in).getTime();
                  const end = new Date(log.clock_out).getTime();
                  
                  const diffMs = end - start;
                  const totalMinutes = Math.floor(diffMs / 60000) - log.total_break_minutes;
                  const displayMinutes = Math.max(0, totalMinutes);
                  const hours = Math.floor(displayMinutes / 60);
                  const minutes = displayMinutes % 60;
                  
                  let formattedTime = '';
                  if (hours > 0) {
                    formattedTime += `${hours} ชม. `;
                  }
                  formattedTime += `${minutes} นาที`;
                  
                  return (
                    <tr key={log.id}>
                      <td>{formatDateString(log.clock_in)}</td>
                      <td>{new Date(log.clock_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{log.total_break_minutes}</td>
                      <td style={{ fontWeight: 600 }}>{formattedTime}</td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>ไม่มีประวัติการเข้าเวร</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {historyTotal > itemsPerPage && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                disabled={historyPage === 1}
                style={{ 
                  padding: '6px 16px', 
                  borderRadius: '6px',
                  background: historyPage === 1 ? 'var(--bg-color)' : 'var(--surface-color)', 
                  color: historyPage === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)', 
                  border: '1px solid var(--border-color)',
                  cursor: historyPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                ก่อนหน้า
              </button>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                หน้า {historyPage} จาก {Math.ceil(historyTotal / itemsPerPage)}
              </span>
              <button 
                onClick={() => setHistoryPage(p => Math.min(Math.ceil(historyTotal / itemsPerPage), p + 1))}
                disabled={historyPage >= Math.ceil(historyTotal / itemsPerPage)}
                style={{ 
                  padding: '6px 16px', 
                  borderRadius: '6px',
                  background: historyPage >= Math.ceil(historyTotal / itemsPerPage) ? 'var(--bg-color)' : 'var(--surface-color)', 
                  color: historyPage >= Math.ceil(historyTotal / itemsPerPage) ? 'var(--text-tertiary)' : 'var(--text-primary)', 
                  border: '1px solid var(--border-color)',
                  cursor: historyPage >= Math.ceil(historyTotal / itemsPerPage) ? 'not-allowed' : 'pointer'
                }}
              >
                ถัดไป
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
