import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, Edit3 } from 'lucide-react';
import './QueueSystem.css';

export default function QueueSystem({ profile }) {
  const [liveUsers, setLiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleStatusChange = async (sessionId, newStatus, currentStatus) => {
    // If the same status is clicked, it unchecks it (sets back to 'available')
    const finalStatus = currentStatus === newStatus ? 'available' : newStatus;
    
    try {
      const { error } = await supabase
        .from('duty_sessions')
        .update({ queue_state: finalStatus })
        .eq('id', sessionId);
        
      if (error) throw error;
      // Realtime subscription will update the UI
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
            handleStatusChange(user.id, 'story', user.queue_state);
          }
        }
      });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkTimeInterval);
  }, [liveUsers, profile]);

  if (!profile) return null;

  const isAdmin = profile.role === 'admin';

  return (
    <div className="queue-container">
      <div className="queue-header">
        <h2 className="queue-title"><Users size={24} color="var(--primary-color)" /> จัดการคิวแพทย์ (Medic Queue)</h2>
        <p className="queue-subtitle">ตารางแสดงสถานะการรับเคสของบุคลากรที่กำลังเข้าเวร</p>
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
                            onChange={() => handleStatusChange(user.id, 'unavailable', queueState)}
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
                            onChange={() => handleStatusChange(user.id, 'queued', queueState)}
                            disabled={!canEdit}
                          />
                          <span className="checkmark checkmark-green"></span>
                        </label>
                      </td>

                      <td className="col-manager" style={{ backgroundColor: '#eaf4f4' }}>
                        <label className={`checkbox-container ${!canEdit ? 'disabled' : ''}`}>
                          <input 
                            type="checkbox" 
                            checked={queueState === 'manager'}
                            onChange={() => handleStatusChange(user.id, 'manager', queueState)}
                            disabled={!canEdit}
                          />
                          <span className="checkmark checkmark-blue"></span>
                        </label>
                      </td>

                      <td className="col-story" style={{ backgroundColor: '#f3e8ff' }}>
                        <label className={`checkbox-container ${!canEdit ? 'disabled' : ''}`}>
                          <input 
                            type="checkbox" 
                            checked={queueState === 'story'}
                            onChange={() => handleStatusChange(user.id, 'story', queueState)}
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
    </div>
  );
}
