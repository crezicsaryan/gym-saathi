import { useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc, query, where } from 'firebase/firestore';

export default function AdminPanel() {
  // 🔥 ADMIN LOGIN STATES 🔥
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('requests');
  const [gyms, setGyms] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Global Admin Settings State
  const [adminSettings, setAdminSettings] = useState({
    upiId: '', qrCodeUrl: '', telegramLink: '', supportEmail: ''
  });

  // Client Viewing State
  const [viewingGym, setViewingGym] = useState(null);
  const [gymClients, setGymClients] = useState([]);

  // 🔥 ADMIN LOGIN LOGIC 🔥
  const handleAdminLogin = (e) => {
    e.preventDefault();
    // Yahan aap apna pasandida ID aur Password set kar sakte ho
    if (adminId === 'admin' && adminPass === 'admin123') {
      setIsAuthenticated(true);
      setLoginError('');
      fetchData(); // Login success hone ke baad hi data fetch hoga
    } else {
      setLoginError('Invalid Admin ID or Password!');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Gyms
      const gymSnap = await getDocs(collection(db, 'gym_owners'));
      setGyms(gymSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      // Fetch Payment Requests
      const reqSnap = await getDocs(collection(db, 'payment_requests'));
      setRequests(reqSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch Admin Settings
      const settingsSnap = await getDoc(doc(db, 'admin_settings', 'global'));
      if(settingsSnap.exists()) setAdminSettings(settingsSnap.data());
    } catch (error) {
      console.error("Error fetching admin data", error);
    }
    setLoading(false);
  };

  // Approve Payment
  const approvePayment = async (req) => {
    if(!window.confirm(`Approve payment for ${req.gymName}?`)) return;
    try {
      const gymRef = doc(db, 'gym_owners', req.gymId);
      const gymSnap = await getDoc(gymRef);
      let currentEnd = new Date();
      if(gymSnap.exists() && gymSnap.data().subscriptionEndDate) {
        const end = new Date(gymSnap.data().subscriptionEndDate);
        if(end > currentEnd) currentEnd = end;
      }
      const newEndDate = new Date(currentEnd.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await updateDoc(gymRef, { subscriptionEndDate: newEndDate, subscriptionStatus: 'active' });
      await deleteDoc(doc(db, 'payment_requests', req.id));
      alert("Payment Approved! Gym unlocked for 30 more days.");
      fetchData();
    } catch (error) { alert("Error approving payment"); }
  };

  // Ban/Unban Gym
  const toggleBanStatus = async (gymId, currentStatus) => {
    const isBanning = currentStatus !== 'banned';
    if(!window.confirm(`Are you sure you want to ${isBanning ? 'BAN' : 'UNBAN'} this gym?`)) return;
    try {
      await updateDoc(doc(db, 'gym_owners', gymId), { subscriptionStatus: isBanning ? 'banned' : 'active' });
      fetchData();
    } catch (error) { alert("Error updating status"); }
  };

  // View Gym Clients
  const viewClients = async (gym) => {
    setViewingGym(gym);
    const q = query(collection(db, 'clients'), where('ownerId', '==', gym.id));
    const snap = await getDocs(q);
    setGymClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setActiveTab('view_clients');
  };

  // Update Admin Settings
  const handleQRUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1048576) return alert("QR Image should be smaller than 1MB");
      const reader = new FileReader();
      reader.onloadend = () => setAdminSettings({ ...adminSettings, qrCodeUrl: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const saveAdminSettings = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'admin_settings', 'global'), adminSettings);
      alert("Settings Updated Successfully! Gym owners will now see these changes.");
    } catch (error) { alert("Error updating settings"); }
  };

  // 🔥 LOGIN SCREEN UI 🔥
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="auth-card-3d" style={{maxWidth: '400px'}}>
          <i className="ri-shield-keyhole-fill" style={{fontSize: '60px', color: '#ea580c'}}></i>
          <h2 style={{fontSize: '24px', color: '#2b3674', marginBottom: '5px', marginTop: '10px'}}>Admin Secure Login</h2>
          <p style={{color: '#8f9bba', fontSize: '14px', marginBottom: '25px'}}>Please enter your credentials to access the panel.</p>
          
          {loginError && <div style={{background: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px', fontWeight: 'bold'}}>{loginError}</div>}
          
          <form onSubmit={handleAdminLogin} style={{textAlign: 'left'}}>
            <div className="input-group">
              <label style={{fontSize: '13px', fontWeight: 'bold', color: '#475569'}}>Admin ID</label>
              <input type="text" required value={adminId} onChange={e=>setAdminId(e.target.value)} className="input-field" placeholder="Enter Admin ID" style={{padding: '12px'}} />
            </div>
            <div className="input-group" style={{marginTop: '15px'}}>
              <label style={{fontSize: '13px', fontWeight: 'bold', color: '#475569'}}>Password</label>
              <input type="password" required value={adminPass} onChange={e=>setAdminPass(e.target.value)} className="input-field" placeholder="Enter Password" style={{padding: '12px'}} />
            </div>
            <button type="submit" className="btn-primary" style={{width: '100%', padding: '14px', fontSize: '16px', marginTop: '25px'}}>
              <i className="ri-login-circle-line" style={{marginRight: '8px'}}></i> Login to Admin
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Preloader after login
  if (loading) return <div style={{padding: '50px', textAlign: 'center', fontSize: '18px', color: '#2b3674', fontWeight: 'bold'}}>Loading Secure Admin Panel... <i className="ri-loader-4-line ri-spin"></i></div>;

  return (
    <div style={{display: 'flex', height: '100vh', fontFamily: 'sans-serif'}} className="login-container">
      
      {/* Professional Sidebar */}
      <div style={{width: '260px', background: 'rgba(17, 28, 68, 0.95)', color: 'white', padding: '20px', backdropFilter: 'blur(10px)', borderRight: '1px solid rgba(255,255,255,0.1)'}}>
        <h2 style={{marginBottom: '30px', color: 'white', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px'}}>
          <i className="ri-shield-user-fill" style={{color: '#ea580c', fontSize: '24px'}}></i> GYM Saathi Admin
        </h2>
        
        <div onClick={() => setActiveTab('requests')} style={{padding: '15px', cursor: 'pointer', background: activeTab === 'requests' ? '#4318ff' : 'transparent', borderRadius: '8px', marginBottom: '10px', transition: '0.3s'}}>
          <i className="ri-bank-card-line" style={{marginRight: '8px'}}></i> Pending Payments ({requests.length})
        </div>
        <div onClick={() => setActiveTab('gyms')} style={{padding: '15px', cursor: 'pointer', background: (activeTab === 'gyms' || activeTab === 'view_clients') ? '#4318ff' : 'transparent', borderRadius: '8px', marginBottom: '10px', transition: '0.3s'}}>
          <i className="ri-store-2-line" style={{marginRight: '8px'}}></i> Manage Gyms ({gyms.length})
        </div>
        <div onClick={() => setActiveTab('settings')} style={{padding: '15px', cursor: 'pointer', background: activeTab === 'settings' ? '#4318ff' : 'transparent', borderRadius: '8px', marginBottom: '20px', transition: '0.3s'}}>
          <i className="ri-settings-3-line" style={{marginRight: '8px'}}></i> Global Settings
        </div>

        {/* Logout Button from Admin */}
        <div onClick={() => setIsAuthenticated(false)} style={{padding: '15px', cursor: 'pointer', background: '#dc2626', borderRadius: '8px', transition: '0.3s', marginTop: 'auto', textAlign: 'center'}}>
          <i className="ri-logout-box-r-line" style={{marginRight: '8px'}}></i> Logout Admin
        </div>
      </div>

      {/* Main Content (3D Animated Cards) */}
      <div style={{flex: 1, padding: '30px', overflowY: 'auto'}}>
        
        {activeTab === 'requests' && (
          <div className="auth-card-3d" style={{maxWidth: '800px', margin: '0 auto', textAlign: 'left', animation: 'floatCard 6s ease-in-out infinite'}}>
            <h2 style={{fontSize: '24px', color: '#2b3674', marginBottom: '20px'}}><i className="ri-time-line"></i> Pending Approvals</h2>
            {requests.length === 0 ? <p style={{color: '#8f9bba'}}>No pending requests.</p> : requests.map(req => (
              <div key={req.id} style={{background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '15px', display: 'flex', gap: '20px', border: '1px solid #e2e8f0'}}>
                <img src={req.screenshot} alt="Payment" style={{width: '120px', height: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1'}} />
                <div style={{flex: 1}}>
                  <h3 style={{color: '#2b3674', margin: '0 0 5px 0'}}>{req.gymName}</h3>
                  <p style={{color: '#8f9bba', margin: '0 0 10px 0'}}>Owner: {req.ownerName} | Phone: {req.phone}</p>
                  <div style={{background: 'white', padding: '10px', borderRadius: '8px', display: 'inline-block', marginBottom: '15px', border: '1px solid #e2e8f0'}}>
                    <span style={{color: '#8f9bba', fontSize: '12px'}}>UTR Number</span><br/>
                    <strong style={{color: '#ea580c'}}>{req.utr}</strong>
                  </div>
                  <div style={{display: 'flex', gap: '10px'}}>
                    <button onClick={() => approvePayment(req)} style={{background: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', flex: 1}}><i className="ri-check-line"></i> Approve</button>
                    <button onClick={() => deleteDoc(doc(db, 'payment_requests', req.id)).then(fetchData)} style={{background: '#dc2626', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', flex: 1}}><i className="ri-close-line"></i> Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'gyms' && (
          <div className="auth-card-3d" style={{maxWidth: '1000px', margin: '0 auto', textAlign: 'left'}}>
            <h2 style={{fontSize: '24px', color: '#2b3674', marginBottom: '20px'}}><i className="ri-store-2-line"></i> All Registered Gyms</h2>
            <table style={{width: '100%', background: 'white', borderRadius: '12px', overflow: 'hidden', borderCollapse: 'collapse', border: '1px solid #e2e8f0'}}>
              <thead style={{background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0'}}>
                <tr><th style={{padding: '15px'}}>Gym Details</th><th style={{padding: '15px'}}>Valid Till</th><th style={{padding: '15px'}}>Status</th><th style={{padding: '15px'}}>Actions</th></tr>
              </thead>
              <tbody>
                {gyms.map(gym => (
                  <tr key={gym.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                    <td style={{padding: '15px'}}>
                      <strong style={{color: '#2b3674'}}>{gym.gymName}</strong><br/>
                      <span style={{fontSize: '12px', color: '#8f9bba'}}>📞 {gym.phone}</span>
                    </td>
                    <td style={{padding: '15px', color: '#334155'}}>{gym.subscriptionEndDate ? new Date(gym.subscriptionEndDate).toLocaleDateString() : 'N/A'}</td>
                    <td style={{padding: '15px'}}>
                      <span style={{background: gym.subscriptionStatus === 'banned' ? '#fee2e2' : '#dcfce7', color: gym.subscriptionStatus === 'banned' ? '#dc2626' : '#16a34a', padding: '5px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold'}}>
                        {gym.subscriptionStatus.toUpperCase()}
                      </span>
                    </td>
                    <td style={{padding: '15px'}}>
                      <div style={{display: 'flex', gap: '5px'}}>
                        <button onClick={() => viewClients(gym)} style={{background: '#4318ff', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'}}><i className="ri-group-line"></i> Clients</button>
                        <button onClick={() => toggleBanStatus(gym.id, gym.subscriptionStatus)} style={{background: gym.subscriptionStatus === 'banned' ? '#16a34a' : '#dc2626', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'}}>
                          {gym.subscriptionStatus === 'banned' ? 'Unban' : 'Ban Gym'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* View Specific Gym Clients */}
        {activeTab === 'view_clients' && viewingGym && (
          <div className="auth-card-3d" style={{maxWidth: '1000px', margin: '0 auto', textAlign: 'left'}}>
            <button onClick={() => setActiveTab('gyms')} style={{background: 'none', border: 'none', color: '#4318ff', cursor: 'pointer', marginBottom: '20px', fontWeight: 'bold'}}><i className="ri-arrow-left-line"></i> Back to Gyms</button>
            <h2 style={{fontSize: '24px', color: '#2b3674', marginBottom: '5px'}}><i className="ri-group-line"></i> Clients of {viewingGym.gymName}</h2>
            <p style={{color: '#8f9bba', marginBottom: '20px'}}>Total Clients: {gymClients.length}</p>
            
            <table style={{width: '100%', background: 'white', borderRadius: '12px', overflow: 'hidden', borderCollapse: 'collapse', border: '1px solid #e2e8f0'}}>
              <thead style={{background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0'}}>
                <tr><th style={{padding: '15px'}}>Client Name</th><th style={{padding: '15px'}}>Phone</th><th style={{padding: '15px'}}>Plan & Fee</th><th style={{padding: '15px'}}>Status</th></tr>
              </thead>
              <tbody>
                {gymClients.length === 0 ? <tr><td colSpan="4" style={{padding: '20px', textAlign: 'center', color: '#8f9bba'}}>No clients found for this gym.</td></tr> : null}
                {gymClients.map(c => (
                  <tr key={c.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                    <td style={{padding: '15px', fontWeight: 'bold', color: '#2b3674'}}>{c.name}</td>
                    <td style={{padding: '15px', color: '#334155'}}>{c.phone}</td>
                    <td style={{padding: '15px', color: '#334155'}}>{c.plan} (₹{c.fee})</td>
                    <td style={{padding: '15px'}}><span style={{background: '#f1f5f9', color: '#475569', padding: '5px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold'}}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Global Settings */}
        {activeTab === 'settings' && (
          <div className="auth-card-3d" style={{maxWidth: '600px', margin: '0 auto', textAlign: 'left', animation: 'floatCard 6s ease-in-out infinite'}}>
            <h2 style={{fontSize: '24px', color: '#2b3674', marginBottom: '20px'}}><i className="ri-settings-3-line"></i> Global Payment & Support Settings</h2>
            <form onSubmit={saveAdminSettings}>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontSize: '13px', color: '#475569', fontWeight: 'bold'}}>UPI ID for Payments</label>
                <input type="text" required value={adminSettings.upiId} onChange={e => setAdminSettings({...adminSettings, upiId: e.target.value})} style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none'}} placeholder="e.g. yourname@oksbi" />
              </div>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontSize: '13px', color: '#475569', fontWeight: 'bold'}}>Upload New QR Code Image</label>
                <input type="file" accept="image/*" onChange={handleQRUpload} style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white'}} />
                {adminSettings.qrCodeUrl && <img src={adminSettings.qrCodeUrl} alt="QR Preview" style={{width: '100px', height: '100px', marginTop: '10px', borderRadius: '8px', border: '2px solid #e2e8f0'}} />}
              </div>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontSize: '13px', color: '#475569', fontWeight: 'bold'}}>Telegram Support Link</label>
                <input type="url" required value={adminSettings.telegramLink} onChange={e => setAdminSettings({...adminSettings, telegramLink: e.target.value})} style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none'}} placeholder="https://t.me/yourusername" />
              </div>
              <div style={{marginBottom: '25px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontSize: '13px', color: '#475569', fontWeight: 'bold'}}>Support Email Address</label>
                <input type="email" required value={adminSettings.supportEmail} onChange={e => setAdminSettings({...adminSettings, supportEmail: e.target.value})} style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none'}} placeholder="support@gymsaathi.com" />
              </div>
              <button type="submit" style={{width: '100%', background: '#4318ff', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s'}}>
                <i className="ri-save-3-line"></i> Update Live Settings
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}