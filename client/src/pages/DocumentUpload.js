import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { uploadDocuments } from '../api';
import './DocumentUpload.css';

const CATEGORIES = [
  { value: 'id', label: 'Government-Issued ID' },
  { value: 'income', label: 'Proof of Income (Pay Stubs / Bank Statements)' },
  { value: 'employment', label: 'Employment Verification Letter' },
  { value: 'reference', label: 'Reference Letter' },
  { value: 'other', label: 'Other' },
];

const ACCEPTED = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export default function DocumentUpload() {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState('id');
  const [applicationId, setApplicationId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState([]);

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length) {
      rejected.forEach(({ file, errors }) => {
        errors.forEach((e) => {
          if (e.code === 'file-too-large') toast.error(`${file.name} exceeds 10 MB limit.`);
          else if (e.code === 'file-invalid-type') toast.error(`${file.name}: unsupported file type.`);
          else toast.error(`${file.name}: ${e.message}`);
        });
      });
    }
    setFiles((prev) => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
  });

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (!files.length) return toast.error('Please select files to upload.');
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    formData.append('category', category);
    if (applicationId.trim()) formData.append('applicationId', applicationId.trim());

    setUploading(true);
    try {
      const { data } = await uploadDocuments(formData);
      setUploaded((prev) => [...prev, ...data.files]);
      setFiles([]);
      toast.success(`${data.files.length} file(s) uploaded successfully!`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const fmt = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="upload-page">
      <h2>Upload Documents</h2>
      <p className="subtitle">
        Upload required documents for your rental application. Accepted formats: PDF, JPEG, PNG (max 10 MB each).
      </p>

      <div className="upload-card">
        <div className="upload-options">
          <div className="field">
            <label htmlFor="category">Document Category</label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="appId">Application ID (optional)</label>
            <input
              id="appId"
              type="text"
              placeholder="Paste your application ID"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
            />
          </div>
        </div>

        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <div className="dropzone-content">
            <span className="dropzone-icon">📂</span>
            {isDragActive
              ? <p>Drop files here…</p>
              : <p>Drag & drop files here, or <strong>click to browse</strong></p>
            }
            <small>PDF, JPEG, PNG — up to 10 MB each</small>
          </div>
        </div>

        {files.length > 0 && (
          <ul className="file-list">
            {files.map((f, i) => (
              <li key={i}>
                <span className="file-icon">{f.type === 'application/pdf' ? '📄' : '🖼️'}</span>
                <span className="file-name">{f.name}</span>
                <span className="file-size">{fmt(f.size)}</span>
                <button className="remove-btn" onClick={() => removeFile(i)} title="Remove">✕</button>
              </li>
            ))}
          </ul>
        )}

        <button
          className="btn btn-primary upload-btn"
          onClick={handleUpload}
          disabled={uploading || files.length === 0}
        >
          {uploading ? 'Uploading…' : `Upload ${files.length > 0 ? `(${files.length} file${files.length > 1 ? 's' : ''})` : ''}`}
        </button>
      </div>

      {uploaded.length > 0 && (
        <div className="uploaded-section">
          <h3>Recently Uploaded</h3>
          <table className="uploaded-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Category</th>
                <th>Size</th>
                <th>Uploaded At</th>
              </tr>
            </thead>
            <tbody>
              {uploaded.map((f, i) => (
                <tr key={i}>
                  <td>
                    <a href={`http://localhost:5000${f.url}`} target="_blank" rel="noreferrer">
                      {f.originalName}
                    </a>
                  </td>
                  <td>{CATEGORIES.find((c) => c.value === f.category)?.label || f.category}</td>
                  <td>{fmt(f.size)}</td>
                  <td>{new Date(f.uploadedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
