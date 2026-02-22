/**
 * Memory Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MemoryService,
  getMemoryService,
  resetMemoryService,
  formatMemoryContext,
  formatConversation,
  formatExchange,
} from '../memory-service';
import type { MemoryContext } from '../magneteco-client';

// Mock environment variables
vi.stubEnv('MAGNETECO_URL', '');
vi.stubEnv('MAGNETECO_API_KEY', '');

describe('MemoryService', () => {
  beforeEach(() => {
    resetMemoryService();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('initialization', () => {
    it('should return unavailable when not configured', () => {
      const service = new MemoryService();
      expect(service.isAvailable()).toBe(false);
    });

    it('should handle retrieve when unavailable', async () => {
      const service = new MemoryService();
      const result = await service.retrieve('user-123', 'test query');
      expect(result).toBeNull();
    });

    it('should handle memorize when unavailable', async () => {
      const service = new MemoryService();
      const result = await service.memorize('user-123', 'test content');
      expect(result).toBeNull();
    });
  });

  describe('getMemoryService singleton', () => {
    it('should return the same instance', () => {
      const service1 = getMemoryService();
      const service2 = getMemoryService();
      expect(service1).toBe(service2);
    });

    it('should return new instance after reset', () => {
      const service1 = getMemoryService();
      resetMemoryService();
      const service2 = getMemoryService();
      expect(service1).not.toBe(service2);
    });
  });
});

describe('formatMemoryContext', () => {
  it('should format empty context', () => {
    const context: MemoryContext = {
      summaries: {},
      relevantItems: [],
      tokenCount: 0,
      query: 'test',
    };
    const result = formatMemoryContext(context);
    expect(result).toBe('');
  });

  it('should format category summaries', () => {
    const context: MemoryContext = {
      summaries: {
        preferences: 'User prefers dark mode',
        business_context: 'Works in construction',
      },
      relevantItems: [],
      tokenCount: 100,
      query: 'test',
    };
    const result = formatMemoryContext(context);
    expect(result).toContain('## Memory Context');
    expect(result).toContain('### Preferences');
    expect(result).toContain('User prefers dark mode');
    expect(result).toContain('### Business Context');
    expect(result).toContain('Works in construction');
  });

  it('should format relevant items', () => {
    const context: MemoryContext = {
      summaries: {},
      relevantItems: [
        {
          id: '1',
          appId: 'app',
          userId: 'user',
          resourceId: 'res',
          category: 'preferences',
          content: 'User likes coffee',
          confidence: 0.9,
          importance: 'medium',
          createdAt: new Date('2024-01-15'),
          accessCount: 5,
          archived: false,
        },
        {
          id: '2',
          appId: 'app',
          userId: 'user',
          resourceId: 'res',
          category: 'preferences',
          content: 'Critical: User is VIP',
          confidence: 1.0,
          importance: 'critical',
          createdAt: new Date('2024-01-16'),
          accessCount: 10,
          archived: false,
        },
      ],
      tokenCount: 50,
      query: 'test',
    };
    const result = formatMemoryContext(context);
    expect(result).toContain('## Recent Relevant Memories');
    expect(result).toContain('User likes coffee');
    expect(result).toContain('[CRITICAL]');
    expect(result).toContain('Critical: User is VIP');
  });

  it('should format entities with relationships', () => {
    const context: MemoryContext = {
      summaries: {},
      relevantItems: [],
      entities: [
        {
          name: 'Acme Corp',
          type: 'Customer',
          properties: {},
          relationships: [
            { predicate: 'has_project', target: 'Building A', targetType: 'Project' },
          ],
        },
      ],
      tokenCount: 30,
      query: 'test',
    };
    const result = formatMemoryContext(context);
    expect(result).toContain('## Related Entities');
    expect(result).toContain('**Acme Corp** (Customer)');
    expect(result).toContain('has_project Building A');
  });
});

describe('formatConversation', () => {
  it('should format messages correctly', () => {
    const messages = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there!' },
      { role: 'user' as const, content: 'How are you?' },
    ];
    const result = formatConversation(messages);
    expect(result).toBe('User: Hello\n\nAssistant: Hi there!\n\nUser: How are you?');
  });

  it('should filter out system messages', () => {
    const messages = [
      { role: 'system' as const, content: 'You are an assistant' },
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi!' },
    ];
    const result = formatConversation(messages);
    expect(result).not.toContain('You are an assistant');
    expect(result).toBe('User: Hello\n\nAssistant: Hi!');
  });
});

describe('formatExchange', () => {
  it('should format a single exchange', () => {
    const result = formatExchange('What is 2+2?', 'The answer is 4.');
    expect(result).toBe('User: What is 2+2?\n\nAssistant: The answer is 4.');
  });
});
