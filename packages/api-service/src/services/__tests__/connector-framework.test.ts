import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import types directly to avoid database dependency chain
import type {
  OAuth2Credentials,
  ApiKeyCredentials,
  BasicAuthCredentials,
  BearerTokenCredentials,
  RateLimitConfig,
  RetryPolicy,
  ConnectorConfig,
  ConnectorRequest,
  ConnectionTestResult,
} from '../../types/connector.types';

// Import framework classes - this is a self-contained module
import {
  OAuth2AuthProvider,
  ApiKeyAuthProvider,
  BasicAuthProvider,
  BearerTokenProvider,
  createAuthProvider,
  RateLimiter,
  RetryHandler,
  DEFAULT_RETRY_POLICY,
  CircuitBreaker,
  CircuitBreakerOpenError,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  MonitoringManager,
  DefaultHttpClient,
  BaseConnector,
  ConnectorRegistry,
  connectorRegistry,
  HttpClientInterface,
  ConnectorServiceContext,
} from '../connector-framework';

// ============================================================================
// Mock HTTP Client
// ============================================================================

class MockHttpClient implements HttpClientInterface {
  private responses: Array<{
    status: number;
    body: string;
    headers: Record<string, string>;
  }> = [];
  private requestCount = 0;
  public requests: Array<{
    method: string;
    url: string;
    options: { headers?: Record<string, string>; body?: string; timeout?: number };
  }> = [];

  setResponse(
    status: number,
    body: string,
    headers: Record<string, string> = {}
  ): void {
    this.responses = [{ status, body, headers }];
  }

  setResponses(
    responses: Array<{ status: number; body: string; headers?: Record<string, string> }>
  ): void {
    this.responses = responses.map((r) => ({
      status: r.status,
      body: r.body,
      headers: r.headers ?? {},
    }));
  }

