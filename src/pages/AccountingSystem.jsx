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
  const [showAddModal, setShowAddModal] = useState(false);
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
  const [availableItems, setAvailableItems] = useState([]);

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
    if (activeTab === 'item') {
      fetchAvailableItems();
    }
  }, [activeTab, startDate, endDate]);

  const fetchAvailableItems = async () => {
    try {
      const { data, error } = await supabase.from('accounting_logs').select('category, transaction_type, quantity, distribute_total').eq('record_group', 'item');
      if (!error && data) {
        const balances = {};
        data.forEach(log => {
          if (!log.category) return;
          if (!balances[log.category]) balances[log.category] = 0;
          if (log.transaction_type === 'receive') balances[log.category] += (log.quantity || 0);
          else if (log.transaction_type === 'disburse') balances[log.category] -= (log.distribute_total || 0);
        });
        const uniqueWithBalances = Object.keys(balances).map(k => ({ name: k, balance: balances[k] }));
        setAvailableItems(uniqueWithBalances);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    }
  };

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
    if (activeTab === 'item' && transactionType === 'receive' && !quantity) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุจำนวนทั้งหมด', 'warning');

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
        
        if (transactionType === 'expense') {
          const { data: allFinance, error: fErr } = await supabase
            .from('accounting_logs')
            .select('transaction_type, amount')
            .eq('record_group', 'finance');
            
          if (!fErr && allFinance) {
            const tInc = allFinance.filter(l => l.transaction_type === 'income').reduce((sum, l) => sum + (l.amount || 0), 0);
            const tExp = allFinance.filter(l => l.transaction_type === 'expense').reduce((sum, l) => sum + (l.amount || 0), 0);
            const trueBal = tInc - tExp;
            
            if (payload.amount > trueBal) {
              Swal.fire('ข้อผิดพลาด', `ยอดเงินคงเหลือไม่เพียงพอ (คงเหลือ ${formatNumber(trueBal)} บาท)`, 'error');
              setIsSubmitting(false);
              return;
            }
          }
        }
        
      } else {
        payload.quantity = parseInt(quantity, 10) || 0;
        payload.distribute_per_person = parseInt(distributePerPerson, 10) || 0;
        payload.person_count = parseInt(personCount, 10) || 0;
        payload.distribute_total = payload.distribute_per_person * payload.person_count;
        payload.item_status = transactionType === 'receive' ? '-' : 'รอดำเนินการ';
        
        if (transactionType === 'disburse') {
          const { data: allItem, error: iErr } = await supabase
            .from('accounting_logs')
            .select('transaction_type, quantity, distribute_total')
            .eq('record_group', 'item')
            .eq('category', category);
            
          if (!iErr && allItem) {
            const tRec = allItem.filter(l => l.transaction_type === 'receive').reduce((sum, l) => sum + (l.quantity || 0), 0);
            const tDis = allItem.filter(l => l.transaction_type === 'disburse').reduce((sum, l) => sum + (l.distribute_total || 0), 0);
            const available = tRec - tDis;
            
            if (payload.distribute_total > available) {
              Swal.fire('ข้อผิดพลาด', `ของไม่เพียงพอ! "${category}" คงเหลือ ${formatNumber(available)} ชิ้น (ต้องการเบิก ${formatNumber(payload.distribute_total)} ชิ้น)`, 'error');
              setIsSubmitting(false);
              return;
            }
          }
        }
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
      setShowAddModal(false);
      fetchLogs();
      if (activeTab === 'item') fetchAvailableItems();
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

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase.from('accounting_logs').update({ item_status: newStatus }).eq('id', id);
      if (error) throw error;
      fetchLogs();
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const formatCurrency = (amt) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amt || 0);
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

  // Calculate Stats for display
  const stats = {
    totalIncome: logs.filter(l => l.transaction_type === 'income').reduce((sum, l) => sum + (l.amount || 0), 0),
    totalExpense: logs.filter(l => l.transaction_type === 'expense').reduce((sum, l) => sum + (l.amount || 0), 0),
    balance: 0,
    totalReceive: logs.filter(l => l.transaction_type === 'receive').reduce((sum, l) => sum + (l.quantity || 0), 0),
    totalDisburse: logs.filter(l => l.transaction_type === 'disburse').reduce((sum, l) => sum + (l.quantity || 0), 0)
  };
  stats.balance = stats.totalIncome - stats.totalExpense;

  if (profile?.role !== 'admin') return null;

  const renderForm = () => (
    <form onSubmit={handleSave}>
      <div className="type-selector" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        {activeTab === 'finance' ? (
          <>
            <button type="button" className={`type-btn income ${transactionType === 'income' ? 'active' : ''}`} onClick={() => setTransactionType('income')} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: transactionType === 'income' ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: '#10b981', fontWeight: 600, cursor: 'pointer' }}>
              <TrendingUp size={18} /> รายรับ
            </button>
            <button type="button" className={`type-btn expense ${transactionType === 'expense' ? 'active' : ''}`} onClick={() => setTransactionType('expense')} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: transactionType === 'expense' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}>
              <TrendingDown size={18} /> รายจ่าย
            </button>
          </>
        ) : (
          <>
            <button type="button" className={`type-btn receive ${transactionType === 'receive' ? 'active' : ''}`} onClick={() => setTransactionType('receive')} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: transactionType === 'receive' ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: '#10b981', fontWeight: 600, cursor: 'pointer' }}>
              <PackagePlus size={18} /> รับของ
            </button>
            <button type="button" className={`type-btn disburse ${transactionType === 'disburse' ? 'active' : ''}`} onClick={() => setTransactionType('disburse')} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: transactionType === 'disburse' ? 'rgba(245, 158, 11, 0.1)' : 'transparent', color: '#f59e0b', fontWeight: 600, cursor: 'pointer' }}>
              <PackageMinus size={18} /> แจกจ่าย
            </button>
          </>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>{activeTab === 'finance' ? 'หมวดหมู่ / ชื่อรายการ' : 'รายการสิ่งของ'}</label>
        {activeTab === 'item' && transactionType === 'disburse' ? (
          <select 
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#1e293b' }}
            value={category}
            onChange={e => setCategory(e.target.value)}
            required
          >
            <option value="" disabled>-- เลือกสิ่งของที่ต้องการเบิก --</option>
            {availableItems.map(item => (
              <option key={item.name} value={item.name}>{item.name} (คงเหลือ {formatNumber(item.balance)} ชิ้น)</option>
            ))}
          </select>
        ) : (
          <input 
            type="text" 
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'transparent', color: '#1e293b' }}
            placeholder={activeTab === 'finance' ? 'เช่น เงินเดือน, สปอนเซอร์, ซื้ออุปกรณ์' : 'เช่น Ticket Rainy, GACHA IC'}
            value={category}
            onChange={e => setCategory(e.target.value)}
            required
          />
        )}
      </div>

      {activeTab === 'finance' && (
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>จำนวนเงิน (THB)</label>
          <input 
            type="number" 
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'transparent', color: '#1e293b' }}
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
          {transactionType === 'receive' && (
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>จำนวนทั้งหมด</label>
              <input 
                type="number" 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'transparent', color: '#1e293b' }}
                placeholder="0"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min="0"
                required
              />
            </div>
          )}
          {transactionType === 'disburse' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>จำนวนแจก(คน)</label>
                  <input 
                    type="number" 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'transparent', color: '#1e293b' }}
                    placeholder="0"
                    value={distributePerPerson}
                    onChange={e => setDistributePerPerson(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>จำนวนคน</label>
                  <input 
                    type="number" 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'transparent', color: '#1e293b' }}
                    placeholder="0"
                    value={personCount}
                    onChange={e => setPersonCount(e.target.value)}
                    min="0"
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>รายละเอียดเพิ่มเติม (Optional)</label>
        <textarea 
          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'transparent', color: '#1e293b', resize: 'vertical' }}
          rows="3"
          placeholder="ระบุหมายเหตุหรือผู้ที่เกี่ยวข้อง..."
          value={description}
          onChange={e => setDescription(e.target.value)}
        ></textarea>
      </div>

      <button type="submit" className="submit-btn" disabled={isSubmitting} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#8b5cf6', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
        <PlusCircle size={20} /> {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
      </button>
    </form>
  );

  const renderManageView = () => (
    <div className="manage-container animate-fade-in">
      {/* Summary Cards */}
      <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="summary-card receive" style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div className="icon-wrapper" style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {activeTab === 'finance' ? <TrendingUp size={24} /> : <PackagePlus size={24} />}
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', color: '#64748b', fontSize: '0.875rem' }}>{activeTab === 'finance' ? 'รายรับทั้งหมด' : 'รับเข้าทั้งหมด'}</h3>
            <p style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem', fontWeight: 700 }}>{activeTab === 'finance' ? formatCurrency(stats.totalIncome) : `${formatNumber(stats.totalReceive)} ชิ้น`}</p>
          </div>
        </div>
        <div className="summary-card disburse" style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div className="icon-wrapper" style={{ width: '48px', height: '48px', borderRadius: '12px', background: activeTab === 'finance' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: activeTab === 'finance' ? '#ef4444' : '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {activeTab === 'finance' ? <TrendingDown size={24} /> : <PackageMinus size={24} />}
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', color: '#64748b', fontSize: '0.875rem' }}>{activeTab === 'finance' ? 'รายจ่ายทั้งหมด' : 'เบิกออกทั้งหมด'}</h3>
            <p style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem', fontWeight: 700 }}>{activeTab === 'finance' ? formatCurrency(stats.totalExpense) : `${formatNumber(stats.totalDisburse)} ชิ้น`}</p>
          </div>
        </div>
        <div className="summary-card balance" style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div className="icon-wrapper" style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {activeTab === 'finance' ? <Wallet size={24} /> : <CheckCircle size={24} />}
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', color: '#64748b', fontSize: '0.875rem' }}>{activeTab === 'finance' ? 'ยอดคงเหลือ' : 'ทำรายการทั้งหมด'}</h3>
            <p style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem', fontWeight: 700 }}>{activeTab === 'finance' ? formatCurrency(stats.balance) : `${formatNumber(logs.length)} รายการ`}</p>
          </div>
        </div>
      </div>

      <div className="table-container" style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
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
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {log.item_status === 'รอดำเนินการ' ? (
                                <button 
                                  onClick={() => handleUpdateStatus(log.id, 'เสร็จสิ้น')}
                                  style={{ cursor: 'pointer', border: 'none', background: '#fef08a', color: '#854d0e', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s' }}
                                  onMouseOver={(e) => e.target.style.opacity = '0.8'}
                                  onMouseOut={(e) => e.target.style.opacity = '1'}
                                >
                                  รอดำเนินการ
                                </button>
                              ) : log.item_status === 'เสร็จสิ้น' ? (
                                <button
                                  onClick={() => handleUpdateStatus(log.id, 'รอดำเนินการ')}
                                  style={{ cursor: 'pointer', border: 'none', background: '#bbf7d0', color: '#166534', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s' }}
                                  onMouseOver={(e) => e.target.style.opacity = '0.8'}
                                  onMouseOut={(e) => e.target.style.opacity = '1'}
                                >
                                  เสร็จสิ้น
                                </button>
                              ) : (
                                '-'
                              )}
                            </td>
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
  );
  const renderReportView = () => {
    let currentBalance = 0;

    return (
      <div className="report-container animate-fade-in">
        <div className="table-header" style={{ marginBottom: '1.5rem', background: '#ffffff', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
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
        
        <div className="report-table-wrapper" style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
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

      {/* Header and Sub Tabs */}
      <div className="sub-tabs-container" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={`accounting-tab-btn ${subTab === 'manage' ? 'active' : ''}`}
            style={{ background: subTab === 'manage' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: subTab === 'manage' ? '#3b82f6' : '#64748b' }}
            onClick={() => setSubTab('manage')}
          >
            <Settings2 size={16} /> จัดการข้อมูล
          </button>
          <button 
            className={`accounting-tab-btn ${subTab === 'report' ? 'active' : ''}`}
            style={{ background: subTab === 'report' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: subTab === 'report' ? '#3b82f6' : '#64748b' }}
            onClick={() => setSubTab('report')}
          >
            <FileText size={16} /> รายงานสรุป
          </button>
        </div>
        
        {subTab === 'manage' && (
          <button 
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#8b5cf6', color: '#fff', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.3)' }}
          >
            <PlusCircle size={18} /> 
            {activeTab === 'finance' ? 'บันทึกธุรกรรมใหม่' : 'บันทึกรายการสิ่งของ'}
          </button>
        )}
      </div>

      {subTab === 'manage' ? renderManageView() : renderReportView()}
      
      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content animate-fade-in" style={{ background: '#ffffff', padding: '2rem', borderRadius: '16px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {activeTab === 'finance' ? <Wallet size={20} color="#3b82f6"/> : <PackagePlus size={20} color="#0ea5e9"/>}
                {activeTab === 'finance' ? 'บันทึกธุรกรรมใหม่' : 'บันทึกรายการสิ่งของ'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
              >
                ✕
              </button>
            </div>
            {renderForm()}
          </div>
        </div>
      )}
      
    </div>
  );
}
