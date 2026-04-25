// UAT — Registering Equipment & Status Management
//
//   UAT-1:  Scan lookup finds existing equipment
//   UAT-2:  Scan lookup for new serial opens registration pre-filled
//   UAT-3:  User can set initial status when registering
//   UAT-4:  Status dropdown in inventory list updates status immediately
//   UAT-5:  Status dropdown on detail page updates status immediately
//   UAT-6:  Status changes are logged with from/to/timestamp
//   UAT-7:  Logs page shows all status changes, searchable
//   UAT-8:  Logs page rows link through to the device detail page
//   UAT-9:  Per-device status history shown on detail page
//   UAT-10: Duplicate serials are rejected
//   UAT-11: Registered equipment appears in inventory immediately
//   UAT-12: Contact person info shows on detail page
//   UAT-13: Manufacturer info shows on detail page
//   UAT-14: Saved manufacturer reusable across multiple registrations
//   UAT-15: All data (logs, contacts, manufacturers) persists via localStorage

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

// ─────────────────────────────────────────────────────────────

describe('UAT — Equipment Registration & Status Management', () => {
  beforeEach(() => {
    localStorage.clear();
    render(<InStock />);
  });

  it('UAT-1: Scan lookup finds existing equipment and shows detail', () => {
    openManualForm();
    addCategory('Printer'); addLocation('Lab A');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'HP-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'HP LaserJet' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    fireEvent.click(screen.getByText('Scan Serial'));
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'), { target: { value: 'HP-001' } });
    fireEvent.click(screen.getByText('Look Up'));
    expect(screen.getByText('HP LaserJet')).toBeInTheDocument();
    expect(screen.getByText('Equipment QR Code')).toBeInTheDocument();
  });

  it('UAT-2: Scan for unknown serial opens registration with serial pre-filled', () => {
    fireEvent.click(screen.getByText('Scan Serial'));
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'), { target: { value: 'NEW-999' } });
    fireEvent.click(screen.getByText('Look Up'));
    expect(screen.getByText('Register New Equipment')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NEW-999')).toBeInTheDocument();
  });

  it('UAT-3: User can set initial status to Needs Maintenance when registering', () => {
    openManualForm();
    addCategory('Printer'); addLocation('Lab B');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'PRN-NM-01' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Broken Printer' } });
    fireEvent.click(screen.getByText('Needs Maintenance'));
    fireEvent.click(screen.getByText('Register Equipment'));
    expect(screen.getByDisplayValue('Needs Maintenance')).toBeInTheDocument();
  });

  it('UAT-4: Status dropdown in list updates the item status immediately', () => {
    openManualForm();
    addCategory('Laptop'); addLocation('Desk 2');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'LAP-ST-01' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Status Laptop' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    fireEvent.change(screen.getByDisplayValue('Working'), { target: { value: 'Under Repair' } });
    expect(screen.getByDisplayValue('Under Repair')).toBeInTheDocument();
  });

  it('UAT-5: Status dropdown on detail page updates status', () => {
    openManualForm();
    addCategory('Monitor'); addLocation('Room 3');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'MON-ST-01' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Status Monitor' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    fireEvent.click(screen.getByText('Status Monitor'));
    fireEvent.change(screen.getByDisplayValue('Working'), { target: { value: 'Decommissioned' } });
    expect(screen.getByDisplayValue('Decommissioned')).toBeInTheDocument();
  });

  it('UAT-6: Status changes are logged with from/to values', () => {
    openManualForm();
    addCategory('Router'); addLocation('Server Room');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'RTR-LOG-01' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Log Router' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    fireEvent.change(screen.getByDisplayValue('Working'), { target: { value: 'Needs Maintenance' } });

    const logs = JSON.parse(localStorage.getItem('instock_status_logs'));
    const changeEntry = logs.find(l => l.from === 'Working' && l.to === 'Needs Maintenance');
    expect(changeEntry).toBeTruthy();
    expect(changeEntry.itemName).toBe('Log Router');
    expect(changeEntry.changedAt).toBeTruthy();
  });

  it('UAT-7: Logs page shows all changes and is searchable', () => {
    openManualForm();
    addCategory('Printer'); addLocation('Lab A');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'PRN-LOG-01' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Searchable Printer' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    fireEvent.change(screen.getByDisplayValue('Working'), { target: { value: 'Under Repair' } });

    fireEvent.click(screen.getByText('Logs'));
    expect(screen.getByText('Status Change Log')).toBeInTheDocument();
    expect(screen.getAllByText('Searchable Printer').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('Search device, status…'), { target: { value: 'Searchable' } });
    expect(screen.getAllByText('Searchable Printer').length).toBeGreaterThan(0);
  });

  it('UAT-8: Clicking a log row navigates to the device detail page', () => {
    openManualForm();
    addCategory('Laptop'); addLocation('Lab C');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'LAP-LINK-01' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Link Laptop' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    fireEvent.change(screen.getByDisplayValue('Working'), { target: { value: 'Under Repair' } });

    fireEvent.click(screen.getByText('Logs'));
    // click the device name row in logs
    fireEvent.click(screen.getAllByText('Link Laptop')[0]);
    expect(screen.getByText('Equipment QR Code')).toBeInTheDocument();
    expect(screen.getByText('← Back to Inventory')).toBeInTheDocument();
  });

  it('UAT-9: Per-device status history shown on detail page', () => {
    openManualForm();
    addCategory('Monitor'); addLocation('Room 4');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'MON-HIST-01' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'History Monitor' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    fireEvent.change(screen.getByDisplayValue('Working'), { target: { value: 'Needs Maintenance' } });

    fireEvent.click(screen.getByText('History Monitor'));
    expect(screen.getByText('Status History')).toBeInTheDocument();
    expect(screen.getAllByText('Needs Maintenance').length).toBeGreaterThan(0);
  });

  it('UAT-10: Duplicate serials are rejected with a clear error', () => {
    openManualForm();
    addCategory('Printer'); addLocation('Room 101');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'DUP-SER' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'First' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    openManualForm();
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'DUP-SER' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Second' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    expect(screen.getByText('Serial already registered')).toBeInTheDocument();
  });

  it('UAT-11: Registered equipment appears in inventory immediately', () => {
    openManualForm();
    addCategory('Monitor'); addLocation('Desk 5');
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'FIRST-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'First Device' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    const baseRows = screen.getAllByRole('row').length;

    openManualForm();
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'FRESH-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'Fresh Equipment' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    expect(screen.getAllByRole('row').length).toBe(baseRows + 1);
  });

  it('UAT-12: Contact person info shows on detail page', () => {
    openManualForm();
    addCategory('Printer'); addLocation('Lab B');
    saveContact({ name: 'Alice Lee', email: 'alice@example.com', phone: '+1 555 111 2222', slack: '@alice' });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'PRN-UAT-12' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'UAT Printer' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    fireEvent.click(screen.getByText('UAT Printer'));
    expect(screen.getByText('Contact Person')).toBeInTheDocument();
    expect(screen.getByText('Alice Lee')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('UAT-13: Manufacturer info shows on detail page', () => {
    openManualForm();
    addCategory('Router'); addLocation('Network Closet');
    saveManufacturer({ name: 'Cisco Systems', phone: '+1 800 553 6387', email: 'support@cisco.com', website: 'https://cisco.com' });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'RTR-UAT-13' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'UAT Router' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    fireEvent.click(screen.getByText('UAT Router'));
    expect(screen.getByText('Manufacturer')).toBeInTheDocument();
    expect(screen.getByText('Cisco Systems')).toBeInTheDocument();
    expect(screen.getByText('https://cisco.com')).toBeInTheDocument();
  });

  it('UAT-14: Saved manufacturer reusable when registering a second item', () => {
    openManualForm();
    addCategory('Printer'); addLocation('Room 1');
    saveManufacturer({ name: 'HP Inc' });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'HP-UAT-1' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'HP Printer 1' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    openManualForm();
    expect(screen.getAllByText('HP Inc').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'HP-UAT-2' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'HP Printer 2' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    expect(screen.getByText('HP Printer 2')).toBeInTheDocument();
  });

  it('UAT-15: Logs, contacts, and manufacturers persist to localStorage', () => {
    openManualForm();
    addCategory('Laptop'); addLocation('Lab D');
    saveContact({ name: 'Stored Person' });
    saveManufacturer({ name: 'Stored Corp' });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'LS-UAT-15' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'LS Device' } });
    fireEvent.click(screen.getByText('Register Equipment'));
    fireEvent.change(screen.getByDisplayValue('Working'), { target: { value: 'Under Repair' } });

    expect(JSON.parse(localStorage.getItem('instock_contacts')).some(c=>c.name==='Stored Person')).toBe(true);
    expect(JSON.parse(localStorage.getItem('instock_manufacturers')).some(m=>m.name==='Stored Corp')).toBe(true);
    expect(JSON.parse(localStorage.getItem('instock_status_logs')).some(l=>l.to==='Under Repair')).toBe(true);
  });
});
