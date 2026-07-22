import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Wallet, TrendingUp, TrendingDown, PackageSearch, PackagePlus, PackageMinus, 
  PlusCircle, Trash2, CalendarDays, Search, CheckCircle, FileText, Settings2
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Swal from 'sweetalert2';
import './AccountingSystem.css';

export default function AccountingSystem({ profile }) {
  const [activeTab, setActiveTab] = useState('finance'); // 'finance' | 'item'
  const [subTab, setSubTab] = useState('manage'); // 'manage' | 'report'
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [endDate, setEndDate] = useState(getLocalDateString());
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [transactionType, setTransactionType] = useState('income'); // income/expense (finance), receive/disburse (item)
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  
  // Item specific fields
  const [quantity, setQuantity] = useState(''); // จำนวนทั้งหมด
  const [distributePerPerson, setDistributePerPerson] = useState(''); // แจกต่อคน
  const [personCount, setPersonCount] = useState(''); // จำนวนคน
  const [itemStatus, setItemStatus] = useState('เสร็จสิ้น'); // สถานะ

  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'finance') {
      setTransactionType('income');
    } else {
      setTransactionType('receive');
    }
  }, [activeTab]);

  useEffect(() => {
    fetchLogs();
  }, [activeTab, startDate, endDate]);

  const fetchLogs = async () => {
    setLoading(true);
    let startStr = startDate;
    let endStr = endDate;

    if (startDate instanceof Date) {
      startStr = startDate.toISOString().split('T')[0];
    }
    if (endDate instanceof Date) {
      endStr = endDate.toISOString().split('T')[0];
    }

    try {
      const { data, error } = await supabase
        .from('accounting_logs')
        .select('*')
        .eq('record_group', activeTab)
        .gte('transaction_date', startStr)
        .lte('transaction_date', endStr)
        .order('created_at', { ascending: true }); // Order ascending for running total
        
      if (error) {
        if (error.message.includes('does not exist') || error.message.includes('column')) {
          setLogs([]);
          return; 
        }
        throw error;
      }
      setLogs(data || []);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!category) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุหมวดหมู่/ชื่อสิ่งของ', 'warning');
    if (activeTab === 'finance' && !amount) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุจำนวนเงิน', 'warning');
    if (activeTab === 'item' && !quantity) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุจำนวนทั้งหมด', 'warning');

    setIsSubmitting(true);
    try {
      const payload = {
        record_group: activeTab,
        transaction_type: transactionType,
        category: category,
        description: description,
        discord_id: profile?.discord_id,
        reporter_name: profile?.name || profile?.discord_id,
        transaction_date: getLocalDateString()
      };

      if (activeTab === 'finance') {
        payload.amount = parseFloat(amount);
      } else {
        payload.quantity = parseInt(quantity, 10) || 0;
        payload.distribute_per_person = parseInt(distributePerPerson, 10) || 0;
        payload.person_count = parseInt(personCount, 10) || 0;
        payload.distribute_total = payload.distribute_per_person * payload.person_count;
        payload.item_status = itemStatus;
      }

      const { error } = await supabase.from('accounting_logs').insert([payload]);
      if (error) throw error;

      Swal.fire({
        title: 'บันทึกสำเร็จ',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });

      // Reset form
      setCategory('');
      setAmount('');
      setQuantity('');
      setDistributePerPerson('');
      setPersonCount('');
      setDescription('');
      fetchLogs();
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const res = await Swal.fire({
      title: 'ลบรายการนี้?',
      text: "คุณไม่สามารถกู้คืนได้หากลบไปแล้ว",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ลบข้อมูล'
    });

    if (res.isConfirmed) {
      try {
        const { error } = await supabase.from('accounting_logs').delete().eq('id', id);
        if (error) throw error;
        fetchLogs();
      } catch (err) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  const formatCurrency = (amt) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amt || 0);
  const formatNumber = (num) => new Intl.NumberFormat('th-TH').format(num || 0);
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
  };

  const filteredLogs = logs.filter(l => 
    (l.category || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (l.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reverse logs for Manage table (newest first)
  const manageLogs = [...filteredLogs].reverse();

  // Calculate Summaries
  const totalIncome = logs.filter(l => l.transaction_type === 'income').reduce((sum, l) => sum + (l.amount || 0), 0);
  const totalExpense = logs.filter(l => l.transaction_type === 'expense').reduce((sum, l) => sum + (l.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;

  const totalReceive = logs.filter(l => l.transaction_type === 'receive').reduce((sum, l) => sum + (l.quantity || 0), 0);
  const totalDisburse = logs.filter(l => l.transaction_type === 'disburse').reduce((sum, l) => sum + (l.quantity || 0), 0);

  if (profile?.role !== 'admin') return null;

  const renderManageView = () => (
    <>
      {activeTab === 'finance' && (
        <div className="summary-cards animate-fade-in">
          <div className="summary-card income">
            <div className="icon-wrapper"><TrendingUp size={24} /></div>
            <div>
              <h3>รายรับทั้งหมด</h3>
              <p>{formatCurrency(totalIncome)}</p>
            </div>
          </div>
          <div className="summary-card expense">
            <div className="icon-wrapper"><TrendingDown size={24} /></div>
            <div>
              <h3>รายจ่ายทั้งหมด</h3>
              <p>{formatCurrency(totalExpense)}</p>
            </div>
          </div>
          <div className="summary-card balance">
            <div className="icon-wrapper"><Wallet size={24} /></div>
            <div>
              <h3>ยอดคงเหลือ</h3>
              <p>{formatCurrency(netBalance)}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'item' && (
        <div className="summary-cards animate-fade-in">
          <div className="summary-card receive">
            <div className="icon-wrapper"><PackagePlus size={24} /></div>
            <div>
              <h3>รับเข้าทั้งหมด</h3>
              <p>{formatNumber(totalReceive)} ชิ้น</p>
            </div>
          </div>
          <div className="summary-card disburse">
            <div className="icon-wrapper"><PackageMinus size={24} /></div>
            <div>
              <h3>เบิกออกทั้งหมด</h3>
              <p>{formatNumber(totalDisburse)} ชิ้น</p>
            </div>
          </div>
          <div className="summary-card total-item">
            <div className="icon-wrapper"><CheckCircle size={24} /></div>
            <div>
              <h3>ทำรายการทั้งหมด</h3>
              <p>{formatNumber(logs.length)} รายการ</p>
            </div>
          </div>
        </div>
      )}

      <div className="content-grid">
        {/* Form Panel */}
        <div className="form-card">
          <h3 style={{ margin: '0 0 1.5rem 0', color: '#1e293b' }}>
            {activeTab === 'finance' ? 'บันทึกธุรกรรมใหม่' : 'บันทึกรายการสิ่งของ'}
          </h3>
          
          <form onSubmit={handleSave}>
            <div className="type-selector">
              {activeTab === 'finance' ? (
                <>
                  <button type="button" className={`type-btn income ${transactionType === 'income' ? 'active' : ''}`} onClick={() => setTransactionType('income')}>
                    <TrendingUp size={18} /> รายรับ
                  </button>
                  <button type="button" className={`type-btn expense ${transactionType === 'expense' ? 'active' : ''}`} onClick={() => setTransactionType('expense')}>
                    <TrendingDown size={18} /> รายจ่าย
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={`type-btn receive ${transactionType === 'receive' ? 'active' : ''}`} onClick={() => setTransactionType('receive')}>
                    <PackagePlus size={18} /> รับของ
                  </button>
                  <button type="button" className={`type-btn disburse ${transactionType === 'disburse' ? 'active' : ''}`} onClick={() => setTransactionType('disburse')}>
                    <PackageMinus size={18} /> แจกจ่าย
                  </button>
                </>
              )}
            </div>

            <div className="form-group">
              <label>{activeTab === 'finance' ? 'หมวดหมู่ / ชื่อรายการ' : 'รายการสิ่งของ'}</label>
              <input 
                type="text" 
                className="modal-input" 
                placeholder={activeTab === 'finance' ? 'เช่น เงินเดือน, สปอนเซอร์, ซื้ออุปกรณ์' : 'เช่น Ticket Rainy, GACHA IC'}
                value={category}
                onChange={e => setCategory(e.target.value)}
                required
              />
            </div>

            {activeTab === 'finance' && (
              <div className="form-group">
                <label>จำนวนเงิน (THB)</label>
                <input 
                  type="number" 
                  className="modal-input" 
                  placeholder="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            )}

            {activeTab === 'item' && (
              <>
                <div className="form-group">
                  <label>จำนวนทั้งหมด</label>
                  <input 
                    type="number" 
                    className="modal-input" 
                    placeholder="0"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    min="0"
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>จำนวนแจก(คน)</label>
                    <input 
                      type="number" 
                      className="modal-input" 
                      placeholder="0"
                      value={distributePerPerson}
                      onChange={e => setDistributePerPerson(e.target.value)}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>จำนวนคน</label>
                    <input 
                      type="number" 
                      className="modal-input" 
                      placeholder="0"
                      value={personCount}
                      onChange={e => setPersonCount(e.target.value)}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>สถานะ</label>
                  <select 
                    className="modal-input"
                    value={itemStatus}
                    onChange={e => setItemStatus(e.target.value)}
                  >
                    <option value="เสร็จสิ้น">เสร็จสิ้น</option>
                    <option value="รอดำเนินการ">รอดำเนินการ</option>
                    <option value="-">-</option>
                  </select>
                </div>
              </>
            )}

            <div className="form-group">
              <label>รายละเอียดเพิ่มเติม (Optional)</label>
              <textarea 
                className="modal-input" 
                rows="3"
                placeholder="ระบุหมายเหตุหรือผู้ที่เกี่ยวข้อง..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              ></textarea>
            </div>

            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              <PlusCircle size={20} /> {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </form>
        </div>

        {/* Table Panel for Manage View */}
        <div className="table-card">
          <div className="table-header">
            <h3 style={{ margin: 0, color: '#1e293b' }}>ประวัติการบันทึก</h3>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="filter-group">
                <Search size={18} color="#94a3b8" />
                <input 
                  type="text" 
                  placeholder="ค้นหารายการ..."
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: '#1e293b', width: '150px' }}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <CalendarDays size={18} color="#94a3b8" />
                <DatePicker 
                  selected={startDate} onChange={d => setStartDate(d)} selectsStart startDate={startDate} endDate={endDate}
                  customInput={<input style={{ background: 'transparent', border: 'none', outline: 'none', color: '#1e293b', width: '80px', cursor: 'pointer' }} />}
                  dateFormat="dd/MM/yyyy"
                />
                <span style={{ color: '#94a3b8' }}>-</span>
                <DatePicker 
                  selected={endDate} onChange={d => setEndDate(d)} selectsEnd startDate={startDate} endDate={endDate} minDate={startDate}
                  customInput={<input style={{ background: 'transparent', border: 'none', outline: 'none', color: '#1e293b', width: '80px', cursor: 'pointer' }} />}
                  dateFormat="dd/MM/yyyy"
                />
              </div>
            </div>
          </div>

          <div className="acc-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="acc-table" style={{ minWidth: '1000px', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap', width: '10%' }}>วันที่</th>
                  <th style={{ whiteSpace: 'nowrap', width: '20%' }}>{activeTab === 'finance' ? 'รายการ' : 'ชื่อสิ่งของ'}</th>
                  {activeTab === 'finance' ? (
                    <>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '15%' }}>รายรับ</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '15%' }}>รายจ่าย</th>
                    </>
                  ) : (
                    <>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>จำนวนทั้งหมด</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>แจก(คน)</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>จำนวนคน</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>คงเหลือ</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>สถานะ</th>
                    </>
                  )}
                  <th style={{ whiteSpace: 'nowrap' }}>ผู้บันทึก</th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={activeTab === 'finance' ? 6 : 9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>กำลังโหลดข้อมูล...</td></tr>
                ) : manageLogs.length === 0 ? (
                  <tr><td colSpan={activeTab === 'finance' ? 6 : 9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>ไม่พบข้อมูลในช่วงเวลานี้</td></tr>
                ) : (
                  manageLogs.map(log => {
                    const isIncome = log.transaction_type === 'income';
                    const amount = log.amount || 0;
                    
                    let remaining = 0;
                    if (activeTab === 'item') {
                      const totalDistribute = (log.distribute_per_person || 0) * (log.person_count || 0);
                      remaining = (log.quantity || 0) - totalDistribute;
                    }

                    return (
                      <tr key={log.id}>
                        <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{formatDate(log.transaction_date)}</td>
                        <td>
                          <div style={{ fontWeight: 500, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                            {log.transaction_type === 'income' && <span className="tag income">รายรับ</span>}
                            {log.transaction_type === 'expense' && <span className="tag expense">รายจ่าย</span>}
                            {log.transaction_type === 'receive' && <span className="tag receive">รับเข้า</span>}
                            {log.transaction_type === 'disburse' && <span className="tag disburse">เบิกออก</span>}
                            <span>{log.category}</span>
                          </div>
                          {log.description && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', whiteSpace: 'normal', minWidth: '150px' }}>{log.description}</div>}
                        </td>
                        
                        {activeTab === 'finance' ? (
                          <>
                            <td style={{ textAlign: 'right', color: '#10b981', fontWeight: isIncome ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>
                              {isIncome ? formatCurrency(amount).replace('฿', '') : ''}
                            </td>
                            <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: !isIncome ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>
                              {!isIncome ? formatCurrency(amount).replace('฿', '') : ''}
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{formatNumber(log.quantity)}</td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{log.distribute_per_person > 0 ? formatNumber(log.distribute_per_person) : '-'}</td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{log.person_count > 0 ? formatNumber(log.person_count) : '-'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{formatNumber(remaining)}</td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{log.item_status !== '-' ? log.item_status : '-'}</td>
                          </>
                        )}
                        
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: '0.85rem' }}>{log.reporter_name || 'Admin'}</div>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button 
                            className="delete-adj-btn" 
                            onClick={() => handleDelete(log.id)}
                            style={{ margin: '0 auto' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );

  const renderReportView = () => {
    let currentBalance = 0;

    return (
      <div className="report-container animate-fade-in">
        <div className="table-header" style={{ marginBottom: '1.5rem', background: 'var(--surface)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={24} color={activeTab === 'finance' ? '#3b82f6' : '#f59e0b'} />
            {activeTab === 'finance' ? 'สรุปเงินอยู่ที่ Vivian' : 'สรุปของอยู่ที่ Vivian'}
          </h2>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="filter-group">
              <CalendarDays size={18} color="#94a3b8" />
              <DatePicker 
                selected={startDate} onChange={d => setStartDate(d)} selectsStart startDate={startDate} endDate={endDate}
                customInput={<input style={{ background: 'transparent', border: 'none', outline: 'none', color: '#1e293b', width: '80px', cursor: 'pointer' }} />}
                dateFormat="dd/MM/yyyy"
              />
              <span style={{ color: '#94a3b8' }}>-</span>
              <DatePicker 
                selected={endDate} onChange={d => setEndDate(d)} selectsEnd startDate={startDate} endDate={endDate} minDate={startDate}
                customInput={<input style={{ background: 'transparent', border: 'none', outline: 'none', color: '#1e293b', width: '80px', cursor: 'pointer' }} />}
                dateFormat="dd/MM/yyyy"
              />
            </div>
            <button className="sub-tab-btn" style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px' }} onClick={() => window.print()}>
              พิมพ์รายงาน
            </button>
          </div>
        </div>
        
        <div className="report-table-wrapper" style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          {activeTab === 'finance' ? (
            <table className="report-table finance-theme" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr>
                  <th style={{ width: '15%', padding: '1rem', background: '#c4b5fd', color: '#000', borderBottom: '2px solid #8b5cf6', textAlign: 'center' }}>วัน/เดือน/ปี</th>
                  <th style={{ width: '40%', padding: '1rem', background: '#c4b5fd', color: '#000', borderBottom: '2px solid #8b5cf6', textAlign: 'center' }}>รายการ</th>
                  <th style={{ width: '15%', padding: '1rem', background: '#c4b5fd', color: '#000', borderBottom: '2px solid #8b5cf6', textAlign: 'center' }}>รายรับ</th>
                  <th style={{ width: '15%', padding: '1rem', background: '#c4b5fd', color: '#000', borderBottom: '2px solid #8b5cf6', textAlign: 'center' }}>รายจ่าย</th>
                  <th style={{ width: '15%', padding: '1rem', background: '#c4b5fd', color: '#000', borderBottom: '2px solid #8b5cf6', textAlign: 'center' }}>รวม</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>กำลังโหลด...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>ไม่พบข้อมูลในช่วงเวลาที่เลือก</td></tr>
                ) : (
                  filteredLogs.map(log => {
                    const isIncome = log.transaction_type === 'income';
                    const amount = log.amount || 0;
                    currentBalance = isIncome ? currentBalance + amount : currentBalance - amount;
                    
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0', background: isIncome ? '#f8fafc' : '#f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{formatDate(log.transaction_date)}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{log.category}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{isIncome ? formatCurrency(amount).replace('฿', '') : ''}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{!isIncome ? formatCurrency(amount).replace('฿', '') : ''}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 'bold' }}>{formatCurrency(currentBalance).replace('฿', '')}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="report-table item-theme" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr>
                  <th rowSpan="2" style={{ width: '10%', padding: '1rem', background: '#fef08a', color: '#000', borderBottom: '2px solid #eab308', textAlign: 'center', borderRight: '1px solid #fde047' }}>วัน/เดือน/ปี</th>
                  <th rowSpan="2" style={{ width: '25%', padding: '1rem', background: '#fef08a', color: '#000', borderBottom: '2px solid #eab308', textAlign: 'center', borderRight: '1px solid #fde047' }}>รายการ</th>
                  <th rowSpan="2" style={{ width: '10%', padding: '1rem', background: '#fef08a', color: '#000', borderBottom: '2px solid #eab308', textAlign: 'center', borderRight: '1px solid #fde047' }}>จำนวน<br/>ทั้งหมด</th>
                  <th rowSpan="2" style={{ width: '10%', padding: '1rem', background: '#fef08a', color: '#000', borderBottom: '2px solid #eab308', textAlign: 'center', borderRight: '1px solid #fde047' }}>จำนวนที่ต้อง<br/>แจก (รวม)</th>
                  <th colSpan="2" style={{ padding: '0.5rem', background: '#fef08a', color: '#000', borderBottom: '1px solid #fde047', textAlign: 'center', borderRight: '1px solid #fde047' }}>การแจกจ่าย</th>
                  <th rowSpan="2" style={{ width: '10%', padding: '1rem', background: '#fef08a', color: '#000', borderBottom: '2px solid #eab308', textAlign: 'center', borderRight: '1px solid #fde047' }}>ของคงเหลือ<br/>(ชิ้น)</th>
                  <th rowSpan="2" style={{ width: '10%', padding: '1rem', background: '#fef08a', color: '#000', borderBottom: '2px solid #eab308', textAlign: 'center' }}>สถานะ</th>
                </tr>
                <tr>
                  <th style={{ width: '12%', padding: '0.5rem', background: '#fef08a', color: '#000', borderBottom: '2px solid #eab308', textAlign: 'center', borderRight: '1px solid #fde047' }}>แจก (คน)</th>
                  <th style={{ width: '10%', padding: '0.5rem', background: '#fef08a', color: '#000', borderBottom: '2px solid #eab308', textAlign: 'center', borderRight: '1px solid #fde047' }}>จำนวนคน</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>กำลังโหลด...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>ไม่พบข้อมูลในช่วงเวลาที่เลือก</td></tr>
                ) : (
                  filteredLogs.map((log, i) => {
                    const totalDistribute = (log.distribute_per_person || 0) * (log.person_count || 0);
                    const remaining = (log.quantity || 0) - totalDistribute;
                    
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fdf8cb' : '#fefce8' }}>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', borderRight: '1px solid #fef08a' }}>{formatDate(log.transaction_date)}</td>
                        <td style={{ padding: '0.75rem 1rem', borderRight: '1px solid #fef08a' }}>{log.category}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', borderRight: '1px solid #fef08a' }}>{formatNumber(log.quantity)}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', borderRight: '1px solid #fef08a' }}>{totalDistribute > 0 ? formatNumber(totalDistribute) : ''}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', borderRight: '1px solid #fef08a' }}>{log.distribute_per_person > 0 ? formatNumber(log.distribute_per_person) : ''}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', borderRight: '1px solid #fef08a' }}>{log.person_count > 0 ? formatNumber(log.person_count) : ''}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', borderRight: '1px solid #fef08a', fontWeight: 'bold' }}>{formatNumber(remaining)}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{log.item_status !== '-' ? log.item_status : ''}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="accounting-container animate-fade-in">
      <div className="accounting-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b', margin: 0 }}>
          <Wallet size={28} color="#475569" /> ระบบบัญชี & คลังสิ่งของ
        </h2>
        <div className="accounting-tabs">
          <button 
            className={`accounting-tab-btn finance ${activeTab === 'finance' ? 'active' : ''}`}
            onClick={() => setActiveTab('finance')}
          >
            <Wallet size={18} /> ระบบการเงิน
          </button>
          <button 
            className={`accounting-tab-btn item ${activeTab === 'item' ? 'active' : ''}`}
            onClick={() => setActiveTab('item')}
          >
            <PackageSearch size={18} /> ระบบสิ่งของ
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="sub-tabs-container" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button 
          className={`accounting-tab-btn ${subTab === 'manage' ? 'active' : ''}`}
          style={{ background: subTab === 'manage' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: subTab === 'manage' ? '#3b82f6' : 'var(--text-secondary)' }}
          onClick={() => setSubTab('manage')}
        >
          <Settings2 size={16} /> จัดการข้อมูล
        </button>
        <button 
          className={`accounting-tab-btn ${subTab === 'report' ? 'active' : ''}`}
          style={{ background: subTab === 'report' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: subTab === 'report' ? '#3b82f6' : 'var(--text-secondary)' }}
          onClick={() => setSubTab('report')}
        >
          <FileText size={16} /> รายงานสรุป
        </button>
      </div>

      {subTab === 'manage' ? renderManageView() : renderReportView()}
      
    </div>
  );
}
