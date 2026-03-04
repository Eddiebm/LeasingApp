import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
});

export const submitApplication = (data) => api.post('/api/applications', data);
export const getApplications = () => api.get('/api/applications');
export const getApplication = (id) => api.get(`/api/applications/${id}`);
export const updateApplicationStatus = (id, status) =>
  api.patch(`/api/applications/${id}/status`, { status });

export const uploadDocuments = (formData) =>
  api.post('/api/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const generateDocument = (type, data) =>
  api.post(`/api/documents/generate/${type}`, data, { responseType: 'blob' });
