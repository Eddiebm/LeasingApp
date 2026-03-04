import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the LeasingApp navbar brand', () => {
  render(<App />);
  const brands = screen.getAllByText(/LeasingApp/i);
  expect(brands.length).toBeGreaterThan(0);
});

test('renders navigation links in the navbar', () => {
  render(<App />);
  // Use the nav element to scope the query
  const nav = document.querySelector('nav.navbar');
  expect(nav).not.toBeNull();
  expect(nav.textContent).toMatch(/Apply Now/i);
  expect(nav.textContent).toMatch(/Upload Documents/i);
  expect(nav.textContent).toMatch(/Generate Documents/i);
  expect(nav.textContent).toMatch(/Dashboard/i);
});
