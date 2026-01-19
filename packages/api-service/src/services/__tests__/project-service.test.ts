import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext, ServiceError } from '../../types';

const {
  mockFindAll,
  mockFindById,
  mockExistsByCode,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockListParticipants,
  mockListAddresses,
  mockUpsertParticipant,
  mockRemoveParticipant,
  mockUpsertAddress,
  mockDeleteAddress,
  MockProjectAccessError,
} = vi.hoisted(() => {
  class AccessError extends Error {}
  return {
    mockFindAll: vi.fn(),
    mockFindById: vi.fn(),
    mockExistsByCode: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockListParticipants: vi.fn(),
    mockListAddresses: vi.fn(),
    mockUpsertParticipant: vi.fn(),
    mockRemoveParticipant: vi.fn(),
    mockUpsertAddress: vi.fn(),
    mockDeleteAddress: vi.fn(),
    MockProjectAccessError: AccessError,
  };
});

vi.mock('@glapi/database', () => ({
  ProjectRepository: vi.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    existsByCode: mockExistsByCode,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
    listParticipants: mockListParticipants,
    listAddresses: mockListAddresses,
    upsertParticipant: mockUpsertParticipant,
    removeParticipant: mockRemoveParticipant,
    upsertAddress: mockUpsertAddress,
    deleteAddress: mockDeleteAddress,
  })),
  ProjectAccessError: MockProjectAccessError,
}));

import { ProjectService } from '../project-service';

const BASE_CONTEXT: ServiceContext = {
  organizationId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
};

