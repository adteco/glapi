import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext, ServiceError } from '../../types';

const {
  mockGetAccessibleProjectIds,
  mockFindByProject,
  mockFindAllForProject,
  mockFindById,
  mockExistsByTaskCode,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockCostCodeFindById,
  MockProjectAccessError,
} = vi.hoisted(() => {
  class AccessError extends Error {}
  return {
    mockGetAccessibleProjectIds: vi.fn(),
    mockFindByProject: vi.fn(),
    mockFindAllForProject: vi.fn(),
    mockFindById: vi.fn(),
    mockExistsByTaskCode: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockCostCodeFindById: vi.fn(),
    MockProjectAccessError: AccessError,
  };
});

vi.mock('@glapi/database', () => ({
  ProjectTaskRepository: vi.fn().mockImplementation(() => ({
    getAccessibleProjectIds: mockGetAccessibleProjectIds,
    findByProject: mockFindByProject,
    findAllForProject: mockFindAllForProject,
    findById: mockFindById,
    existsByTaskCode: mockExistsByTaskCode,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
  })),
  ProjectCostCodeRepository: vi.fn().mockImplementation(() => ({
    findById: mockCostCodeFindById,
  })),
  ProjectAccessError: MockProjectAccessError,
}));

import { ProjectTaskService } from '../project-task-service';

const BASE_CONTEXT: ServiceContext = {
  organizationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
};

