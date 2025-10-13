import { http, HttpResponse } from 'msw'

export const handlers = [
  // Mock authentication endpoints
  http.post('/api/auth/verify', () => {
    return HttpResponse.json({
      user: {
        id: 'test-user-123',
        organizationId: 'test-org-123',
      },
    })
  }),

  // Mock tRPC endpoints
  http.get('/api/trpc/*', () => {
    return HttpResponse.json({
      result: {
        data: {
          success: true,
        },
      },
    })
  }),

  http.post('/api/trpc/*', () => {
    return HttpResponse.json({
      result: {
        data: {
          success: true,
        },
      },
    })
  }),
]