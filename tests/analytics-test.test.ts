import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAnalyticsTest } from '../src/lib/analytics-test';

afterEach(() => vi.unstubAllGlobals());
describe('shared test traffic classification', () => {
  it.each([
    ['true', '', true],
    [null, 'wenbu_analytics_test=1', true],
    [null, 'other=1; wenbu_analytics_test=1; another=0', true],
    [null, 'other_wenbu_analytics_test=1', false],
    ['false', 'wenbu_analytics_test=10', false],
    [null, '', false],
  ])('classifies session %s and cookie %s', (session, cookie, expected) => {
    vi.stubGlobal('sessionStorage', { getItem: () => session });
    vi.stubGlobal('document', { cookie });
    expect(isAnalyticsTest()).toBe(expected);
  });
  it('keeps cookie-only QA excluded when session storage is blocked', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw Error('blocked');
      },
    });
    vi.stubGlobal('document', { cookie: 'wenbu_analytics_test=1' });
    expect(isAnalyticsTest()).toBe(true);
  });
  it('keeps session QA excluded when cookie access is blocked', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'true' });
    vi.stubGlobal('document', {
      get cookie() {
        throw Error('blocked');
      },
    });
    expect(isAnalyticsTest()).toBe(true);
  });
});
