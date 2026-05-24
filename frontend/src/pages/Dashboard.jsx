import { useState, useEffect } from 'react';
import { auth, db } from '../utils/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, setDoc, getDocs, query, where, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [gymProfile, setGymProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Chatbot States (Aeistha)
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: 'Hi! I am Aeistha, your AI Assistant. How can I help you manage your gym today?' }
  ]);

  // Setup / Settings Form
  const [gymName, setGymName] = useState('');
  const [phone, setPhone] = useState('');
  const [settingsForm, setSettingsForm] = useState({ gymName: '', phone: '', logoUrl: '' });

  // Data & Client Form
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [editingClientId, setEditingClientId] = useState(null);
  const [newClient, setNewClient] = useState({ name: '', phone: '', plan: '1 Month', joinDate: '', fee: '', status: 'Active' });

  // MANUAL UPI PAYMENT STATES
  const [utrNumber, setUtrNumber] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // 🔥 ADMIN GLOBAL SETTINGS (QR, UPI, Telegram, Email) 🔥
  const [adminSettings, setAdminSettings] = useState({
    upiId: 'admin@upi', 
    qrCodeUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg',
    telegramLink: '#',
    supportEmail: '#'
  });

  // 1. Fetch Data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'gym_owners', user.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) setGymProfile(snap.data());

          const q = query(collection(db, 'clients'), where('ownerId', '==', user.uid));
          const querySnapshot = await getDocs(q);
          const fetchedClients = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setClients(fetchedClients.sort((a,b) => b.id.localeCompare(a.id)));

          // Fetch Global Settings from Admin
          const settingsSnap = await getDoc(doc(db, 'admin_settings', 'global'));
          if (settingsSnap.exists()) setAdminSettings(settingsSnap.data());

        } catch (error) { console.error("Data fetch error:", error); }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. SUBSCRIPTION & DAYS LEFT CALCULATOR
  const calculateDaysLeft = (endDate) => {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const now = new Date();
    const diff = end - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysLeft = gymProfile ? calculateDaysLeft(gymProfile.subscriptionEndDate) : 0;
  const isSubscriptionLocked = gymProfile && daysLeft <= 0 && gymProfile.subscriptionStatus !== 'pending_verification';

  // VOICE AI LOGIC (Aeistha Speaks)
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(voice => 
        voice.name.includes('Female') || voice.name.includes('Samantha') || voice.name.includes('Zira') || voice.name.includes('Google UK English Female')
      );
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.rate = 1;
      utterance.pitch = 1.2;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (isChatOpen && chatMessages.length === 1) {
      speakText(chatMessages[0].text);
    } else if (!isChatOpen) {
      window.speechSynthesis.cancel();
    }
  }, [isChatOpen, chatMessages]);

  // 3. MANUAL PAYMENT SUBMIT LOGIC
  const handleScreenshotUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2097152) { alert("Please select an image smaller than 2MB"); return; }
      const reader = new FileReader();
      reader.onloadend = () => { setPaymentScreenshot(reader.result); };
      reader.readAsDataURL(file);
    }
  };

  const submitPaymentRequest = async (e) => {
    e.preventDefault();
    if(!utrNumber || !paymentScreenshot) return alert("Please enter UTR Number and upload the Payment Screenshot.");
    setIsSubmittingPayment(true);
    try {
      await addDoc(collection(db, 'payment_requests'), {
        gymId: auth.currentUser.uid, gymName: gymProfile.gymName, ownerName: gymProfile.ownerName,
        phone: gymProfile.phone, utr: utrNumber, screenshot: paymentScreenshot, date: new Date().toISOString(), status: 'pending'
      });
      await updateDoc(doc(db, 'gym_owners', auth.currentUser.uid), { subscriptionStatus: 'pending_verification' });
      setGymProfile({...gymProfile, subscriptionStatus: 'pending_verification'});
      alert("Payment request sent! Please wait for Admin approval.");
    } catch (error) { alert("Error submitting payment."); }
    setIsSubmittingPayment(false);
  };

  // 4. Setup First-Time Profile with 1 MONTH FREE TRIAL
  const saveProfile = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    const trialEnd = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const newProfile = { ownerName: user.displayName || 'Owner', email: user.email, gymName, phone, logoUrl: '', subscriptionStatus: 'trial', subscriptionEndDate: trialEnd };
    try {
      await setDoc(doc(db, 'gym_owners', user.uid), newProfile);
      setGymProfile(newProfile);
    } catch (error) { alert("Error saving profile."); }
  };

  // 5. Settings
  const openSettings = () => {
    setSettingsForm({ gymName: gymProfile.gymName, phone: gymProfile.phone, logoUrl: gymProfile.logoUrl || '' });
    setIsSettingsOpen(true);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1048576) { alert("Image smaller than 1MB please"); return; }
      const reader = new FileReader();
      reader.onloadend = () => { setSettingsForm({ ...settingsForm, logoUrl: reader.result }); };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'gym_owners', auth.currentUser.uid), settingsForm);
      setGymProfile({ ...gymProfile, ...settingsForm });
      setIsSettingsOpen(false);
    } catch (error) { alert("Error updating settings."); }
  };

  // 6. Client Logic
  const calculateNextDue = (joinDate, plan) => {
    if(!joinDate) return '';
    const date = new Date(joinDate);
    if (plan === '1 Month') date.setMonth(date.getMonth() + 1);
    else if (plan === '3 Months') date.setMonth(date.getMonth() + 3);
    else if (plan === '6 Months') date.setMonth(date.getMonth() + 6);
    else if (plan === '1 Year') date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  };

  const openAddModal = () => {
    setEditingClientId(null);
    setNewClient({ name: '', phone: '', plan: '1 Month', joinDate: '', fee: '', status: 'Active' });
    setIsModalOpen(true);
  };

  const openEditModal = (client) => {
    setEditingClientId(client.id);
    setNewClient({ name: client.name, phone: client.phone, plan: client.plan, joinDate: client.joinDate, fee: client.fee, status: client.status });
    setIsModalOpen(true);
  };

  const handleAddOrUpdateClient = async (e) => {
    e.preventDefault();
    const nextDue = calculateNextDue(newClient.joinDate, newClient.plan);
    const clientData = { ownerId: auth.currentUser.uid, name: newClient.name, phone: newClient.phone, plan: newClient.plan, joinDate: newClient.joinDate, nextDueDate: nextDue, fee: parseInt(newClient.fee), status: newClient.status };

    try {
      if (editingClientId) {
        await updateDoc(doc(db, 'clients', editingClientId), clientData);
        setClients(clients.map(c => c.id === editingClientId ? { id: editingClientId, ...clientData } : c));
      } else {
        const docRef = await addDoc(collection(db, 'clients'), clientData);
        setClients([{ id: docRef.id, ...clientData }, ...clients]);
      }
      setIsModalOpen(false);
    } catch (error) { alert("Error saving client"); }
  };

  const handleDeleteClient = async (id) => {
    if(window.confirm("Are you sure you want to completely remove this client?")) {
      try {
        await deleteDoc(doc(db, 'clients', id));
        setClients(clients.filter(c => c.id !== id));
      } catch (error) { alert("Error deleting client."); }
    }
  };

  const dueClientsCount = clients.filter(c => c.status === 'Due').length;
  const upcomingCount = clients.filter(c => c.status === 'Upcoming').length;
  const totalRevenue = clients.reduce((sum, c) => sum + (c.fee || 0), 0);
  const monthlyRevenue = clients.reduce((sum, c) => c.status !== 'Due' ? sum + (c.fee || 0) : sum, 0);

  // AI CHATBOT LOGIC
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput;
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setTimeout(() => {
      let aiReply = `At ${gymProfile.gymName}, I am ready to assist you.`;
      if(userText.toLowerCase().includes("due")) aiReply = `At ${gymProfile.gymName}, you currently have ${dueClientsCount} clients with pending payments.`;
      else if (userText.toLowerCase().includes("revenue")) aiReply = `At ${gymProfile.gymName}, your total collected revenue is ₹${totalRevenue}.`;
      else if (userText.toLowerCase().includes("client")) aiReply = `At ${gymProfile.gymName}, you are managing ${clients.length} clients.`;
      else aiReply = `At ${gymProfile.gymName}, I'm here to help. Ask me about your dues, revenue, or clients!`;
      setChatMessages(prev => [...prev, { sender: 'ai', text: aiReply }]);
      speakText(aiReply);
    }, 1000);
  };

  if (loading) return <div className="preloader-bg-white"><div className="brand-circle-wrapper"><div className="circle-spinner"></div><div className="brand-text"><span className="text-gym">GYM</span><span className="text-saathi">Saathi</span></div></div></div>;

  if (!gymProfile) {
    return (
      <div className="login-container">
        <div className="auth-card-3d">
          <div className="brand-text" style={{marginBottom: '20px', textAlign: 'center'}}><span className="text-gym" style={{fontSize: '28px'}}>GYM</span><span className="text-saathi" style={{fontSize: '24px'}}>Saathi</span></div>
          <h2 style={{fontSize: '22px', marginBottom: '5px', textAlign: 'center', color: '#2b3674'}}>Complete Your Profile</h2>
          <form onSubmit={saveProfile} style={{marginTop: '25px', textAlign: 'left'}}>
            <div className="input-group"><label>Gym Name</label><input type="text" required value={gymName} onChange={e=>setGymName(e.target.value)} className="input-field" placeholder="e.g. Iron Paradise Gym" /></div>
            <div className="input-group"><label>Mobile No.</label><input type="tel" required value={phone} onChange={e=>setPhone(e.target.value)} className="input-field" placeholder="9876543210" /></div>
            <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '10px'}}>Start 1 Month Free Trial</button>
          </form>
        </div>
      </div>
    );
  }

  // IF BANNED
  if (gymProfile?.subscriptionStatus === 'banned') {
    return (
      <div className="paywall-container">
        <div className="paywall-card">
          <div style={{fontSize: '50px', marginBottom: '10px'}}><i className="ri-error-warning-fill" style={{color: '#dc2626'}}></i></div>
          <h2 style={{fontSize: '24px', marginBottom: '10px', color: '#dc2626'}}>Account Suspended</h2>
          <p style={{color: '#8f9bba', marginBottom: '30px', lineHeight: '1.5'}}>Your account has been restricted by the Administrator. Please contact support.</p>
          <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px'}}>
            <a href={adminSettings.telegramLink} target="_blank" rel="noreferrer" style={{background: '#0088cc', color: 'white', padding: '10px 15px', borderRadius: '8px', textDecoration: 'none'}}><i className="ri-telegram-fill"></i> Support</a>
            <a href={`mailto:${adminSettings.supportEmail}`} style={{background: '#4318ff', color: 'white', padding: '10px 15px', borderRadius: '8px', textDecoration: 'none'}}><i className="ri-mail-send-fill"></i> Email</a>
          </div>
          <button onClick={() => signOut(auth)} style={{background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold'}}>Logout</button>
        </div>
      </div>
    );
  }

  // IF VERIFICATION PENDING
  if (gymProfile?.subscriptionStatus === 'pending_verification') {
    return (
      <div className="paywall-container">
        <div className="paywall-card">
          <div style={{fontSize: '50px', marginBottom: '10px'}}><i className="ri-time-fill" style={{color: '#ea580c'}}></i></div>
          <h2 style={{fontSize: '24px', marginBottom: '10px', color: '#ea580c'}}>Verification Pending</h2>
          <p style={{color: '#8f9bba', marginBottom: '30px', lineHeight: '1.5'}}>Your payment screenshot and UTR have been submitted. The Admin is verifying your payment. Your dashboard will unlock soon!</p>
          <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px'}}>
            <a href={adminSettings.telegramLink} target="_blank" rel="noreferrer" style={{background: '#0088cc', color: 'white', padding: '10px 15px', borderRadius: '8px', textDecoration: 'none'}}><i className="ri-telegram-fill"></i> Contact Admin</a>
          </div>
          <button onClick={() => signOut(auth)} style={{background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold'}}>Logout</button>
        </div>
      </div>
    );
  }

  // IF SUBSCRIPTION EXPIRED (PAYWALL WITH DYNAMIC UPI & SUPPORT)
  if (isSubscriptionLocked) {
    return (
      <div className="paywall-container">
        <div className="paywall-card" style={{padding: '30px', maxWidth: '450px'}}>
          <div style={{fontSize: '40px', marginBottom: '10px'}}><i className="ri-lock-fill" style={{color: '#2b3674'}}></i></div>
          <h2 style={{fontSize: '22px', marginBottom: '10px'}}>Subscription Expired</h2>
          <p style={{color: '#8f9bba', marginBottom: '20px', fontSize: '14px', lineHeight: '1.5'}}>Pay ₹399 via UPI to unlock {gymProfile.gymName} dashboard.</p>
          
          <div style={{background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px'}}>
            <img src={adminSettings.qrCodeUrl} alt="Admin QR Code" style={{width: '150px', height: '150px', borderRadius: '8px', border: '2px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'}} />
            <div style={{fontSize: '14px', color: '#334155', fontWeight: 'bold', marginTop: '10px'}}>Scan & Pay ₹399</div>
            <div style={{fontSize: '12px', color: '#8f9bba'}}>UPI ID: {adminSettings.upiId}</div>
          </div>

          <form onSubmit={submitPaymentRequest} style={{textAlign: 'left'}}>
            <div className="input-group">
              <label style={{fontSize: '13px'}}>UTR / Transaction Number</label>
              <input type="text" required value={utrNumber} onChange={e=>setUtrNumber(e.target.value)} className="input-field" placeholder="e.g. 123456789012" />
            </div>
            <div className="input-group">
              <label style={{fontSize: '13px'}}>Upload Payment Screenshot</label>
              <input type="file" accept="image/*" required onChange={handleScreenshotUpload} className="input-field" style={{padding: '8px'}} />
            </div>
            <button type="submit" className="btn-primary" style={{width: '100%', padding: '12px'}} disabled={isSubmittingPayment}>
              {isSubmittingPayment ? 'Submitting...' : 'Submit for Verification'}
            </button>
          </form>

          <div style={{marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <a href={adminSettings.telegramLink} target="_blank" rel="noreferrer" style={{color: '#0088cc', fontSize: '14px', textDecoration: 'none', fontWeight: 'bold'}}><i className="ri-customer-service-2-fill"></i> Need Help?</a>
            <button onClick={() => signOut(auth)} style={{background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold'}}>Logout</button>
          </div>
        </div>
      </div>
    );
  }

  const filteredData = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm);
    const matchStatus = filterStatus === 'All Status' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="app-layout">
      {isSidebarOpen && <div className="modal-overlay" onClick={() => setIsSidebarOpen(false)} style={{zIndex: 999}}></div>}
      
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <span className="sidebar-gym-name">
            <i className="ri-dumbbell-line" style={{ color: 'white', marginRight: '8px', fontSize: '20px', verticalAlign: 'middle' }}></i>
            {gymProfile.gymName}
          </span>
          <button className="close-sidebar" onClick={() => setIsSidebarOpen(false)}>×</button>
        </div>
        <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => {setActiveTab('dashboard'); setIsSidebarOpen(false);}}><i className="ri-dashboard-fill"></i> Dashboard</div>
        <div className={`nav-item ${activeTab === 'clients' ? 'active' : ''}`} onClick={() => {setActiveTab('clients'); setIsSidebarOpen(false);}}><i className="ri-team-fill"></i> Clients</div>
        <div className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => {setActiveTab('payments'); setIsSidebarOpen(false);}}><i className="ri-secure-payment-line"></i> Payments</div>
        
        {/* 🔥 NEW CUSTOMER SUPPORT TAB 🔥 */}
        <div className={`nav-item ${activeTab === 'support' ? 'active' : ''}`} onClick={() => {setActiveTab('support'); setIsSidebarOpen(false);}} style={{marginTop: 'auto', marginBottom: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px'}}>
          <i className="ri-customer-service-2-fill"></i> Help & Support
        </div>
      </div>

      <div className="main-content">
        <header className="top-header">
          <div className="header-mobile-nav"><button className="hamburger" onClick={() => setIsSidebarOpen(true)}>☰</button></div>
          <div className="header-search-container" style={{ position: 'relative' }}>
            <i className="ri-search-line" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#8f9bba' }}></i>
            <input type="text" placeholder="Search clients by name or phone..." className="search-bar" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '40px' }} />
          </div>
          <div className="profile-wrapper">
            <div className="user-profile" onClick={() => setActiveTab('profile')} style={{cursor: 'pointer'}} title="View Profile">
              <div className="profile-text"><div className="owner-name-text">Hello, {gymProfile.ownerName.split(" ")[0]}</div></div>
              <div className="user-avatar" style={gymProfile.logoUrl ? {backgroundImage: `url(${gymProfile.logoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent'} : {}}>
                {!gymProfile.logoUrl && gymProfile.ownerName.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-title">Total Clients</div><div className="stat-value" style={{color: '#4318ff'}}>{clients.length}</div></div>
              <div className="stat-card"><div className="stat-title">Due Clients</div><div className="stat-value" style={{color: '#dc2626'}}>{dueClientsCount}</div></div>
              <div className="stat-card"><div className="stat-title">Upcoming</div><div className="stat-value" style={{color: '#ea580c'}}>{upcomingCount}</div></div>
              <div className="stat-card"><div className="stat-title">Monthly Projection</div><div className="stat-value" style={{color: '#16a34a'}}>₹{monthlyRevenue}</div></div>
              <div className="stat-card"><div className="stat-title">Days Left</div><div className="stat-value" style={{color: '#ea580c'}}>{daysLeft}</div><div className="stat-sub">{gymProfile.subscriptionStatus === 'trial' ? 'Free Trial' : 'Active Subscription'}</div></div>
            </div>

            <div className="dashboard-grid">
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Recent Clients</div>
                  <div className="card-actions">
                    <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option>All Status</option><option>Active</option><option>Due</option><option>Upcoming</option>
                    </select>
                    <button className="btn-primary" onClick={openAddModal}>+ Add Client</button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table">
                    <thead><tr><th>Name</th><th>Phone</th><th>Plan</th><th>Next Due</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredData.slice(0, 5).map(c => (
                        <tr key={c.id}>
                          <td style={{fontWeight: '600'}}>{c.name}</td><td>{c.phone}</td><td>{c.plan}</td><td>{c.nextDueDate}</td>
                          <td><span className={`status-badge s-${c.status}`}>{c.status}</span></td>
                          <td>
                            <div style={{display: 'flex', gap: '5px'}}>
                              <button className="action-btn" title="Edit Client" onClick={() => openEditModal(c)}><i className="ri-edit-line"></i></button>
                              <button className="action-btn" title="Remove Client" onClick={() => handleDeleteClient(c.id)}><i className="ri-delete-bin-fill"></i></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredData.length === 0 && <tr><td colSpan="6" style={{textAlign: 'center', color: '#8f9bba', padding: '30px'}}>No clients found. Add some!</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="card-title" style={{marginBottom: '20px'}}>Quick Actions</div>
                <button className="quick-action-btn" onClick={openAddModal}>👥 Add Client</button>
                <button className="quick-action-btn" onClick={() => setActiveTab('payments')}><i className="ri-secure-payment-fill"></i> Pay Subscription</button>
                <button className="quick-action-btn" onClick={() => setActiveTab('clients')}>📋 View All Clients</button>
              </div>
            </div>
          </>
        )}

        {/* CLIENTS VIEW */}
        {activeTab === 'clients' && (
          <div className="card" style={{ width: '100%', minHeight: '60vh' }}>
            <div className="card-header">
              <div className="card-title">All Clients Directory</div>
              <div className="card-actions">
                <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option>All Status</option><option>Active</option><option>Due</option><option>Upcoming</option>
                </select>
                <button className="btn-primary" onClick={openAddModal}>+ Add Client</button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table">
                <thead><tr><th>Name</th><th>Phone</th><th>Plan</th><th>Next Due</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredData.map(c => (
                    <tr key={c.id}>
                      <td style={{fontWeight: '600'}}>{c.name}</td><td>{c.phone}</td><td>{c.plan}</td><td>{c.nextDueDate}</td>
                      <td><span className={`status-badge s-${c.status}`}>{c.status}</span></td>
                      <td>
                        <div style={{display: 'flex', gap: '5px'}}>
                          <button className="action-btn" onClick={() => openEditModal(c)}><i className="ri-edit-line"></i></button>
                          <button className="action-btn" onClick={() => handleDeleteClient(c.id)}><i className="ri-delete-bin-fill"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && <tr><td colSpan="6" style={{textAlign: 'center', color: '#8f9bba', padding: '30px'}}>No clients found. Add some!</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAYMENTS VIEW */}
        {activeTab === 'payments' && (
          <div className="card" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
            <div className="premium-banner">
              <div>
                <h3 style={{fontSize: '20px', marginBottom: '5px'}}>{gymProfile.subscriptionStatus === 'trial' ? '✨ Free Trial Active' : '👑 You are a Subscribed Customer'}</h3>
                <p style={{fontSize: '14px', opacity: 0.9}}>Manage your GYM Saathi plan easily.</p>
              </div>
              <div style={{textAlign: 'right', background: 'rgba(255,255,255,0.2)', padding: '10px 15px', borderRadius: '12px'}}>
                <div style={{fontSize: '24px', fontWeight: 'bold'}}>{daysLeft}</div>
                <div style={{fontSize: '12px'}}>Days Left</div>
              </div>
            </div>

            <div className="card-title" style={{fontSize: '22px', marginBottom: '10px'}}>Renew Subscription</div>
            
            <div style={{background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', textAlign: 'center'}}>
              <div style={{fontSize: '14px', color: '#334155', fontWeight: 'bold', marginBottom: '10px'}}>Scan to Pay ₹399</div>
              <img src={adminSettings.qrCodeUrl} alt="UPI QR" style={{width: '150px', height: '150px', margin: '0 auto', border: '4px solid white', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'}} />
              <div style={{fontSize: '14px', color: '#8f9bba', marginTop: '10px'}}>UPI ID: {adminSettings.upiId}</div>
            </div>

            <form onSubmit={submitPaymentRequest}>
              <div className="input-group">
                <label>UTR / Transaction Number</label>
                <input type="text" required value={utrNumber} onChange={e=>setUtrNumber(e.target.value)} className="input-field" placeholder="12 digit UTR number" />
              </div>
              <div className="input-group">
                <label>Upload Payment Screenshot</label>
                <input type="file" accept="image/*" required onChange={handleScreenshotUpload} className="input-field" style={{padding: '9px'}} />
              </div>
              <button type="submit" className="btn-primary" style={{width: '100%', padding: '15px', fontSize: '16px'}} disabled={isSubmittingPayment}>
                {isSubmittingPayment ? 'Submitting...' : 'Submit for Verification'}
              </button>
            </form>
          </div>
        )}

        {/* 🔥 NEW SUPPORT TAB 🔥 */}
        {activeTab === 'support' && (
          <div className="card" style={{ width: '100%', maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
            <i className="ri-customer-service-2-fill" style={{fontSize: '60px', color: '#4318ff'}}></i>
            <h2 style={{ fontSize: '24px', color: '#2b3674', margin: '15px 0' }}>How can we help you?</h2>
            <p style={{ fontSize: '16px', color: '#8f9bba', marginBottom: '30px' }}>Our support team is always ready to resolve your issues and answer your doubts.</p>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '300px', margin: '0 auto'}}>
              <a href={adminSettings.telegramLink} target="_blank" rel="noreferrer" style={{background: '#0088cc', color: 'white', padding: '15px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '16px'}}>
                <i className="ri-telegram-fill" style={{marginRight: '8px'}}></i> Connect on Telegram
              </a>
              <a href={`mailto:${adminSettings.supportEmail}`} style={{background: '#f8fafc', color: '#2b3674', padding: '15px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '16px', border: '1px solid #cbd5e1'}}>
                <i className="ri-mail-send-fill" style={{marginRight: '8px'}}></i> Send an Email
              </a>
            </div>
          </div>
        )}

        {/* PROFILE PAGE */}
        {activeTab === 'profile' && (
          <div className="card" style={{ width: '100%', maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#ea580c', color: 'white', fontSize: '48px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', backgroundImage: gymProfile.logoUrl ? `url(${gymProfile.logoUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', border: '4px solid #f4f7fe', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
              {!gymProfile.logoUrl && gymProfile.ownerName.charAt(0).toUpperCase()}
            </div>
            <h2 style={{ fontSize: '28px', color: '#2b3674', marginBottom: '5px', textTransform: 'capitalize' }}>{gymProfile.ownerName}</h2>
            <p style={{ fontSize: '16px', color: '#8f9bba', marginBottom: '25px' }}>Owner at <span style={{fontWeight: 'bold', color: '#4318ff'}}>{gymProfile.gymName}</span></p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px', textAlign: 'left' }}>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '13px', color: '#8f9bba', marginBottom: '5px' }}>Phone Number</div>
                <div style={{ fontSize: '16px', color: '#2b3674', fontWeight: 'bold' }}><i className="ri-phone-line"></i> {gymProfile.phone}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '13px', color: '#8f9bba', marginBottom: '5px' }}>Total Clients</div>
                <div style={{ fontSize: '16px', color: '#2b3674', fontWeight: 'bold' }}>👥 {clients.length}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button className="btn-primary" onClick={openSettings} style={{ flex: 1, padding: '12px', fontSize: '15px' }}>⚙️ Edit Profile</button>
              <button className="btn-primary" onClick={() => signOut(auth)} style={{ flex: 1, padding: '12px', fontSize: '15px', background: '#dc2626' }}>🚪 Logout Securely</button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD/EDIT CLIENT */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{marginBottom: '20px', color: '#2b3674'}}>{editingClientId ? 'Edit Client Details' : 'Add New Client'}</h2>
            <form onSubmit={handleAddOrUpdateClient}>
              <div className="input-group"><label>Full Name</label><input type="text" required value={newClient.name} onChange={e=>setNewClient({...newClient, name: e.target.value})} className="input-field" /></div>
              <div className="input-group"><label>Phone Number</label><input type="tel" required value={newClient.phone} onChange={e=>setNewClient({...newClient, phone: e.target.value})} className="input-field" /></div>
              <div style={{display: 'flex', gap: '15px', marginBottom: '15px'}}>
                <div style={{flex: 1}}><label>Join Date</label><input type="date" required value={newClient.joinDate} onChange={e=>setNewClient({...newClient, joinDate: e.target.value})} className="input-field" /></div>
                <div style={{flex: 1}}><label>Total Fee (₹)</label><input type="number" required value={newClient.fee} onChange={e=>setNewClient({...newClient, fee: e.target.value})} className="input-field" /></div>
              </div>
              <div style={{display: 'flex', gap: '15px', marginBottom: '15px'}}>
                <div style={{flex: 1}}>
                  <label>Membership Plan</label>
                  <select className="input-field" value={newClient.plan} onChange={e=>setNewClient({...newClient, plan: e.target.value})}>
                    <option>1 Month</option><option>3 Months</option><option>6 Months</option><option>1 Year</option>
                  </select>
                </div>
                {editingClientId && (
                  <div style={{flex: 1}}>
                    <label>Update Status</label>
                    <select className="input-field" value={newClient.status} onChange={e=>setNewClient({...newClient, status: e.target.value})}>
                      <option>Active</option><option>Upcoming</option><option>Due</option>
                    </select>
                  </div>
                )}
              </div>
              <div style={{display: 'flex', gap: '10px', marginTop: '25px'}}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="input-field" style={{flex: 1, background: '#f8fafc', cursor: 'pointer', border: 'none'}}>Cancel</button>
                <button type="submit" className="btn-primary" style={{flex: 1}}>{editingClientId ? 'Update Changes' : 'Save Client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SETTINGS */}
      {isSettingsOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{marginBottom: '20px', color: '#2b3674'}}>Gym Profile Settings</h2>
            <form onSubmit={handleSaveSettings}>
              <div className="input-group"><label>Gym Name</label><input type="text" required value={settingsForm.gymName} onChange={e=>setSettingsForm({...settingsForm, gymName: e.target.value})} className="input-field" /></div>
              <div className="input-group"><label>Phone Number</label><input type="tel" required value={settingsForm.phone} onChange={e=>setSettingsForm({...settingsForm, phone: e.target.value})} className="input-field" /></div>
              <div className="input-group">
                <label>Gym Logo / Photo (Select from Gallery)</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="input-field" style={{padding: '9px', cursor: 'pointer'}} />
                {settingsForm.logoUrl && <div style={{marginTop: '10px', textAlign: 'center'}}><img src={settingsForm.logoUrl} alt="Preview" style={{width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0'}} /></div>}
              </div>
              <div style={{display: 'flex', gap: '10px', marginTop: '25px'}}>
                <button type="button" onClick={() => setIsSettingsOpen(false)} className="input-field" style={{flex: 1, background: '#f8fafc', cursor: 'pointer', border: 'none'}}>Cancel</button>
                <button type="submit" className="btn-primary" style={{flex: 1}}>Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AEISTHA CHATBOT UI */}
      <button className="chatbot-toggle" onClick={() => setIsChatOpen(!isChatOpen)}>🤖</button>
      {isChatOpen && (
        <div className="chatbot-window">
          <div className="chat-header"><span>✨ Aeistha</span><button onClick={() => setIsChatOpen(false)} style={{background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px'}}>✖</button></div>
          <div className="chat-body">{chatMessages.map((msg, i) => (<div key={i} className={`chat-msg ${msg.sender === 'user' ? 'msg-user' : 'msg-ai'}`}>{msg.text}</div>))}</div>
          <form className="chat-input-area" onSubmit={handleSendMessage}>
            <input type="text" className="chat-input" placeholder="Ask Aeistha..." value={chatInput} onChange={e => setChatInput(e.target.value)} />
            <button type="submit" className="chat-send">➤</button>
          </form>
        </div>
      )}
    </div>
  );
}