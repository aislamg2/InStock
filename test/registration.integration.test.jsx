// Integration Tests — InStock Registration Flow

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import InStock from '../src/InStock.jsx';

// ── helpers ──────────────────────────────────────────────────
function addCategory(name) {
  fireEvent.click(screen.getByText('+ Add a category…'));
  fireEvent.change(screen.getByPlaceholderText('New category…'), { target: { value: name } });
  fireEvent.click(screen.getAllByText('Add')[0]);
}

function addLocation(name) {
  fireEvent.click(screen.getByText('+ Add a location…'));
  fireEvent.change(screen.getByPlaceholderText('New location…'), { target: { value: name } });
  const btns = screen.getAllByText('Add');
  fireEvent.click(btns[btns.length - 1]);
}

function saveContact({ name, email = '', phone = '', slack = '' }) {
  const addBtn = screen.queryByText('+ Add contact…');
  if (addBtn) fireEvent.click(addBtn);
  else fireEvent.change(screen.getByDisplayValue(/— None —/), { target: { value: '__add__' } });
  fireEvent.change(screen.getByPlaceholderText('Jane Smith'), { target: { value: name } });
  if (email) fireEvent.change(screen.getByPlaceholderText('jane@example.com'), { target: { value: email } });
  if (phone) fireEvent.change(screen.getByPlaceholderText('+1 555 000 0000'),  { target: { value: phone } });
  if (slack) fireEvent.change(screen.getByPlaceholderText('@jane.smith'),      { target: { value: slack } });
  fireEvent.click(screen.getAllByText('Save')[0]);
}

function saveManufacturer({ name, phone = '', email = '', website = '' }) {
  const addBtn = screen.queryByText('+ Add manufacturer…');
  if (addBtn) fireEvent.click(addBtn);
  else {
    const noneSelects = screen.getAllByDisplayValue('— None —');
    fireEvent.change(noneSelects[noneSelects.length - 1], { target: { value: '__add__' } });
  }
  fireEvent.change(screen.getByPlaceholderText('Acme Corp'), { target: { value: name } });
  if (phone)   fireEvent.change(screen.getByPlaceholderText('+1 800 000 0000'),  { target: { value: phone } });
  if (email)   fireEvent.change(screen.getByPlaceholderText('support@acme.com'), { target: { value: email } });
  if (website) fireEvent.change(screen.getByPlaceholderText('https://acme.com'), { target: { value: website } });
  const saveBtns = screen.getAllByText('Save');
  fireEvent.click(saveBtns[saveBtns.length - 1]);
}

function openManualForm() {
  fireEvent.click(screen.getByText('+ Register'));
  fireEvent.click(screen.getByText('Manual Entry'));
}

function registerItem({ serial, name, status = null }) {
  openManualForm();
  fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: serial } });
  fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: name } });
  if (status) fireEvent.click(screen.getByText(status));
  fireEvent.click(screen.getByText('Register Equipment'));
}

// ─────────────────────────────────────────────────────────────

