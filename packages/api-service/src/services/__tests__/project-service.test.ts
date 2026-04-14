import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext } from '../../types';

// Use vi.hoisted() to properly hoist mock functions for use in vi.mock factory
const {
  mockFindById,
  mockFindByCode,
  mockFindAll,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockExistsByCode,
  mockFindParticipants,
  mockFindParticipantById,
  mockCreateParticipant,
  mockUpdateParticipant,
  mockDeleteParticipant,
  mockParticipantExists,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindByCode: vi.fn(),
  mockFindAll: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockExistsByCode: vi.fn(),
  mockFindParticipants: vi.fn(),
  mockFindParticipantById: vi.fn(),
  mockCreateParticipant: vi.fn(),
  mockUpdateParticipant: vi.fn(),
  mockDeleteParticipant: vi.fn(),
  mockParticipantExists: vi.fn(),
}));

// Mock the database module
vi.mock('@glapi/database', () => ({
  ProjectRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
    findByCode: mockFindByCode,
    findAll: mockFindAll,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
    existsByCode: mockExistsByCode,
    findParticipants: mockFindParticipants,
    findParticipantById: mockFindParticipantById,
    createParticipant: mockCreateParticipant,
    updateParticipant: mockUpdateParticipant,
    deleteParticipant: mockDeleteParticipant,
    participantExists: mockParticipantExists,
  })),
}));

// Import after mocking
import { ProjectService } from '../project-service';

