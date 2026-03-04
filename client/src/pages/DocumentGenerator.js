import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { generateDocument } from '../api';
import './DocumentGenerator.css';

const DOC_TYPES = [
  {
    type: 'application',
    label: 'Rental Application PDF',
    icon: '📋',
    description: 'Generate a signed rental application form with all applicant details.',
    fields: ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth',
      'currentAddress', 'city', 'state', 'zip',
      'employer', 'position', 'monthlyIncome', 'employmentLength',
      'previousLandlord', 'previousLandlordPhone',
      'reference1Name', 'reference1Phone', 'reference2Name', 'reference2Phone',
      'pets', 'vehicles', 'additionalInfo'],
  },
  {
    type: 'lease',
    label: 'Lease Agreement',
    icon: '📝',
    description: 'Generate a residential lease agreement between landlord and tenant.',
    fields: ['firstName', 'lastName', 'propertyAddress', 'rentAmount',
      'leaseStartDate', 'leaseEndDate', 'securityDeposit', 'landlordName'],
  },
  {
    type: 'checklist',
    label: 'Move-In / Move-Out Checklist',
    icon: '✅',
    description: 'Generate a property condition checklist for move-in and move-out inspections.',
    fields: ['firstName', 'lastName', 'propertyAddress'],
  },
];

const FIELD_META = {
  firstName: { label: 'First Name', type: 'text' },
  lastName: { label: 'Last Name', type: 'text' },
  email: { label: 'Email', type: 'email' },
  phone: { label: 'Phone', type: 'tel' },
  dateOfBirth: { label: 'Date of Birth', type: 'date' },
  currentAddress: { label: 'Street Address', type: 'text' },
  city: { label: 'City', type: 'text' },
  state: { label: 'State', type: 'text' },
  zip: { label: 'ZIP Code', type: 'text' },
  employer: { label: 'Employer', type: 'text' },
  position: { label: 'Position / Title', type: 'text' },
  monthlyIncome: { label: 'Monthly Income ($)', type: 'number' },
  employmentLength: { label: 'Employment Length', type: 'text' },
  previousLandlord: { label: 'Previous Landlord', type: 'text' },
  previousLandlordPhone: { label: 'Previous Landlord Phone', type: 'tel' },
  reference1Name: { label: 'Reference 1 Name', type: 'text' },
  reference1Phone: { label: 'Reference 1 Phone', type: 'tel' },
  reference2Name: { label: 'Reference 2 Name', type: 'text' },
  reference2Phone: { label: 'Reference 2 Phone', type: 'tel' },
  pets: { label: 'Pets', type: 'text' },
  vehicles: { label: 'Vehicles', type: 'text' },
  additionalInfo: { label: 'Additional Info', type: 'textarea' },
  propertyAddress: { label: 'Property Address', type: 'text' },
  rentAmount: { label: 'Monthly Rent ($)', type: 'number' },
  leaseStartDate: { label: 'Lease Start Date', type: 'date' },
  leaseEndDate: { label: 'Lease End Date', type: 'date' },
  securityDeposit: { label: 'Security Deposit ($)', type: 'number' },
  landlordName: { label: 'Landlord / Agency Name', type: 'text' },
};

export default function DocumentGenerator() {
  const [selected, setSelected] = useState(null);
  const [formData, setFormData] = useState({});
  const [generating, setGenerating] = useState(false);

  const handleSelect = (docType) => {
    setSelected(docType);
    setFormData({});
  };

  const change = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const { data } = await generateDocument(selected.type, formData);
      const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selected.type}-${Date.now()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF generated and downloaded!');
    } catch {
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="docgen-page">
      <h2>Generate Documents</h2>
      <p className="subtitle">Select a document type to generate a ready-to-sign PDF.</p>

      <div className="doc-types">
        {DOC_TYPES.map((dt) => (
          <button
            key={dt.type}
            className={`doc-type-card ${selected?.type === dt.type ? 'selected' : ''}`}
            onClick={() => handleSelect(dt)}
          >
            <span className="dt-icon">{dt.icon}</span>
            <span className="dt-label">{dt.label}</span>
            <span className="dt-desc">{dt.description}</span>
          </button>
        ))}
      </div>

      {selected && (
        <form className="gen-form" onSubmit={handleGenerate}>
          <h3>Fill in details for: {selected.label}</h3>
          <div className="fields-grid">
            {selected.fields.map((fieldKey) => {
              const meta = FIELD_META[fieldKey] || { label: fieldKey, type: 'text' };
              return (
                <div key={fieldKey} className={`field ${meta.type === 'textarea' ? 'full-width' : ''}`}>
                  <label htmlFor={fieldKey}>{meta.label}</label>
                  {meta.type === 'textarea' ? (
                    <textarea
                      id={fieldKey}
                      name={fieldKey}
                      rows={3}
                      value={formData[fieldKey] || ''}
                      onChange={change}
                    />
                  ) : (
                    <input
                      id={fieldKey}
                      name={fieldKey}
                      type={meta.type}
                      value={formData[fieldKey] || ''}
                      onChange={change}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="gen-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>← Back</button>
            <button type="submit" className="btn btn-primary" disabled={generating}>
              {generating ? 'Generating…' : `📥 Generate ${selected.label}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
