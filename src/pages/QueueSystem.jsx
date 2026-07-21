import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, Edit3, History, Calendar, X } from 'lucide-react';
import './QueueSystem.css';

export default function QueueSystem({ profile }) {
  const [liveUsers, setLiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Timer & History State
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [startDate, setStartDate] = useState(getLocalDateString());
  const [endDate, setEndDate] = useState(getLocalDateString());

  // Update current time every second for the live timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (startTimeString) => {
    if (!startTimeString) return '';
    const start = new Date(startTimeString).getTime();
    const diff = Math.floor((currentTimeMs - start) / 1000);
    if (diff < 0) return '00:00:00';
    
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  useEffect(() => {
    fetchLiveUsers();

    // Subscribe to live users changes
    const subscription = supabase
      .channel('live-queue')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'duty_sessions'
      }, () => {
        fetchLiveUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchLiveUsers = async () => {
    try {
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
        .order('clock_in', { ascending: true });

      if (error) throw error;
      setLiveUsers(data || []);
    } catch (err) {
      console.error('Error fetching live users for queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (user, newStatus, currentStatus) => {
    const finalStatus = currentStatus === newStatus ? 'available' : newStatus;
    
    try {
      let updatePayload = { queue_state: finalStatus };

      // If they are STOPPING being a manager
      if (currentStatus === 'manager' && finalStatus !== 'manager') {
        if (user.current_manager_log_id) {
          // Calculate duration
          const startTime = new Date(user.manager_start_time).getTime();
          const durationMinutes = Math.floor((Date.now() - startTime) / 60000);
          
          await supabase
            .from('queue_manager_logs')
            .update({ 
              end_time: new Date().toISOString(),
              duration_minutes: durationMinutes
            })
            .eq('id', user.current_manager_log_id);
        }
        
        updatePayload.manager_start_time = null;
        updatePayload.current_manager_log_id = null;
      }

      // If they are STARTING to be a manager
      if (finalStatus === 'manager') {
        const { data: logData, error: logError } = await supabase
          .from('queue_manager_logs')
          .insert({ discord_id: user.discord_id })
          .select('id')
          .single();
          
        if (logError) throw logError;
        
        updatePayload.manager_start_time = new Date().toISOString();
        updatePayload.current_manager_log_id = logData.id;
      }

      const { error } = await supabase
        .from('duty_sessions')
        .update(updatePayload)
        .eq('id', user.id);
        
      if (error) throw error;
    } catch (err) {
      alert('Error updating queue status: ' + err.message);
    }
  };

  const handleRemarkChange = async (sessionId, newRemark) => {
    try {
      const { error } = await supabase
        .from('duty_sessions')
        .update({ queue_remark: newRemark })
        .eq('id', sessionId);
        
      if (error) throw error;
    } catch (err) {
      console.error('Error updating remark:', err);
    }
  };

  const handleStoryTimeChange = async (sessionId, newTime) => {
    try {
      const { error } = await supabase
        .from('duty_sessions')
        .update({ story_time: newTime })
        .eq('id', sessionId);
        
      if (error) throw error;
    } catch (err) {
      console.error('Error updating story time:', err);
    }
  };

  useEffect(() => {
    if (!profile) return;
    
    const checkTimeInterval = setInterval(() => {
      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      liveUsers.forEach(user => {
        const isMe = user.discord_id === profile.discord_id;
        
        // Auto-tick "Story" only for the logged-in user to prevent race conditions
        if (isMe && user.story_time && user.queue_state !== 'story') {
          if (currentTimeStr === user.story_time) {
            handleStatusChange(user, 'story', user.queue_state);
          }
        }
      });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkTimeInterval);
  }, [liveUsers, profile]);

  const fetchHistory = async () => {
    if (!startDate || !endDate) return;
    setLoadingHistory(true);
    try {
      const start = new Date(`${startDate}T00:00:00+07:00`).toISOString();
      const end = new Date(`${endDate}T23:59:59+07:00`).toISOString();

      const { data, error } = await supabase
        .from('queue_manager_logs')
        .select('duration_minutes, discord_id')
        .gte('start_time', start)
        .lte('start_time', end);

      if (error) throw error;

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('discord_id, ic_name');

      if (usersError) throw usersError;

      const userMap = {};
      usersData.forEach(u => { userMap[u.discord_id] = u.ic_name; });

      const grouped = {};
      data.forEach(log => {
        if (!log.duration_minutes) return;
        if (!grouped[log.discord_id]) grouped[log.discord_id] = 0;
        grouped[log.discord_id] += log.duration_minutes;
      });

      const result = Object.keys(grouped).map(did => ({
        ic_name: userMap[did] || did,
        total_minutes: grouped[did]
      })).sort((a, b) => b.total_minutes - a.total_minutes);

      setHistoryData(result);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showHistory) {
      fetchHistory();
    }
  }, [showHistory, startDate, endDate]);

  if (!profile) return null;

  const isAdmin = profile.role === 'admin';

  return (
    <div className="queue-container">
      <div className="queue-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="queue-title"><Users size={24} color="var(--primary-color)" /> จัดการคิวแพทย์ (Medic Queue)</h2>
          <p className="queue-subtitle">ตารางแสดงสถานะการรับเคสของบุคลากรที่กำลังเข้าเวร</p>
        </div>
        <button 
          onClick={() => setShowHistory(true)}
          className="history-btn"
        >
          <History size={18} />
          ประวัติการรันคิว
        </button>
      </div>

      <div className="queue-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="queue-table">
            <thead>
              <tr>
                <th className="col-name" style={{ backgroundColor: '#fcd5ce' }}>รายชื่อ</th>
                <th className="col-unavailable" style={{ backgroundColor: '#e63946', color: 'white' }}>ไม่สะดวก</th>
                <th className="col-queued" style={{ backgroundColor: '#2a9d8f', color: 'white' }}>คิว</th>
                <th className="col-manager" style={{ backgroundColor: '#457b9d', color: 'white' }}>หมอรันคิว</th>
                <th className="col-story" style={{ backgroundColor: '#9d4edd', color: 'white' }}>สตอรี่</th>
                <th className="col-story-time" style={{ backgroundColor: '#e0aaff', color: 'black' }}>เวลาไป</th>
                <th className="col-remark">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>กำลังโหลดข้อมูล...</td></tr>
              ) : liveUsers.length > 0 ? (
                liveUsers.map((user) => {
                  const isMe = user.discord_id === profile.discord_id;
                  const canEdit = isMe || isAdmin;
                  const queueState = user.queue_state || 'available';

                  return (
                    <tr key={user.id} className={isMe ? 'row-me' : ''}>
                      <td className="col-name">
                        <div style={{ 
                          fontWeight: 600,
                          color: queueState === 'story' ? '#e63946' : 'inherit'
                        }}>
                          {user.users?.ic_name} {isMe && <span className="badge-me">(คุณ)</span>}
                        </div>
                      </td>
                      
                      <td className="col-unavailable" style={{ backgroundColor: '#ffeaeb' }}>
                        <label className={`checkbox-container ${!canEdit ? 'disabled' : ''}`}>
                          <input 
                            type="checkbox" 
                            checked={queueState === 'unavailable'}
                            onChange={() => handleStatusChange(user, 'unavailable', queueState)}
                            disabled={!canEdit}
                          />
                          <span className="checkmark checkmark-red"></span>
                        </label>
                      </td>

                      <td className="col-queued" style={{ backgroundColor: '#e2f0eb' }}>
                        <label className={`checkbox-container ${!canEdit ? 'disabled' : ''}`}>
                          <input 
                            type="checkbox" 
                            checked={queueState === 'queued'}
                            onChange={() => handleStatusChange(user, 'queued', queueState)}
                            disabled={!canEdit}
                          />
                          <span className="checkmark checkmark-green"></span>
                        </label>
                      </td>

                      <td className="col-manager" style={{ backgroundColor: '#eaf4f4' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <label className={`checkbox-container ${!canEdit ? 'disabled' : ''}`}>
                            <input 
                              type="checkbox" 
                              checked={queueState === 'manager'}
                              onChange={() => handleStatusChange(user, 'manager', queueState)}
                              disabled={!canEdit}
                            />
                            <span className="checkmark checkmark-blue"></span>
                          </label>
                          {queueState === 'manager' && user.manager_start_time && (
                            <span style={{ fontSize: '0.75rem', color: '#1d3557', fontWeight: 600, fontFamily: 'monospace' }}>
                              ⏱️ {formatTimer(user.manager_start_time)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="col-story" style={{ backgroundColor: '#f3e8ff' }}>
                        <label className={`checkbox-container ${!canEdit ? 'disabled' : ''}`}>
                          <input 
                            type="checkbox" 
                            checked={queueState === 'story'}
                            onChange={() => handleStatusChange(user, 'story', queueState)}
                            disabled={!canEdit}
                          />
                          <span className="checkmark checkmark-purple"></span>
                        </label>
                      </td>

                      <td className="col-story-time" style={{ backgroundColor: '#f9f5ff' }}>
                        <div className="remark-input-container">
                          <input 
                            type="time" 
                            className="remark-input time-input"
                            defaultValue={user.story_time || ''}
                            disabled={!canEdit}
                            onBlur={(e) => {
                              if (e.target.value !== user.story_time) {
                                handleStoryTimeChange(user.id, e.target.value);
                              }
                            }}
                          />
                        </div>
                      </td>

                      <td className="col-remark">
                        <div className="remark-input-container">
                          <input 
                            type="text" 
                            className="remark-input"
                            defaultValue={user.queue_remark || ''}
                            placeholder={canEdit ? "พิมพ์หมายเหตุ..." : ""}
                            disabled={!canEdit}
                            onBlur={(e) => {
                              if (e.target.value !== user.queue_remark) {
                                handleRemarkChange(user.id, e.target.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur();
                              }
                            }}
                          />
                          {canEdit && <Edit3 size={14} className="edit-icon" />}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    ไม่มีบุคลากรเข้าเวรในขณะนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showHistory && (
        <div className="modal-overlay">
          <div className="modal-content history-modal">
            <div className="modal-header">
              <h2><History size={24} color="var(--primary-color)" style={{ marginRight: '8px' }} /> ประวัติหมอรันคิว</h2>
              <button className="close-btn" onClick={() => setShowHistory(false)}><X size={24} /></button>
            </div>
            
            <div className="history-filters">
              <div className="filter-group">
                <Calendar size={18} color="var(--text-secondary)" />
                <span>จากวันที่:</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="date-input"
                />
              </div>
              <div className="filter-group">
                <span>ถึงวันที่:</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="date-input"
                />
              </div>
            </div>

            <div className="history-table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>รายชื่อแพทย์</th>
                    <th style={{ backgroundColor: '#f8f9fa', textAlign: 'center', fontWeight: 600 }}>เวลาทั้งหมด (นาที)</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingHistory ? (
                    <tr><td colSpan="2" style={{ textAlign: 'center', padding: '2rem' }}>กำลังโหลด...</td></tr>
                  ) : historyData.length > 0 ? (
                    historyData.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{item.ic_name}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#457b9d' }}>
                          {item.total_minutes} นาที
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        ไม่มีข้อมูลการรันคิวในช่วงเวลานี้
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
