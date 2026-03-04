import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const { pathname } = useLocation();
  const links = [
    { to: '/', label: 'Home' },
    { to: '/apply', label: 'Apply Now' },
    { to: '/upload', label: 'Upload Documents' },
    { to: '/documents', label: 'Generate Documents' },
    { to: '/dashboard', label: 'Dashboard' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-icon">🏠</span>
        <span className="navbar-title">LeasingApp</span>
      </div>
      <ul className="navbar-links">
        {links.map(({ to, label }) => (
          <li key={to}>
            <Link to={to} className={pathname === to ? 'active' : ''}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
