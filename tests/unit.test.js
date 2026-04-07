import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bootApp } from './helpers/appHarness.js';

describe('Utility helpers', () => {
  let app;

  beforeEach(async () => {
    app = await bootApp();
  });

  afterEach(() => {
    app.cleanup();
  });

  it('parses valid dates and rejects malformed ones', () => {
    const parsed = app.window.parseDateKeyAsLocalDate('2026-03-15');

    expect(parsed).not.toBeNull();
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(2);
    expect(parsed.getDate()).toBe(15);
    expect(app.window.parseDateKeyAsLocalDate('invalid')).toBeNull();
    expect(app.window.parseDateKeyAsLocalDate('')).toBeNull();
  });

  it('escapes HTML content before rendering it', () => {
    expect(app.window.escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(app.window.escapeHtml('a & b')).toBe('a &amp; b');
    expect(app.window.escapeHtml('plain text')).toBe('plain text');
  });

  it('sums timeSpentOnDay entries and ignores invalid values', () => {
    const cutoffDate = app.window.parseDateKeyAsLocalDate('2026-03-01');
    const endDate = app.window.parseDateKeyAsLocalDate('2026-03-31');

    const task = {
      id: 'task-1',
      timeSpentOnDay: {
        '2026-03-01': 3_600_000,
        '2026-03-02': 0,
        '2026-03-03': 'bad-value',
        'not-a-date': 3_600_000,
      },
    };

    expect(app.window.getTaskHoursInRange(task, cutoffDate, endDate)).toBe(1);
  });

  it('falls back to timeSpent for root tasks only', () => {
    const cutoffDate = app.window.parseDateKeyAsLocalDate('2026-03-01');
    const endDate = app.window.parseDateKeyAsLocalDate('2026-03-31');

    expect(
      app.window.getTaskHoursInRange(
        {
          id: 'task-root',
          parentId: null,
          timeSpent: 7_200_000,
          created: '2026-03-10T10:00:00.000Z',
        },
        cutoffDate,
        endDate,
      ),
    ).toBe(2);

    expect(
      app.window.getTaskHoursInRange(
        {
          id: 'task-child',
          parentId: 'task-root',
          timeSpent: 7_200_000,
          created: '2026-03-10T10:00:00.000Z',
        },
        cutoffDate,
        endDate,
      ),
    ).toBe(0);
  });

  it('walks parent links to the top-level task', () => {
    const allTasksById = {
      'task-1': { id: 'task-1', parentId: 'task-2' },
      'task-2': { id: 'task-2', parentId: 'task-3' },
      'task-3': { id: 'task-3', parentId: null },
    };

    const topLevelTask = app.window.getTopLevelTask('task-1', allTasksById);
    expect(topLevelTask.id).toBe('task-3');
  });
});