import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CalendarDays, LogOut, Send, History, CheckCircle, XCircle, Clock, Umbrella, AlertCircle } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Swal from 'sweetalert2';
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

  // Vacation Form & Logic
  const [vacationStartDate, setVacationStartDate] = useState(null);
  const [vacationEndDate, setVacationEndDate] = useState(null);
  const [workingDays, setWorkingDays] = useState(0);
  const [hasTakenVacation, setHasTakenVacation] = useState(false);
  const isDoctorOrAbove = profile?.position && (
    profile.position.includes('แพทย์') || 
    profile.position.includes('ชำนาญการ') || 
    profile.position.includes('เลขา') || 
    profile.position.includes('รอง') || 
    profile.position.includes('ผอ') || 
    profile.position.includes('ผู้อำนวยการ')
  ) && !profile.position.includes('นักศึกษา') && !profile.position.includes('นศพ');

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
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const allHistory = data || [];
      setHistory(allHistory.slice(0, 20));
      
      const vacationTaken = allHistory.some(req => req.request_type === 'vacation' && req.status !== 'rejected');
      setHasTakenVacation(vacationTaken);

      const { data: dutyData } = await supabase
        .from('duty_sessions')
        .select('clock_in')
        .eq('discord_id', profile.discord_id)
        .not('clock_in', 'is', null);
        
      if (dutyData) {
        const uniqueDates = new Set(dutyData.map(d => new Date(d.clock_in).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })));
        setWorkingDays(uniqueDates.size);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate || !leaveReason) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
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
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'ส่งคำร้องขอลางานสำเร็จ' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVacationSubmit = async (e) => {
    e.preventDefault();
    if (!vacationStartDate || !vacationEndDate) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณากรอกข้อมูลวันที่เริ่มลาและถึงวันที่ให้ครบถ้วน' });
      return;
    }
    
    if (workingDays < 30) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'ไม่สามารถลาพักร้อนได้เนื่องจากคุณยังทำงานไม่ครบ 30 วัน' });
      return;
    }
    
    if (hasTakenVacation) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'คุณได้ใช้สิทธิ์ลาพักร้อนไปแล้ว' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert([{
          discord_id: profile.discord_id,
          request_type: 'vacation',
          start_date: vacationStartDate.toISOString(),
          end_date: vacationEndDate.toISOString(),
          reason: 'ขอใช้สิทธิ์ลาพักร้อนประจำปี'
        }]);

      if (error) throw error;
      
      setVacationStartDate(null);
      setVacationEndDate(null);
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'ส่งคำร้องขอลาพักร้อนสำเร็จ' });
      fetchHistory();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResignSubmit = async (e) => {
    e.preventDefault();
    if (!resignReason || !resignDate) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
      return;
    }

    const result = await Swal.fire({
      title: 'ยืนยันการลาออก',
      text: 'คุณแน่ใจหรือไม่ที่จะส่งคำร้องขอลาออก? การกระทำนี้ไม่สามารถย้อนกลับได้',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก'
    });
    if (!result.isConfirmed) return;

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
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'ส่งคำร้องขอลาออกสำเร็จ กรุณารอแอดมินดำเนินการ' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
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
          className={`leave-tab-btn ${mode === 'vacation' ? 'active vacation' : ''}`}
          onClick={() => setMode('vacation')}
        >
          <Umbrella size={18} /> ลาพักร้อน
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
          ) : mode === 'vacation' ? (
            <>
              <h2 className="leave-card-title vacation-mode"><Umbrella size={28} /> ฟอร์มขอลาพักร้อน</h2>
              
              {!isDoctorOrAbove ? (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', color: '#991b1b', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <AlertCircle size={32} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>ไม่สามารถใช้สิทธิ์ได้</h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>คุณต้องอยู่ในตำแหน่ง "แพทย์" หรือสูงกว่า จึงจะมีสิทธิ์ลาพักร้อนได้</p>
                  </div>
                </div>
              ) : hasTakenVacation ? (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', color: '#991b1b', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <AlertCircle size={32} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>สิทธิ์ถูกใช้ไปแล้ว</h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>คุณได้ทำการใช้สิทธิ์ลาพักร้อน (1 ครั้ง) ไปแล้ว</p>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ backgroundColor: workingDays >= 30 ? '#ecfdf5' : '#fffbeb', border: `1px solid ${workingDays >= 30 ? '#a7f3d0' : '#fde68a'}`, padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', color: workingDays >= 30 ? '#065f46' : '#92400e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '1.05rem' }}>สิทธิ์ลาพักร้อนประจำปี</strong>
                      <span style={{ fontWeight: 600 }}>{workingDays}/30 วัน</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (workingDays / 30) * 100)}%`, height: '100%', background: workingDays >= 30 ? '#10b981' : '#f59e0b', transition: 'width 0.5s ease' }}></div>
                    </div>
                    {workingDays < 30 ? (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>*คุณต้องตอกบัตรเข้าเวรอีก {30 - workingDays} วัน เพื่อปลดล็อคสิทธิ์ลาพักร้อน (สิทธิ์สามารถใช้ได้ 1 ครั้ง)</p>
                    ) : (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>*คุณมีสิทธิ์สามารถลาพักร้อนได้แล้ว! (สิทธิ์สามารถใช้ได้ 1 ครั้ง)</p>
                    )}
                  </div>
                  
                  <form onSubmit={handleVacationSubmit}>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">วันที่เริ่มลาพักร้อน</label>
                        <DatePicker 
                          selected={vacationStartDate} 
                          onChange={(date) => setVacationStartDate(date)} 
                          selectsStart
                          startDate={vacationStartDate}
                          endDate={vacationEndDate}
                          minDate={new Date()}
                          placeholderText="ระบุวันที่"
                          className="form-input"
                          dateFormat="dd/MM/yyyy"
                          required
                          disabled={workingDays < 30}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">ถึงวันที่</label>
                        <DatePicker 
                          selected={vacationEndDate} 
                          onChange={(date) => setVacationEndDate(date)} 
                          selectsEnd
                          startDate={vacationStartDate}
                          endDate={vacationEndDate}
                          minDate={vacationStartDate || new Date()}
                          placeholderText="ระบุวันที่"
                          className="form-input"
                          dateFormat="dd/MM/yyyy"
                          required
                          disabled={workingDays < 30}
                        />
                      </div>
                    </div>
                    
                    <button type="submit" className="submit-btn vacation-btn" disabled={loading || workingDays < 30}>
                      <Umbrella size={20} /> ส่งคำร้องขอลาพักร้อน
                    </button>
                  </form>
                </>
              )}
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
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>
                        {req.request_type === 'resign' ? 'ขอลาออก' : req.request_type === 'vacation' ? 'ลาพักร้อน' : 'ขอลางาน'}
                      </h4>
                    </td>
                    <td>{formatDateString(req.created_at)}</td>
                    <td style={{ maxWidth: '200px' }}>
                      {req.request_type === 'leave' || req.request_type === 'vacation' ? (
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
