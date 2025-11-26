import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetTracker, getRequestCount, updateFromHeader } from '../rateLimit';

// Mock the cache module
vi.mock('../cache/index.js', () => ({
  readGlobalCache: vi.fn(() => null),
  writeGlobalCache: vi.fn(),
}));

// We need to test the middleware logic directly since the actual API wrapper
// requires a real YNAB API instance. Extract and test the core logic.

describe('apiWrapper middleware logic', () => {
  beforeEach(() => {
    resetTracker();
  });

  describe('X-Rate-Limit header handling', () => {
    it('should update count from X-Rate-Limit header on success', () => {
      // Simulate what the middleware does when header is present
      const headerValue = '42';
      const count = parseInt(headerValue, 10);
      if (!isNaN(count)) {
        updateFromHeader(count);
      }

      expect(getRequestCount()).toBe(42);
    });

    it('should handle X-Rate-Limit header with various values', () => {
      updateFromHeader(0);
      expect(getRequestCount()).toBe(0);

      updateFromHeader(100);
      expect(getRequestCount()).toBe(100);

      updateFromHeader(200);
      expect(getRequestCount()).toBe(200);

      // Over limit
      updateFromHeader(250);
      expect(getRequestCount()).toBe(250);
    });
  });

  describe('error response handling', () => {
    it('should NOT increment on 429 error response', () => {
      // Simulate middleware behavior: no header, response.ok = false (429)
      const response = { ok: false, status: 429 };
      const rateLimitHeader = null;

      // This is the logic from apiWrapper.ts
      if (rateLimitHeader) {
        const count = parseInt(rateLimitHeader, 10);
        if (!isNaN(count)) {
          updateFromHeader(count);
        }
      } else if (response.ok) {
        // Would increment here, but response.ok is false
      }

      expect(getRequestCount()).toBe(0);
    });

    it('should NOT increment on 500 error response', () => {
      const response = { ok: false, status: 500 };
      const rateLimitHeader = null;

      if (rateLimitHeader) {
        updateFromHeader(parseInt(rateLimitHeader, 10));
      } else if (response.ok) {
        // Would increment here, but response.ok is false
      }

      expect(getRequestCount()).toBe(0);
    });

    it('should NOT increment on 401 error response', () => {
      const response = { ok: false, status: 401 };
      const rateLimitHeader = null;

      if (rateLimitHeader) {
        updateFromHeader(parseInt(rateLimitHeader, 10));
      } else if (response.ok) {
        // Would increment here, but response.ok is false
      }

      expect(getRequestCount()).toBe(0);
    });

    it('should NOT increment on 404 error response', () => {
      const response = { ok: false, status: 404 };
      const rateLimitHeader = null;

      if (rateLimitHeader) {
        updateFromHeader(parseInt(rateLimitHeader, 10));
      } else if (response.ok) {
        // Would increment here, but response.ok is false
      }

      expect(getRequestCount()).toBe(0);
    });
  });

  describe('successful response without header', () => {
    it('should increment on successful response without X-Rate-Limit header', async () => {
      // Import the actual increment function
      const { incrementRequestCount } = await import('../rateLimit');

      const response = { ok: true, status: 200 };
      const rateLimitHeader = null;

      // Simulate middleware logic
      if (rateLimitHeader) {
        updateFromHeader(parseInt(rateLimitHeader, 10));
      } else if (response.ok) {
        incrementRequestCount();
      }

      expect(getRequestCount()).toBe(1);
    });
  });

  describe('header takes precedence', () => {
    it('should use header value even on error if header is present', () => {
      // If YNAB returns X-Rate-Limit even on error, use it
      const response = { ok: false, status: 429 };
      const rateLimitHeader = '200';

      if (rateLimitHeader) {
        const count = parseInt(rateLimitHeader, 10);
        if (!isNaN(count)) {
          updateFromHeader(count);
        }
      } else if (response.ok) {
        // Would increment here
      }

      expect(getRequestCount()).toBe(200);
    });

    it('should prefer header over increment on success', () => {
      const response = { ok: true, status: 200 };
      const rateLimitHeader = '75';

      if (rateLimitHeader) {
        const count = parseInt(rateLimitHeader, 10);
        if (!isNaN(count)) {
          updateFromHeader(count);
        }
      } else if (response.ok) {
        // Would increment here, but header was present
      }

      expect(getRequestCount()).toBe(75);
    });
  });

  describe('invalid header values', () => {
    it('should ignore non-numeric header values', async () => {
      const { incrementRequestCount } = await import('../rateLimit');

      const response = { ok: true, status: 200 };
      const rateLimitHeader = 'invalid';

      if (rateLimitHeader) {
        const count = parseInt(rateLimitHeader, 10);
        if (!isNaN(count)) {
          updateFromHeader(count);
        }
        // Note: if header is present but invalid, we don't increment either
        // This matches the current behavior in apiWrapper.ts
      } else if (response.ok) {
        incrementRequestCount();
      }

      // Header was present but invalid - current behavior doesn't increment
      expect(getRequestCount()).toBe(0);
    });

    it('should ignore empty header values', async () => {
      const { incrementRequestCount } = await import('../rateLimit');

      const response = { ok: true, status: 200 };
      const rateLimitHeader = '';

      // Empty string is falsy, so it goes to the else branch
      if (rateLimitHeader) {
        const count = parseInt(rateLimitHeader, 10);
        if (!isNaN(count)) {
          updateFromHeader(count);
        }
      } else if (response.ok) {
        incrementRequestCount();
      }

      expect(getRequestCount()).toBe(1);
    });
  });
});
