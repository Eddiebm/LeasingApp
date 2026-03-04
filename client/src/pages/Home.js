import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const features = [
  {
    icon: '📋',
    title: 'Rental Application',
    description:
      'Fill out our comprehensive rental application in minutes. We guide you step-by-step through personal info, employment, and rental history.',
    link: '/apply',
    cta: 'Apply Now',
  },
  {
    icon: '📤',
    title: 'Upload Documents',
    description:
      'Securely upload required documents such as government-issued ID, pay stubs, bank statements, and reference letters.',
    link: '/upload',
    cta: 'Upload Files',
  },
  {
    icon: '📄',
    title: 'Generate Documents',
    description:
      'Instantly generate ready-to-sign PDFs: rental applications, lease agreements, and move-in/move-out checklists.',
    link: '/documents',
    cta: 'Generate PDF',
  },
  {
    icon: '📊',
    title: 'Application Dashboard',
    description:
      'Track the status of all submitted applications, review uploaded documents, and manage approvals all in one place.',
    link: '/dashboard',
    cta: 'View Dashboard',
  },
];

export default function Home() {
  return (
    <div className="home">
      <section className="hero">
        <h1>Welcome to LeasingApp</h1>
        <p>Your end-to-end rental management platform. Apply for a rental, upload required documents, generate official paperwork, and track your application — all in one place.</p>
        <Link to="/apply" className="btn btn-primary hero-btn">Start Your Application</Link>
      </section>

      <section className="features">
        {features.map(({ icon, title, description, link, cta }) => (
          <div key={title} className="feature-card">
            <div className="feature-icon">{icon}</div>
            <h3>{title}</h3>
            <p>{description}</p>
            <Link to={link} className="btn btn-secondary">{cta}</Link>
          </div>
        ))}
      </section>
    </div>
  );
}
