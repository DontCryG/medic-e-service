import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserCog, Clock, CheckCircle, XCircle, CalendarDays, LogOut, Umbrella } from 'lucide-react';
import './RequestManagement.css';

export default function RequestManagement({ profile }) {
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('pending'); // 'pending', 'approved', 'rejected'
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchData();
      
      const subscription = supabase
        .channel('admin-leave-requests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
          fetchData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [profile]);

  const fetchData = async () => {
    try {
      // Fetch all users to map discord_id to user info
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*');
      
      if (usersError) throw usersError;
      
      const userMap = {};
      usersData.forEach(u => {
        userMap[u.discord_id] = u;
      });
      setUsers(userMap);

      // Fetch all requests
      const { data: reqData, error: reqError } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (reqError) throw reqError;
      setRequests(reqData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId, requestType, discordId, newStatus) => {
    const actionText = newStatus === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ';
    if (!window.confirm(`คุณต้องการ ${actionText} คำร้องนี้ใช่หรือไม่?`)) return;

    setProcessingId(requestId);
    try {
      // 1. Update request status
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // 2. If it's an APPROVED RESIGNATION, demote the user
      if (requestType === 'resign' && newStatus === 'approved') {
        const { error: roleError } = await supabase
          .from('users')
          .update({ role: 'user' }) // 'user' role revokes access
          .eq('discord_id', discordId);
          
        if (roleError) console.error('Error updating user role:', roleError);
      }

      // 3. Send Notification
      try {
        await supabase.from('notifications').insert([{
          discord_id: discordId,
          title: `คำร้อง${requestType === 'leave' ? 'ลางาน' : requestType === 'vacation' ? 'ลาพักร้อน' : 'ลาออก'}ถูก${newStatus === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}`,
          message: `คำร้องของคุณได้รับการตรวจสอบและ${newStatus === 'approved' ? 'อนุมัติเรียบร้อยแล้ว' : 'ถูกปฏิเสธ'}`
        }]);
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }

      alert('ดำเนินการสำเร็จ');
      fetchData();
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDateString = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('th-TH', { 
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  const filteredRequests = requests.filter(req => req.status === filterTab);

  if (!profile || profile.role !== 'admin') return null;

  return (
    <div className="req-admin-container">
      
      <div className="req-admin-tabs">
        <button 
          className={`req-admin-tab-btn ${filterTab === 'pending' ? 'active pending' : ''}`}
          onClick={() => setFilterTab('pending')}
        >
          <Clock size={18} /> รอดำเนินการ
        </button>
        <button 
          className={`req-admin-tab-btn ${filterTab === 'approved' ? 'active approved' : ''}`}
          onClick={() => setFilterTab('approved')}
        >
          <CheckCircle size={18} /> อนุมัติแล้ว
        </button>
        <button 
          className={`req-admin-tab-btn ${filterTab === 'rejected' ? 'active rejected' : ''}`}
          onClick={() => setFilterTab('rejected')}
        >
          <XCircle size={18} /> ไม่อนุมัติ
        </button>
      </div>

      <div className="req-admin-card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', color: '#ea580c' }}>
          <UserCog size={28} /> จัดการคำร้อง
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>กำลังโหลดข้อมูล...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="req-admin-table">
              <thead>
                <tr>
                  <th>ผู้ส่งคำร้อง</th>
                  <th>ประเภทคำร้อง</th>
                  <th>รายละเอียด</th>
                  <th>วันที่ส่ง</th>
                  {filterTab === 'pending' && <th>จัดการ</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length > 0 ? filteredRequests.map(req => {
                  const reqUser = users[req.discord_id] || {};
                  return (
                    <tr key={req.id}>
                      <td>
                        <div className="req-admin-user">
                          <div className="req-admin-avatar">
                            {reqUser.avatar_url ? (
                              <img src={reqUser.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : getInitial(reqUser.ic_name)}
                          </div>
                          <div>
                            <div className="req-admin-name">{reqUser.ic_name || 'ไม่ทราบชื่อ'}</div>
                            <div className="req-admin-role">{reqUser.position || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`req-type-badge ${req.request_type}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          {req.request_type === 'leave' ? <CalendarDays size={14} /> : req.request_type === 'vacation' ? <Umbrella size={14} /> : <LogOut size={14} />}
                          {req.request_type === 'leave' ? 'ลางาน' : req.request_type === 'vacation' ? 'ลาพักร้อน' : 'ลาออก'}
                        </span>
                      </td>
                      <td style={{ maxWidth: '250px' }}>
                        {req.request_type === 'leave' || req.request_type === 'vacation' ? (
                          <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: 600 }}>
                            {formatDateString(req.start_date)} - {formatDateString(req.end_date)}
                          </div>
                        ) : (
                          req.start_date && (
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: 600 }}>
                              วันสุดท้าย: {formatDateString(req.start_date)}
                            </div>
                          )
                        )}
                        <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>{req.reason}</div>
                      </td>
                      <td>{formatDateString(req.created_at)}</td>
                      
                      {filterTab === 'pending' && (
                        <td>
                          <div className="req-admin-actions">
                            <button 
                              className="btn-approve"
                              onClick={() => handleAction(req.id, req.request_type, req.discord_id, 'approved')}
                              disabled={processingId === req.id}
                            >
                              <CheckCircle size={16} /> อนุมัติ
                            </button>
                            <button 
                              className="btn-reject"
                              onClick={() => handleAction(req.id, req.request_type, req.discord_id, 'rejected')}
                              disabled={processingId === req.id}
                            >
                              <XCircle size={16} /> ปฏิเสธ
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={filterTab === 'pending' ? "5" : "4"} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      ไม่มีคำร้องในหมวดหมู่นี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
