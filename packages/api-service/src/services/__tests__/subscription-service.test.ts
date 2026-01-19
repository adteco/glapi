import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionService, AmendSubscriptionInput } from '../subscription-service';
import { ServiceContext, ServiceError } from '../../types';

const mockSubscriptionRepository = {
  createWithItems: vi.fn(),
  list: vi.fn(),
  findByIdWithItems: vi.fn(),
  update: vi.fn(),
  calculateContractValue: vi.fn(),
};

const mockSubscriptionItemRepository = {
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockSubscriptionVersionRepository = {
  recordVersion: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
};

vi.mock('@glapi/database', () => ({
  SubscriptionRepository: vi.fn(() => mockSubscriptionRepository),
  SubscriptionItemRepository: vi.fn(() => mockSubscriptionItemRepository),
  SubscriptionVersionRepository: vi.fn(() => mockSubscriptionVersionRepository),
}));

describe('SubscriptionService', () => {
  const context: ServiceContext = {
    organizationId: 'org-123',
    userId: 'user-456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionRepository.findByIdWithItems.mockResolvedValue(null);
  });

  it('throws when amendSubscription is called without changes', async () => {
    const service = new SubscriptionService(context);
    const input: AmendSubscriptionInput = {
      subscriptionId: 'sub-1',
    };

    await expect(service.amendSubscription(input)).rejects.toThrow(ServiceError);
    expect(mockSubscriptionRepository.findByIdWithItems).not.toHaveBeenCalled();
  });

  it('records version snapshot when amendment succeeds', async () => {
    const subscription = {
      id: 'sub-1',
      organizationId: context.organizationId!,
      entityId: 'cust-1',
      subscriptionNumber: 'SUB-001',
      status: 'active',
      startDate: '2024-01-01',
      items: [],
    };

    const updatedSubscription = {
      ...subscription,
      contractValue: '5000',
      items: [
        {
          id: 'item-1',
          itemId: 'item-abc',
          quantity: '1',
          unitPrice: '5000',
          startDate: '2024-01-01',
          endDate: null,
        },
      ],
    };

    mockSubscriptionRepository.findByIdWithItems
      .mockResolvedValueOnce(subscription)
      .mockResolvedValueOnce(updatedSubscription);

    mockSubscriptionRepository.calculateContractValue.mockResolvedValue(5000);

    const service = new SubscriptionService(context);

    await service.amendSubscription({
      subscriptionId: subscription.id,
      addItems: [
        {
          itemId: 'item-abc',
          quantity: 1,
          unitPrice: 5000,
          startDate: new Date('2024-01-01'),
        },
      ],
      reason: 'Upsell',
    });

    expect(mockSubscriptionItemRepository.create).toHaveBeenCalledTimes(1);
    expect(mockSubscriptionRepository.calculateContractValue).toHaveBeenCalledWith(subscription.id);
    expect(mockSubscriptionVersionRepository.recordVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        versionType: 'amendment',
        changeReason: 'Upsell',
        subscriptionSnapshot: expect.objectContaining({
          id: subscription.id,
        }),
      }),
    );
  });

  it('lists versions only when subscription belongs to organization', async () => {
    const service = new SubscriptionService(context);
    const subscription = {
      id: 'sub-2',
      organizationId: context.organizationId!,
      entityId: 'cust-1',
      subscriptionNumber: 'SUB-002',
      status: 'active',
      startDate: '2024-01-01',
      items: [],
    };

    mockSubscriptionRepository.findByIdWithItems.mockResolvedValue(subscription);
    mockSubscriptionVersionRepository.listVersions.mockResolvedValue([]);

    const result = await service.listSubscriptionVersions(subscription.id, 10);

    expect(result).toEqual([]);
    expect(mockSubscriptionVersionRepository.listVersions).toHaveBeenCalledWith(subscription.id, { limit: 10 });
  });
});
