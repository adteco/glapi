import { BaseService } from './base-service';
import { PaginatedResult, PaginationParams, ServiceError } from '../types';
import {
  ProjectTask,
  ProjectTaskNode,
  ProjectTaskFilters,
  CreateProjectTaskInput,
  UpdateProjectTaskInput,
} from '../types/project-tasks.types';
import {
  ProjectTaskRepository,
  ProjectCostCodeRepository,
  ProjectAccessError,
  ProjectTaskFilters as RepositoryTaskFilters,
} from '@glapi/database';

interface TaskListParams extends PaginationParams {
  orderBy?: 'sortOrder' | 'startDate' | 'endDate' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export class ProjectTaskService extends BaseService {
  private taskRepository: ProjectTaskRepository;
  private costCodeRepository: ProjectCostCodeRepository;

  constructor(context = {}) {
    super(context);
    this.taskRepository = new ProjectTaskRepository();
    this.costCodeRepository = new ProjectCostCodeRepository();
  }

  private async getAccessibleProjectIds(): Promise<string[]> {
    const organizationId = this.requireOrganizationContext();
    return this.taskRepository.getAccessibleProjectIds(organizationId);
  }

  private transformTask(dbTask: any): ProjectTask {
    return {
      id: dbTask.id,
      projectId: dbTask.projectId,
      parentTaskId: dbTask.parentTaskId,
      projectCostCodeId: dbTask.projectCostCodeId,
      taskCode: dbTask.taskCode,
      name: dbTask.name,
      description: dbTask.description,
      status: dbTask.status,
      priority: dbTask.priority,
      startDate: dbTask.startDate,
      endDate: dbTask.endDate,
      durationDays: dbTask.durationDays,
      percentComplete: dbTask.percentComplete ?? '0',
      isMilestone: dbTask.isMilestone,
      sortOrder: dbTask.sortOrder,
      assignedEntityId: dbTask.assignedEntityId,
      metadata: dbTask.metadata,
      createdBy: dbTask.createdBy,
      createdAt: dbTask.createdAt,
      updatedAt: dbTask.updatedAt,
    };
  }

  private buildTaskTree(tasks: ProjectTask[]): ProjectTaskNode[] {
    const map = new Map<string, ProjectTaskNode>();
    const roots: ProjectTaskNode[] = [];

    for (const task of tasks) {
      map.set(task.id, { ...task, children: [] });
    }

    for (const task of tasks) {
      const node = map.get(task.id)!;
      if (task.parentTaskId && map.has(task.parentTaskId)) {
        map.get(task.parentTaskId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private handleAccessError(error: unknown): never {
    if (error instanceof ProjectAccessError) {
      throw new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403);
    }
    throw error;
  }

  async listTasks(
    projectId: string,
    params: TaskListParams = {},
    filters: ProjectTaskFilters = {}
  ): Promise<PaginatedResult<ProjectTask>> {
    const projectIds = await this.getAccessibleProjectIds();
    const repositoryFilters: RepositoryTaskFilters = { ...filters };

    try {
      const result = await this.taskRepository.findByProject(
        projectId,
        projectIds,
        {
          page: params.page,
          limit: params.limit,
          orderBy: params.orderBy,
          orderDirection: params.orderDirection,
        },
        repositoryFilters
      );

      return {
        ...result,
        data: result.data.map((task) => this.transformTask(task)),
      };
    } catch (error) {
      this.handleAccessError(error);
    }
  }

  async getTaskTree(projectId: string, filters: ProjectTaskFilters = {}): Promise<ProjectTaskNode[]> {
    const projectIds = await this.getAccessibleProjectIds();

    try {
      const rows = await this.taskRepository.findAllForProject(projectId, projectIds);
      let tasks = rows.map((row) => this.transformTask(row));

      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        tasks = tasks.filter((task) => statuses.includes(task.status));
      }

      if (filters.assignedEntityId) {
        tasks = tasks.filter((task) => task.assignedEntityId === filters.assignedEntityId);
      }

      return this.buildTaskTree(tasks);
    } catch (error) {
      this.handleAccessError(error);
    }
  }

  async getTaskById(id: string): Promise<ProjectTask> {
    const projectIds = await this.getAccessibleProjectIds();
    const task = await this.taskRepository.findById(id, projectIds);

    if (!task) {
      throw new ServiceError('Task not found', 'PROJECT_TASK_NOT_FOUND', 404);
    }

    return this.transformTask(task);
  }

  async createTask(input: CreateProjectTaskInput): Promise<ProjectTask> {
    const projectIds = await this.getAccessibleProjectIds();

    if (!projectIds.includes(input.projectId)) {
      throw new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403);
    }

    if (input.parentTaskId) {
      const parent = await this.taskRepository.findById(input.parentTaskId, projectIds);
      if (!parent || parent.projectId !== input.projectId) {
        throw new ServiceError('Parent task not found', 'TASK_PARENT_NOT_FOUND', 404);
      }
    }

    if (input.projectCostCodeId) {
      const costCode = await this.costCodeRepository.findById(input.projectCostCodeId, projectIds);
      if (!costCode || costCode.projectId !== input.projectId) {
        throw new ServiceError('Cost code not found', 'PROJECT_COST_CODE_NOT_FOUND', 404);
      }
    }

    const exists = await this.taskRepository.existsByTaskCode(input.projectId, input.taskCode);
    if (exists) {
      throw new ServiceError('Task code already exists', 'PROJECT_TASK_CODE_EXISTS', 400);
    }

    const userId = this.requireUserContext();

    const created = await this.taskRepository.create({
      projectId: input.projectId,
      parentTaskId: input.parentTaskId ?? null,
      projectCostCodeId: input.projectCostCodeId ?? null,
      taskCode: input.taskCode,
      name: input.name,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      startDate: input.startDate,
      endDate: input.endDate,
      durationDays: input.durationDays ?? null,
      percentComplete: input.percentComplete ?? null,
      isMilestone: input.isMilestone,
      sortOrder: input.sortOrder,
      assignedEntityId: input.assignedEntityId ?? null,
      metadata: input.metadata ?? null,
      createdBy: userId,
    });

    return this.transformTask(created);
  }

  async updateTask(id: string, input: UpdateProjectTaskInput): Promise<ProjectTask> {
    const projectIds = await this.getAccessibleProjectIds();
    const existing = await this.taskRepository.findById(id, projectIds);

    if (!existing) {
      throw new ServiceError('Task not found', 'PROJECT_TASK_NOT_FOUND', 404);
    }

    if (input.projectId && input.projectId !== existing.projectId) {
      throw new ServiceError('Task cannot be moved to another project', 'PROJECT_TASK_INVALID_PROJECT', 400);
    }

    const projectId = existing.projectId;

    if (input.taskCode && input.taskCode !== existing.taskCode) {
      const duplicate = await this.taskRepository.existsByTaskCode(projectId, input.taskCode);
      if (duplicate) {
        throw new ServiceError('Task code already exists', 'PROJECT_TASK_CODE_EXISTS', 400);
      }
    }

    if (input.parentTaskId !== undefined) {
      if (input.parentTaskId === id) {
        throw new ServiceError('Task cannot be its own parent', 'TASK_PARENT_INVALID', 400);
      }

      if (input.parentTaskId) {
        const parent = await this.taskRepository.findById(input.parentTaskId, projectIds);
        if (!parent || parent.projectId !== projectId) {
          throw new ServiceError('Parent task not found', 'TASK_PARENT_NOT_FOUND', 404);
        }
      }
    }

    if (input.projectCostCodeId !== undefined && input.projectCostCodeId) {
      const costCode = await this.costCodeRepository.findById(input.projectCostCodeId, projectIds);
      if (!costCode || costCode.projectId !== projectId) {
        throw new ServiceError('Cost code not found', 'PROJECT_COST_CODE_NOT_FOUND', 404);
      }
    }

    const updated = await this.taskRepository.update(id, projectIds, {
      ...input,
    });

    if (!updated) {
      throw new ServiceError('Failed to update task', 'PROJECT_TASK_UPDATE_FAILED', 500);
    }

    return this.transformTask(updated);
  }

  async deleteTask(id: string): Promise<{ success: boolean }> {
    const projectIds = await this.getAccessibleProjectIds();
    const existing = await this.taskRepository.findById(id, projectIds);

    if (!existing) {
      throw new ServiceError('Task not found', 'PROJECT_TASK_NOT_FOUND', 404);
    }

    await this.taskRepository.delete(id, projectIds);
    return { success: true };
  }
}