  async request(
    method: string,
    url: string,
    options: { headers?: Record<string, string>; body?: string; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    this.requests.push({ method, url, options });
    const response = this.responses[this.requestCount] ?? this.responses[0] ?? {
      status: 200,
      body: '{}',
      headers: {},
    };
    this.requestCount++;
    return response;
  }

  async post(
    url: string,
    options: { headers?: Record<string, string>; body?: string; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    return this.request('POST', url, options);
  }

  async get(
    url: string,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    return this.request('GET', url, options ?? {});
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  reset(): void {
    this.requestCount = 0;
    this.requests = [];
    this.responses = [];
  }
}

// ============================================================================
// Test Connector Implementation
// ============================================================================

class TestConnector extends BaseConnector {
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await this.get('/ping');
      return {
        success: response.status === 200,
        latencyMs: response.durationMs,
        message: 'Connection successful',
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Expose protected method for testing
  async makeRequest<T>(request: ConnectorRequest) {
    return this.request<T>(request);
  }
}

// ============================================================================
// Authentication Provider Tests
// ============================================================================

describe('Authentication Providers', () => {
  describe('OAuth2AuthProvider', () => {
    let mockHttpClient: MockHttpClient;

    beforeEach(() => {
      mockHttpClient = new MockHttpClient();
    });

    it('should get auth headers with access token', async () => {
      const credentials: OAuth2Credentials = {
        method: 'oauth2',
        clientId: 'client123',
        clientSecret: 'secret456',
        accessToken: 'existing-token',
        tokenType: 'Bearer',
        grantType: 'client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      };

      const provider = new OAuth2AuthProvider(credentials, mockHttpClient);
      const headers = await provider.getAuthHeaders();

      expect(headers).toEqual({
        Authorization: 'Bearer existing-token',
      });
    });

    it('should refresh token when expired', async () => {
      const credentials: OAuth2Credentials = {
        method: 'oauth2',
        clientId: 'client123',
        clientSecret: 'secret456',
        accessToken: 'old-token',
        grantType: 'client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        expiresAt: new Date(Date.now() - 1000), // Already expired
      };

      mockHttpClient.setResponse(
        200,
        JSON.stringify({
          access_token: 'new-token',
          expires_in: 3600,
          token_type: 'Bearer',
        })
      );

      const provider = new OAuth2AuthProvider(credentials, mockHttpClient);
      const headers = await provider.getAuthHeaders();

      expect(headers).toEqual({
        Authorization: 'Bearer new-token',
      });
      expect(mockHttpClient.getRequestCount()).toBe(1);
    });

    it('should report token as expired', () => {
      const credentials: OAuth2Credentials = {
        method: 'oauth2',
        clientId: 'client123',
        clientSecret: 'secret456',
        grantType: 'client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        expiresAt: new Date(Date.now() - 1000),
      };

      const provider = new OAuth2AuthProvider(credentials);
      expect(provider.isExpired()).toBe(true);
    });

    it('should report token as not expired', () => {
      const credentials: OAuth2Credentials = {
        method: 'oauth2',
        clientId: 'client123',
        clientSecret: 'secret456',
        grantType: 'client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      const provider = new OAuth2AuthProvider(credentials);
      expect(provider.isExpired()).toBe(false);
    });
  });

  describe('ApiKeyAuthProvider', () => {
    it('should get auth headers with header placement', async () => {
      const credentials: ApiKeyCredentials = {
        method: 'api_key',
        apiKey: 'my-api-key',
        headerName: 'X-Custom-Key',
        placement: 'header',
      };

      const provider = new ApiKeyAuthProvider(credentials);
      const headers = await provider.getAuthHeaders();

      expect(headers).toEqual({
        'X-Custom-Key': 'my-api-key',
      });
    });

    it('should use default header name', async () => {
      const credentials: ApiKeyCredentials = {
        method: 'api_key',
        apiKey: 'my-api-key',
      };

      const provider = new ApiKeyAuthProvider(credentials);
      const headers = await provider.getAuthHeaders();

      expect(headers).toEqual({
        'X-API-Key': 'my-api-key',
      });
    });

    it('should return empty headers for query placement', async () => {
      const credentials: ApiKeyCredentials = {
        method: 'api_key',
        apiKey: 'my-api-key',
        placement: 'query',
        queryParamName: 'key',
      };

      const provider = new ApiKeyAuthProvider(credentials);
      const headers = await provider.getAuthHeaders();

      expect(headers).toEqual({});
    });

    it('should return query params for query placement', () => {
      const credentials: ApiKeyCredentials = {
        method: 'api_key',
        apiKey: 'my-api-key',
        placement: 'query',
        queryParamName: 'apiKey',
      };

      const provider = new ApiKeyAuthProvider(credentials);
      const params = provider.getAuthQueryParams();

      expect(params).toEqual({
        apiKey: 'my-api-key',
      });
    });

    it('should never report as expired', () => {
      const credentials: ApiKeyCredentials = {
        method: 'api_key',
        apiKey: 'my-api-key',
      };

      const provider = new ApiKeyAuthProvider(credentials);
      expect(provider.isExpired()).toBe(false);
    });
  });

  describe('BasicAuthProvider', () => {
    it('should encode credentials correctly', async () => {
      const credentials: BasicAuthCredentials = {
        method: 'basic',
        username: 'user',
        password: 'pass',
      };

      const provider = new BasicAuthProvider(credentials);
      const headers = await provider.getAuthHeaders();

      const expected = Buffer.from('user:pass').toString('base64');
      expect(headers).toEqual({
        Authorization: `Basic ${expected}`,
      });
    });
  });

  describe('BearerTokenProvider', () => {
    it('should return bearer token header', async () => {
      const credentials: BearerTokenCredentials = {
        method: 'bearer',
        token: 'my-bearer-token',
      };

      const provider = new BearerTokenProvider(credentials);
      const headers = await provider.getAuthHeaders();

      expect(headers).toEqual({
        Authorization: 'Bearer my-bearer-token',
      });
    });

    it('should report expired if expiresAt is in the past', () => {
      const credentials: BearerTokenCredentials = {
        method: 'bearer',
        token: 'my-bearer-token',
        expiresAt: new Date(Date.now() - 1000),
      };

      const provider = new BearerTokenProvider(credentials);
      expect(provider.isExpired()).toBe(true);
    });
  });

  describe('createAuthProvider', () => {
    it('should create OAuth2 provider', () => {
      const credentials: OAuth2Credentials = {
        method: 'oauth2',
        clientId: 'client123',
        clientSecret: 'secret456',
        grantType: 'client_credentials',
        tokenUrl: 'https://auth.example.com/token',
      };

      const provider = createAuthProvider(credentials);
      expect(provider.method).toBe('oauth2');
    });

    it('should create API key provider', () => {
      const credentials: ApiKeyCredentials = {
        method: 'api_key',
        apiKey: 'my-api-key',
      };

      const provider = createAuthProvider(credentials);
      expect(provider.method).toBe('api_key');
    });

    it('should throw for unsupported auth method', () => {
      const credentials = {
        method: 'unknown' as any,
      };

      expect(() => createAuthProvider(credentials)).toThrow('Unsupported auth method');
    });
  });
});

// ============================================================================
// Rate Limiter Tests
// ============================================================================

describe('RateLimiter', () => {
  it('should allow requests within limit', async () => {
    const config: RateLimitConfig = {
      maxRequests: 5,
      window: 'second',
    };

    const limiter = new RateLimiter(config);

    // Should allow 5 requests
    for (let i = 0; i < 5; i++) {
      await expect(limiter.acquire()).resolves.toBeUndefined();
    }
  });

  it('should throw when limit exceeded without queuing', async () => {
    const config: RateLimitConfig = {
      maxRequests: 2,
      window: 'second',
      queueWhenLimited: false,
    };

    const limiter = new RateLimiter(config);

    await limiter.acquire();
    await limiter.acquire();
    await expect(limiter.acquire()).rejects.toThrow('Rate limit exceeded');
  });

  it('should allow burst requests', async () => {
    const config: RateLimitConfig = {
      maxRequests: 2,
      window: 'second',
      burstLimit: 2,
    };

    const limiter = new RateLimiter(config);

    // Should allow 4 requests (2 normal + 2 burst)
    for (let i = 0; i < 4; i++) {
      await expect(limiter.acquire()).resolves.toBeUndefined();
    }
  });

  it('should report correct state', async () => {
    const config: RateLimitConfig = {
      maxRequests: 5,
      window: 'minute',
    };

    const limiter = new RateLimiter(config);

    await limiter.acquire();
    await limiter.acquire();

    const state = limiter.getState();
    expect(state.requestCount).toBe(2);
    expect(state.isLimited).toBe(false);
  });

  it('should report limited state when at capacity', async () => {
    const config: RateLimitConfig = {
      maxRequests: 2,
      window: 'minute',
      queueWhenLimited: false,
    };

    const limiter = new RateLimiter(config);

    await limiter.acquire();
    await limiter.acquire();

    const state = limiter.getState();
    expect(state.requestCount).toBe(2);
    expect(state.isLimited).toBe(true);
  });
});

// ============================================================================
// Retry Handler Tests
// ============================================================================

describe('RetryHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on first successful attempt', async () => {
    const handler = new RetryHandler();
    const fn = vi.fn().mockResolvedValue('success');

    const result = await handler.execute(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const handler = new RetryHandler({ maxAttempts: 3 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce('success');

    const promise = handler.execute(fn);

    // Fast-forward through the retry delay
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max attempts', async () => {
    const handler = new RetryHandler({ maxAttempts: 3 });
    const error = new Error('ECONNRESET');
    const fn = vi.fn().mockRejectedValue(error);

    const promise = handler.execute(fn);

    // Fast-forward through all retry delays
    await vi.advanceTimersByTimeAsync(60000);

    await expect(promise).rejects.toThrow('ECONNRESET');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable errors', async () => {
    const handler = new RetryHandler({ maxAttempts: 3, retryableErrorCodes: [] });
    const error = new Error('Some error');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(handler.execute(fn)).rejects.toThrow('Some error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  describe('calculateDelay', () => {
    it('should calculate exponential backoff', () => {
      const handler = new RetryHandler({
        backoffStrategy: 'exponential',
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        jitterFactor: 0, // Disable jitter for predictable testing
        maxDelayMs: 30000,
      });

      expect(handler.calculateDelay(1)).toBe(1000);
      expect(handler.calculateDelay(2)).toBe(2000);
      expect(handler.calculateDelay(3)).toBe(4000);
      expect(handler.calculateDelay(4)).toBe(8000);
    });

    it('should calculate linear backoff', () => {
      const handler = new RetryHandler({
        backoffStrategy: 'linear',
        initialDelayMs: 1000,
        backoffMultiplier: 1,
        jitterFactor: 0,
        maxDelayMs: 30000,
      });

      expect(handler.calculateDelay(1)).toBe(1000);
      expect(handler.calculateDelay(2)).toBe(2000);
      expect(handler.calculateDelay(3)).toBe(3000);
    });

    it('should calculate constant delay', () => {
      const handler = new RetryHandler({
        backoffStrategy: 'constant',
        initialDelayMs: 1000,
        jitterFactor: 0,
        maxDelayMs: 30000,
      });

      expect(handler.calculateDelay(1)).toBe(1000);
      expect(handler.calculateDelay(5)).toBe(1000);
    });

    it('should calculate fibonacci backoff', () => {
      const handler = new RetryHandler({
        backoffStrategy: 'fibonacci',
        initialDelayMs: 1000,
        jitterFactor: 0,
        maxDelayMs: 30000,
      });

      expect(handler.calculateDelay(1)).toBe(1000); // fib(1) = 1
      expect(handler.calculateDelay(2)).toBe(1000); // fib(2) = 1
      expect(handler.calculateDelay(3)).toBe(2000); // fib(3) = 2
      expect(handler.calculateDelay(4)).toBe(3000); // fib(4) = 3
      expect(handler.calculateDelay(5)).toBe(5000); // fib(5) = 5
    });

    it('should respect max delay', () => {
      const handler = new RetryHandler({
        backoffStrategy: 'exponential',
        initialDelayMs: 10000,
        backoffMultiplier: 2,
        jitterFactor: 0,
        maxDelayMs: 15000,
      });

      expect(handler.calculateDelay(1)).toBe(10000);
      expect(handler.calculateDelay(2)).toBe(15000); // Capped at max
      expect(handler.calculateDelay(3)).toBe(15000); // Capped at max
    });
  });

  describe('shouldRetry', () => {
    it('should retry on network errors when enabled', () => {
      const handler = new RetryHandler({ retryOnNetworkError: true });
      const error = new Error('ECONNRESET');

      expect(handler.shouldRetry(error, 1)).toBe(true);
    });

    it('should retry on timeout when enabled', () => {
      const handler = new RetryHandler({ retryOnTimeout: true });
      const error = new Error('Request timeout');
      error.name = 'TimeoutError';

      expect(handler.shouldRetry(error, 1)).toBe(true);
    });

    it('should retry on retryable status codes', () => {
      const handler = new RetryHandler({ retryableStatusCodes: [500, 503] });
      const error = new Error('Server error') as Error & { statusCode: number };
      error.statusCode = 503;

      expect(handler.shouldRetry(error, 1)).toBe(true);
    });

    it('should not retry when max attempts reached', () => {
      const handler = new RetryHandler({ maxAttempts: 3 });
      const error = new Error('ECONNRESET');

      expect(handler.shouldRetry(error, 3)).toBe(false);
    });
  });
});

// ============================================================================
// Circuit Breaker Tests
// ============================================================================

describe('CircuitBreaker', () => {
  it('should start in closed state', () => {
    const breaker = new CircuitBreaker();
    expect(breaker.getState()).toBe('closed');
  });

  it('should execute function when closed', async () => {
    const breaker = new CircuitBreaker();
    const fn = vi.fn().mockResolvedValue('result');

    const result = await breaker.execute(fn);

    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should open after failure threshold', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(fn);
      } catch {}
    }

    expect(breaker.getState()).toBe('open');
  });

  it('should throw CircuitBreakerOpenError when open', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    try {
      await breaker.execute(fn);
    } catch {}

    await expect(breaker.execute(fn)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
  });

  it('should transition to half-open after reset timeout', async () => {
    vi.useFakeTimers();

    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 5000,
    });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    try {
      await breaker.execute(fn);
    } catch {}

    expect(breaker.getState()).toBe('open');

    // Advance time past reset timeout
    vi.advanceTimersByTime(6000);

    // Reset mock for successful call
    fn.mockResolvedValueOnce('success');

    // Next call should succeed and transition to half-open
    await breaker.execute(fn);

    expect(breaker.getState()).toBe('half-open');

    vi.useRealTimers();
  });

  it('should close after success threshold in half-open', async () => {
    vi.useFakeTimers();

    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      successThreshold: 2,
      resetTimeoutMs: 5000,
    });
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail'));

    try {
      await breaker.execute(fn);
    } catch {}

    vi.advanceTimersByTime(6000);

    fn.mockResolvedValue('success');

    // First success in half-open
    await breaker.execute(fn);
    expect(breaker.getState()).toBe('half-open');

    // Second success - should close
    await breaker.execute(fn);
    expect(breaker.getState()).toBe('closed');

    vi.useRealTimers();
  });

  it('should call onStateChange callback', async () => {
    const onStateChange = vi.fn();
    const breaker = new CircuitBreaker({ failureThreshold: 1 }, onStateChange);
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    try {
      await breaker.execute(fn);
    } catch {}

    expect(onStateChange).toHaveBeenCalledWith('open');
  });

  it('should allow bypassing when disabled', async () => {
    const breaker = new CircuitBreaker({ enabled: false, failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    try {
      await breaker.execute(fn);
    } catch {}

    // Should still allow execution when disabled
    fn.mockResolvedValue('success');
    const result = await breaker.execute(fn);
    expect(result).toBe('success');
  });

  it('should reset circuit breaker', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    try {
      await breaker.execute(fn);
    } catch {}

    expect(breaker.getState()).toBe('open');

    breaker.reset();

    expect(breaker.getState()).toBe('closed');
  });
});

// ============================================================================
// Monitoring Manager Tests
// ============================================================================

describe('MonitoringManager', () => {
  it('should emit events to hooks', async () => {
    const onRequestStart = vi.fn();
    const onRequestSuccess = vi.fn();

    const manager = new MonitoringManager('test-connector', 'test', {
      onRequestStart,
      onRequestSuccess,
    });

    await manager.emit('request_start', { metadata: { test: true } });
    await manager.emit('request_success', { durationMs: 100 });

    expect(onRequestStart).toHaveBeenCalledTimes(1);
    expect(onRequestStart).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'request_start',
        connectorId: 'test-connector',
        connectorType: 'test',
      })
    );

    expect(onRequestSuccess).toHaveBeenCalledTimes(1);
  });

  it('should track metrics', async () => {
    const manager = new MonitoringManager('test-connector', 'test', {});

    await manager.emit('request_start');
    await manager.emit('request_success', { durationMs: 100 });
    await manager.emit('request_start');
    await manager.emit('request_failure', { durationMs: 50 });

    const metrics = manager.getMetrics();

    expect(metrics.totalRequests).toBe(2);
    expect(metrics.successfulRequests).toBe(1);
    expect(metrics.failedRequests).toBe(1);
  });

  it('should calculate latency percentiles', async () => {
    const manager = new MonitoringManager('test-connector', 'test', {});

    // Add latency samples
    for (let i = 1; i <= 100; i++) {
      manager.recordLatency(i * 10); // 10, 20, 30, ..., 1000ms
    }

    const metrics = manager.getMetrics();

    expect(metrics.avgLatencyMs).toBeGreaterThan(0);
    expect(metrics.p95LatencyMs).toBeGreaterThanOrEqual(950);
    expect(metrics.p99LatencyMs).toBeGreaterThanOrEqual(990);
  });

  it('should update health status', async () => {
    const manager = new MonitoringManager('test-connector', 'test', {});

    expect(manager.getMetrics().health).toBe('unknown');

    manager.setHealthStatus('healthy');
    expect(manager.getMetrics().health).toBe('healthy');

    manager.setHealthStatus('degraded');
    expect(manager.getMetrics().health).toBe('degraded');
  });
});

