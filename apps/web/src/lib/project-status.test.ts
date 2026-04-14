import { describe, expect, it } from 'vitest';
import {
  getProjectStatusBadgeVariant,
  getProjectStatusLabel,
  normalizeProjectStatus,
} from './project-status';

describe('project status helpers', () => {
  it('normalizes legacy lowercase statuses to canonical uppercase values', () => {
    expect(normalizeProjectStatus('active')).toBe('ACTIVE');
    expect(normalizeProjectStatus('planning')).toBe('DRAFT');
    expect(normalizeProjectStatus('on_hold')).toBe('ON_HOLD');
  });

  it('preserves canonical uppercase statuses', () => {
    expect(normalizeProjectStatus('ACTIVE')).toBe('ACTIVE');
    expect(normalizeProjectStatus('DRAFT')).toBe('DRAFT');
  });

  it('returns the canonical label and badge variant', () => {
    expect(getProjectStatusLabel('planning')).toBe('Draft');
    expect(getProjectStatusLabel('ACTIVE')).toBe('Active');
    expect(getProjectStatusBadgeVariant('archived')).toBe('destructive');
  });
});
