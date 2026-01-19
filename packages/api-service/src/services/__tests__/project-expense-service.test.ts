import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext } from '../../types';

const {
  mockFindAll,
  mockFindById,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockRecordApproval,
  mockListAttachments,
  mockAddAttachment,
  mockDeleteAttachment,
  mockTaskIds,
  mockTaskFind,
  mockCostCodeFind,
  mockProjectFind,
  mockProjectIds,
  mockMarkAsPosted,
  mockJobCostPostExpenseEntries,
} = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockRecordApproval: vi.fn(),
  mockListAttachments: vi.fn(),
  mockAddAttachment: vi.fn(),
  mockDeleteAttachment: vi.fn(),
  mockTaskIds: vi.fn(),
  mockTaskFind: vi.fn(),
  mockCostCodeFind: vi.fn(),
  mockProjectFind: vi.fn(),
  mockProjectIds: vi.fn(),
  mockMarkAsPosted: vi.fn(),
  mockJobCostPostExpenseEntries: vi.fn(),
}));

vi.mock('@glapi/database', () => ({
  ProjectExpenseRepository: vi.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
     markAsPosted: mockMarkAsPosted,
    recordApproval: mockRecordApproval,
    listAttachments: mockListAttachments,
    addAttachment: mockAddAttachment,
    deleteAttachment: mockDeleteAttachment,
  })),
  ProjectTaskRepository: vi.fn().mockImplementation(() => ({
    getAccessibleProjectIds: mockTaskIds,
    findById: mockTaskFind,
  })),
  ProjectCostCodeRepository: vi.fn().mockImplementation(() => ({
    findById: mockCostCodeFind,
  })),
  ProjectRepository: vi.fn().mockImplementation(() => ({
    findById: mockProjectFind,
    getAccessibleProjectIds: mockProjectIds,
  })),
}));

vi.mock('../job-cost-posting-service', () => ({
  JobCostPostingService: vi.fn().mockImplementation(() => ({
    postExpenseEntries: mockJobCostPostExpenseEntries,
  })),
}));

import { ProjectExpenseService } from '../project-expense-service';

describe('ProjectExpenseService', () => {
  let service: ProjectExpenseService;
  const baseContext: ServiceContext = { organizationId: 'org-1', userId: 'user-1' };
  const entry = {
    id: 'exp-1',
    organizationId: baseContext.organizationId!,
    subsidiaryId: 'sub-1',
    employeeId: 'user-1',
    projectId: 'proj-1',
    projectTaskId: null,
    costCodeId: 'cost-1',
    expenseType: 'OTHER',
    vendorName: null,
    vendorInvoiceNumber: null,
    expenseDate: '2025-01-10',
    amount: '100.00',
    currencyCode: 'USD',
    description: null,
    isBillable: true,
    status: 'DRAFT',
    metadata: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectExpenseService(baseContext);
    mockTaskIds.mockResolvedValue(['proj-1']);
    mockTaskFind.mockResolvedValue({ id: 'task-1', projectId: 'proj-1' });
    mockCostCodeFind.mockResolvedValue({
      id: 'cost-1',
      projectId: 'proj-1',
      costAccountId: 'acc-100',
      wipAccountId: 'wip-100',
      costCode: 'LAB-100',
    });
    mockProjectFind.mockResolvedValue({ id: 'proj-1', subsidiaryId: 'sub-1' });
    mockProjectIds.mockResolvedValue(['proj-1']);
    mockJobCostPostExpenseEntries.mockResolvedValue({
      glResult: { glTransaction: { id: 'gl-exp-1' } },
    });
  });

  it('lists expenses with pagination', async () => {
    mockFindAll.mockResolvedValue({ data: [entry], total: 1 });
    const result = await service.list();
    expect(result.data).toHaveLength(1);
    expect(mockFindAll).toHaveBeenCalled();
  });

  it('fetches expense by id', async () => {
    mockFindById.mockResolvedValue(entry);
    const result = await service.getById('exp-1');
    expect(result.id).toBe('exp-1');
  });

  it('creates expense and derives project from task', async () => {
    mockCreate.mockResolvedValue(entry);
    const created = await service.create({
      projectTaskId: 'task-1',
      expenseDate: '2025-01-10',
      amount: '100.00',
      expenseType: 'TRAVEL',
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-1', subsidiaryId: 'sub-1' })
    );
    expect(created.id).toBe('exp-1');
  });

  it('prevents task mismatch', async () => {
    mockTaskFind.mockResolvedValue({ id: 'task-1', projectId: 'proj-2' });
    await expect(
      service.create({
        projectId: 'proj-1',
        projectTaskId: 'task-1',
        expenseDate: '2025-01-10',
        amount: '10',
      })
    ).rejects.toThrowError();
  });

  it('updates draft expense', async () => {
    mockFindById.mockResolvedValue({ ...entry, status: 'DRAFT' });
    mockUpdate.mockResolvedValue({ ...entry, description: 'Updated' });
    const updated = await service.update('exp-1', { description: 'Updated' });
    expect(updated.description).toBe('Updated');
  });

  it('deletes draft expense', async () => {
    mockFindById.mockResolvedValue(entry);
    mockDelete.mockResolvedValue(true);
    const result = await service.delete('exp-1');
    expect(result.success).toBe(true);
  });

  it('changes status and records approval', async () => {
    mockFindById.mockResolvedValue(entry);
    mockUpdate.mockResolvedValue({ ...entry, status: 'SUBMITTED' });
    const updated = await service.changeStatus('exp-1', 'SUBMITTED');
    expect(updated.status).toBe('SUBMITTED');
    expect(mockRecordApproval).toHaveBeenCalled();
  });

  describe('postToGL', () => {
    it('posts approved expenses through job cost service', async () => {
      const approvedEntry = { ...entry, status: 'APPROVED' };
      mockFindById.mockResolvedValue(approvedEntry);
      mockMarkAsPosted.mockResolvedValue({ ...approvedEntry, status: 'POSTED' });

      const result = await service.postToGL(['exp-1']);

      expect(result.success).toBe(true);
      expect(result.postedCount).toBe(1);
      expect(result.glTransactionId).toBe('gl-exp-1');
      expect(mockJobCostPostExpenseEntries).toHaveBeenCalledTimes(1);
      expect(mockMarkAsPosted).toHaveBeenCalledWith('exp-1', baseContext.organizationId!, 'gl-exp-1');
    });

    it('captures GL posting failures per expense', async () => {
      const approvedEntry = { ...entry, status: 'APPROVED' };
      mockFindById.mockResolvedValue(approvedEntry);
      mockJobCostPostExpenseEntries.mockRejectedValue(new Error('GL period closed'));

      const result = await service.postToGL(['exp-1']);

      expect(result.success).toBe(false);
      expect(result.postedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors[0].error).toContain('GL period closed');
      expect(mockMarkAsPosted).not.toHaveBeenCalled();
    });
  });

  it('lists attachments', async () => {
    mockFindById.mockResolvedValue(entry);
    mockListAttachments.mockResolvedValue([]);
    const attachments = await service.listAttachments('exp-1');
    expect(Array.isArray(attachments)).toBe(true);
  });
});