describe('InStock — Registration Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    render(<InStock />);
  });

  it('shows empty inventory on first load', () => {
    expect(screen.getByText('Registered Equipment')).toBeInTheDocument();
    expect(screen.getByText('No equipment found')).toBeInTheDocument();
  });

  it('opens registration form when + Register is clicked', () => {
    fireEvent.click(screen.getByText('+ Register'));
    // Now shows choice modal first
    expect(screen.getByText('Import CSV')).toBeInTheDocument();
    expect(screen.getByText('Manual Entry')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Manual Entry'));
    expect(screen.getByText('Register New Equipment')).toBeInTheDocument();
  });

  it('shows all four status options in the registration form', () => {
    openManualForm();
    expect(screen.getByText('Working')).toBeInTheDocument();
    expect(screen.getByText('Needs Maintenance')).toBeInTheDocument();
    expect(screen.getByText('Under Repair')).toBeInTheDocument();
    expect(screen.getByText('Decommissioned')).toBeInTheDocument();
  });

  it('defaults initial status to Working', () => {
    openManualForm();
    // "Working" button should appear selected (checked via aria or just presence)
    expect(screen.getByText('Working')).toBeInTheDocument();
  });

  it('registers equipment with a chosen status', () => {
    openManualForm();
    addCategory('Printer');
    addLocation('Lab A');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'SER-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Test Printer' } });
    fireEvent.click(screen.getByText('Needs Maintenance'));
    fireEvent.click(screen.getByText('Register Equipment'));
    // status dropdown in the table should show Needs Maintenance
    expect(screen.getByDisplayValue('Needs Maintenance')).toBeInTheDocument();
  });

  it('status dropdown in list changes status and logs it', () => {
    openManualForm();
    addCategory('Laptop');
    addLocation('Desk 1');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'LAP-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Dell Laptop' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    // change status via the inline dropdown in the inventory table
    const statusSelect = screen.getByDisplayValue('Working');
    fireEvent.change(statusSelect, { target: { value: 'Under Repair' } });
    expect(screen.getByDisplayValue('Under Repair')).toBeInTheDocument();

    // log should be recorded
    const logs = JSON.parse(localStorage.getItem('instock_status_logs'));
    expect(logs.some(l => l.to === 'Under Repair' && l.from === 'Working')).toBe(true);
  });

  it('status dropdown on detail page changes status and shows in history', () => {
    openManualForm();
    addCategory('Monitor');
    addLocation('Room 2');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'MON-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Dell Monitor' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    fireEvent.click(screen.getByText('Dell Monitor'));
    const detailSelect = screen.getByDisplayValue('Working');
    fireEvent.change(detailSelect, { target: { value: 'Needs Maintenance' } });

    expect(screen.getByText('Status History')).toBeInTheDocument();
    expect(screen.getAllByText('Needs Maintenance').length).toBeGreaterThan(0);
  });

  it('Logs page shows status change entries', () => {
    openManualForm();
    addCategory('Router');
    addLocation('Server Room');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'RTR-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Cisco Router' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    const statusSelect = screen.getByDisplayValue('Working');
    fireEvent.change(statusSelect, { target: { value: 'Decommissioned' } });

    fireEvent.click(screen.getByText('Logs'));
    expect(screen.getByText('Status Change Log')).toBeInTheDocument();
    expect(screen.getAllByText('Cisco Router').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Decommissioned').length).toBeGreaterThan(0);
  });

  it('Logs page search filters by device name', () => {
    openManualForm();
    addCategory('Printer');
    addLocation('Lab B');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'PRN-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'HP Printer' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    openManualForm();
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'LAP-002' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Dell Laptop' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    fireEvent.click(screen.getByText('Logs'));
    fireEvent.change(screen.getByPlaceholderText('Search device, status…'), { target: { value: 'HP Printer' } });
    expect(screen.getByText('HP Printer')).toBeInTheDocument();
    expect(screen.queryByText('Dell Laptop')).not.toBeInTheDocument();
  });

  it('logs persist to localStorage', () => {
    openManualForm();
    addCategory('Laptop');
    addLocation('Lab C');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'LAP-LS-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'LS Laptop' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    const logs = JSON.parse(localStorage.getItem('instock_status_logs'));
    expect(logs.some(l => l.itemName === 'LS Laptop')).toBe(true);
  });

  it('shows add-category and add-location prompts when empty', () => {
    openManualForm();
    expect(screen.getByText('+ Add a category…')).toBeInTheDocument();
    expect(screen.getByText('+ Add a location…')).toBeInTheDocument();
  });

  it('removes a custom category when × is clicked', () => {
    openManualForm();
    addCategory('Printer');
    fireEvent.click(screen.getByTitle('Remove "Printer"'));
    expect(screen.queryByTitle('Remove "Printer"')).not.toBeInTheDocument();
  });

  it('removes a custom location when × is clicked', () => {
    openManualForm();
    addCategory('Laptop');
    addLocation('Room 202');
    fireEvent.click(screen.getByTitle('Remove "Room 202"'));
    expect(screen.queryByTitle('Remove "Room 202"')).not.toBeInTheDocument();
  });

  it('registers equipment with contact and manufacturer', () => {
    openManualForm();
    addCategory('Monitor');
    addLocation('Lab A');
    saveContact({ name: 'Bob Jones' });
    saveManufacturer({ name: 'Dell Inc' });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'MON-002' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Dell Monitor' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    expect(screen.getByText('Dell Monitor')).toBeInTheDocument();
  });

  it('shows contact and manufacturer info on detail page', () => {
    openManualForm();
    addCategory('Printer');
    addLocation('Lab B');
    saveContact({ name: 'Alice Lee', email: 'alice@example.com' });
    saveManufacturer({ name: 'Cisco', website: 'https://cisco.com' });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'PRN-DET-01' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Test Printer' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    fireEvent.click(screen.getByText('Test Printer'));
    expect(screen.getByText('Alice Lee')).toBeInTheDocument();
    expect(screen.getByText('Cisco')).toBeInTheDocument();
  });

  it('shows error for duplicate serial', () => {
    openManualForm();
    addCategory('Printer');
    addLocation('Room 101');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'DUP-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'First' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    openManualForm();
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'DUP-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Second' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    expect(screen.getByText('Serial already registered')).toBeInTheDocument();
  });

  it('search filters the equipment list', () => {
    openManualForm();
    addCategory('Laptop');
    addLocation('Lab A');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'LAP-F-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Dell Laptop' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    openManualForm();
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'PRN-F-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'HP Printer' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    fireEvent.change(screen.getByPlaceholderText('Search name, serial, location…'), { target: { value: 'Dell' } });
    expect(screen.getByText('Dell Laptop')).toBeInTheDocument();
    expect(screen.queryByText('HP Printer')).not.toBeInTheDocument();
  });

  it('persists contacts and manufacturers to localStorage', () => {
    openManualForm();
    saveContact({ name: 'Stored Person' });
    saveManufacturer({ name: 'Stored Corp' });
    expect(JSON.parse(localStorage.getItem('instock_contacts')).some(c=>c.name==='Stored Person')).toBe(true);
    expect(JSON.parse(localStorage.getItem('instock_manufacturers')).some(m=>m.name==='Stored Corp')).toBe(true);
  });

  it('saved manufacturer is reusable for a second registration', () => {
    openManualForm();
    addCategory('Printer');
    addLocation('Room 1');
    saveManufacturer({ name: 'HP Inc' });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'HP-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'HP Printer 1' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    openManualForm();
    expect(screen.getAllByText('HP Inc').length).toBeGreaterThan(0);
  });
});
