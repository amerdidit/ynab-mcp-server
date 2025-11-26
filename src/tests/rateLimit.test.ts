import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  updateFromHeader,
  incrementRequestCount,
  getRateLimitStatus,
  getRateLimitWarningLevel,
  formatRateLimitStatus,
  resetTracker,
  getRequestCount,
} from '../rateLimit';

// Mock the cache module
vi.mock('../cache/index.js', () => ({
  readGlobalCache: vi.fn(() => null),
  writeGlobalCache: vi.fn(),
}));

describe('rateLimit', () => {
  beforeEach(() => {
    resetTracker();
  });

  describe('updateFromHeader', () => {
    it('should update request count from header value', () => {
      updateFromHeader(50);

      expect(getRequestCount()).toBe(50);
    });

    it('should overwrite previous value with new header value', () => {
      updateFromHeader(50);
      updateFromHeader(75);

      expect(getRequestCount()).toBe(75);
    });
  });

  describe('incrementRequestCount', () => {
    it('should increment the request count', () => {
      incrementRequestCount();
      incrementRequestCount();
      incrementRequestCount();

      expect(getRequestCount()).toBe(3);
    });

    it('should work alongside updateFromHeader', () => {
      updateFromHeader(50);
      incrementRequestCount();

      expect(getRequestCount()).toBe(51);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return correct status with no requests', () => {
      const status = getRateLimitStatus();

      expect(status.requestsUsed).toBe(0);
      expect(status.requestsRemaining).toBe(200);
      expect(status.limit).toBe(200);
      expect(status.percentUsed).toBe(0);
    });

    it('should return correct status after header update', () => {
      updateFromHeader(50);

      const status = getRateLimitStatus();

      expect(status.requestsUsed).toBe(50);
      expect(status.requestsRemaining).toBe(150);
      expect(status.percentUsed).toBe(25);
    });

    it('should return 0 remaining when at limit', () => {
      updateFromHeader(200);

      const status = getRateLimitStatus();

      expect(status.requestsUsed).toBe(200);
      expect(status.requestsRemaining).toBe(0);
      expect(status.percentUsed).toBe(100);
    });

    it('should handle exceeding limit', () => {
      updateFromHeader(250);

      const status = getRateLimitStatus();

      expect(status.requestsUsed).toBe(250);
      expect(status.requestsRemaining).toBe(0);
      expect(status.percentUsed).toBe(125);
    });

    it('should include lastUpdatedAgo when available', () => {
      updateFromHeader(50);

      const status = getRateLimitStatus();

      expect(status.lastUpdated).not.toBeNull();
      expect(status.lastUpdatedAgo).toBe('just now');
    });
  });

  describe('getRateLimitWarningLevel', () => {
    it('should return "ok" when under 75%', () => {
      updateFromHeader(100);

      expect(getRateLimitWarningLevel()).toBe('ok');
    });

    it('should return "warning" at 75-89%', () => {
      updateFromHeader(150);

      expect(getRateLimitWarningLevel()).toBe('warning');
    });

    it('should return "critical" at 90-99%', () => {
      updateFromHeader(180);

      expect(getRateLimitWarningLevel()).toBe('critical');
    });

    it('should return "exceeded" at 100%+', () => {
      updateFromHeader(200);

      expect(getRateLimitWarningLevel()).toBe('exceeded');
    });
  });

  describe('formatRateLimitStatus', () => {
    it('should format status message correctly', () => {
      updateFromHeader(50);

      const message = formatRateLimitStatus();

      expect(message).toContain('50/200');
      expect(message).toContain('25%');
      expect(message).toContain('150 requests');
    });

    it('should include warning for warning level', () => {
      updateFromHeader(160);

      const message = formatRateLimitStatus();

      expect(message).toContain('Warning');
    });

    it('should include critical message for critical level', () => {
      updateFromHeader(185);

      const message = formatRateLimitStatus();

      expect(message).toContain('Critical');
    });

    it('should include exceeded message when over limit', () => {
      updateFromHeader(205);

      const message = formatRateLimitStatus();

      expect(message).toContain('exceeded');
    });

    it('should include last updated time', () => {
      updateFromHeader(50);

      const message = formatRateLimitStatus();

      expect(message).toContain('Last updated');
    });
  });

  describe('resetTracker', () => {
    it('should reset request count to 0', () => {
      updateFromHeader(150);

      expect(getRequestCount()).toBe(150);

      resetTracker();

      expect(getRequestCount()).toBe(0);
    });
  });
});
