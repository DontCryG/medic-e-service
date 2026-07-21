import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Settings, FileText, Briefcase, Bell, Download, CalendarDays, PlusCircle, Trash2, Save } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './SystemSettings.css';

export default function SystemSettings({ profile }) {
  const [activeTab, setActiveTab] = useState('reports');
  const [loading, setLoading] = useState(true);

  // === Reports State ===
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState(new Date());
  const [reportData, setReportData] = useState([]);
  const [summaryData, setSummaryData] = useState({ totalPayout: 0, totalHours: 0 });
  const [isGenerating, setIsGenerating] = useState(false);
  const pdfRef = useRef();

  // === Positions State ===
  const [positions, setPositions] = useState([]);
  const [newPosition, setNewPosition] = useState('');
  const [newRate, setNewRate] = useState('');

  // === General Settings State ===
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementActive, setAnnouncementActive] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchData();
    }
  }, [profile, startDate, endDate, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'reports') {
        await fetchReportData();
      } else if (activeTab === 'positions') {
        await fetchPositions();
      } else if (activeTab === 'general') {
        await fetchSettings();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- Reports Logic ---
  const fetchReportData = async () => {
    try {
      // Fetch rates
      const { data: ratesData } = await supabase.from('salary_rates').select('*');
      const ratesMap = {};
      if (ratesData) {
        ratesData.forEach(r => ratesMap[r.position_name] = Number(r.hourly_rate));
      }

      // Fetch users
      const { data: usersData } = await supabase.from('users').select('*');
      const userMap = {};
      if (usersData) {
        usersData.forEach(u => userMap[u.discord_id] = u);
      }

      // Fetch duty sessions
      let query = supabase.from('duty_sessions').select('*').eq('status', 'completed');
      let adjQuery = supabase.from('salary_adjustments').select('*');

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        query = query.gte('clock_in', start.toISOString());
        adjQuery = adjQuery.gte('created_at', start.toISOString());
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23,59,59,999);
        query = query.lte('clock_in', end.toISOString());
        adjQuery = adjQuery.lte('created_at', end.toISOString());
      }

      const [sessionsRes, adjRes] = await Promise.all([query, adjQuery]);
      const sessions = sessionsRes.data || [];
      const adjustments = adjRes.data || [];

      const userWork = {};
      const userAdj = {};

      adjustments.forEach(adj => {
        if (!userAdj[adj.discord_id]) userAdj[adj.discord_id] = { bonus: 0, deduction: 0 };
        if (adj.type === 'bonus') userAdj[adj.discord_id].bonus += Number(adj.amount);
        if (adj.type === 'deduction') userAdj[adj.discord_id].deduction += Number(adj.amount);
      });

      let tPayout = 0;
      let tMins = 0;

      sessions.forEach(session => {
        if (!userWork[session.discord_id]) userWork[session.discord_id] = 0;
        const start = new Date(session.clock_in).getTime();
        const end = new Date(session.clock_out).getTime();
        const mins = Math.floor((end - start) / 60000) - (session.total_break_minutes || 0);
        if (mins > 0) {
          userWork[session.discord_id] += mins;
          tMins += mins;
        }
      });

      const finalData = [];
      Object.keys(userWork).forEach(discordId => {
        const user = userMap[discordId];
        if (!user) return;
        const tHours = userWork[discordId] / 60;
        const rate = ratesMap[user.position] || 0;
        const base = tHours * rate;
        const adj = userAdj[discordId] || { bonus: 0, deduction: 0 };
        const payout = Math.max(0, base + adj.bonus - adj.deduction);
        tPayout += payout;
        finalData.push({
          name: user.ic_name,
          position: user.position,
          hours: tHours,
          basePayout: base,
          bonus: adj.bonus,
          deduction: adj.deduction,
          payout: payout
        });
      });

      finalData.sort((a,b) => b.payout - a.payout);
      setReportData(finalData);
      setSummaryData({ totalPayout: tPayout, totalHours: tMins / 60 });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    const element = pdfRef.current;
    
    try {
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Salary_Report_${new Date().getTime()}.pdf`);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการสร้าง PDF');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Positions Logic ---
  const fetchPositions = async () => {
    const { data } = await supabase.from('salary_rates').select('*').order('position_name');
    if (data) setPositions(data);
  };

  const handleAddPosition = async () => {
    if (!newPosition) return;
    try {
      await supabase.from('salary_rates').insert([{ position_name: newPosition, hourly_rate: Number(newRate) || 0 }]);
      setNewPosition('');
      setNewRate('');
      fetchPositions();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeletePosition = async (id) => {
    if (!window.confirm('ลบตำแหน่งนี้?')) return;
    try {
      await supabase.from('salary_rates').delete().eq('id', id);
      fetchPositions();
    } catch (err) {
      alert(err.message);
    }
  };

  // --- General Settings Logic ---
  const fetchSettings = async () => {
    const { data } = await supabase.from('app_settings').select('*');
    if (data) {
      data.forEach(setting => {
        if (setting.setting_key === 'announcement_text') setAnnouncementText(setting.setting_value);
        if (setting.setting_key === 'announcement_active') setAnnouncementActive(setting.setting_value === 'true');
      });
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await supabase.from('app_settings').upsert([
        { setting_key: 'announcement_text', setting_value: announcementText },
        { setting_key: 'announcement_active', setting_value: announcementActive ? 'true' : 'false' }
      ]);
      alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const formatCurrency = (amt) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amt);
  const formatHours = (h) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh} ชม. ${mm} นาที`;
  };

  if (!profile || profile.role !== 'admin') return null;

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b', margin: 0 }}>
          <Settings size={28} color="#475569" /> ระบบตั้งค่าส่วนกลาง
        </h2>
        <div className="settings-tabs">
          <button className={`settings-tab-btn ${activeTab === 'reports' ? 'active reports' : ''}`} onClick={() => setActiveTab('reports')}>
            <FileText size={18} /> รายงาน (PDF)
          </button>
          <button className={`settings-tab-btn ${activeTab === 'positions' ? 'active positions' : ''}`} onClick={() => setActiveTab('positions')}>
            <Briefcase size={18} /> จัดการตำแหน่ง
          </button>
          <button className={`settings-tab-btn ${activeTab === 'general' ? 'active general' : ''}`} onClick={() => setActiveTab('general')}>
            <Bell size={18} /> ประกาศ & ทั่วไป
          </button>
        </div>
      </div>

      <div className="settings-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>กำลังโหลดข้อมูล...</div>
        ) : (
          <>
            {/* REPORTS TAB */}
            {activeTab === 'reports' && (
              <div className="animate-fade-in">
                <div className="report-controls">
                  <div className="filter-group">
                    <CalendarDays size={18} color="#94a3b8" />
                    <label style={{ marginRight: '0.5rem', fontWeight: 600 }}>ตั้งแต่:</label>
                    <DatePicker 
                      selected={startDate} onChange={d => setStartDate(d)} selectsStart startDate={startDate} endDate={endDate}
                      className="modal-input" dateFormat="dd/MM/yyyy"
                    />
                  </div>
                  <div className="filter-group">
                    <label style={{ marginRight: '0.5rem', fontWeight: 600 }}>ถึง:</label>
                    <DatePicker 
                      selected={endDate} onChange={d => setEndDate(d)} selectsEnd startDate={startDate} endDate={endDate} minDate={startDate}
                      className="modal-input" dateFormat="dd/MM/yyyy"
                    />
                  </div>
                  <button className="export-btn" onClick={handleDownloadPDF} disabled={isGenerating || reportData.length === 0}>
                    {isGenerating ? 'กำลังสร้าง PDF...' : <><Download size={20} /> ดาวน์โหลด PDF</>}
                  </button>
                </div>

                <div style={{ padding: '1rem', background: '#fffbeb', color: '#b45309', borderRadius: '12px', marginBottom: '2rem', fontSize: '0.9rem' }}>
                  <strong>Tip:</strong> รายงานด้านล่างนี้คือหน้าตาของไฟล์ PDF ที่คุณจะได้รับ คุณสามารถตรวจสอบความถูกต้องก่อนกดดาวน์โหลดได้เลยครับ
                </div>

                {/* HIDDEN PDF CONTAINER FOR HTML2CANVAS */}
                <div className="pdf-preview-container">
                  <div className="pdf-document" ref={pdfRef}>
                    <div className="pdf-header">
                      <h1 className="pdf-title">รายงานสรุปค่าตอบแทนบุคลากรทางการแพทย์</h1>
                      <p className="pdf-subtitle">
                        ประจำวันที่ {startDate.toLocaleDateString('th-TH')} ถึง {endDate.toLocaleDateString('th-TH')}
                      </p>
                    </div>

                    <table className="pdf-table">
                      <thead>
                        <tr>
                          <th>ลำดับ</th>
                          <th>ชื่อ-สกุล (IC)</th>
                          <th>ตำแหน่ง</th>
                          <th>ชั่วโมงเข้าเวร</th>
                          <th>โบนัส (+)/หัก (-)</th>
                          <th>ยอดสุทธิที่ต้องจ่าย</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((d, i) => (
                          <tr key={i}>
                            <td style={{textAlign: 'center'}}>{i + 1}</td>
                            <td>{d.name}</td>
                            <td>{d.position}</td>
                            <td style={{textAlign: 'center'}}>{formatHours(d.hours)}</td>
                            <td style={{textAlign: 'right'}}>
                              {d.bonus > 0 ? `+${formatCurrency(d.bonus)}` : ''} 
                              {d.deduction > 0 ? ` -${formatCurrency(d.deduction)}` : ''}
                              {d.bonus === 0 && d.deduction === 0 ? '-' : ''}
                            </td>
                            <td style={{textAlign: 'right', fontWeight: 'bold'}}>{formatCurrency(d.payout)}</td>
                          </tr>
                        ))}
                        {reportData.length === 0 && (
                          <tr><td colSpan="6" style={{textAlign: 'center', padding: '2rem'}}>ไม่มีข้อมูลในช่วงเวลานี้</td></tr>
                        )}
                      </tbody>
                    </table>

                    {reportData.length > 0 && (
                      <div className="pdf-summary">
                        <p>จำนวนบุคลากรทั้งหมด: <strong>{reportData.length} คน</strong></p>
                        <p>ชั่วโมงการทำงานรวม: <strong>{Math.floor(summaryData.totalHours)} ชั่วโมง</strong></p>
                        <p style={{fontSize: '18px'}}>ยอดรวมที่ต้องชำระทั้งสิ้น: <strong>{formatCurrency(summaryData.totalPayout)}</strong></p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* POSITIONS TAB */}
            {activeTab === 'positions' && (
              <div className="animate-fade-in" style={{ maxWidth: '600px' }}>
                <p style={{ color: '#64748b', marginBottom: '2rem' }}>เพิ่มหรือลบตำแหน่งในระบบ เพื่อให้ไปแสดงผลในหน้ารายชื่อและหน้าคำนวณเงินเดือน</p>
                
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                  <input type="text" className="modal-input" placeholder="ชื่อตำแหน่งใหม่" value={newPosition} onChange={e => setNewPosition(e.target.value)} />
                  <input type="number" className="modal-input" placeholder="เรทเริ่มต้น (บาท)" value={newRate} onChange={e => setNewRate(e.target.value)} style={{ width: '150px' }} />
                  <button className="export-btn" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px' }} onClick={handleAddPosition}>
                    <PlusCircle size={18} /> เพิ่ม
                  </button>
                </div>

                <div className="position-list">
                  {positions.map(pos => (
                    <div key={pos.id} className="position-item">
                      <div>
                        <div className="position-name">{pos.position_name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>เรทปัจจุบัน: {pos.hourly_rate} บ./ชม.</div>
                      </div>
                      <button className="delete-adj-btn" onClick={() => handleDeletePosition(pos.id)}><Trash2 size={18} /></button>
                    </div>
                  ))}
                  {positions.length === 0 && <div style={{textAlign: 'center', color: '#94a3b8', padding: '2rem'}}>ยังไม่มีข้อมูลตำแหน่ง</div>}
                </div>
              </div>
            )}

            {/* GENERAL SETTINGS TAB */}
            {activeTab === 'general' && (
              <div className="animate-fade-in">
                <div className="announcement-form">
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>ข้อความประกาศหน้า Dashboard</label>
                    <textarea 
                      className="modal-input" 
                      rows="4" 
                      placeholder="พิมพ์ข้อความที่ต้องการประกาศให้ทุกคนทราบ..."
                      value={announcementText}
                      onChange={e => setAnnouncementText(e.target.value)}
                    ></textarea>
                  </div>

                  <label className="toggle-switch">
                    <input type="checkbox" style={{ display: 'none' }} checked={announcementActive} onChange={e => setAnnouncementActive(e.target.checked)} />
                    <span className="toggle-slider"></span>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>เปิดใช้งานป้ายประกาศ</span>
                  </label>

                  <div style={{ marginTop: '1rem' }}>
                    <button className="export-btn" style={{ background: '#10b981' }} onClick={handleSaveSettings} disabled={savingSettings}>
                      <Save size={18} /> {savingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
