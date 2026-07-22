import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Wallet, TrendingUp, TrendingDown, PackageSearch, PackagePlus, PackageMinus, 
  PlusCircle, Trash2, CalendarDays, Search, CheckCircle 
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Swal from 'sweetalert2';
import './AccountingSystem.css';

export default function AccountingSystem({ profile }) {
  const [activeTab, setActiveTab] = useState('finance'); // 'finance' | 'item'
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
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'finance') setTransactionType('income');
    else setTransactionType('receive');
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
        .order('created_at', { ascending: false });
        
      if (error) {
        if (error.message.includes('does not exist')) {
          setLogs([]);
          return; // Suppress error if table doesn't exist yet
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
    if (activeTab === 'item' && !quantity) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุจำนวนชิ้น', 'warning');

    setIsSubmitting(true);
    try {
      const payload = {
        record_group: activeTab,
        transaction_type: transactionType,
        category: category,
        description: description,
        discord_id: profile?.discord_id,
        reporter_name: profile?.name || profile?.discord_id
      };

      if (activeTab === 'finance') {
        payload.amount = parseFloat(amount);
      } else {
        payload.quantity = parseInt(quantity, 10);
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

  const formatCurrency = (amt) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amt);
  const formatNumber = (num) => new Intl.NumberFormat('th-TH').format(num);

  const filteredLogs = logs.filter(l => 
    (l.category || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (l.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate Summaries
  const totalIncome = logs.filter(l => l.transaction_type === 'income').reduce((sum, l) => sum + (l.amount || 0), 0);
  const totalExpense = logs.filter(l => l.transaction_type === 'expense').reduce((sum, l) => sum + (l.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;

  const totalReceive = logs.filter(l => l.transaction_type === 'receive').reduce((sum, l) => sum + (l.quantity || 0), 0);
  const totalDisburse = logs.filter(l => l.transaction_type === 'disburse').reduce((sum, l) => sum + (l.quantity || 0), 0);

  if (profile?.role !== 'admin') return null;

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
                    <PackagePlus size={18} /> รับเข้า
                  </button>
                  <button type="button" className={`type-btn disburse ${transactionType === 'disburse' ? 'active' : ''}`} onClick={() => setTransactionType('disburse')}>
                    <PackageMinus size={18} /> เบิกออก
                  </button>
                </>
              )}
            </div>

            <div className="form-group">
              <label>{activeTab === 'finance' ? 'หมวดหมู่ / ชื่อรายการ' : 'ชื่อสิ่งของ'}</label>
              <input 
                type="text" 
                className="modal-input" 
                placeholder={activeTab === 'finance' ? 'เช่น เงินเดือน, สปอนเซอร์, ซื้ออุปกรณ์' : 'เช่น ผ้าพันแผล, ยาแก้ปวด'}
                value={category}
                onChange={e => setCategory(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>{activeTab === 'finance' ? 'จำนวนเงิน (THB)' : 'จำนวน (ชิ้น)'}</label>
              <input 
                type="number" 
                className="modal-input" 
                placeholder="0"
                value={activeTab === 'finance' ? amount : quantity}
                onChange={e => activeTab === 'finance' ? setAmount(e.target.value) : setQuantity(e.target.value)}
                min="0"
                step={activeTab === 'finance' ? "0.01" : "1"}
                required
              />
            </div>

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

        {/* Table Panel */}
        <div className="table-card">
          <div className="table-header">
            <h3 style={{ margin: 0, color: '#1e293b' }}>ประวัติรายการ</h3>
            
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

          <div className="acc-table-wrapper">
            <table className="acc-table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ประเภท</th>
                  <th>{activeTab === 'finance' ? 'รายการ' : 'ชื่อสิ่งของ'}</th>
                  <th style={{ textAlign: 'right' }}>จำนวน</th>
                  <th>ผู้บันทึก</th>
                  <th style={{ textAlign: 'center' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>กำลังโหลดข้อมูล...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>ไม่พบข้อมูลในช่วงเวลานี้</td></tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ color: '#64748b' }}>{log.transaction_date}</td>
                      <td>
                        {log.transaction_type === 'income' && <span className="tag income">รายรับ</span>}
                        {log.transaction_type === 'expense' && <span className="tag expense">รายจ่าย</span>}
                        {log.transaction_type === 'receive' && <span className="tag receive">รับเข้า</span>}
                        {log.transaction_type === 'disburse' && <span className="tag disburse">เบิกออก</span>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: '#1e293b' }}>{log.category}</div>
                        {log.description && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>{log.description}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {activeTab === 'finance' ? (
                          <span className={log.transaction_type === 'income' ? 'val-positive' : 'val-negative'}>
                            {log.transaction_type === 'income' ? '+' : '-'}{formatCurrency(log.amount)}
                          </span>
                        ) : (
                          <span className={log.transaction_type === 'receive' ? 'val-positive' : 'val-negative'}>
                            {log.transaction_type === 'receive' ? '+' : '-'}{formatNumber(log.quantity)} ชิ้น
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{log.reporter_name || 'Admin'}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="delete-adj-btn" 
                          onClick={() => handleDelete(log.id)}
                          style={{ margin: '0 auto' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
