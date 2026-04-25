// UAT — Sprint 2 Features
//
//   UAT-16:  User can add a maintenance report on a device's detail page
//   UAT-17:  Maintenance report shows cost, technician, type, and description
//   UAT-18:  User can delete a maintenance report
//   UAT-19:  Warranty badge shows Active for future dates
//   UAT-20:  Warranty badge shows Expired for past dates
//   UAT-21:  Warranty badge shows Not set when no date entered
//   UAT-22:  User can update warranty date from detail page
//   UAT-23:  CSV import modal accessible from Register button
//   UAT-24:  CSV import button is disabled with no data loaded
//   UAT-25:  User can delete equipment from detail page
//   UAT-26:  Full workflow — register, change status, add maintenance, verify logs
//   UAT-27:  Contact person info is editable on detail page
//   UAT-28:  Manufacturer info is editable on detail page
//   UAT-29:  Multiple status changes appear in per-device history on detail page
//   UAT-30:  Maintenance total cost displays on detail page

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

function openManualForm() {
  fireEvent.click(screen.getByText('+ Register'));
  fireEvent.click(screen.getByText('Manual Entry'));
}

function registerItem({ serial, name, status = null }) {
  openManualForm();
  addCategory('TestCat');
  addLocation('TestLoc');
  fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: serial } });
  fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: name } });
  if (status) fireEvent.click(screen.getByText(status));
  fireEvent.click(screen.getByText('Register Equipment'));
}

function goToDetail(itemName) {
  fireEvent.click(screen.getByText(itemName));
}

function addMaintenanceReport({ date, description, technician = '', cost = '' }) {
  fireEvent.click(screen.getByText('+ Add Report'));
  const dateInputs = document.querySelectorAll('input[type="date"]');
  fireEvent.change(dateInputs[dateInputs.length - 1], { target: { value: date } });
  fireEvent.change(screen.getByPlaceholderText('What was done…'), { target: { value: description } });
  if (technician) {
    const nameInputs = screen.getAllByPlaceholderText('Name');
    fireEvent.change(nameInputs[nameInputs.length - 1], { target: { value: technician } });
  }
  if (cost) fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: cost } });
  fireEvent.click(screen.getByText('Save Report'));
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

// ─────────────────────────────────────────────────────────────

