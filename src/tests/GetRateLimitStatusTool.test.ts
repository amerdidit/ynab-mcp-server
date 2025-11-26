import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as GetRateLimitStatusTool from '../tools/GetRateLimitStatusTool';
import { updateFromHeader, resetTracker } from '../rateLimit';

// Mock the cache module
vi.mock('../cache/index.js', () => ({
  readGlobalCache: vi.fn(() => null),
  writeGlobalCache: vi.fn(),
}));

describe('GetRateLimitStatusTool', () => {
  beforeEach(() => {
    resetTracker();
  });

  describe('tool configuration', () => {
    it('should have correct name and description', () => {
      expect(GetRateLimitStatusTool.name).toBe('get_rate_limit_status');
      expect(GetRateLimitStatusTool.description).toContain('rate limit');
      expect(GetRateLimitStatusTool.description).toContain('200 requests');
    });

    it('should have empty input schema', () => {
      expect(GetRateLimitStatusTool.inputSchema).toEqual({});
    });
  });

  describe('execute', () => {
    it('should return status with no requests', async () => {
      const result = await GetRateLimitStatusTool.execute({});

      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.requestsUsed).toBe(0);
      expect(parsed.requestsRemaining).toBe(200);
      expect(parsed.limit).toBe(200);
      expect(parsed.percentUsed).toBe(0);
      expect(parsed.warningLevel).toBe('ok');
    });

    it('should return correct status after header update', async () => {
      updateFromHeader(50);

      const result = await GetRateLimitStatusTool.execute({});

      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.requestsUsed).toBe(50);
      expect(parsed.requestsRemaining).toBe(150);
      expect(parsed.percentUsed).toBe(25);
      expect(parsed.warningLevel).toBe('ok');
    });

    it('should show warning level when appropriate', async () => {
      updateFromHeader(160);

      const result = await GetRateLimitStatusTool.execute({});

      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.warningLevel).toBe('warning');
    });

    it('should show critical level when appropriate', async () => {
      updateFromHeader(185);

      const result = await GetRateLimitStatusTool.execute({});

      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.warningLevel).toBe('critical');
    });

    it('should show exceeded level when over limit', async () => {
      updateFromHeader(200);

      const result = await GetRateLimitStatusTool.execute({});

      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.warningLevel).toBe('exceeded');
    });

    it('should include human-readable message', async () => {
      updateFromHeader(50);

      const result = await GetRateLimitStatusTool.execute({});

      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.message).toContain('50/200');
      expect(parsed.message).toContain('150 requests');
    });
  });
});
