import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Settings, Calculator, Filter, CalendarDays, DollarSign, Clock, Users, X, Save } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './SalarySystem.css';

export default function SalarySystem({ profile }) {
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState(new Date());
  
  const [salaryData, setSalaryData] = useState([]);
  const [rates, setRates] = useState({});
  const [summary, setSummary] = useState({ totalPayout: 0, totalHours: 0, totalStaff: 0 });

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editRates, setEditRates] = useState([]);
  const [savingRates, setSavingRates] = useState(false);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchRatesAndData();
    }
  }, [profile, startDate, endDate]);

  const fetchRatesAndData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Salary Rates
      const { data: ratesData, error: ratesError } = await supabase
        .from('salary_rates')
        .select('*');
        
      if (ratesError) {
        console.error('Error fetching rates (Did you run the SQL?)', ratesError);
        // Fallback to empty if table doesn't exist
      }
      
      const ratesMap = {};
      if (ratesData) {
        ratesData.forEach(r => {
          ratesMap[r.position_name] = Number(r.hourly_rate);
        });
        setRates(ratesMap);
        setEditRates(ratesData);
      }

      // 2. Fetch Users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*');
      
      if (usersError) throw usersError;
      
      const userMap = {};
      usersData.forEach(u => {
        userMap[u.discord_id] = u;
      });

      // 3. Fetch Duty Sessions in Date Range
      let query = supabase
        .from('duty_sessions')
        .select('*')
        .eq('status', 'completed');

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

      const { data: sessions, error: sessionsError } = await query;
      if (sessionsError) throw sessionsError;

      // 4. Calculate Salary
      const userWorkData = {};
      let totalPayout = 0;
      let totalMinutesGlobal = 0;

      sessions.forEach(session => {
        if (!userWorkData[session.discord_id]) {
          userWorkData[session.discord_id] = {
            totalMinutes: 0
          };
        }
        const start = new Date(session.clock_in).getTime();
        const end = new Date(session.clock_out).getTime();
        const diffMs = end - start;
        const totalMinutes = Math.floor(diffMs / 60000) - (session.total_break_minutes || 0);
        if (totalMinutes > 0) {
          userWorkData[session.discord_id].totalMinutes += totalMinutes;
          totalMinutesGlobal += totalMinutes;
        }
      });

      const finalSalaryData = [];
      
      Object.keys(userWorkData).forEach(discordId => {
        const user = userMap[discordId];
        if (!user) return; // Ignore if user deleted

        const totalMinutes = userWorkData[discordId].totalMinutes;
        const totalHours = totalMinutes / 60;
        const hourlyRate = ratesMap[user.position] || 0;
        const payout = totalHours * hourlyRate;
        
        totalPayout += payout;

        finalSalaryData.push({
          discord_id: discordId,
          ic_name: user.ic_name,
          position: user.position,
          avatar_url: user.avatar_url,
          totalMinutes: totalMinutes,
          totalHours: totalHours,
          hourlyRate: hourlyRate,
          payout: payout
        });
      });

      // Sort by payout descending
      finalSalaryData.sort((a, b) => b.payout - a.payout);

      setSalaryData(finalSalaryData);
      setSummary({
        totalPayout,
        totalHours: totalMinutesGlobal / 60,
        totalStaff: finalSalaryData.length
      });

    } catch (error) {
      console.error('Calculation Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRates = async () => {
    setSavingRates(true);
    try {
      for (const rate of editRates) {
        await supabase
          .from('salary_rates')
          .update({ hourly_rate: rate.hourly_rate })
          .eq('id', rate.id);
      }
      alert('บันทึกเรทเงินเดือนเรียบร้อยแล้ว');
      setIsSettingsOpen(false);
      fetchRatesAndData(); // Recalculate
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
    } finally {
      setSavingRates(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
  };

  const formatHours = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h} ชม. ${m} นาที`;
  };

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  if (!profile || profile.role !== 'admin') return null;

  return (
    <div className="salary-container">
      
      {/* Header & Controls */}
      <div className="salary-header">
        <div className="salary-filters">
          <div className="filter-group">
            <CalendarDays size={18} color="#94a3b8" />
            <label>ตั้งแต่:</label>
            <DatePicker 
              selected={startDate} 
              onChange={(date) => setStartDate(date)} 
              selectsStart
              startDate={startDate}
              endDate={endDate}
              className="filter-input date-picker-custom"
              dateFormat="dd/MM/yyyy"
            />
          </div>
          <div className="filter-group">
            <label>ถึง:</label>
            <DatePicker 
              selected={endDate} 
              onChange={(date) => setEndDate(date)} 
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              className="filter-input date-picker-custom"
              dateFormat="dd/MM/yyyy"
            />
          </div>
        </div>

        <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>
          <Settings size={18} />
          ตั้งค่าเรทเงินเดือน
        </button>
      </div>

      {/* Summary Cards */}
      <div className="salary-summary-cards">
        <div className="summary-card">
          <div className="summary-icon green">
            <DollarSign size={24} />
          </div>
          <div className="summary-details">
            <h4>ยอดจ่ายรวม (รอบบิลนี้)</h4>
            <p className="summary-value">{formatCurrency(summary.totalPayout)}</p>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon purple">
            <Clock size={24} />
          </div>
          <div className="summary-details">
            <h4>ชั่วโมงทำงานรวม</h4>
            <p className="summary-value">{Math.floor(summary.totalHours)}<span style={{fontSize: '1rem', fontWeight: '500', color: '#64748b'}}> ชม.</span></p>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon orange">
            <Users size={24} />
          </div>
          <div className="summary-details">
            <h4>บุคลากรที่ปฏิบัติงาน</h4>
            <p className="summary-value">{summary.totalStaff}<span style={{fontSize: '1rem', fontWeight: '500', color: '#64748b'}}> คน</span></p>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="salary-card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', color: '#16a34a' }}>
          <Calculator size={28} /> สรุปเงินเดือนบุคลากรแพทย์
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>กำลังคำนวณข้อมูล...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="salary-table">
              <thead>
                <tr>
                  <th>ข้อมูลบุคลากร (IC)</th>
                  <th>ตำแหน่ง (Position)</th>
                  <th>ชั่วโมงทำงานสุทธิ</th>
                  <th>เรทต่อชั่วโมง</th>
                  <th>ยอดสุทธิที่ต้องจ่าย</th>
                </tr>
              </thead>
              <tbody>
                {salaryData.length > 0 ? salaryData.map(data => (
                  <tr key={data.discord_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontWeight: 'bold', color: '#94a3b8' }}>
                          {data.avatar_url ? (
                            <img src={data.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : getInitial(data.ic_name)}
                        </div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{data.ic_name}</div>
                      </div>
                    </td>
                    <td>{data.position}</td>
                    <td style={{ color: '#475569' }}>{formatHours(data.totalHours)}</td>
                    <td style={{ color: '#64748b' }}>{data.hourlyRate > 0 ? `${data.hourlyRate} บ./ชม.` : 'ไม่มีเรทค่าจ้าง'}</td>
                    <td className="amount-text">{formatCurrency(data.payout)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      ไม่มีข้อมูลการเข้าเวรในช่วงเวลาที่เลือก
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>ตั้งค่าเรทเงินเดือน</h2>
              <button className="close-btn" onClick={() => setIsSettingsOpen(false)}><X size={20} /></button>
            </div>
            
            <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              กำหนดค่าจ้างต่อชั่วโมง (บาท/ชั่วโมง) สำหรับแต่ละตำแหน่ง หากเปลี่ยนแปลงจะมีผลกับการคำนวณใหม่ทันที
            </p>

            <div className="rate-list">
              {editRates.length > 0 ? editRates.map((rate, index) => (
                <div key={rate.id} className="rate-item">
                  <span className="rate-item-name">{rate.position_name}</span>
                  <div className="rate-input-group">
                    <input 
                      type="number"
                      className="rate-input"
                      value={rate.hourly_rate}
                      onChange={(e) => {
                        const newRates = [...editRates];
                        newRates[index].hourly_rate = e.target.value;
                        setEditRates(newRates);
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '0.9rem' }}>บ./ชม.</span>
                  </div>
                </div>
              )) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', background: '#fef2f2', borderRadius: '12px' }}>
                  <strong>ยังไม่มีฐานข้อมูลตำแหน่ง</strong><br/>
                  กรุณารันคำสั่ง SQL ที่ได้รับ เพื่อสร้างตาราง salary_rates ก่อน
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setIsSettingsOpen(false)} disabled={savingRates}>ยกเลิก</button>
              <button className="modal-btn save" onClick={handleSaveRates} disabled={savingRates || editRates.length === 0}>
                {savingRates ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
