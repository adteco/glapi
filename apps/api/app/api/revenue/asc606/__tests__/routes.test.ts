import { NextRequest } from 'next/server';
import { POST as createSalesOrderPlan } from '../sales-orders/route';
import { POST as generateSalesOrderPlan } from '../sales-orders/[salesOrderId]/plan/route';
import { GET as getSubscriptionPlan } from '../subscriptions/[subscriptionId]/plan/route';
import { POST as previewLicenseChange } from '../subscriptions/[subscriptionId]/license-changes/preview/route';
import { POST as applyLicenseChange } from '../subscriptions/[subscriptionId]/license-changes/apply/route';
import * as asc606Api from '../_lib';

jest.mock('../_lib', () => ({
  getAsc606Caller: jest.fn(),
  handleAsc606ApiError: jest.fn(),
}));

type MockAsc606Caller = {
  salesOrders: {
    createWithRevenuePlan: jest.Mock;
    generateRevenuePlan: jest.Mock;
  };
  revenue: {
    subscriptionPlan: jest.Mock;
  };
  subscriptions: {
    previewLicenseChange: jest.Mock;
    applyLicenseChange: jest.Mock;
  };
};

describe('ASC606 Revenue API Routes', () => {
  let mockCaller: MockAsc606Caller;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCaller = {
      salesOrders: {
        createWithRevenuePlan: jest.fn(),
        generateRevenuePlan: jest.fn(),
      },
      revenue: {
        subscriptionPlan: jest.fn(),
      },
      subscriptions: {
        previewLicenseChange: jest.fn(),
        applyLicenseChange: jest.fn(),
      },
    };

    (asc606Api.getAsc606Caller as jest.Mock).mockResolvedValue(mockCaller);
  });

  it('POST /api/revenue/asc606/sales-orders creates order and returns plan', async () => {
    const mockResponse = {
      order: { id: 'so-1' },
      subscription: { id: 'sub-1' },
      plan: { waterfall: [] },
    };
    mockCaller.salesOrders.createWithRevenuePlan.mockResolvedValue(mockResponse);

    const request = new NextRequest('http://localhost/api/revenue/asc606/sales-orders', {
      method: 'POST',
      body: JSON.stringify({
        order: { entityId: 'ent-1', lines: [{ itemId: 'item-1', quantity: 10 }] },
        revenuePlan: { billingFrequency: 'monthly', termMonths: 12 },
      }),
    });

    const response = await createSalesOrderPlan(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockCaller.salesOrders.createWithRevenuePlan).toHaveBeenCalledWith({
      order: { entityId: 'ent-1', lines: [{ itemId: 'item-1', quantity: 10 }] },
      revenuePlan: { billingFrequency: 'monthly', termMonths: 12 },
    });
    expect(data).toEqual(mockResponse);
  });

  it('POST /api/revenue/asc606/sales-orders/:salesOrderId/plan generates plan for existing order', async () => {
    const mockResponse = { order: { id: 'so-1' }, plan: { waterfall: [] } };
    mockCaller.salesOrders.generateRevenuePlan.mockResolvedValue(mockResponse);

    const request = new NextRequest('http://localhost/api/revenue/asc606/sales-orders/so-1/plan', {
      method: 'POST',
      body: JSON.stringify({
        revenuePlan: { termMonths: 24, billingFrequency: 'annual' },
      }),
    });

    const response = await generateSalesOrderPlan(request, {
      params: { salesOrderId: 'so-1' },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockCaller.salesOrders.generateRevenuePlan).toHaveBeenCalledWith({
      salesOrderId: 'so-1',
      revenuePlan: { termMonths: 24, billingFrequency: 'annual' },
    });
    expect(data).toEqual(mockResponse);
  });

  it('GET /api/revenue/asc606/subscriptions/:subscriptionId/plan returns waterfall and schedules', async () => {
    const mockResponse = {
      summary: { totalScheduled: 1000, totalRecognized: 250, totalDeferred: 750 },
      waterfall: [{ period: '2025-01', scheduled: 100, recognized: 50, deferredBalance: 50 }],
      schedules: [{ id: 'sch-1' }],
    };
    mockCaller.revenue.subscriptionPlan.mockResolvedValue(mockResponse);

    const request = new NextRequest(
      'http://localhost/api/revenue/asc606/subscriptions/sub-1/plan?startDate=2025-01-01&endDate=2025-12-31'
    );

    const response = await getSubscriptionPlan(request, {
      params: { subscriptionId: 'sub-1' },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockCaller.revenue.subscriptionPlan).toHaveBeenCalledWith({
      subscriptionId: 'sub-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    });
    expect(data).toEqual(mockResponse);
  });

  it('POST /api/revenue/asc606/subscriptions/:subscriptionId/license-changes/preview returns what-if delta', async () => {
    const mockResponse = {
      baseline: { transactionPrice: 10000 },
      scenario: { transactionPrice: 12000 },
      delta: { transactionPrice: 2000 },
    };
    mockCaller.subscriptions.previewLicenseChange.mockResolvedValue(mockResponse);

    const request = new NextRequest(
      'http://localhost/api/revenue/asc606/subscriptions/sub-1/license-changes/preview',
      {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'item-1',
          action: 'add',
          quantity: 5,
          unitPrice: 120,
          effectiveDate: '2025-04-01',
        }),
      }
    );

    const response = await previewLicenseChange(request, {
      params: { subscriptionId: 'sub-1' },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockCaller.subscriptions.previewLicenseChange).toHaveBeenCalledWith({
      subscriptionId: 'sub-1',
      itemId: 'item-1',
      action: 'add',
      quantity: 5,
      unitPrice: 120,
      effectiveDate: new Date('2025-04-01'),
      endDate: undefined,
      reason: undefined,
    });
    expect(data).toEqual(mockResponse);
  });

  it('POST /api/revenue/asc606/subscriptions/:subscriptionId/license-changes/apply applies and recalculates', async () => {
    const mockResponse = {
      subscription: { id: 'sub-1', version: 2 },
      calculation: { subscriptionId: 'sub-1' },
      plan: { waterfall: [] },
    };
    mockCaller.subscriptions.applyLicenseChange.mockResolvedValue(mockResponse);

    const request = new NextRequest(
      'http://localhost/api/revenue/asc606/subscriptions/sub-1/license-changes/apply',
      {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'item-1',
          action: 'remove',
          quantity: 3,
          effectiveDate: '2025-05-01',
          reason: 'Customer downsized seats',
        }),
      }
    );

    const response = await applyLicenseChange(request, {
      params: { subscriptionId: 'sub-1' },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockCaller.subscriptions.applyLicenseChange).toHaveBeenCalledWith({
      subscriptionId: 'sub-1',
      itemId: 'item-1',
      action: 'remove',
      quantity: 3,
      unitPrice: undefined,
      effectiveDate: new Date('2025-05-01'),
      endDate: undefined,
      reason: 'Customer downsized seats',
    });
    expect(data).toEqual(mockResponse);
  });

  it('delegates failures to shared API error handler', async () => {
    const handlerResponse = new Response(JSON.stringify({ message: 'handled' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });

    mockCaller.subscriptions.applyLicenseChange.mockRejectedValue(new Error('boom'));
    (asc606Api.handleAsc606ApiError as jest.Mock).mockReturnValue(handlerResponse);

    const request = new NextRequest(
      'http://localhost/api/revenue/asc606/subscriptions/sub-1/license-changes/apply',
      {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'item-1',
          action: 'remove',
          quantity: 1,
          effectiveDate: '2025-05-01',
        }),
      }
    );

    const response = await applyLicenseChange(request, {
      params: { subscriptionId: 'sub-1' },
    });

    expect(response.status).toBe(400);
    expect(asc606Api.handleAsc606ApiError).toHaveBeenCalledTimes(1);
  });
});
