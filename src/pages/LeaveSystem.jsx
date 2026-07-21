import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CalendarDays, LogOut, Send, History, CheckCircle, XCircle, Clock } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './LeaveSystem.css';

export default function LeaveSystem({ profile }) {
  const [mode, setMode] = useState('leave'); // 'leave' or 'resign'
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  
  // Leave Form
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [leaveReason, setLeaveReason] = useState('');
  
  // Resign Form
  const [resignReason, setResignReason] = useState('');
  const [resignDate, setResignDate] = useState(null);

  useEffect(() => {
    if (profile) {
      fetchHistory();
      
      const subscription = supabase
        .channel('leave-requests')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'leave_requests',
          filter: `discord_id=eq.${profile.discord_id}`
        }, () => {
          fetchHistory();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [profile]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('discord_id', profile.discord_id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate || !leaveReason) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert([{
          discord_id: profile.discord_id,
          request_type: 'leave',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          reason: leaveReason
        }]);

      if (error) throw error;
      
      setStartDate(null);
      setEndDate(null);
      setLeaveReason('');
      alert('ส่งคำร้องขอลางานสำเร็จ');
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResignSubmit = async (e) => {
    e.preventDefault();
    if (!resignReason || !resignDate) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะส่งคำร้องขอลาออก?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert([{
          discord_id: profile.discord_id,
          request_type: 'resign',
          start_date: resignDate.toISOString(),
          reason: resignReason
        }]);

      if (error) throw error;
      
      setResignReason('');
      setResignDate(null);
      alert('ส่งคำร้องขอลาออกสำเร็จ กรุณารอแอดมินดำเนินการ');
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDateString = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('th-TH', { 
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'approved':
        return <span className="status-indicator approved"><CheckCircle size={14} /> อนุมัติแล้ว</span>;
      case 'rejected':
        return <span className="status-indicator rejected"><XCircle size={14} /> ไม่อนุมัติ</span>;
      default:
        return <span className="status-indicator pending"><Clock size={14} /> รอการอนุมัติ</span>;
    }
  };

  if (!profile) return null;

  return (
    <div className="leave-container">
      
      {/* Mode Toggle Tabs */}
      <div className="leave-tabs">
        <button 
          className={`leave-tab-btn ${mode === 'leave' ? 'active leave' : ''}`}
          onClick={() => setMode('leave')}
        >
          <CalendarDays size={18} /> ลางาน
        </button>
        <button 
          className={`leave-tab-btn ${mode === 'resign' ? 'active resign' : ''}`}
          onClick={() => setMode('resign')}
        >
          <LogOut size={18} /> ลาออก
        </button>
      </div>

      <div className="leave-content-grid">
        {/* Left: Request Form */}
        <div className="leave-card">
          {mode === 'leave' ? (
            <>
              <h2 className="leave-card-title leave-mode"><CalendarDays size={28} /> ฟอร์มขอลางาน</h2>
              <form onSubmit={handleLeaveSubmit}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">วันที่เริ่มลา</label>
                    <DatePicker 
                      selected={startDate} 
                      onChange={(date) => setStartDate(date)} 
                      selectsStart
                      startDate={startDate}
                      endDate={endDate}
                      placeholderText="ระบุวันที่"
                      className="form-input"
                      dateFormat="dd/MM/yyyy"
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">ถึงวันที่</label>
                    <DatePicker 
                      selected={endDate} 
                      onChange={(date) => setEndDate(date)} 
                      selectsEnd
                      startDate={startDate}
                      endDate={endDate}
                      minDate={startDate}
                      placeholderText="ระบุวันที่"
                      className="form-input"
                      dateFormat="dd/MM/yyyy"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">เหตุผลการลา</label>
                  <textarea 
                    className="form-textarea"
                    placeholder="ระบุเหตุผลการลา (เช่น ลาป่วย, ลากิจ, พักผ่อน)"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    required
                  ></textarea>
                </div>

                <button type="submit" className="submit-btn leave-btn" disabled={loading}>
                  <Send size={20} /> ส่งคำร้องขอลางาน
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="leave-card-title resign-mode"><LogOut size={28} /> ฟอร์มขอลาออก</h2>
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', color: '#991b1b', fontSize: '0.95rem' }}>
                <strong>หมายเหตุ:</strong> การส่งคำร้องขอลาออก จะส่งผลให้แอดมินพิจารณาปลดสิทธิ์คุณออกจากการเป็นบุคลากรของหน่วยงาน หากอนุมัติแล้วคุณจะไม่สามารถเข้าใช้งานระบบได้อีก
              </div>
              <form onSubmit={handleResignSubmit}>
                <div className="form-group">
                  <label className="form-label">วันทำงานวันสุดท้าย</label>
                  <DatePicker 
                    selected={resignDate} 
                    onChange={(date) => setResignDate(date)} 
                    placeholderText="ระบุวันที่"
                    className="form-input"
                    dateFormat="dd/MM/yyyy"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">เหตุผลการลาออก</label>
                  <textarea 
                    className="form-textarea"
                    placeholder="โปรดระบุเหตุผลในการตัดสินใจลาออกของคุณ..."
                    value={resignReason}
                    onChange={(e) => setResignReason(e.target.value)}
                    required
                  ></textarea>
                </div>

                <button type="submit" className="submit-btn resign-btn" disabled={loading}>
                  <Send size={20} /> ยืนยันการส่งคำร้องขอลาออก
                </button>
              </form>
            </>
          )}
        </div>

        {/* Right: History Table */}
        <div className="leave-card">
          <h2 className="leave-card-title" style={{ color: '#1e293b' }}><History size={24} color="#64748b" /> ประวัติคำร้องของคุณ</h2>
          
          <div style={{ overflowX: 'auto' }}>
            <table className="leave-table">
              <thead>
                <tr>
                  <th>ประเภท</th>
                  <th>วันที่ส่งคำร้อง</th>
                  <th>รายละเอียด/เหตุผล</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? history.map(req => (
                  <tr key={req.id}>
                    <td>
                      <span className={`req-type-badge ${req.request_type}`}>
                        {req.request_type === 'leave' ? 'ลางาน' : 'ลาออก'}
                      </span>
                    </td>
                    <td>{formatDateString(req.created_at)}</td>
                    <td style={{ maxWidth: '200px' }}>
                      {req.request_type === 'leave' ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                          {formatDateString(req.start_date)} - {formatDateString(req.end_date)}
                        </div>
                      ) : (
                        req.start_date && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                            วันสุดท้าย: {formatDateString(req.start_date)}
                          </div>
                        )
                      )}
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={req.reason}>
                        {req.reason}
                      </div>
                    </td>
                    <td>{getStatusDisplay(req.status)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                      ยังไม่มีประวัติการส่งคำร้อง
                    </td>
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
