import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeManagementService } from '../change-management-service';
import type { ServiceContext } from '../../types';

const mockCreate = vi.fn();
const mockList = vi.fn();
const mockFind = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@glapi/database', () => ({
  ChangeRequestRepository: vi.fn().mockImplementation(() => ({
    create: mockCreate,
    listByOrganization: mockList,
    findById: mockFind,
    update: mockUpdate,
  })),
  changeRequestStatusEnum: {
    enumValues: ['draft', 'pending_approval', 'approved', 'rejected', 'completed', 'cancelled'],
  },
}));

describe('ChangeManagementService', () => {
  const context: ServiceContext = {
    organizationId: 'org-1',
    userId: 'user-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a change request with org/user context', async () => {
    const service = new ChangeManagementService(context);
    mockCreate.mockResolvedValue({
      id: 'cr-1',
      organizationId: context.organizationId,
      title: 'Test',
      status: 'draft',
    });

    const request = await service.createChangeRequest({
      title: 'Test',
      requestType: 'deployment',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test',
        requestType: 'deployment',
        organizationId: context.organizationId,
        createdBy: context.userId,
      }),
    );
    expect(request.id).toBe('cr-1');
  });

  it('submits a draft change request', async () => {
    const service = new ChangeManagementService(context);
    mockFind.mockResolvedValue({
      id: 'cr-1',
      organizationId: context.organizationId,
      status: 'draft',
    });
    mockUpdate.mockResolvedValue({
      id: 'cr-1',
      status: 'pending_approval',
      organizationId: context.organizationId,
    });

    const result = await service.submitChangeRequest('cr-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      'cr-1',
      expect.objectContaining({
        status: 'pending_approval',
      }),
    );
    expect(result.status).toBe('pending_approval');
  });

  it('rejects invalid status transitions', async () => {
    const service = new ChangeManagementService(context);
    mockFind.mockResolvedValue({
      id: 'cr-1',
      organizationId: context.organizationId,
      status: 'approved',
    });

    await expect(service.submitChangeRequest('cr-1')).rejects.toThrow('draft');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
