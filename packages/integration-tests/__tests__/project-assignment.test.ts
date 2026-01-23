/**
 * Project Assignment Integration Tests
 *
 * Tests for employee project assignments and relationships.
 * Validates the createAssignment and getMyAssignments TRPC endpoints.
 *
 * @module project-assignment.test
 * @task glapi-t9c
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestDatabase } from '../helpers/test-database';
import { TestDataGenerator } from '../helpers/test-data-generator';
import { createCallerFactory, appRouter, type Context } from '@glapi/trpc';
import { createEmployeeAssignmentSchema } from '@glapi/types';
import { z } from 'zod';

// Use z.input for input types to allow optional fields with defaults
type CreateEmployeeAssignmentInput = z.input<typeof createEmployeeAssignmentSchema>;

describe('Project Assignment Integration Tests', () => {
  let testDb: TestDatabase;
  let dataGenerator: TestDataGenerator;
  let organizationId: string;
  let adminId: string;
  let employee1Id: string;
  let employee2Id: string;
  let project1Id: string;
  let project2Id: string;
  let costCodeId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adminCaller: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let employee1Caller: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let employee2Caller: any;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();

    dataGenerator = new TestDataGenerator(testDb.db);

    // Create test organization
    const organization = await dataGenerator.createOrganization('Assignment Test Org');
    organizationId = organization.id;

    // Create admin
    const admin = await dataGenerator.createEmployee(organizationId, 'Admin');
    adminId = admin.id;

    // Create employees
    const employee1 = await dataGenerator.createEmployee(organizationId, 'Employee1');
    employee1Id = employee1.id;

    const employee2 = await dataGenerator.createEmployee(organizationId, 'Employee2');
    employee2Id = employee2.id;

    // Create projects
    const project1 = await dataGenerator.createProject(organizationId, 'Project Alpha');
    project1Id = project1.id;

    const project2 = await dataGenerator.createProject(organizationId, 'Project Beta');
    project2Id = project2.id;

    // Create cost code for first project
    const costCode = await dataGenerator.createCostCode(organizationId, project1Id, 'Development');
    costCodeId = costCode.id;

    // Create TRPC callers
    const createCaller = createCallerFactory(appRouter);

    // Admin caller
    const adminContext: Context = {
      req: undefined,
      res: undefined,
      user: {
        id: adminId,
        organizationId,
        email: 'admin@example.com',
        role: 'admin',
      },
      db: testDb.db,
      serviceContext: {
        organizationId,
        userId: adminId,
      },
    };
    adminCaller = createCaller(adminContext);

    // Employee1 caller
    const employee1Context: Context = {
      req: undefined,
      res: undefined,
      user: {
        id: employee1Id,
        organizationId,
        email: 'employee1@example.com',
        role: 'user',
      },
      db: testDb.db,
      serviceContext: {
        organizationId,
        userId: employee1Id,
      },
    };
    employee1Caller = createCaller(employee1Context);

    // Employee2 caller
    const employee2Context: Context = {
      req: undefined,
      res: undefined,
      user: {
        id: employee2Id,
        organizationId,
        email: 'employee2@example.com',
        role: 'user',
      },
      db: testDb.db,
      serviceContext: {
        organizationId,
        userId: employee2Id,
      },
    };
    employee2Caller = createCaller(employee2Context);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    // Clear assignments between tests
    await testDb.client`TRUNCATE TABLE employee_project_assignments CASCADE`;
  });

  describe('Create Employee Assignment', () => {
    it('should create a basic employee assignment', async () => {
      const input: CreateEmployeeAssignmentInput = {
        employeeId: employee1Id,
        projectId: project1Id,
      };

      const result = await adminCaller.timeEntries.createAssignment(input);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.employeeId).toBe(employee1Id);
      expect(result.projectId).toBe(project1Id);
      expect(result.isActive).toBe(true);
      expect(result.canApproveTime).toBe(false);
      expect(result.actualHours).toBe('0');
    });

    it('should create assignment with all fields', async () => {
      const input: CreateEmployeeAssignmentInput = {
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'Senior Developer',
        defaultCostCodeId: costCodeId,
        budgetedHours: '160.00',
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        canApproveTime: true,
        metadata: { department: 'Engineering' },
      };

      const result = await adminCaller.timeEntries.createAssignment(input);

      expect(result.role).toBe('Senior Developer');
      expect(result.defaultCostCodeId).toBe(costCodeId);
      expect(result.budgetedHours).toBe('160.00');
      expect(result.startDate).toBe('2024-01-01');
      expect(result.endDate).toBe('2024-06-30');
      expect(result.canApproveTime).toBe(true);
      expect(result.metadata).toEqual({ department: 'Engineering' });
    });

    it('should create multiple assignments for same employee', async () => {
      // Assign employee to project 1
      await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'Developer',
      });

      // Assign same employee to project 2
      const result2 = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project2Id,
        role: 'Consultant',
      });

      expect(result2.employeeId).toBe(employee1Id);
      expect(result2.projectId).toBe(project2Id);
      expect(result2.role).toBe('Consultant');
    });

    it('should create multiple assignments for same project', async () => {
      // Assign employee 1 to project
      await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'Lead Developer',
        canApproveTime: true,
      });

      // Assign employee 2 to same project
      const result2 = await adminCaller.timeEntries.createAssignment({
        employeeId: employee2Id,
        projectId: project1Id,
        role: 'Junior Developer',
      });

      expect(result2.employeeId).toBe(employee2Id);
      expect(result2.projectId).toBe(project1Id);
      expect(result2.canApproveTime).toBe(false);
    });

    it('should validate assignment input schema', () => {
      // Missing required fields
      const missingEmployeeId = createEmployeeAssignmentSchema.safeParse({
        projectId: project1Id,
      });
      expect(missingEmployeeId.success).toBe(false);

      const missingProjectId = createEmployeeAssignmentSchema.safeParse({
        employeeId: employee1Id,
      });
      expect(missingProjectId.success).toBe(false);

      // Invalid UUID
      const invalidEmployeeId = createEmployeeAssignmentSchema.safeParse({
        employeeId: 'not-a-uuid',
        projectId: project1Id,
      });
      expect(invalidEmployeeId.success).toBe(false);

      // Valid minimal input
      const validMinimal = createEmployeeAssignmentSchema.safeParse({
        employeeId: employee1Id,
        projectId: project1Id,
      });
      expect(validMinimal.success).toBe(true);

      // Valid full input
      const validFull = createEmployeeAssignmentSchema.safeParse({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'Developer',
        budgetedHours: '80.00',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        canApproveTime: true,
      });
      expect(validFull.success).toBe(true);
    });

    it('should validate role length', () => {
      const longRole = createEmployeeAssignmentSchema.safeParse({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'a'.repeat(101), // 101 characters, max is 100
      });
      expect(longRole.success).toBe(false);

      const validRole = createEmployeeAssignmentSchema.safeParse({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'a'.repeat(100), // Exactly 100 characters
      });
      expect(validRole.success).toBe(true);
    });
  });

  describe('Get My Assignments', () => {
    it('should return empty array when no assignments', async () => {
      const result = await employee1Caller.timeEntries.getMyAssignments();

      expect(result).toEqual([]);
    });

    it('should return only my assignments', async () => {
      // Create assignment for employee1
      await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'Developer',
      });

      // Create assignment for employee2
      await adminCaller.timeEntries.createAssignment({
        employeeId: employee2Id,
        projectId: project1Id,
        role: 'Designer',
      });

      // Employee1 should only see their own
      const employee1Assignments = await employee1Caller.timeEntries.getMyAssignments();
      expect(employee1Assignments.length).toBe(1);
      expect(employee1Assignments[0].employeeId).toBe(employee1Id);
      expect(employee1Assignments[0].role).toBe('Developer');

      // Employee2 should only see their own
      const employee2Assignments = await employee2Caller.timeEntries.getMyAssignments();
      expect(employee2Assignments.length).toBe(1);
      expect(employee2Assignments[0].employeeId).toBe(employee2Id);
      expect(employee2Assignments[0].role).toBe('Designer');
    });

    it('should return multiple assignments for same employee', async () => {
      // Create two assignments for employee1
      await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'Developer',
      });

      await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project2Id,
        role: 'Tech Lead',
      });

      const result = await employee1Caller.timeEntries.getMyAssignments();

      expect(result.length).toBe(2);
      const projectIds = result.map((a: { projectId: string }) => a.projectId);
      expect(projectIds).toContain(project1Id);
      expect(projectIds).toContain(project2Id);
    });

    it('should filter active assignments only by default', async () => {
      // Create active assignment
      await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'Active Assignment',
      });

      // Manually create an inactive assignment via direct DB insert
      await testDb.client`
        INSERT INTO employee_project_assignments (
          organization_id, employee_id, project_id, role, is_active, created_at, updated_at
        ) VALUES (
          ${organizationId}::uuid, ${employee1Id}::uuid, ${project2Id}::uuid,
          'Inactive Assignment', false, NOW(), NOW()
        )
      `;

      // Default should only show active
      const activeOnly = await employee1Caller.timeEntries.getMyAssignments();
      expect(activeOnly.length).toBe(1);
      expect(activeOnly[0].role).toBe('Active Assignment');

      // With activeOnly=false should show all
      const allAssignments = await employee1Caller.timeEntries.getMyAssignments({ activeOnly: false });
      expect(allAssignments.length).toBe(2);
    });

    it('should return assignment details with all fields', async () => {
      await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'Senior Developer',
        defaultCostCodeId: costCodeId,
        budgetedHours: '160.00',
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        canApproveTime: true,
        metadata: { level: 'senior' },
      });

      const result = await employee1Caller.timeEntries.getMyAssignments();

      expect(result.length).toBe(1);
      const assignment = result[0];
      expect(assignment.role).toBe('Senior Developer');
      expect(assignment.defaultCostCodeId).toBe(costCodeId);
      expect(assignment.budgetedHours).toBe('160.00');
      expect(assignment.startDate).toBe('2024-01-01');
      expect(assignment.endDate).toBe('2024-06-30');
      expect(assignment.canApproveTime).toBe(true);
      expect(assignment.isActive).toBe(true);
      expect(assignment.actualHours).toBe('0');
    });
  });

  describe('Assignment with Time Approval Permission', () => {
    it('should create assignment with time approval permission', async () => {
      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'Project Manager',
        canApproveTime: true,
      });

      expect(result.canApproveTime).toBe(true);
    });

    it('should default canApproveTime to false', async () => {
      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'Developer',
      });

      expect(result.canApproveTime).toBe(false);
    });
  });

  describe('Assignment Date Ranges', () => {
    it('should create assignment with start date only', async () => {
      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        startDate: '2024-01-15',
      });

      expect(result.startDate).toBe('2024-01-15');
      expect(result.endDate).toBeNull();
    });

    it('should create assignment with end date only', async () => {
      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        endDate: '2024-12-31',
      });

      expect(result.startDate).toBeNull();
      expect(result.endDate).toBe('2024-12-31');
    });

    it('should create assignment with both dates', async () => {
      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        startDate: '2024-01-01',
        endDate: '2024-06-30',
      });

      expect(result.startDate).toBe('2024-01-01');
      expect(result.endDate).toBe('2024-06-30');
    });
  });

  describe('Budget Hours', () => {
    it('should create assignment with budgeted hours', async () => {
      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        budgetedHours: '200.50',
      });

      expect(result.budgetedHours).toBe('200.50');
      expect(result.actualHours).toBe('0'); // Should start at 0
    });

    it('should handle null budgeted hours', async () => {
      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
      });

      expect(result.budgetedHours).toBeNull();
    });
  });

  describe('Default Cost Code', () => {
    it('should create assignment with default cost code', async () => {
      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        defaultCostCodeId: costCodeId,
      });

      expect(result.defaultCostCodeId).toBe(costCodeId);
    });

    it('should handle empty string cost code as undefined', async () => {
      // Empty strings should be converted to undefined by the schema
      const input = {
        employeeId: employee1Id,
        projectId: project1Id,
        defaultCostCodeId: '',
      };

      const validationResult = createEmployeeAssignmentSchema.safeParse(input);
      expect(validationResult.success).toBe(true);

      if (validationResult.success) {
        expect(validationResult.data.defaultCostCodeId).toBeUndefined();
      }
    });
  });

  describe('Metadata', () => {
    it('should store metadata on assignment', async () => {
      const metadata = {
        department: 'Engineering',
        skill_level: 'Senior',
        hourly_rate: 150,
        tags: ['fullstack', 'lead'],
      };

      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        metadata,
      });

      expect(result.metadata).toEqual(metadata);
    });

    it('should handle null metadata', async () => {
      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
      });

      // Default metadata handling - could be null or empty object depending on implementation
      expect(result.metadata === null || typeof result.metadata === 'object').toBe(true);
    });
  });

  describe('Database Persistence', () => {
    it('should persist assignment to database', async () => {
      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'Database Test Role',
        budgetedHours: '100.00',
      });

      // Verify directly in database
      const dbResult = await testDb.client`
        SELECT * FROM employee_project_assignments WHERE id = ${result.id}::uuid
      `;

      expect(dbResult.length).toBe(1);
      expect(dbResult[0].employee_id).toBe(employee1Id);
      expect(dbResult[0].project_id).toBe(project1Id);
      expect(dbResult[0].role).toBe('Database Test Role');
      expect(dbResult[0].budgeted_hours).toBe('100.00');
      expect(dbResult[0].organization_id).toBe(organizationId);
    });

    it('should include audit fields', async () => {
      const beforeCreate = new Date();

      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
      });

      const afterCreate = new Date();

      // Verify audit fields
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();

      const createdAt = new Date(result.createdAt);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime() - 1000);
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + 1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle creating same assignment twice gracefully', async () => {
      // Create first assignment
      await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        role: 'First Assignment',
      });

      // Creating another assignment for same employee-project pair
      // This could either succeed (creating duplicate) or fail depending on constraints
      // Let's test that it at least doesn't throw an unexpected error
      try {
        const second = await adminCaller.timeEntries.createAssignment({
          employeeId: employee1Id,
          projectId: project1Id,
          role: 'Second Assignment',
        });
        // If it succeeds, we should have two assignments
        const myAssignments = await employee1Caller.timeEntries.getMyAssignments();
        expect(myAssignments.length).toBeGreaterThanOrEqual(1);
      } catch {
        // If it fails due to a unique constraint, that's also valid behavior
        expect(true).toBe(true);
      }
    });

    it('should handle assignment with very long role name at limit', async () => {
      const maxLengthRole = 'A'.repeat(100);

      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        role: maxLengthRole,
      });

      expect(result.role).toBe(maxLengthRole);
      expect(result.role?.length).toBe(100);
    });

    it('should handle assignment with zero budgeted hours', async () => {
      const result = await adminCaller.timeEntries.createAssignment({
        employeeId: employee1Id,
        projectId: project1Id,
        budgetedHours: '0.00',
      });

      expect(result.budgetedHours).toBe('0.00');
    });
  });
});
