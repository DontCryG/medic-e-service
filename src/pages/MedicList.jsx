import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Contact, Search } from 'lucide-react';
import './PersonnelSystem.css'; // Reusing styles from PersonnelSystem

export default function MedicList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();

    const subscription = supabase
      .channel('medic-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', ['admin', 'medic']) // Only approved medics
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  // Filters
  const filteredUsers = users.filter(user => {
    return (user.ic_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
           (user.position || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="personnel-container animate-fade-in">
      
      {/* Header */}
      <div className="personnel-header">
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อ หรือ ตำแหน่ง..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 2.5rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              outline: 'none',
              fontSize: '0.95rem'
            }}
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="personnel-card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', color: '#ea580c' }}>
          <Contact size={28} /> ทำเนียบรายชื่อแพทย์
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>กำลังโหลดข้อมูล...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="personnel-table">
              <thead>
                <tr>
                  <th>ข้อมูลแพทย์ (IC)</th>
                  <th>ตำแหน่ง (Position)</th>
                  <th>สิทธิ์ (Role)</th>
                  <th>ช่องทางติดต่อ (โทรศัพท์)</th>
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
                        </div>
                      </div>
                    </td>
                    <td>{user.position || '-'}</td>
                    <td>
                      <span className={`role-badge ${user.role}`}>{user.role}</span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.95rem' }}>{user.ic_phone || '-'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      ไม่พบข้อมูลบุคลากรในหมวดหมู่นี้
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