const PROJECT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const dbTask = {
  id: 'task-1',
  projectId: PROJECT_ID,
  parentTaskId: null,
  projectCostCodeId: null,
  taskCode: 'TASK-001',
  name: 'Mobilization',
  description: null,
  status: 'NOT_STARTED',
  priority: 'MEDIUM',
  startDate: null,
  endDate: null,
  durationDays: null,
  percentComplete: '0',
  isMilestone: false,
  sortOrder: 1,
  assignedEntityId: null,
  metadata: null,
  createdBy: BASE_CONTEXT.userId,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('ProjectTaskService', () => {
  let service: ProjectTaskService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectTaskService(BASE_CONTEXT);
    mockGetAccessibleProjectIds.mockResolvedValue([PROJECT_ID]);
    mockExistsByTaskCode.mockResolvedValue(false);
    mockCostCodeFindById.mockResolvedValue({ id: 'cost-1', projectId: PROJECT_ID });
  });

  describe('listTasks', () => {
    it('returns paginated tasks for accessible project', async () => {
      mockFindByProject.mockResolvedValue({
        data: [dbTask],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });

      const result = await service.listTasks(PROJECT_ID);

      expect(mockFindByProject).toHaveBeenCalledWith(
        PROJECT_ID,
        [PROJECT_ID],
        {
          page: undefined,
          limit: undefined,
          orderBy: undefined,
          orderDirection: undefined,
        },
        {}
      );
      expect(result.data[0].id).toBe(dbTask.id);
    });

    it('maps repository access errors to ServiceError', async () => {
      mockFindByProject.mockRejectedValue(new MockProjectAccessError('denied'));

      await expect(service.listTasks(PROJECT_ID)).rejects.toThrowError(
        new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403)
      );
    });
  });

  describe('getTaskTree', () => {
    it('builds hierarchical tree and applies filters', async () => {
      const taskA = { ...dbTask, id: 'task-a', taskCode: 'A', sortOrder: 1, status: 'IN_PROGRESS' };
      const taskB = { ...dbTask, id: 'task-b', taskCode: 'B', parentTaskId: 'task-a', sortOrder: 2, status: 'BLOCKED' };
      mockFindAllForProject.mockResolvedValue([taskA, taskB]);

      const tree = await service.getTaskTree(PROJECT_ID, { status: 'IN_PROGRESS' });

      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(0);
    });
  });

  describe('createTask', () => {
    it('requires user to have project access', async () => {
      mockGetAccessibleProjectIds.mockResolvedValue([]);

      await expect(
        service.createTask({
          projectId: PROJECT_ID,
          taskCode: 'TASK-NEW',
          name: 'Site prep',
        })
      ).rejects.toThrowError(new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403));
    });

    it('validates parent task belongs to project', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        service.createTask({
          projectId: PROJECT_ID,
          taskCode: 'TASK-NEW',
          name: 'Site prep',
          parentTaskId: 'unknown-parent',
        })
      ).rejects.toThrowError(new ServiceError('Parent task not found', 'TASK_PARENT_NOT_FOUND', 404));
    });

    it('validates cost code belongs to project', async () => {
      mockFindById.mockResolvedValue(dbTask);
      mockCostCodeFindById.mockResolvedValue({ id: 'cost-1', projectId: 'other-project' });

      await expect(
        service.createTask({
          projectId: PROJECT_ID,
          taskCode: 'TASK-NEW',
          name: 'Site prep',
          projectCostCodeId: 'cost-1',
        })
      ).rejects.toThrowError(new ServiceError('Cost code not found', 'PROJECT_COST_CODE_NOT_FOUND', 404));
    });

    it('creates task when inputs are valid', async () => {
      mockCreate.mockResolvedValue(dbTask);

      const created = await service.createTask({
        projectId: PROJECT_ID,
        taskCode: dbTask.taskCode,
        name: dbTask.name,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: PROJECT_ID,
          createdBy: BASE_CONTEXT.userId,
        })
      );
      expect(created.id).toBe(dbTask.id);
    });
  });

  describe('updateTask', () => {
    it('throws when task not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.updateTask('missing', {})).rejects.toThrowError(
        new ServiceError('Task not found', 'PROJECT_TASK_NOT_FOUND', 404)
      );
    });

    it('prevents moving task to another project', async () => {
      mockFindById.mockResolvedValue(dbTask);

      await expect(
        service.updateTask(dbTask.id, {
          projectId: 'different',
        })
      ).rejects.toThrowError(
        new ServiceError('Task cannot be moved to another project', 'PROJECT_TASK_INVALID_PROJECT', 400)
      );
    });

    it('prevents duplicate task codes', async () => {
      mockFindById.mockResolvedValue(dbTask);
      mockExistsByTaskCode.mockResolvedValue(true);

      await expect(
        service.updateTask(dbTask.id, {
          taskCode: 'TASK-NEW',
        })
      ).rejects.toThrowError(new ServiceError('Task code already exists', 'PROJECT_TASK_CODE_EXISTS', 400));
    });

    it('prevents task being its own parent', async () => {
      mockFindById.mockResolvedValue(dbTask);

      await expect(
        service.updateTask(dbTask.id, {
          parentTaskId: dbTask.id,
        })
      ).rejects.toThrowError(new ServiceError('Task cannot be its own parent', 'TASK_PARENT_INVALID', 400));
    });

    it('updates task successfully', async () => {
      mockFindById.mockResolvedValue(dbTask);
      mockExistsByTaskCode.mockResolvedValue(false);
      mockUpdate.mockResolvedValue({ ...dbTask, name: 'Updated' });

      const updated = await service.updateTask(dbTask.id, { name: 'Updated' });

      expect(mockUpdate).toHaveBeenCalledWith(dbTask.id, [PROJECT_ID], { name: 'Updated' });
      expect(updated.name).toBe('Updated');
    });
  });

  describe('deleteTask', () => {
    it('requires existing task', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.deleteTask('missing')).rejects.toThrowError(
        new ServiceError('Task not found', 'PROJECT_TASK_NOT_FOUND', 404)
      );
    });

    it('deletes task', async () => {
      mockFindById.mockResolvedValue(dbTask);
      mockDelete.mockResolvedValue({ id: dbTask.id });

      const result = await service.deleteTask(dbTask.id);

      expect(mockDelete).toHaveBeenCalledWith(dbTask.id, [PROJECT_ID]);
      expect(result).toEqual({ success: true });
    });
  });

  describe('getTaskById', () => {
    it('throws when task missing', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.getTaskById('missing')).rejects.toThrowError(
        new ServiceError('Task not found', 'PROJECT_TASK_NOT_FOUND', 404)
      );
    });

    it('returns task when found', async () => {
      mockFindById.mockResolvedValue(dbTask);

      const task = await service.getTaskById(dbTask.id);

      expect(task.id).toBe(dbTask.id);
      expect(task.taskCode).toBe(dbTask.taskCode);
    });
  });
});