describe('UAT — Sprint 2 Features', () => {
  beforeEach(() => {
    localStorage.clear();
    render(<InStock />);
  });

  it('UAT-16: User can add a maintenance report on detail page', () => {
    registerItem({ serial: 'UAT16-001', name: 'UAT16 Device' });
    goToDetail('UAT16 Device');
    expect(screen.getByText(/Maintenance Reports/)).toBeInTheDocument();

    addMaintenanceReport({
      date: '2025-04-10',
      description: 'Replaced screen',
      technician: 'Tech Joe',
      cost: '120.00',
    });

    expect(screen.getByText('Replaced screen')).toBeInTheDocument();
  });

  it('UAT-17: Maintenance report shows cost, technician, type, and description', () => {
    registerItem({ serial: 'UAT17-001', name: 'UAT17 Device' });
    goToDetail('UAT17 Device');
    addMaintenanceReport({
      date: '2025-03-20',
      description: 'Fan motor replaced',
      technician: 'Alice',
      cost: '85.50',
    });

    expect(screen.getByText('Fan motor replaced')).toBeInTheDocument();
    // technician shown as "Technician: Alice"
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    // cost shown as "$85.50"
    expect(screen.getAllByText(/85\.50/).length).toBeGreaterThan(0);
    // type badge shown (default "Repair")
    expect(screen.getByText('Repair')).toBeInTheDocument();
  });

  it('UAT-18: User can delete a maintenance report', () => {
    registerItem({ serial: 'UAT18-001', name: 'UAT18 Device' });
    goToDetail('UAT18 Device');
    addMaintenanceReport({ date: '2025-01-15', description: 'Oiled hinges' });

    expect(screen.getByText('Oiled hinges')).toBeInTheDocument();

    // × button has title="Delete report"
    fireEvent.click(screen.getByTitle('Delete report'));

    const logs = JSON.parse(localStorage.getItem('instock_maintenance_logs'));
    expect(logs.some(l => l.description === 'Oiled hinges')).toBe(false);
  });

  it('UAT-19: Warranty badge shows Active for future date', () => {
    registerItem({ serial: 'UAT19-001', name: 'UAT19 Device' });
    goToDetail('UAT19 Device');

    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThan(0);
    fireEvent.change(dateInputs[0], { target: { value: '2030-12-31' } });
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('UAT-20: Warranty badge shows Expired for past date', () => {
    registerItem({ serial: 'UAT20-001', name: 'UAT20 Device' });
    goToDetail('UAT20 Device');

    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThan(0);
    fireEvent.change(dateInputs[0], { target: { value: '2020-01-01' } });
    expect(screen.getAllByText(/Expired/).length).toBeGreaterThan(0);
  });

  it('UAT-21: Warranty badge shows Not set when no date entered', () => {
    registerItem({ serial: 'UAT21-001', name: 'UAT21 Device' });
    goToDetail('UAT21 Device');
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('UAT-22: User can update warranty date from detail page', () => {
    registerItem({ serial: 'UAT22-001', name: 'UAT22 Device' });
    goToDetail('UAT22 Device');

    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThan(0);
    fireEvent.change(dateInputs[0], { target: { value: '2028-06-15' } });
    const stored = JSON.parse(localStorage.getItem('instock_items'));
    const item = stored.find(i => i.serial === 'UAT22-001');
    expect(item.warrantyExpiration).toBe('2028-06-15');
  });

  it('UAT-23: CSV import modal accessible from Register button', () => {
    fireEvent.click(screen.getByText('+ Register'));
    expect(screen.getByText('Import CSV')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Import CSV'));
    expect(screen.getByText('Import Equipment from CSV')).toBeInTheDocument();
    expect(screen.getByText('Need a template?')).toBeInTheDocument();
  });

  it('UAT-24: CSV import button is disabled with no data loaded', () => {
    fireEvent.click(screen.getByText('+ Register'));
    fireEvent.click(screen.getByText('Import CSV'));
    const importBtn = screen.getByText('Import 0 Items');
    expect(importBtn).toBeDisabled();
  });

  it('UAT-25: User can delete equipment from detail page', () => {
    registerItem({ serial: 'UAT25-001', name: 'UAT25 Delete' });
    expect(screen.getByText('UAT25 Delete')).toBeInTheDocument();

    goToDetail('UAT25 Delete');
    fireEvent.click(screen.getByText('Delete Equipment'));

    expect(screen.queryByText('UAT25 Delete')).not.toBeInTheDocument();
  });

  it('UAT-26: Full workflow — register, change status, add maintenance, verify logs', () => {
    // 1. register
    registerItem({ serial: 'FLOW-001', name: 'Flow Device' });
    expect(screen.getByText('Flow Device')).toBeInTheDocument();

    // 2. change status
    fireEvent.change(screen.getByDisplayValue('Working'), { target: { value: 'Needs Maintenance' } });

    // 3. go to detail and add maintenance
    goToDetail('Flow Device');
    expect(screen.getByText('Status History')).toBeInTheDocument();
    addMaintenanceReport({ date: '2025-04-18', description: 'Full inspection', technician: 'Tech Team', cost: '200' });
    expect(screen.getByText('Full inspection')).toBeInTheDocument();

    // 4. go to logs page and verify
    fireEvent.click(screen.getByText('← Back to Inventory'));
    fireEvent.click(screen.getByText('Logs'));
    expect(screen.getAllByText('Flow Device').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Needs Maintenance').length).toBeGreaterThan(0);
  });

  it('UAT-27: Contact person info is editable on detail page', () => {
    openManualForm();
    addCategory('Printer');
    addLocation('Lab');
    saveContact({ name: 'Original Contact', email: 'orig@example.com' });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'UAT27-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'UAT27 Device' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    goToDetail('UAT27 Device');
    expect(screen.getByText('Contact Person')).toBeInTheDocument();
    expect(screen.getByText('Original Contact')).toBeInTheDocument();

    // click Edit on the contact card
    const editBtns = screen.getAllByText('Edit');
    fireEvent.click(editBtns[0]);
    // should now show Save/Cancel buttons in edit mode
    expect(screen.getAllByText('Save').length).toBeGreaterThan(0);
  });

  it('UAT-28: Manufacturer info is editable on detail page', () => {
    openManualForm();
    addCategory('Router');
    addLocation('Closet');
    saveManufacturer({ name: 'Cisco', website: 'https://cisco.com' });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP-LJ-90214'),    { target: { value: 'UAT28-001' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. HP LaserJet Pro'), { target: { value: 'UAT28 Device' } });
    fireEvent.click(screen.getByText('Register Equipment'));

    goToDetail('UAT28 Device');
    expect(screen.getByText('Manufacturer')).toBeInTheDocument();
    expect(screen.getByText('Cisco')).toBeInTheDocument();

    // click Edit on the manufacturer card (second Edit button)
    const editBtns = screen.getAllByText('Edit');
    fireEvent.click(editBtns[editBtns.length - 1]);
    expect(screen.getAllByText('Save').length).toBeGreaterThan(0);
  });

  it('UAT-29: Multiple status changes appear in per-device history', () => {
    registerItem({ serial: 'UAT29-001', name: 'UAT29 History' });

    fireEvent.change(screen.getByDisplayValue('Working'), { target: { value: 'Under Repair' } });
    fireEvent.change(screen.getByDisplayValue('Under Repair'), { target: { value: 'Needs Maintenance' } });

    goToDetail('UAT29 History');
    expect(screen.getByText('Status History')).toBeInTheDocument();

    // at least 3 log entries: initial + 2 changes
    const logs = JSON.parse(localStorage.getItem('instock_status_logs'));
    const deviceLogs = logs.filter(l => l.itemSerial === 'UAT29-001');
    expect(deviceLogs.length).toBeGreaterThanOrEqual(3);
  });

  it('UAT-30: Maintenance total cost displays on detail page', () => {
    registerItem({ serial: 'UAT30-001', name: 'UAT30 Cost' });
    goToDetail('UAT30 Cost');

    addMaintenanceReport({ date: '2025-01-01', description: 'Fix A', cost: '50' });
    addMaintenanceReport({ date: '2025-02-01', description: 'Fix B', cost: '75.50' });

    // total cost $125.50 should appear somewhere
    expect(screen.getByText(/125\.50/)).toBeInTheDocument();
  });
});