// ============================================================================
// Base Connector Tests
// ============================================================================

describe('BaseConnector', () => {
  let mockHttpClient: MockHttpClient;
  let connector: TestConnector;

  const createConnector = (
    configOverrides: Partial<ConnectorConfig> = {}
  ): TestConnector => {
    const config: ConnectorConfig = {
      id: 'test-connector',
      name: 'Test Connector',
      type: 'test',
      baseUrl: 'https://api.example.com',
      credentials: {
        method: 'api_key',
        apiKey: 'test-key',
      },
      ...configOverrides,
    };

    return new TestConnector({}, config, mockHttpClient);
  };

  beforeEach(() => {
    mockHttpClient = new MockHttpClient();
    connector = createConnector();
  });

  it('should make authenticated requests', async () => {
    mockHttpClient.setResponse(200, JSON.stringify({ data: 'test' }));

    const response = await connector.makeRequest({
      method: 'GET',
      path: '/test',
    });

    expect(response.data).toEqual({ data: 'test' });
    expect(response.status).toBe(200);
    expect(mockHttpClient.requests[0].options.headers?.['X-API-Key']).toBe('test-key');
  });

  it('should handle query parameters', async () => {
    mockHttpClient.setResponse(200, JSON.stringify({}));

    await connector.makeRequest({
      method: 'GET',
      path: '/test',
      params: { foo: 'bar', num: 123 },
    });

    expect(mockHttpClient.requests[0].url).toContain('foo=bar');
    expect(mockHttpClient.requests[0].url).toContain('num=123');
  });

  it('should handle POST with body', async () => {
    mockHttpClient.setResponse(200, JSON.stringify({ id: 1 }));

    await connector.makeRequest({
      method: 'POST',
      path: '/items',
      body: { name: 'test item' },
    });

    expect(mockHttpClient.requests[0].method).toBe('POST');
    expect(mockHttpClient.requests[0].options.body).toBe(
      JSON.stringify({ name: 'test item' })
    );
  });

  it('should skip auth when requested', async () => {
    mockHttpClient.setResponse(200, JSON.stringify({}));

    await connector.makeRequest({
      method: 'GET',
      path: '/public',
      skipAuth: true,
    });

    expect(mockHttpClient.requests[0].options.headers?.['X-API-Key']).toBeUndefined();
  });

  it('should add idempotency key', async () => {
    mockHttpClient.setResponse(200, JSON.stringify({}));

    await connector.makeRequest({
      method: 'POST',
      path: '/items',
      idempotencyKey: 'unique-key-123',
    });

    expect(mockHttpClient.requests[0].options.headers?.['Idempotency-Key']).toBe(
      'unique-key-123'
    );
  });

  it('should throw on HTTP error', async () => {
    mockHttpClient.setResponse(404, JSON.stringify({ error: 'Not found' }));

    await expect(
      connector.makeRequest({
        method: 'GET',
        path: '/missing',
      })
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('should perform health check', async () => {
    mockHttpClient.setResponse(200, JSON.stringify({}));

    const result = await connector.healthCheck();

    expect(result.status).toBe('healthy');
    expect(result.latencyMs).toBeDefined();
  });

  it('should return unhealthy on failed health check', async () => {
    mockHttpClient.setResponse(500, JSON.stringify({ error: 'Server error' }));

    const result = await connector.healthCheck();

    expect(result.status).toBe('unhealthy');
  });

  it('should return connector state', async () => {
    mockHttpClient.setResponse(200, JSON.stringify({}));

    await connector.makeRequest({ method: 'GET', path: '/test' });

    const state = connector.getState();

    expect(state.circuitBreakerState).toBe('closed');
    expect(state.isHealthy).toBe(true);
    expect(state.lastRequestAt).toBeDefined();
  });

  it('should return metrics', async () => {
    const metrics = connector.getMetrics();

    expect(metrics).toMatchObject({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
    });
  });

  it('should return safe config without credentials', () => {
    const config = connector.getConfig();

    expect(config.id).toBe('test-connector');
    expect(config.baseUrl).toBe('https://api.example.com');
    expect((config as any).credentials).toBeUndefined();
  });

  describe('with rate limiting', () => {
    it('should respect rate limits', async () => {
      connector = createConnector({
        rateLimit: {
          maxRequests: 2,
          window: 'second',
          queueWhenLimited: false,
        },
      });
      mockHttpClient.setResponse(200, JSON.stringify({}));

      await connector.makeRequest({ method: 'GET', path: '/test' });
      await connector.makeRequest({ method: 'GET', path: '/test' });

      await expect(
        connector.makeRequest({ method: 'GET', path: '/test' })
      ).rejects.toMatchObject({
        message: expect.stringContaining('Rate limit'),
      });
    });
  });

  describe('with circuit breaker', () => {
    it('should open circuit after failures', async () => {
      connector = createConnector({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 2,
          successThreshold: 1,
          resetTimeoutMs: 5000,
          windowSize: 10,
        },
        // Disable retries to make test faster
        retryPolicy: {
          maxAttempts: 1,
          initialDelayMs: 10,
          maxDelayMs: 10,
          backoffStrategy: 'constant',
        },
      });

      mockHttpClient.setResponse(500, JSON.stringify({ error: 'Server error' }));

      // First two failures should open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await connector.makeRequest({ method: 'GET', path: '/test' });
        } catch {}
      }

      const state = connector.getState();
      expect(state.circuitBreakerState).toBe('open');

      // Next request should fail with circuit breaker error
      await expect(
        connector.makeRequest({ method: 'GET', path: '/test' })
      ).rejects.toMatchObject({
        message: expect.stringContaining('Circuit breaker'),
      });
    }, 10000); // Increase timeout to 10 seconds
  });
});

