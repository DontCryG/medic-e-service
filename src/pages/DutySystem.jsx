import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Play, Pause, Square, Clock, Users, Activity, Filter, RefreshCw } from 'lucide-react';
import './DutySystem.css';

export default function DutySystem({ profile }) {
  const [currentSession, setCurrentSession] = useState(null);
  const [liveUsers, setLiveUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  
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
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [profile, filterDate]);

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
            position
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
        .select('*')
        .eq('discord_id', profile.discord_id)
        .eq('status', 'completed')
        .order('clock_in', { ascending: false })
        .limit(20);

      if (filterDate) {
        // Simple date filter
        const startOfDay = new Date(filterDate);
        startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(filterDate);
        endOfDay.setHours(23,59,59,999);
        
        query = query
          .gte('clock_in', startOfDay.toISOString())
          .lte('clock_in', endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      setHistory(data || []);
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
      alert('Error clocking in: ' + err.message);
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
      alert('Error changing break status: ' + err.message);
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
      alert('Error clocking out: ' + err.message);
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
          <div className="duty-avatar">
            {getInitial(profile.ic_name)}
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
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>ไม่มีผู้เข้าเวรในขณะนี้</td>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={18} color="var(--text-secondary)" />
              <input 
                type="date" 
                className="filter-input" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="duty-table">
              <thead>
                <tr>
                  <th>วันที่เข้าเวร</th>
                  <th>เวลาออกเวร</th>
                  <th>พักเบรก (นาที)</th>
                  <th>รวมเวลา (ชม.)</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? history.map(log => {
                  const start = new Date(log.clock_in).getTime();
                  const end = new Date(log.clock_out).getTime();
                  const diffHours = ((end - start) / 3600000) - (log.total_break_minutes / 60);
                  
                  return (
                    <tr key={log.id}>
                      <td>{formatDateString(log.clock_in)}</td>
                      <td>{new Date(log.clock_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{log.total_break_minutes}</td>
                      <td style={{ fontWeight: 600 }}>{diffHours > 0 ? diffHours.toFixed(1) : '0.0'}</td>
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
        </div>
      </div>
    </div>
  );
}
