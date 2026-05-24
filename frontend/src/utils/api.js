import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Yeh aapke backend ka address hai
});

// Automatically token bhejne ke liye
api.interceptors.request.use((config) => {
  const userInfo = JSON.parse(localStorage.getItem('gymSaathiUser'));
  if (userInfo && userInfo.token) {
    config.headers.Authorization = `Bearer ${userInfo.token}`;
  }
  return config;
});

export default api;