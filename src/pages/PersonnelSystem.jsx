import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, Search, Edit2, Trash2, X, ShieldAlert, ChevronDown } from 'lucide-react';
import './PersonnelSystem.css';

export default function PersonnelSystem({ profile }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all'); // all, admin, medic, user
  
  // Edit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [availablePositions, setAvailablePositions] = useState([]);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchUsers();
      fetchPositions();
      
      const subscription = supabase
        .channel('admin-personnel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          fetchUsers();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [profile]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const { data } = await supabase.from('salary_rates').select('position_name').order('position_name');
      if (data) {
        setAvailablePositions(data.map(p => p.position_name));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  // Filters
  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.ic_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (user.discord_id || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Actions
  const handleEditClick = (user) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditPosition(user.position);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditRole('');
    setEditPosition('');
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: editRole, position: editPosition })
        .eq('discord_id', editingUser.discord_id);

      if (error) throw error;
      
      // Send notification
      if (editRole !== editingUser.role || editPosition !== editingUser.position) {
        let msg = '';
        if (editRole !== editingUser.role) msg += `สิทธิ์การใช้งานของคุณถูกเปลี่ยนเป็น: ${editRole}\n`;
        if (editPosition !== editingUser.position) msg += `ตำแหน่งของคุณถูกเปลี่ยนเป็น: ${editPosition}\n`;
        
        try {
          await supabase.from('notifications').insert([{
            discord_id: editingUser.discord_id,
            title: 'แจ้งเตือนการเปลี่ยนแปลงข้อมูลบุคลากร',
            message: msg.trim()
          }]);
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }

      alert('บันทึกข้อมูลเรียบร้อยแล้ว');
      closeEditModal();
      fetchUsers();
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการ "ลบ" ข้อมูลของ ${user.ic_name} ออกจากระบบอย่างถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
      return;
    }

    try {
      // Supabase Delete
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('discord_id', user.discord_id);

      if (error) throw error;
      
      alert(`ลบข้อมูลของ ${user.ic_name} เรียบร้อยแล้ว`);
      fetchUsers();
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + error.message);
    }
  };

  if (!profile || profile.role !== 'admin') return null;

  return (
    <div className="personnel-container">
      
      {/* Header & Controls */}
      <div className="personnel-header">
        <div className="personnel-search">
          <Search size={18} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="ค้นหาด้วยชื่อ IC..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="personnel-tabs">
          <button className={`personnel-tab-btn ${filterRole === 'all' ? 'active all' : ''}`} onClick={() => setFilterRole('all')}>ทั้งหมด</button>
          <button className={`personnel-tab-btn ${filterRole === 'admin' ? 'active admin' : ''}`} onClick={() => setFilterRole('admin')}>แอดมิน (Admin)</button>
          <button className={`personnel-tab-btn ${filterRole === 'medic' ? 'active medic' : ''}`} onClick={() => setFilterRole('medic')}>แพทย์ (Medic)</button>
          <button className={`personnel-tab-btn ${filterRole === 'user' ? 'active user' : ''}`} onClick={() => setFilterRole('user')}>รออนุมัติ (User)</button>
        </div>
      </div>

      {/* Table Card */}
      <div className="personnel-card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', color: '#ea580c' }}>
          <Users size={28} /> ทะเบียนบุคลากรแพทย์
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>กำลังโหลดข้อมูล...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="personnel-table">
              <thead>
                <tr>
                  <th>ข้อมูลบุคลากร (IC)</th>
                  <th>ตำแหน่ง (Position)</th>
                  <th>สิทธิ์ (Role)</th>
                  <th>Discord ID</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? filteredUsers.map(user => (
                  <tr key={user.discord_id}>
                    <td>
                      <div className="personnel-user">
                        <div className="personnel-avatar" style={{ padding: user.avatar_url ? 0 : undefined }}>
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : getInitial(user.ic_name)}
                        </div>
                        <div>
                          <div className="personnel-name">{user.ic_name}</div>
                          <div className="personnel-phone">{user.ic_phone || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{user.position}</td>
                    <td>
                      <span className={`role-badge ${user.role}`}>{user.role}</span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{user.discord_id}</td>
                    <td>
                      <div className="personnel-actions">
                        <button className="action-btn edit" onClick={() => handleEditClick(user)} title="แก้ไขข้อมูล">
                          <Edit2 size={18} />
                        </button>
                        {user.discord_id !== profile.discord_id && (
                          <button className="action-btn delete" onClick={() => handleDeleteUser(user)} title="ลบข้อมูลถาวร">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      ไม่พบข้อมูลบุคลากรในหมวดหมู่นี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>แก้ไขข้อมูลบุคลากร</h2>
              <button className="close-btn" onClick={closeEditModal}><X size={20} /></button>
            </div>
            
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px' }}>
              <div className="personnel-avatar" style={{ padding: editingUser.avatar_url ? 0 : undefined, width: '50px', height: '50px' }}>
                {editingUser.avatar_url ? (
                  <img src={editingUser.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : getInitial(editingUser.ic_name)}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#1e293b' }}>{editingUser.ic_name}</div>
                <div style={{ fontSize: '0.9rem', color: '#64748b' }}>Discord ID: {editingUser.discord_id}</div>
              </div>
            </div>

            <div className="modal-form-group">
              <label>สิทธิ์การใช้งาน (Role)</label>
              <div className="custom-dropdown">
                <div 
                  className={`dropdown-selected ${isRoleDropdownOpen ? 'open' : ''}`}
                  onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                >
                  {editRole === 'admin' ? 'Admin (ผู้ดูแลระบบ)' : 
                   editRole === 'medic' ? 'Medic (แพทย์ทั่วไป)' : 
                   'User (รออนุมัติ / โดนตัดสิทธิ์)'}
                  <ChevronDown size={18} style={{ transition: 'transform 0.2s', transform: isRoleDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                </div>
                {isRoleDropdownOpen && (
                  <div className="dropdown-options">
                    {[
                      { value: 'user', label: 'User (รออนุมัติ / โดนตัดสิทธิ์)' },
                      { value: 'medic', label: 'Medic (แพทย์ทั่วไป)' },
                      { value: 'admin', label: 'Admin (ผู้ดูแลระบบ)' }
                    ].map(role => (
                      <div 
                        key={role.value} 
                        className={`dropdown-option ${editRole === role.value ? 'selected' : ''}`}
                        onClick={() => {
                          setEditRole(role.value);
                          setIsRoleDropdownOpen(false);
                        }}
                      >
                        {role.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-form-group">
              <label>ตำแหน่ง (Position)</label>
              <div className="custom-dropdown">
                <div 
                  className={`dropdown-selected ${isDropdownOpen ? 'open' : ''}`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  {editPosition || 'เลือกตำแหน่ง...'}
                  <ChevronDown size={18} style={{ transition: 'transform 0.2s', transform: isDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                </div>
                {isDropdownOpen && (
                  <div className="dropdown-options">
                    {availablePositions.length > 0 ? availablePositions.map(pos => (
                      <div 
                        key={pos} 
                        className={`dropdown-option ${editPosition === pos ? 'selected' : ''}`}
                        onClick={() => {
                          setEditPosition(pos);
                          setIsDropdownOpen(false);
                        }}
                      >
                        {pos}
                      </div>
                    )) : (
                      <div className="dropdown-option">กำลังโหลดตำแหน่ง...</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {editRole === 'user' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: '#b91c1c', fontSize: '0.85rem', background: '#fef2f2', padding: '0.75rem', borderRadius: '8px' }}>
                <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>คำเตือน:</strong> การเปลี่ยนสิทธิ์เป็น User จะทำให้ผู้ใช้นี้ไม่สามารถเข้าถึงระบบภายในได้อีก (Access Denied)</span>
              </div>
            )}

            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={closeEditModal} disabled={isSaving}>ยกเลิก</button>
              <button className="modal-btn save" onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