const dbProject = {
  id: 'proj-1',
  organizationId: BASE_CONTEXT.organizationId,
  projectCode: 'PRJ-001',
  name: 'New HQ Build',
  status: 'PLANNING',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  retainagePercent: '5.00',
  currencyCode: 'USD',
  description: 'Campus expansion',
  metadata: { region: 'east' },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectService(BASE_CONTEXT);
  });

  describe('listProjects', () => {
    it('returns transformed projects with pagination', async () => {
      mockFindAll.mockResolvedValue({
        data: [dbProject],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });

      const result = await service.listProjects();

      expect(mockFindAll).toHaveBeenCalledWith(
        BASE_CONTEXT.organizationId,
        {
          page: undefined,
          limit: undefined,
          orderBy: undefined,
          orderDirection: undefined,
        },
        {}
      );
      expect(result.data[0]).toMatchObject({
        id: dbProject.id,
        projectCode: dbProject.projectCode,
        name: dbProject.name,
      });
    });
  });

  describe('getProjectById', () => {
    it('returns project with participants and addresses', async () => {
      mockFindById.mockResolvedValue(dbProject);
      mockListParticipants.mockResolvedValue([
        {
          id: 'participant-1',
          projectId: dbProject.id,
          participantRole: 'OWNER',
          entityId: 'entity-1',
          isPrimary: true,
          metadata: null,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          entityName: 'ACME Construction',
          entityType: 'COMPANY',
          entityExternalId: 'acme',
        },
      ]);
      mockListAddresses.mockResolvedValue([
        {
          id: 'address-1',
          projectId: dbProject.id,
          addressType: 'JOB_SITE',
          addressLine1: '123 Main St',
          addressLine2: null,
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
          country: 'US',
          metadata: null,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ]);

      const project = await service.getProjectById(dbProject.id);

      expect(project.participants).toHaveLength(1);
      expect(project.addresses).toHaveLength(1);
    });

    it('throws when project is missing', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.getProjectById('missing')).rejects.toThrowError(
        new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404)
      );
    });
  });

  describe('createProject', () => {
    it('creates project when code is unique', async () => {
      mockExistsByCode.mockResolvedValue(false);
      mockCreate.mockResolvedValue(dbProject);

      const created = await service.createProject({
        projectCode: dbProject.projectCode,
        name: dbProject.name,
        status: dbProject.status as any,
      });

      expect(mockExistsByCode).toHaveBeenCalledWith(BASE_CONTEXT.organizationId, dbProject.projectCode);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: BASE_CONTEXT.organizationId,
          projectCode: dbProject.projectCode,
          name: dbProject.name,
        })
      );
      expect(created.id).toBe(dbProject.id);
    });

    it('prevents duplicate project codes', async () => {
      mockExistsByCode.mockResolvedValue(true);

      await expect(
        service.createProject({
          projectCode: dbProject.projectCode,
          name: dbProject.name,
        })
      ).rejects.toThrowError(new ServiceError('Project code already exists', 'PROJECT_CODE_EXISTS', 400));
    });
  });

  describe('updateProject', () => {
    it('throws when project is missing', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        service.updateProject('missing', {
          name: 'Updated',
        })
      ).rejects.toThrowError(new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404));
    });

    it('prevents duplicate codes on update', async () => {
      mockFindById.mockResolvedValue(dbProject);
      mockExistsByCode.mockResolvedValue(true);

      await expect(
        service.updateProject(dbProject.id, {
          projectCode: 'NEW',
        })
      ).rejects.toThrowError(new ServiceError('Project code already exists', 'PROJECT_CODE_EXISTS', 400));
    });

    it('updates project successfully', async () => {
      mockFindById.mockResolvedValue(dbProject);
      mockExistsByCode.mockResolvedValue(false);
      mockUpdate.mockResolvedValue({
        ...dbProject,
        name: 'Updated Name',
      });

      const updated = await service.updateProject(dbProject.id, { name: 'Updated Name' });

      expect(mockUpdate).toHaveBeenCalledWith(dbProject.id, BASE_CONTEXT.organizationId, { name: 'Updated Name' });
      expect(updated.name).toBe('Updated Name');
    });
  });

  describe('deleteProject', () => {
    it('requires existing project', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.deleteProject(dbProject.id)).rejects.toThrowError(
        new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404)
      );
    });

    it('deletes project by id', async () => {
      mockFindById.mockResolvedValue(dbProject);
      mockDelete.mockResolvedValue({ id: dbProject.id });

      const result = await service.deleteProject(dbProject.id);

      expect(mockDelete).toHaveBeenCalledWith(dbProject.id, BASE_CONTEXT.organizationId);
      expect(result).toEqual({ success: true });
    });
  });

  describe('participant management', () => {
    it('creates participant and transforms result', async () => {
      mockUpsertParticipant.mockResolvedValue({
        id: 'participant-1',
        projectId: dbProject.id,
        participantRole: 'OWNER',
        entityId: 'entity-1',
        isPrimary: true,
        metadata: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        entityName: 'ACME',
        entityType: 'COMPANY',
        entityExternalId: 'acme',
      });

      const participant = await service.upsertParticipant(dbProject.id, {
        participantRole: 'OWNER',
        entityId: 'entity-1',
      });

      expect(mockUpsertParticipant).toHaveBeenCalledWith(dbProject.id, BASE_CONTEXT.organizationId, {
        entityId: 'entity-1',
        participantRole: 'OWNER',
        isPrimary: undefined,
        metadata: undefined,
      });
      expect(participant.participantRole).toBe('OWNER');
    });

    it('maps repository access errors to ServiceError', async () => {
      mockUpsertParticipant.mockRejectedValue(new MockProjectAccessError('denied'));

      await expect(
        service.upsertParticipant(dbProject.id, {
          participantRole: 'OWNER',
        })
      ).rejects.toThrowError(new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403));
    });

    it('removes participant', async () => {
      mockRemoveParticipant.mockResolvedValue({ id: 'participant-1' });

      const result = await service.removeParticipant('participant-1');

      expect(mockRemoveParticipant).toHaveBeenCalledWith('participant-1', BASE_CONTEXT.organizationId);
      expect(result).toEqual({ success: true });
    });

    it('throws when removal target missing', async () => {
      mockRemoveParticipant.mockResolvedValue(null);

      await expect(service.removeParticipant('missing')).rejects.toThrowError(
        new ServiceError('Participant not found', 'PROJECT_PARTICIPANT_NOT_FOUND', 404)
      );
    });
  });

  describe('address management', () => {
    it('upserts address successfully', async () => {
      mockUpsertAddress.mockResolvedValue({
        id: 'address-1',
        projectId: dbProject.id,
        addressType: 'JOB_SITE',
        addressLine1: '123 Main',
        addressLine2: null,
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'US',
        metadata: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      });

      const address = await service.upsertAddress(dbProject.id, {
        addressType: 'JOB_SITE',
        addressLine1: '123 Main',
      });

      expect(mockUpsertAddress).toHaveBeenCalledWith(
        dbProject.id,
        BASE_CONTEXT.organizationId,
        expect.objectContaining({
          addressType: 'JOB_SITE',
          addressLine1: '123 Main',
        })
      );
      expect(address.addressType).toBe('JOB_SITE');
    });

    it('throws when deleteAddress returns null', async () => {
      mockDeleteAddress.mockResolvedValue(null);

      await expect(service.deleteAddress('address-1')).rejects.toThrowError(
        new ServiceError('Address not found', 'PROJECT_ADDRESS_NOT_FOUND', 404)
      );
    });
  });

  describe('context validation', () => {
    it('requires organizationId for operations', async () => {
      const contextlessService = new ProjectService({});

      await expect(contextlessService.listProjects()).rejects.toThrowError(
        new ServiceError('Organization context is required for this operation', 'MISSING_ORGANIZATION_CONTEXT', 401)
      );
    });
  });
});
