import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Settings, FileText, Briefcase, Bell, Download, CalendarDays, PlusCircle, Trash2, Save, ChevronDown, Building, Edit2, Search, X } from 'lucide-react';
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
  const [reportCategory, setReportCategory] = useState('all');
  const [reportData, setReportData] = useState([]);
  const [summaryData, setSummaryData] = useState({ totalPayout: 0, totalHours: 0 });
  const [isGenerating, setIsGenerating] = useState(false);
  const pdfRef = useRef();
  
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // === Positions State ===
  const [positions, setPositions] = useState([]);
  const [newPosition, setNewPosition] = useState('');
  const [newRate, setNewRate] = useState('');

  // === Agencies State ===
  const [agencies, setAgencies] = useState([]);
  const [newAgencyName, setNewAgencyName] = useState('');
  const [newAgencyCategory, setNewAgencyCategory] = useState('Gang');
  const [searchAgency, setSearchAgency] = useState('');
  const [editingAgency, setEditingAgency] = useState(''); // Stores the agency object being edited
  const [editAgencyInput, setEditAgencyInput] = useState('');
  const [editAgencyCategory, setEditAgencyCategory] = useState('Gang');

  // === General Settings State ===
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementActive, setAnnouncementActive] = useState(true);
  const [notifyAll, setNotifyAll] = useState(false);
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
      } else if (activeTab === 'agencies') {
        await fetchAgencies();
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
      // 1. Fetch Salary Rates
      const { data: ratesData } = await supabase.from('salary_rates').select('*');
      const ratesMap = {};
      if (ratesData) ratesData.forEach(r => ratesMap[r.position_name] = Number(r.hourly_rate));

      // 2. Fetch Users
      const { data: usersData } = await supabase.from('users').select('*');
      const userMap = {};
      if (usersData) usersData.forEach(u => userMap[u.discord_id] = u);

      let query = supabase.from('duty_sessions').select('*').eq('status', 'completed');
      let adjQuery = supabase.from('salary_adjustments').select('*');
      let queueQuery = supabase.from('queue_manager_logs').select('*');

      if (startDate) {
        const start = new Date(startDate); start.setHours(0,0,0,0);
        query = query.gte('clock_in', start.toISOString());
        adjQuery = adjQuery.gte('created_at', start.toISOString());
        queueQuery = queueQuery.gte('start_time', start.toISOString());
      }
      
      if (endDate) {
        const end = new Date(endDate); end.setHours(23,59,59,999);
        query = query.lte('clock_in', end.toISOString());
        adjQuery = adjQuery.lte('created_at', end.toISOString());
        queueQuery = queueQuery.lte('start_time', end.toISOString());
      }

      const [sessionsRes, adjRes, queueRes] = await Promise.all([query, adjQuery, queueQuery]);
      const sessions = sessionsRes.data || [];
      const adjustments = adjRes.data || [];
      const queueLogs = queueRes.data || [];

      // Calculate Queue Manager Bonus
      const userQueueData = {};
      queueLogs.forEach(log => {
        if (!log.duration_minutes) return;
        const d = new Date(log.start_time);
        const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d);
        if (!userQueueData[log.discord_id]) userQueueData[log.discord_id] = {};
        if (!userQueueData[log.discord_id][dateStr]) userQueueData[log.discord_id][dateStr] = 0;
        userQueueData[log.discord_id][dateStr] += log.duration_minutes;
      });

      const userBonusMinutes = {};
      Object.keys(userQueueData).forEach(discordId => {
        userBonusMinutes[discordId] = 0;
        Object.keys(userQueueData[discordId]).forEach(dateStr => {
          if (userQueueData[discordId][dateStr] >= 120) userBonusMinutes[discordId] += 120;
        });
      });

      const userWorkData = {};
      const userAdjData = {};
      
      adjustments.forEach(adj => {
        if (!userAdjData[adj.discord_id]) {
          userAdjData[adj.discord_id] = { bonus: 0, deduction: 0, storyMoney: 0, gacha_ic: 0, gacha_promote: 0, coin_agency: 0 };
        }
        if (adj.type === 'bonus') {
          if (adj.reason.includes('สตอรี่')) {
            userAdjData[adj.discord_id].storyMoney += Number(adj.amount);
          } else {
            userAdjData[adj.discord_id].bonus += Number(adj.amount);
          }
        }
        if (adj.type === 'deduction') userAdjData[adj.discord_id].deduction += Number(adj.amount);
        if (adj.type === 'gacha_ic') userAdjData[adj.discord_id].gacha_ic += Number(adj.amount);
        if (adj.type === 'gacha_promote') userAdjData[adj.discord_id].gacha_promote += Number(adj.amount);
        if (adj.type === 'coin_agency') userAdjData[adj.discord_id].coin_agency += Number(adj.amount);
      });
      
      let totalPayout = 0;
      let totalMinutesGlobal = 0;

      sessions.forEach(session => {
        if (!userWorkData[session.discord_id]) userWorkData[session.discord_id] = { totalMinutes: 0, bonusDutyMinutes: 0 };
        const start = new Date(session.clock_in).getTime();
        const end = new Date(session.clock_out).getTime();
        const mins = Math.floor((end - start) / 60000) - (session.total_break_minutes || 0);
        if (mins > 0) {
          userWorkData[session.discord_id].totalMinutes += mins;
          totalMinutesGlobal += mins;
        }
      });

      Object.keys(userBonusMinutes).forEach(discordId => {
        const bonusMins = userBonusMinutes[discordId];
        if (bonusMins > 0) {
          if (!userWorkData[discordId]) userWorkData[discordId] = { totalMinutes: 0, bonusDutyMinutes: 0 };
          userWorkData[discordId].totalMinutes += bonusMins;
          userWorkData[discordId].bonusDutyMinutes = bonusMins;
          totalMinutesGlobal += bonusMins;
        }
      });

      const getOcRate = (position) => {
        if (!position) return 0;
        if (position.includes('ผอ') || position.includes('ผู้อำนวยการ')) return 25;
        if (position.includes('รอง')) return 25;
        if (position.includes('เลขา')) return 20;
        if (position.includes('ชำนาญการ')) return 15;
        if (position.includes('แพทย์')) return 10;
        return 0;
      };

      const finalData = [];
      Object.keys(userWorkData).forEach(discordId => {
        const user = userMap[discordId];
        if (!user) return;

        const tMins = userWorkData[discordId].totalMinutes;
        const tHours = tMins / 60;
        const rate = ratesMap[user.position] || 0;
        const base = tHours * rate;
        
        let ocMoney = 0;
        const floorHours = Math.floor(tHours);
        if (floorHours >= 30) {
          const ocRate = getOcRate(user.position);
          ocMoney = (floorHours - 29) * ocRate;
        }
        
        const adj = userAdjData[discordId] || { bonus: 0, deduction: 0, storyMoney: 0, gacha_ic: 0, gacha_promote: 0, coin_agency: 0 };
        const payout = Math.max(0, base + adj.bonus + adj.storyMoney + ocMoney - adj.deduction);
        
        totalPayout += payout;
        finalData.push({
          discord_id: discordId,
          name: user.ic_name,
          position: user.position,
          hours: tHours,
          bonusDutyMinutes: userWorkData[discordId].bonusDutyMinutes || 0,
          basePayout: base,
          bonus: adj.bonus,
          deduction: adj.deduction,
          storyMoney: adj.storyMoney,
          gacha_ic: adj.gacha_ic,
          gacha_promote: adj.gacha_promote,
          coin_agency: adj.coin_agency,
          ocMoney: ocMoney,
          payout: payout
        });
      });

      finalData.sort((a,b) => b.payout - a.payout);
      setReportData(finalData);
      setSummaryData({ totalPayout: totalPayout, totalHours: totalMinutesGlobal / 60 });
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

  // --- Agencies Logic ---
  const fetchAgencies = async () => {
    const { data } = await supabase.from('app_settings').select('*').eq('setting_key', 'agencies_list').single();
    if (data && data.setting_value) {
      try {
        const parsed = JSON.parse(data.setting_value);
        const migrated = parsed.map(item => {
          if (typeof item === 'string') return { name: item, category: 'Gang' };
          return item;
        });
        setAgencies(migrated);
      } catch (e) {
        setAgencies([]);
      }
    } else {
      setAgencies([]);
    }
  };

  const handleAddAgency = async () => {
    if (!newAgencyName.trim()) return;
    try {
      const newObj = { name: newAgencyName.trim(), category: newAgencyCategory };
      const updatedAgencies = [...agencies, newObj];
      await supabase.from('app_settings').upsert([
        { setting_key: 'agencies_list', setting_value: JSON.stringify(updatedAgencies) }
      ]);
      setNewAgencyName('');
      setNewAgencyCategory('Gang');
      fetchAgencies();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteAgency = async (agencyObj) => {
    if (!window.confirm(`ลบสังกัด ${agencyObj.name} ออกจากระบบ?`)) return;
    try {
      const updatedAgencies = agencies.filter(a => a.name !== agencyObj.name);
      await supabase.from('app_settings').upsert([
        { setting_key: 'agencies_list', setting_value: JSON.stringify(updatedAgencies) }
      ]);
      fetchAgencies();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveEditAgency = async () => {
    if (!editAgencyInput.trim()) {
      setEditingAgency('');
      return;
    }
    try {
      const updatedAgencies = agencies.map(a => 
        a.name === editingAgency.name 
          ? { ...a, name: editAgencyInput.trim(), category: editAgencyCategory } 
          : a
      );
      await supabase.from('app_settings').upsert([
        { setting_key: 'agencies_list', setting_value: JSON.stringify(updatedAgencies) }
      ]);
      setEditingAgency('');
      fetchAgencies();
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
      
      if (announcementActive && announcementText && notifyAll) {
        const { data: usersData } = await supabase.from('users').select('discord_id');
        if (usersData && usersData.length > 0) {
          const notifications = usersData.map(u => ({
            discord_id: u.discord_id,
            title: '📣 ประกาศอัปเดตระบบ',
            message: announcementText
          }));
          await supabase.from('notifications').insert(notifications);
        }
        setNotifyAll(false); // Reset after sending
      }

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

  const filteredReportData = reportData.map(d => {
    let categoryPayout = 0;
    if (reportCategory === 'ic') {
      categoryPayout = Math.max(0, d.basePayout - d.deduction);
    } else if (reportCategory === 'oc') {
      categoryPayout = d.ocMoney;
    } else if (reportCategory === 'story') {
      categoryPayout = d.storyMoney;
    } else if (reportCategory === 'bonus') {
      categoryPayout = d.bonus;
    } else {
      categoryPayout = d.payout;
    }
    return { ...d, categoryPayout };
  }).filter(d => {
    if (reportCategory === 'all') return true;
    if (reportCategory === 'bonus') return d.bonus > 0 || d.gacha_ic > 0 || d.gacha_promote > 0 || d.coin_agency > 0;
    return d.categoryPayout > 0;
  });
  
  const categoryTotalPayout = filteredReportData.reduce((sum, d) => sum + d.categoryPayout, 0);
  const totalGachaIC = filteredReportData.reduce((sum, d) => sum + (d.gacha_ic || 0), 0);
  const totalGachaPromote = filteredReportData.reduce((sum, d) => sum + (d.gacha_promote || 0), 0);
  const totalCoinAgency = filteredReportData.reduce((sum, d) => sum + (d.coin_agency || 0), 0);

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
          <button className={`settings-tab-btn ${activeTab === 'agencies' ? 'active agencies' : ''}`} onClick={() => setActiveTab('agencies')}>
            <Building size={18} /> จัดการสังกัด
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
                  <div className="filter-group">
                    <label style={{ marginRight: '0.5rem', fontWeight: 600 }}>หมวดหมู่:</label>
                    <div className="custom-dropdown-container" ref={categoryDropdownRef}>
                      <div 
                        className="modal-input custom-dropdown-trigger"
                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                      >
                        <span>
                          {reportCategory === 'all' ? 'สรุปยอดรวมทั้งหมด (ALL)' : 
                           reportCategory === 'ic' ? 'สรุปหมวดเงิน IC' :
                           reportCategory === 'oc' ? 'สรุปหมวดเงิน OC' :
                           reportCategory === 'story' ? 'สรุปหมวดเงินดูสตอรี่' :
                           reportCategory === 'bonus' ? 'สรุปหมวดเงินโบนัส' : ''}
                        </span>
                        <ChevronDown size={18} color="#64748b" style={{ transform: isCategoryDropdownOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                      </div>
                      
                      {isCategoryDropdownOpen && (
                        <div className="custom-dropdown-menu">
                          <div className={`custom-dropdown-item ${reportCategory === 'all' ? 'active' : ''}`} onClick={() => { setReportCategory('all'); setIsCategoryDropdownOpen(false); }}>สรุปยอดรวมทั้งหมด (ALL)</div>
                          <div className={`custom-dropdown-item ${reportCategory === 'ic' ? 'active' : ''}`} onClick={() => { setReportCategory('ic'); setIsCategoryDropdownOpen(false); }}>สรุปหมวดเงิน IC</div>
                          <div className={`custom-dropdown-item ${reportCategory === 'oc' ? 'active' : ''}`} onClick={() => { setReportCategory('oc'); setIsCategoryDropdownOpen(false); }}>สรุปหมวดเงิน OC</div>
                          <div className={`custom-dropdown-item ${reportCategory === 'story' ? 'active' : ''}`} onClick={() => { setReportCategory('story'); setIsCategoryDropdownOpen(false); }}>สรุปหมวดเงินดูสตอรี่</div>
                          <div className={`custom-dropdown-item ${reportCategory === 'bonus' ? 'active' : ''}`} onClick={() => { setReportCategory('bonus'); setIsCategoryDropdownOpen(false); }}>สรุปหมวดเงินโบนัส</div>
                        </div>
                      )}
                    </div>
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
                      <h1 className="pdf-title">
                        {reportCategory === 'all' ? 'รายงานสรุปค่าตอบแทนบุคลากรทางการแพทย์' : 
                         reportCategory === 'ic' ? 'รายงานสรุปหมวดเงิน IC' :
                         reportCategory === 'oc' ? 'รายงานสรุปหมวดเงิน OC' :
                         reportCategory === 'bonus' ? 'รายงานสรุปหมวดเงินโบนัส' :
                         'รายงานสรุปหมวดเงินดูสตอรี่'}
                      </h1>
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
                          {(reportCategory === 'all' || reportCategory === 'ic') && <th>ชั่วโมงเข้าเวร</th>}
                          {reportCategory === 'all' && <th>รายการปรับปรุง (+/-)</th>}
                          {reportCategory === 'bonus' && <th>รายการโบนัส/อื่นๆ</th>}
                          <th>ยอดสุทธิที่ต้องจ่าย</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReportData.map((d, i) => (
                          <tr key={i}>
                            <td style={{textAlign: 'center'}}>{i + 1}</td>
                            <td>{d.name}</td>
                            <td>{d.position}</td>
                            {(reportCategory === 'all' || reportCategory === 'ic') && (
                              <td style={{textAlign: 'center'}}>{formatHours(d.hours)}</td>
                            )}
                            {reportCategory === 'all' && (
                              <td style={{textAlign: 'right'}}>
                                <div style={{display: 'flex', flexDirection: 'column', fontSize: '0.85rem'}}>
                                  {d.bonus > 0 ? <span style={{color: '#059669'}}>+{formatCurrency(d.bonus)} (โบนัส)</span> : null} 
                                  {d.gacha_ic > 0 ? <span style={{color: '#8b5cf6'}}>กาชา IC: {d.gacha_ic} ลูก</span> : null} 
                                  {d.gacha_promote > 0 ? <span style={{color: '#ec4899'}}>กาชา Promote: {d.gacha_promote} ลูก</span> : null} 
                                  {d.coin_agency > 0 ? <span style={{color: '#f59e0b'}}>เหรียญ Agency: {d.coin_agency} เหรียญ</span> : null} 
                                  {d.deduction > 0 ? <span style={{color: '#e11d48'}}>-{formatCurrency(d.deduction)} (หัก)</span> : null}
                                  {d.storyMoney > 0 ? <span style={{color: '#0284c7'}}>+{formatCurrency(d.storyMoney)} (สตอรี่)</span> : null}
                                  {d.ocMoney > 0 ? <span style={{color: '#7c3aed'}}>+{formatCurrency(d.ocMoney)} (OC)</span> : null}
                                  {d.bonus === 0 && d.deduction === 0 && d.storyMoney === 0 && d.ocMoney === 0 && d.gacha_ic === 0 && d.gacha_promote === 0 && d.coin_agency === 0 ? '-' : null}
                                </div>
                              </td>
                            )}
                            {reportCategory === 'bonus' && (
                              <td style={{textAlign: 'right'}}>
                                <div style={{display: 'flex', flexDirection: 'column', fontSize: '0.85rem'}}>
                                  {d.bonus > 0 ? <span style={{color: '#059669'}}>+{formatCurrency(d.bonus)} (โบนัส)</span> : null} 
                                  {d.gacha_ic > 0 ? <span style={{color: '#8b5cf6'}}>กาชา IC: {d.gacha_ic} ลูก</span> : null} 
                                  {d.gacha_promote > 0 ? <span style={{color: '#ec4899'}}>กาชา Promote: {d.gacha_promote} ลูก</span> : null} 
                                  {d.coin_agency > 0 ? <span style={{color: '#f59e0b'}}>เหรียญ Agency: {d.coin_agency} เหรียญ</span> : null}
                                  {d.bonus === 0 && d.gacha_ic === 0 && d.gacha_promote === 0 && d.coin_agency === 0 ? '-' : null}
                                </div>
                              </td>
                            )}
                            <td style={{textAlign: 'right', fontWeight: 'bold'}}>{formatCurrency(d.categoryPayout)}</td>
                          </tr>
                        ))}
                        {filteredReportData.length === 0 && (
                          <tr><td colSpan="6" style={{textAlign: 'center', padding: '2rem'}}>ไม่มีข้อมูลในช่วงเวลานี้</td></tr>
                        )}
                      </tbody>
                    </table>

                    {filteredReportData.length > 0 && (
                      <div className="pdf-summary">
                        <p>จำนวนบุคลากรทั้งหมด: <strong>{filteredReportData.length} คน</strong></p>
                        {(reportCategory === 'all' || reportCategory === 'ic') && (
                          <p>รวมชั่วโมงเข้าเวร: <strong>{Math.floor(summaryData.totalHours)} ชั่วโมง</strong></p>
                        )}
                        {(reportCategory === 'all' || reportCategory === 'bonus') && (
                          <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                            {totalGachaIC > 0 && <p>รวมกาชา IC: <strong>{totalGachaIC} ลูก</strong></p>}
                            {totalGachaPromote > 0 && <p>รวมกาชา Promote: <strong>{totalGachaPromote} ลูก</strong></p>}
                            {totalCoinAgency > 0 && <p>รวมเหรียญ Agency: <strong>{totalCoinAgency} เหรียญ</strong></p>}
                          </div>
                        )}
                        <p style={{fontSize: '18px'}}>ยอดรวมสุทธิที่ต้องจ่าย: <strong>{formatCurrency(categoryTotalPayout)}</strong></p>
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

            {/* AGENCIES TAB */}
            {activeTab === 'agencies' && (
              <div className="animate-fade-in" style={{ maxWidth: '600px' }}>
                <p style={{ color: '#64748b', marginBottom: '2rem' }}>เพิ่มหรือลบรายชื่อสังกัดที่ต้องการให้มีในระบบ</p>
                
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                  <input 
                    type="text" 
                    className="modal-input" 
                    placeholder="ชื่อสังกัด (เช่น กาชาด)" 
                    value={newAgencyName} 
                    onChange={e => setNewAgencyName(e.target.value)} 
                    style={{ flex: 1 }}
                  />
                  <select 
                    className="modal-input" 
                    value={newAgencyCategory} 
                    onChange={e => setNewAgencyCategory(e.target.value)}
                    style={{ width: '150px' }}
                  >
                    <option value="Gang">Gang</option>
                    <option value="Family">Family</option>
                  </select>
                  <button className="export-btn" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px' }} onClick={handleAddAgency}>
                    <PlusCircle size={18} /> เพิ่ม
                  </button>
                </div>

                <div className="position-list">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 1rem 0' }}>
                    <h4 style={{ margin: 0, color: '#1e293b' }}>รายชื่อสังกัดทั้งหมด ({agencies.length})</h4>
                    <div style={{ position: 'relative', width: '250px' }}>
                      <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input 
                        type="text" 
                        className="modal-input" 
                        placeholder="ค้นหาสังกัด..." 
                        value={searchAgency}
                        onChange={(e) => setSearchAgency(e.target.value)}
                        style={{ paddingLeft: '2.5rem', width: '100%', paddingBottom: '0.6rem', paddingTop: '0.6rem' }}
                      />
                    </div>
                  </div>
                  
                  {agencies.filter(a => a.name.toLowerCase().includes(searchAgency.toLowerCase())).map((agency, idx) => (
                    <div key={idx} className="position-item">
                      {editingAgency && editingAgency.name === agency.name ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, alignItems: 'center' }}>
                          <input 
                            type="text" 
                            className="modal-input" 
                            value={editAgencyInput} 
                            onChange={(e) => setEditAgencyInput(e.target.value)} 
                            style={{ flex: 1 }}
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditAgency(); }}
                          />
                          <select 
                            className="modal-input" 
                            value={editAgencyCategory} 
                            onChange={e => setEditAgencyCategory(e.target.value)}
                            style={{ width: '130px', padding: '0.5rem' }}
                          >
                            <option value="Gang">Gang</option>
                            <option value="Family">Family</option>
                          </select>
                          <button className="add-btn" onClick={handleSaveEditAgency} style={{ padding: '0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                            <Save size={16} />
                          </button>
                          <button className="action-btn delete" onClick={() => setEditingAgency('')} style={{ padding: '0.5rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className="position-name">{agency.name}</div>
                            <span className={`agency-tag ${agency.category?.toLowerCase() === 'family' ? 'family' : 'gang'}`}>
                              {agency.category || 'Gang'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="edit-btn" onClick={() => { setEditingAgency(agency); setEditAgencyInput(agency.name); setEditAgencyCategory(agency.category || 'Gang'); }} title="แก้ไข" style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Edit2 size={18} />
                            </button>
                            <button className="delete-adj-btn" onClick={() => handleDeleteAgency(agency)} title="ลบ">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {agencies.length === 0 && <div style={{textAlign: 'center', color: '#94a3b8', padding: '2rem'}}>ยังไม่มีรายชื่อสังกัด</div>}
                  {agencies.length > 0 && agencies.filter(a => a.name.toLowerCase().includes(searchAgency.toLowerCase())).length === 0 && (
                    <div style={{textAlign: 'center', color: '#94a3b8', padding: '2rem'}}>ไม่พบรายชื่อสังกัดที่ค้นหา</div>
                  )}
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
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>เปิดใช้งานป้ายประกาศหน้าแรก</span>
                  </label>

                  <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="checkbox" 
                      id="notify-all" 
                      checked={notifyAll} 
                      onChange={e => setNotifyAll(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="notify-all" style={{ fontWeight: 500, color: '#0f172a', cursor: 'pointer' }}>
                      ส่งการแจ้งเตือนนี้ไปยังบุคลากรทุกคน 🔔
                    </label>
                  </div>

                  <div style={{ marginTop: '1.5rem' }}>
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
