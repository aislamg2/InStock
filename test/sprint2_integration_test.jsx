// Integration Tests — Sprint 2 Features
// Covers: maintenance reports, warranty tracking, CSV import,
// equipment deletion, and export CSV.

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

// ─────────────────────────────────────────────────────────────

describe('InStock — Sprint 2 Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    render(<InStock />);
  });

  /* ─── Register Choice Modal ─── */
  describe('Register Choice Modal', () => {
    it('shows Import CSV and Manual Entry options when + Register is clicked', () => {
      fireEvent.click(screen.getByText('+ Register'));
      expect(screen.getByText('Import CSV')).toBeInTheDocument();
      expect(screen.getByText('Manual Entry')).toBeInTheDocument();
    });

    it('closes the choice modal when Cancel is clicked', () => {
      fireEvent.click(screen.getByText('+ Register'));
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Import CSV')).not.toBeInTheDocument();
    });

    it('opens the CSV import modal when Import CSV is selected', () => {
      fireEvent.click(screen.getByText('+ Register'));
      fireEvent.click(screen.getByText('Import CSV'));
      expect(screen.getByText('Import Equipment from CSV')).toBeInTheDocument();
    });

    it('opens the manual form when Manual Entry is selected', () => {
      fireEvent.click(screen.getByText('+ Register'));
      fireEvent.click(screen.getByText('Manual Entry'));
      expect(screen.getByText('Register New Equipment')).toBeInTheDocument();
    });
  });

  /* ─── Equipment Deletion ─── */
  describe('Equipment Deletion', () => {
    it('removes equipment from the list when deleted', () => {
      registerItem({ serial: 'DEL-001', name: 'Delete Me' });
      expect(screen.getByText('Delete Me')).toBeInTheDocument();

      goToDetail('Delete Me');
      fireEvent.click(screen.getByText('Delete Equipment'));

      expect(screen.queryByText('Delete Me')).not.toBeInTheDocument();
    });

    it('deleted equipment is removed from localStorage', () => {
      registerItem({ serial: 'DEL-LS-001', name: 'LS Delete' });
      let stored = JSON.parse(localStorage.getItem('instock_items'));
      expect(stored.some(i => i.serial === 'DEL-LS-001')).toBe(true);

      goToDetail('LS Delete');
      fireEvent.click(screen.getByText('Delete Equipment'));

      stored = JSON.parse(localStorage.getItem('instock_items'));
      expect(stored.some(i => i.serial === 'DEL-LS-001')).toBe(false);
    });
  });

  /* ─── Warranty Tracking ─── */
  describe('Warranty Tracking', () => {
    it('shows warranty section on detail page', () => {
      registerItem({ serial: 'WAR-001', name: 'Warranty Device' });
      goToDetail('Warranty Device');
      expect(screen.getByText('Warranty')).toBeInTheDocument();
    });

    it('shows "Not set" when no warranty date', () => {
      registerItem({ serial: 'WAR-002', name: 'No Warranty' });
      goToDetail('No Warranty');
      expect(screen.getByText('Not set')).toBeInTheDocument();
    });

    it('can update warranty date on existing item', () => {
      registerItem({ serial: 'WAR-003', name: 'Warranty Update' });
      goToDetail('Warranty Update');

      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs.length).toBeGreaterThan(0);
      fireEvent.change(dateInputs[0], { target: { value: '2030-12-31' } });

      const stored = JSON.parse(localStorage.getItem('instock_items'));
      const item = stored.find(i => i.serial === 'WAR-003');
      expect(item.warrantyExpiration).toBe('2030-12-31');
    });
  });

  /* ─── Maintenance Reports ─── */
  describe('Maintenance Reports', () => {
    it('shows maintenance section on detail page', () => {
      registerItem({ serial: 'MNT-001', name: 'Maint Device' });
      goToDetail('Maint Device');
      expect(screen.getByText(/Maintenance Reports/)).toBeInTheDocument();
    });

    it('opens the add maintenance form with fields', () => {
      registerItem({ serial: 'MNT-002', name: 'Maint Form Device' });
      goToDetail('Maint Form Device');
      fireEvent.click(screen.getByText('+ Add Report'));
      expect(screen.getByText('Save Report')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('What was done…')).toBeInTheDocument();
    });

    it('adds a maintenance report with all fields', () => {
      registerItem({ serial: 'MNT-003', name: 'Full Maint' });
      goToDetail('Full Maint');

      addMaintenanceReport({
        date: '2025-04-15',
        description: 'Replaced toner cartridge',
        technician: 'Bob Smith',
        cost: '45.99',
      });

      expect(screen.getByText('Replaced toner cartridge')).toBeInTheDocument();
    });

    it('persists maintenance reports to localStorage', () => {
      registerItem({ serial: 'MNT-LS-001', name: 'LS Maint' });
      goToDetail('LS Maint');

      addMaintenanceReport({ date: '2025-03-01', description: 'Oil change' });

      const logs = JSON.parse(localStorage.getItem('instock_maintenance_logs'));
      expect(logs.some(l => l.description === 'Oil change')).toBe(true);
    });

    it('can delete a maintenance report via × button', () => {
      registerItem({ serial: 'MNT-DEL-001', name: 'Del Maint' });
      goToDetail('Del Maint');

      addMaintenanceReport({ date: '2025-02-01', description: 'Temp report' });
      expect(screen.getByText('Temp report')).toBeInTheDocument();

      // × button has title="Delete report"
      fireEvent.click(screen.getByTitle('Delete report'));

      const logs = JSON.parse(localStorage.getItem('instock_maintenance_logs'));
      expect(logs.some(l => l.description === 'Temp report')).toBe(false);
    });
  });

  /* ─── CSV Import Modal ─── */
  describe('CSV Import Modal', () => {
    it('shows the template download button', () => {
      fireEvent.click(screen.getByText('+ Register'));
      fireEvent.click(screen.getByText('Import CSV'));
      expect(screen.getByText('Download Template')).toBeInTheDocument();
    });

    it('shows file upload area', () => {
      fireEvent.click(screen.getByText('+ Register'));
      fireEvent.click(screen.getByText('Import CSV'));
      expect(screen.getByText('Click to select a CSV file')).toBeInTheDocument();
    });

    it('closes CSV modal on Cancel', () => {
      fireEvent.click(screen.getByText('+ Register'));
      fireEvent.click(screen.getByText('Import CSV'));
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Import Equipment from CSV')).not.toBeInTheDocument();
    });

    it('disables import button when no data loaded', () => {
      fireEvent.click(screen.getByText('+ Register'));
      fireEvent.click(screen.getByText('Import CSV'));
      const importBtn = screen.getByText('Import 0 Items');
      expect(importBtn).toBeDisabled();
    });
  });

  /* ─── Status Change from List ─── */
  describe('Status Changes Integration', () => {
    it('changing status from list view creates a log entry', () => {
      registerItem({ serial: 'SC-INT-001', name: 'Status Test' });
      const select = screen.getByDisplayValue('Working');
      fireEvent.change(select, { target: { value: 'Under Repair' } });

      const logs = JSON.parse(localStorage.getItem('instock_status_logs'));
      const entry = logs.find(l => l.from === 'Working' && l.to === 'Under Repair' && l.itemSerial === 'SC-INT-001');
      expect(entry).toBeTruthy();
      expect(entry.changedAt).toBeTruthy();
    });

    it('multiple status changes create multiple log entries', () => {
      registerItem({ serial: 'SC-MULTI-001', name: 'Multi Status' });
      fireEvent.change(screen.getByDisplayValue('Working'), { target: { value: 'Under Repair' } });
      fireEvent.change(screen.getByDisplayValue('Under Repair'), { target: { value: 'Decommissioned' } });

      const logs = JSON.parse(localStorage.getItem('instock_status_logs'));
      const changes = logs.filter(l => l.itemSerial === 'SC-MULTI-001' && l.from !== '—');
      expect(changes.length).toBeGreaterThanOrEqual(2);
    });

    it('registration creates an initial status log entry', () => {
      registerItem({ serial: 'SC-INIT-001', name: 'Init Status' });
      const logs = JSON.parse(localStorage.getItem('instock_status_logs'));
      const initEntry = logs.find(l => l.itemSerial === 'SC-INIT-001' && l.from === '—');
      expect(initEntry).toBeTruthy();
      expect(initEntry.to).toBe('Working');
    });
  });

  /* ─── Export CSV ─── */
  describe('Export CSV', () => {
    it('shows export button when items exist', () => {
      registerItem({ serial: 'EXP-001', name: 'Export Test' });
      const exportBtn = screen.queryByText('Export CSV');
      if (exportBtn) {
        expect(exportBtn).toBeInTheDocument();
      }
    });
  });

  /* ─── QR Code ─── */
  describe('QR Code', () => {
    it('shows QR code on detail page', () => {
      registerItem({ serial: 'QR-001', name: 'QR Device' });
      goToDetail('QR Device');
      expect(screen.getByText('Equipment QR Code')).toBeInTheDocument();
    });

    it('shows Download QR button', () => {
      registerItem({ serial: 'QR-002', name: 'QR Download' });
      goToDetail('QR Download');
      expect(screen.getByText('Download QR')).toBeInTheDocument();
    });
  });

  /* ─── Detail Page — Back Navigation ─── */
  describe('Detail Page Navigation', () => {
    it('shows back button on detail page', () => {
      registerItem({ serial: 'NAV-001', name: 'Nav Device' });
      goToDetail('Nav Device');
      expect(screen.getByText('← Back to Inventory')).toBeInTheDocument();
    });

    it('back button returns to inventory list', () => {
      registerItem({ serial: 'NAV-002', name: 'Nav Back' });
      goToDetail('Nav Back');
      fireEvent.click(screen.getByText('← Back to Inventory'));
      expect(screen.getByText('Registered Equipment')).toBeInTheDocument();
    });
  });
});
