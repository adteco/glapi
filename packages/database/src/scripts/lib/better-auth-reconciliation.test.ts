import { describe, expect, it } from 'vitest';
import {
  buildBetterAuthMemberId,
  buildBetterAuthOrganizationId,
  buildBetterAuthUserId,
  normalizeBetterAuthMemberRole,
  normalizeEmail,
} from './better-auth-reconciliation';

describe('better auth reconciliation helpers', () => {
  it('builds deterministic Better Auth identifiers', () => {
    expect(
      buildBetterAuthOrganizationId('11111111-1111-1111-1111-111111111111')
    ).toBe('ba_org_11111111-1111-1111-1111-111111111111');
    expect(
      buildBetterAuthUserId('22222222-2222-2222-2222-222222222222')
    ).toBe('ba_usr_22222222-2222-2222-2222-222222222222');
    expect(
      buildBetterAuthMemberId(
        'ba_org_11111111-1111-1111-1111-111111111111',
        'ba_usr_22222222-2222-2222-2222-222222222222'
      )
    ).toBe(
      'ba_mem_ba_org_11111111-1111-1111-1111-111111111111_ba_usr_22222222-2222-2222-2222-222222222222'
    );
  });

  it('normalizes Better Auth member roles to supported values', () => {
    expect(normalizeBetterAuthMemberRole('owner')).toBe('owner');
    expect(normalizeBetterAuthMemberRole('OWNER')).toBe('owner');
    expect(normalizeBetterAuthMemberRole('admin')).toBe('admin');
    expect(normalizeBetterAuthMemberRole('manager')).toBe('member');
    expect(normalizeBetterAuthMemberRole(undefined)).toBe('member');
  });

  it('normalizes emails for conflict detection', () => {
    expect(normalizeEmail(' Test@Example.com ')).toBe('test@example.com');
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});
