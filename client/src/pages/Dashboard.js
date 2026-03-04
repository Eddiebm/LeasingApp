import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getApplications, updateApplicationStatus } from '../api';
import './Dashboard.css';

const STATUS_LABELS = {
  pending: { label: 'Pending', color: '#f39c12' },
  under_review: { label: 'Under Review', color: '#2980b9' },
  approved: { label: 'Approved', color: '#27ae60' },
  denied: { label: 'Denied', color: '#e74c3c' },
};

export default function Dashboard() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getApplications();
      setApplications(data.reverse());
    } catch {
      toast.error('Failed to load applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const handleStatusChange = async (id, status) => {
    try {
      await updateApplicationStatus(id, status);
      setApplications((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
      toast.success('Status updated.');
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const filtered = statusFilter === 'all'
    ? applications
    : applications.filter((a) => a.status === statusFilter);

  if (loading) return <div className="dashboard loading"><div className="spinner" /><p>Loading applications…</p></div>;

  return (
    <div className="dashboard">
      <div className="dash-header">
        <h2>Application Dashboard</h2>
        <div className="dash-controls">
          <label htmlFor="filter">Filter by status:</label>
          <select id="filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All ({applications.length})</option>
            {Object.entries(STATUS_LABELS).map(([k, { label }]) => (
              <option key={k} value={k}>
                {label} ({applications.filter((a) => a.status === k).length})
              </option>
            ))}
          </select>
          <button className="btn btn-ghost refresh-btn" onClick={fetchApps}>↻ Refresh</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span>📭</span>
          <p>No applications found.</p>
          <a href="/apply" className="btn btn-primary">Submit Application</a>
        </div>
      ) : (
        <div className="app-list">
          {filtered.map((app) => {
            const st = STATUS_LABELS[app.status] || STATUS_LABELS.pending;
            const isOpen = expanded === app.id;
            return (
              <div key={app.id} className={`app-item ${isOpen ? 'open' : ''}`}>
                <div className="app-summary" onClick={() => setExpanded(isOpen ? null : app.id)}>
                  <div className="app-name">
                    {app.firstName} {app.lastName}
                    <span className="app-date">{new Date(app.submittedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="app-meta">
                    <span className="status-badge" style={{ background: st.color }}>{st.label}</span>
                    <span className="app-email">{app.email}</span>
                    <span className="toggle-icon">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="app-detail">
                    <div className="detail-grid">
                      <DetailRow label="Application ID" value={app.id} mono />
                      <DetailRow label="Phone" value={app.phone} />
                      <DetailRow label="Date of Birth" value={app.dateOfBirth} />
                      <DetailRow label="Address" value={`${app.currentAddress}, ${app.city}, ${app.state} ${app.zip}`} />
                      <DetailRow label="Employer" value={app.employer} />
                      <DetailRow label="Position" value={app.position} />
                      <DetailRow label="Monthly Income" value={app.monthlyIncome ? `$${app.monthlyIncome}` : ''} />
                      <DetailRow label="Employment Length" value={app.employmentLength} />
                      <DetailRow label="Previous Landlord" value={`${app.previousLandlord || '—'} ${app.previousLandlordPhone || ''}`} />
                      <DetailRow label="Pets" value={app.pets} />
                      <DetailRow label="Vehicles" value={app.vehicles} />
                    </div>

                    {app.documents?.length > 0 && (
                      <div className="doc-section">
                        <h4>Uploaded Documents ({app.documents.length})</h4>
                        <ul className="doc-list">
                          {app.documents.map((d, i) => (
                            <li key={i}>
                              <a href={`http://localhost:5000${d.url}`} target="_blank" rel="noreferrer">
                                📎 {d.originalName}
                              </a>
                              <span className="doc-cat">{d.category}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="status-control">
                      <label>Update Status:</label>
                      <div className="status-buttons">
                        {Object.entries(STATUS_LABELS).map(([k, { label, color }]) => (
                          <button
                            key={k}
                            className={`status-btn ${app.status === k ? 'active' : ''}`}
                            style={app.status === k ? { background: color, color: '#fff', borderColor: color } : {}}
                            onClick={() => handleStatusChange(app.id, k)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value${mono ? ' mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}