// ============================================================================
// Connector Registry Tests
// ============================================================================

describe('ConnectorRegistry', () => {
  beforeEach(() => {
    // Reset the registry for each test
    const registry = ConnectorRegistry.getInstance();
    // Note: In a real scenario, we'd have a clear method
  });

  it('should be a singleton', () => {
    const registry1 = ConnectorRegistry.getInstance();
    const registry2 = ConnectorRegistry.getInstance();

    expect(registry1).toBe(registry2);
  });

  it('should register connector types', () => {
    const registry = ConnectorRegistry.getInstance();

    registry.register({
      type: 'plaid',
      name: 'Plaid',
      description: 'Banking connector',
      category: 'banking',
      supportedAuthMethods: ['oauth2'],
      defaultConfig: {},
      requiredCredentialFields: ['clientId', 'clientSecret'],
    });

    expect(registry.has('plaid')).toBe(true);
  });

  it('should get connector type definition', () => {
    const registry = ConnectorRegistry.getInstance();

    registry.register({
      type: 'salesforce',
      name: 'Salesforce',
      description: 'CRM connector',
      category: 'crm',
      supportedAuthMethods: ['oauth2'],
      defaultConfig: {},
      requiredCredentialFields: ['clientId', 'clientSecret'],
    });

    const definition = registry.get('salesforce');

    expect(definition?.name).toBe('Salesforce');
    expect(definition?.category).toBe('crm');
  });

  it('should get connectors by category', () => {
    const registry = ConnectorRegistry.getInstance();

    registry.register({
      type: 'bank1',
      name: 'Bank 1',
      description: 'Banking connector 1',
      category: 'banking',
      supportedAuthMethods: ['oauth2'],
      defaultConfig: {},
      requiredCredentialFields: [],
    });

    registry.register({
      type: 'bank2',
      name: 'Bank 2',
      description: 'Banking connector 2',
      category: 'banking',
      supportedAuthMethods: ['api_key'],
      defaultConfig: {},
      requiredCredentialFields: [],
    });

    registry.register({
      type: 'crm1',
      name: 'CRM 1',
      description: 'CRM connector',
      category: 'crm',
      supportedAuthMethods: ['oauth2'],
      defaultConfig: {},
      requiredCredentialFields: [],
    });

    const bankingConnectors = registry.getByCategory('banking');

    expect(bankingConnectors.length).toBeGreaterThanOrEqual(2);
    expect(bankingConnectors.every((c) => c.category === 'banking')).toBe(true);
  });

  it('should return undefined for unknown type', () => {
    const registry = ConnectorRegistry.getInstance();

    expect(registry.get('unknown-type')).toBeUndefined();
    expect(registry.has('unknown-type')).toBe(false);
  });
});
