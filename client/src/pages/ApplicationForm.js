import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { submitApplication } from '../api';
import './ApplicationForm.css';

const STEPS = ['Personal Info', 'Address', 'Employment', 'Rental History', 'References', 'Review'];

const INITIAL = {
  firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '',
  currentAddress: '', city: '', state: '', zip: '',
  employer: '', position: '', monthlyIncome: '', employmentLength: '',
  previousLandlord: '', previousLandlordPhone: '', previousAddress: '',
  reference1Name: '', reference1Phone: '',
  reference2Name: '', reference2Phone: '',
  pets: 'No', vehicles: '', additionalInfo: '',
};

function Field({ label, id, required, ...rest }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}{required && <span className="req"> *</span>}</label>
      <input id={id} {...rest} required={required} />
    </div>
  );
}

function SelectField({ label, id, options, ...rest }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} {...rest}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TextAreaField({ label, id, ...rest }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={3} {...rest} />
    </div>
  );
}

export default function ApplicationForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const next = (e) => {
    e.preventDefault();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await submitApplication(form);
      setSubmitted(data);
      toast.success('Application submitted successfully!');
    } catch {
      toast.error('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="form-success">
        <div className="success-icon">✅</div>
        <h2>Application Submitted!</h2>
        <p>Your application ID is:</p>
        <code>{submitted.id}</code>
        <p>Save this ID to track your application status on the dashboard.</p>
        <button className="btn btn-primary" onClick={() => { setSubmitted(null); setForm(INITIAL); setStep(0); }}>
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <div className="app-form-page">
      <h2>Rental Application</h2>

      {/* Stepper */}
      <div className="stepper">
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
            <span className="step-num">{i < step ? '✓' : i + 1}</span>
            <span className="step-label">{s}</span>
          </div>
        ))}
      </div>

      <form className="form-card" onSubmit={step === STEPS.length - 1 ? handleSubmit : next}>

        {step === 0 && (
          <div className="fields-grid">
            <Field label="First Name" id="firstName" name="firstName" value={form.firstName} onChange={change} required />
            <Field label="Last Name" id="lastName" name="lastName" value={form.lastName} onChange={change} required />
            <Field label="Email" id="email" name="email" type="email" value={form.email} onChange={change} required />
            <Field label="Phone" id="phone" name="phone" type="tel" value={form.phone} onChange={change} required />
            <Field label="Date of Birth" id="dateOfBirth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={change} required />
          </div>
        )}

        {step === 1 && (
          <div className="fields-grid">
            <Field label="Street Address" id="currentAddress" name="currentAddress" value={form.currentAddress} onChange={change} required className="full-width" />
            <Field label="City" id="city" name="city" value={form.city} onChange={change} required />
            <Field label="State" id="state" name="state" value={form.state} onChange={change} required />
            <Field label="ZIP Code" id="zip" name="zip" value={form.zip} onChange={change} required />
          </div>
        )}

        {step === 2 && (
          <div className="fields-grid">
            <Field label="Employer Name" id="employer" name="employer" value={form.employer} onChange={change} required />
            <Field label="Job Title / Position" id="position" name="position" value={form.position} onChange={change} required />
            <Field label="Gross Monthly Income ($)" id="monthlyIncome" name="monthlyIncome" type="number" min="0" value={form.monthlyIncome} onChange={change} required />
            <Field label="Length of Employment" id="employmentLength" name="employmentLength" placeholder="e.g. 2 years" value={form.employmentLength} onChange={change} required />
          </div>
        )}

        {step === 3 && (
          <div className="fields-grid">
            <Field label="Previous Landlord Name" id="previousLandlord" name="previousLandlord" value={form.previousLandlord} onChange={change} />
            <Field label="Previous Landlord Phone" id="previousLandlordPhone" name="previousLandlordPhone" type="tel" value={form.previousLandlordPhone} onChange={change} />
            <Field label="Previous Address" id="previousAddress" name="previousAddress" value={form.previousAddress} onChange={change} className="full-width" />
          </div>
        )}

        {step === 4 && (
          <div className="fields-grid">
            <Field label="Reference 1 — Name" id="reference1Name" name="reference1Name" value={form.reference1Name} onChange={change} />
            <Field label="Reference 1 — Phone" id="reference1Phone" name="reference1Phone" type="tel" value={form.reference1Phone} onChange={change} />
            <Field label="Reference 2 — Name" id="reference2Name" name="reference2Name" value={form.reference2Name} onChange={change} />
            <Field label="Reference 2 — Phone" id="reference2Phone" name="reference2Phone" type="tel" value={form.reference2Phone} onChange={change} />
            <SelectField label="Do you have pets?" id="pets" name="pets" options={['No', 'Yes — Cat', 'Yes — Dog', 'Yes — Other']} value={form.pets} onChange={change} />
            <Field label="Vehicle(s) (make/model/year)" id="vehicles" name="vehicles" value={form.vehicles} onChange={change} />
            <TextAreaField label="Additional Information" id="additionalInfo" name="additionalInfo" value={form.additionalInfo} onChange={change} className="full-width" />
          </div>
        )}

        {step === 5 && (
          <div className="review">
            <h3>Review Your Application</h3>
            <ReviewSection title="Personal Information" data={{
              'Name': `${form.firstName} ${form.lastName}`,
              'Email': form.email, 'Phone': form.phone, 'DOB': form.dateOfBirth,
            }} />
            <ReviewSection title="Address" data={{
              'Street': form.currentAddress,
              'City / State / ZIP': `${form.city}, ${form.state} ${form.zip}`,
            }} />
            <ReviewSection title="Employment" data={{
              'Employer': form.employer, 'Position': form.position,
              'Monthly Income': form.monthlyIncome ? `$${form.monthlyIncome}` : '',
              'Length': form.employmentLength,
            }} />
            <ReviewSection title="Rental History" data={{
              'Previous Landlord': form.previousLandlord,
              'Phone': form.previousLandlordPhone,
              'Previous Address': form.previousAddress,
            }} />
            <ReviewSection title="References & Other" data={{
              'Ref 1': `${form.reference1Name} — ${form.reference1Phone}`,
              'Ref 2': `${form.reference2Name} — ${form.reference2Phone}`,
              'Pets': form.pets, 'Vehicles': form.vehicles,
            }} />
            <p className="certification">
              By submitting, I certify that all information provided is true and accurate.
            </p>
          </div>
        )}

        <div className="form-actions">
          {step > 0 && (
            <button type="button" className="btn btn-ghost" onClick={back}>← Back</button>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {step === STEPS.length - 1 ? (submitting ? 'Submitting…' : 'Submit Application') : 'Next →'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ReviewSection({ title, data }) {
  return (
    <div className="review-section">
      <h4>{title}</h4>
      <dl>
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="review-row">
            <dt>{k}</dt>
            <dd>{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