describe('ProjectService', () => {
  let service: ProjectService;
  let context: ServiceContext;

  const testUserId = 'user-123';
  const testOrgId = 'org-123';
  const testSubsidiaryId = 'sub-123';
  const testProjectId = 'proj-123';

  const mockProject = {
    id: testProjectId,
    organizationId: testOrgId,
    subsidiaryId: testSubsidiaryId,
    projectCode: 'PRJ-001',
    name: 'Test Project',
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    jobNumber: 'JOB-001',
    projectType: 'construction',
    retainagePercent: '10.00',
    currencyCode: 'USD',
    description: 'Test project description',
    externalSource: null,
    metadata: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockParticipant = {
    id: 'part-123',
    projectId: testProjectId,
    entityId: 'entity-123',
    participantRole: 'contractor',
    isPrimary: true,
    metadata: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      userId: testUserId,
      organizationId: testOrgId,
    };

    service = new ProjectService(context);
  });

  describe('listProjects', () => {
    it('should list projects with pagination', async () => {
      const mockResult = {
        data: [mockProject],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };

      mockFindAll.mockResolvedValue(mockResult);

      const result = await service.listProjects({ page: 1, limit: 50 }, {});

      expect(mockFindAll).toHaveBeenCalledWith(testOrgId, { page: 1, limit: 50 }, {});
      expect(result.data).toHaveLength(1);
      expect(result.data[0].projectCode).toBe('PRJ-001');
    });

    it('should filter projects by status', async () => {
      mockFindAll.mockResolvedValue({
        data: [mockProject],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });

      await service.listProjects({}, { status: 'ACTIVE' });

      expect(mockFindAll).toHaveBeenCalledWith(testOrgId, {}, { status: 'ACTIVE' });
    });

    it('should filter projects by search term', async () => {
      mockFindAll.mockResolvedValue({
        data: [mockProject],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });

      await service.listProjects({}, { search: 'test' });

      expect(mockFindAll).toHaveBeenCalledWith(testOrgId, {}, { search: 'test' });
    });
  });

  describe('getProjectById', () => {
    it('should return a project by ID', async () => {
      mockFindById.mockResolvedValue(mockProject);

      const result = await service.getProjectById(testProjectId);

      expect(mockFindById).toHaveBeenCalledWith(testProjectId, testOrgId);
      expect(result.id).toBe(testProjectId);
      expect(result.projectCode).toBe('PRJ-001');
    });

    it('should throw error if project not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.getProjectById('nonexistent'))
        .rejects.toThrow('Project not found');
    });
  });

  describe('getProjectByCode', () => {
    it('should return a project by code', async () => {
      mockFindByCode.mockResolvedValue(mockProject);

      const result = await service.getProjectByCode('PRJ-001');

      expect(mockFindByCode).toHaveBeenCalledWith('PRJ-001', testOrgId);
      expect(result.projectCode).toBe('PRJ-001');
    });

    it('should throw error if project not found', async () => {
      mockFindByCode.mockResolvedValue(null);

      await expect(service.getProjectByCode('nonexistent'))
        .rejects.toThrow('Project not found');
    });
  });

  describe('createProject', () => {
    it('should create a new project', async () => {
      mockExistsByCode.mockResolvedValue(false);
      mockCreate.mockResolvedValue(mockProject);

      const input = {
        projectCode: 'PRJ-001',
        name: 'Test Project',
        status: 'active',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      };

      const result = await service.createProject(input);

      expect(mockExistsByCode).toHaveBeenCalledWith('PRJ-001', testOrgId);
      expect(mockCreate).toHaveBeenCalledWith({
        organizationId: testOrgId,
        ...input,
        status: 'ACTIVE',
      });
      expect(result.projectCode).toBe('PRJ-001');
    });

    it('should preserve canonical uppercase status when creating a project', async () => {
      mockExistsByCode.mockResolvedValue(false);
      mockCreate.mockResolvedValue(mockProject);

      await service.createProject({
        projectCode: 'PRJ-002',
        name: 'Uppercase Project',
        status: 'ON_HOLD',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        organizationId: testOrgId,
        projectCode: 'PRJ-002',
        name: 'Uppercase Project',
        status: 'ON_HOLD',
      });
    });

    it('should throw error if project code already exists', async () => {
      mockExistsByCode.mockResolvedValue(true);

      const input = {
        projectCode: 'PRJ-001',
        name: 'Test Project',
      };

      await expect(service.createProject(input))
        .rejects.toThrow('Project code "PRJ-001" already exists');
    });

    it('should throw error if end date is before start date', async () => {
      mockExistsByCode.mockResolvedValue(false);

      const input = {
        projectCode: 'PRJ-001',
        name: 'Test Project',
        startDate: '2026-12-31',
        endDate: '2026-01-01',
      };

      await expect(service.createProject(input))
        .rejects.toThrow('End date cannot be before start date');
    });
  });

  describe('updateProject', () => {
    it('should update an existing project', async () => {
      const updatedProject = { ...mockProject, name: 'Updated Project' };
      mockFindById.mockResolvedValue(mockProject);
      mockUpdate.mockResolvedValue(updatedProject);

      const result = await service.updateProject(testProjectId, { name: 'Updated Project' });

      expect(mockFindById).toHaveBeenCalledWith(testProjectId, testOrgId);
      expect(mockUpdate).toHaveBeenCalledWith(testProjectId, testOrgId, { name: 'Updated Project' });
      expect(result.name).toBe('Updated Project');
    });

    it('should normalize lowercase status when updating a project', async () => {
      mockFindById.mockResolvedValue(mockProject);
      mockUpdate.mockResolvedValue({ ...mockProject, status: 'ON_HOLD' });

      await service.updateProject(testProjectId, { status: 'on_hold' });

      expect(mockUpdate).toHaveBeenCalledWith(testProjectId, testOrgId, { status: 'ON_HOLD' });
    });

    it('should throw error if project not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.updateProject('nonexistent', { name: 'Test' }))
        .rejects.toThrow('Project not found');
    });

    it('should validate project code uniqueness when changing', async () => {
      mockFindById.mockResolvedValue(mockProject);
      mockExistsByCode.mockResolvedValue(true);

      await expect(service.updateProject(testProjectId, { projectCode: 'PRJ-002' }))
        .rejects.toThrow('Project code "PRJ-002" already exists');
    });

    it('should validate date range when updating dates', async () => {
      mockFindById.mockResolvedValue(mockProject);

      // Project has startDate '2026-01-01', try to set endDate before that
      await expect(service.updateProject(testProjectId, { endDate: '2025-12-01' }))
        .rejects.toThrow('End date cannot be before start date');
    });
  });

  describe('deleteProject', () => {
    it('should delete an existing project', async () => {
      mockFindById.mockResolvedValue(mockProject);
      mockDelete.mockResolvedValue(undefined);

      await service.deleteProject(testProjectId);

      expect(mockFindById).toHaveBeenCalledWith(testProjectId, testOrgId);
      expect(mockDelete).toHaveBeenCalledWith(testProjectId, testOrgId);
    });

    it('should throw error if project not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.deleteProject('nonexistent'))
        .rejects.toThrow('Project not found');
    });
  });

  describe('listParticipants', () => {
    it('should list participants for a project', async () => {
      mockFindById.mockResolvedValue(mockProject);
      mockFindParticipants.mockResolvedValue([mockParticipant]);

      const result = await service.listParticipants(testProjectId);

      expect(mockFindById).toHaveBeenCalledWith(testProjectId, testOrgId);
      expect(mockFindParticipants).toHaveBeenCalledWith(testProjectId);
      expect(result).toHaveLength(1);
      expect(result[0].participantRole).toBe('contractor');
    });

    it('should throw error if project not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.listParticipants('nonexistent'))
        .rejects.toThrow('Project not found');
    });
  });

  describe('addParticipant', () => {
    it('should add a participant to a project', async () => {
      mockFindById.mockResolvedValue(mockProject);
      mockParticipantExists.mockResolvedValue(false);
      mockCreateParticipant.mockResolvedValue(mockParticipant);

      const input = {
        participantRole: 'contractor',
        entityId: 'entity-123',
        isPrimary: true,
      };

      const result = await service.addParticipant(testProjectId, input);

      expect(mockFindById).toHaveBeenCalledWith(testProjectId, testOrgId);
      expect(mockParticipantExists).toHaveBeenCalledWith(testProjectId, 'contractor', 'entity-123');
      expect(mockCreateParticipant).toHaveBeenCalledWith({
        projectId: testProjectId,
        ...input,
      });
      expect(result.participantRole).toBe('contractor');
    });

    it('should throw error if participant already exists', async () => {
      mockFindById.mockResolvedValue(mockProject);
      mockParticipantExists.mockResolvedValue(true);

      const input = {
        participantRole: 'contractor',
        entityId: 'entity-123',
      };

      await expect(service.addParticipant(testProjectId, input))
        .rejects.toThrow('Participant with this role already exists on project');
    });

    it('should throw error if project not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.addParticipant('nonexistent', { participantRole: 'contractor' }))
        .rejects.toThrow('Project not found');
    });
  });

  describe('updateParticipant', () => {
    it('should update a participant', async () => {
      const updatedParticipant = { ...mockParticipant, isPrimary: false };
      mockFindById.mockResolvedValue(mockProject);
      mockFindParticipantById.mockResolvedValue(mockParticipant);
      mockUpdateParticipant.mockResolvedValue(updatedParticipant);

      const result = await service.updateParticipant(
        testProjectId,
        'part-123',
        { isPrimary: false }
      );

      expect(mockFindById).toHaveBeenCalledWith(testProjectId, testOrgId);
      expect(mockFindParticipantById).toHaveBeenCalledWith('part-123');
      expect(mockUpdateParticipant).toHaveBeenCalledWith('part-123', { isPrimary: false });
      expect(result.isPrimary).toBe(false);
    });

    it('should throw error if participant not found', async () => {
      mockFindById.mockResolvedValue(mockProject);
      mockFindParticipantById.mockResolvedValue(null);

      await expect(service.updateParticipant(testProjectId, 'nonexistent', { isPrimary: false }))
        .rejects.toThrow('Participant not found');
    });

    it('should throw error if participant belongs to different project', async () => {
      mockFindById.mockResolvedValue(mockProject);
      mockFindParticipantById.mockResolvedValue({
        ...mockParticipant,
        projectId: 'other-project',
      });

      await expect(service.updateParticipant(testProjectId, 'part-123', { isPrimary: false }))
        .rejects.toThrow('Participant not found');
    });
  });

  describe('removeParticipant', () => {
    it('should remove a participant from a project', async () => {
      mockFindById.mockResolvedValue(mockProject);
      mockFindParticipantById.mockResolvedValue(mockParticipant);
      mockDeleteParticipant.mockResolvedValue(undefined);

      await service.removeParticipant(testProjectId, 'part-123');

      expect(mockFindById).toHaveBeenCalledWith(testProjectId, testOrgId);
      expect(mockFindParticipantById).toHaveBeenCalledWith('part-123');
      expect(mockDeleteParticipant).toHaveBeenCalledWith('part-123');
    });

    it('should throw error if participant not found', async () => {
      mockFindById.mockResolvedValue(mockProject);
      mockFindParticipantById.mockResolvedValue(null);

      await expect(service.removeParticipant(testProjectId, 'nonexistent'))
        .rejects.toThrow('Participant not found');
    });
  });

  describe('requireOrganizationContext', () => {
    it('should throw error if no organization context', async () => {
      const noOrgService = new ProjectService({ userId: testUserId });

      await expect(noOrgService.listProjects({}, {}))
        .rejects.toThrow();
    });
  });
});
