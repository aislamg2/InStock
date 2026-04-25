import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensureAdminSeeded,
  login,
  createAccount,
  validateSignup,
  listOrganizations,
  findOrganizationByName,
  findUserByUsername,
  getSession,
  logout,
  listUsers,
  _resetForTests,
} from '../src/authService.js';

describe('authService', () => {
  beforeEach(() => {
    _resetForTests();
  });

  describe('organizations', () => {
    it('seeds the Notre Dame org by default', () => {
      const orgs = listOrganizations();
      expect(orgs.length).toBeGreaterThan(0);
      expect(orgs[0].name).toBe('University of Notre Dame');
    });

    it('finds Notre Dame by full name and short name (case-insensitive)', () => {
      expect(findOrganizationByName('University of Notre Dame')).not.toBeNull();
      expect(findOrganizationByName('notre dame')).not.toBeNull();
      expect(findOrganizationByName('NOTRE DAME')).not.toBeNull();
    });

    it('returns null for unknown org', () => {
      expect(findOrganizationByName('Unknown University')).toBeNull();
      expect(findOrganizationByName('')).toBeNull();
    });
  });

  describe('admin seed', () => {
    it('creates a single admin user on first call', async () => {
      await ensureAdminSeeded();
      const admin = findUserByUsername('admin');
      expect(admin).not.toBeNull();
      expect(admin.role).toBe('admin');
      expect(admin.orgId).toBe('org_nd');
    });

    it('is idempotent — does not create a second admin on subsequent calls', async () => {
      await ensureAdminSeeded();
      await ensureAdminSeeded();
      await ensureAdminSeeded();
      const admins = listUsers().filter((u) => u.role === 'admin');
      expect(admins.length).toBe(1);
    });

    it('does not store the plaintext password', async () => {
      await ensureAdminSeeded();
      // listUsers() strips secrets
      const admin = listUsers().find((u) => u.username === 'admin');
      expect(admin.passwordHash).toBeUndefined();
      expect(admin.salt).toBeUndefined();
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await ensureAdminSeeded();
    });

    it('logs in with default admin/admin123', async () => {
      const session = await login({ username: 'admin', password: 'admin123' });
      expect(session.username).toBe('admin');
      expect(session.role).toBe('admin');
      expect(session.orgId).toBe('org_nd');
    });

    it('persists session via getSession', async () => {
      await login({ username: 'admin', password: 'admin123' });
      const s = await getSession();
      expect(s).not.toBeNull();
      expect(s.username).toBe('admin');
    });

    it('rejects wrong password', async () => {
      await expect(
        login({ username: 'admin', password: 'wrong' })
      ).rejects.toThrow(/invalid/i);
    });

    it('rejects unknown username', async () => {
      await expect(
        login({ username: 'nope', password: 'admin123' })
      ).rejects.toThrow(/invalid/i);
    });

    it('rejects missing fields', async () => {
      await expect(login({ username: '', password: '' })).rejects.toThrow();
    });

    it('username match is case-insensitive', async () => {
      const session = await login({ username: 'ADMIN', password: 'admin123' });
      expect(session.username).toBe('admin');
    });

    it('logout clears the session', async () => {
      await login({ username: 'admin', password: 'admin123' });
      expect(await getSession()).not.toBeNull();
      await logout();
      expect(await getSession()).toBeNull();
    });
  });

  describe('validateSignup', () => {
    it('accepts a valid signup', () => {
      const errors = validateSignup({
        username: 'arvin',
        password: 'secret123',
        confirmPassword: 'secret123',
        orgName: 'University of Notre Dame',
      });
      expect(errors).toEqual({});
    });

    it('rejects short username', () => {
      const errors = validateSignup({
        username: 'ab',
        password: 'secret123',
        confirmPassword: 'secret123',
        orgName: 'University of Notre Dame',
      });
      expect(errors.username).toBeDefined();
    });

    it('rejects short password', () => {
      const errors = validateSignup({
        username: 'arvin',
        password: '123',
        confirmPassword: '123',
        orgName: 'University of Notre Dame',
      });
      expect(errors.password).toBeDefined();
    });

    it('rejects mismatched confirm password', () => {
      const errors = validateSignup({
        username: 'arvin',
        password: 'secret123',
        confirmPassword: 'different1',
        orgName: 'University of Notre Dame',
      });
      expect(errors.confirmPassword).toBeDefined();
    });

    it('rejects an unknown organization', () => {
      const errors = validateSignup({
        username: 'arvin',
        password: 'secret123',
        confirmPassword: 'secret123',
        orgName: 'Some Unknown School',
      });
      expect(errors.orgName).toBeDefined();
    });
  });

  describe('createAccount', () => {
    beforeEach(async () => {
      await ensureAdminSeeded();
    });

    it('creates a new member linked to Notre Dame', async () => {
      const user = await createAccount({
        username: 'arvin',
        password: 'secret123',
        orgName: 'University of Notre Dame',
      });
      expect(user.role).toBe('member');
      expect(user.orgId).toBe('org_nd');
      expect(user.username).toBe('arvin');
    });

    it('newly created user can log in', async () => {
      await createAccount({
        username: 'arvin',
        password: 'secret123',
        orgName: 'University of Notre Dame',
      });
      const session = await login({ username: 'arvin', password: 'secret123' });
      expect(session.username).toBe('arvin');
      expect(session.role).toBe('member');
      expect(session.orgId).toBe('org_nd');
    });

    it('rejects duplicate username', async () => {
      await createAccount({
        username: 'arvin',
        password: 'secret123',
        orgName: 'University of Notre Dame',
      });
      await expect(
        createAccount({
          username: 'arvin',
          password: 'another1',
          orgName: 'University of Notre Dame',
        })
      ).rejects.toThrow(/invalid/i);
    });

    it('rejects unknown org at create time', async () => {
      await expect(
        createAccount({
          username: 'arvin',
          password: 'secret123',
          orgName: 'Unknown University',
        })
      ).rejects.toThrow(/invalid/i);
    });

    it('does not return secrets in the created user object', async () => {
      const user = await createAccount({
        username: 'arvin',
        password: 'secret123',
        orgName: 'University of Notre Dame',
      });
      expect(user.passwordHash).toBeUndefined();
      expect(user.salt).toBeUndefined();
    });
  });
});
