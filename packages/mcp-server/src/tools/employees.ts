import type { MCPServer } from '../mcp/server';
import type { AuthContext } from '../mcp/types';
import { createBackendClient, handleAPIError } from '../services/trpc-client';
import { createToolResponse, createDataResponse } from './index';
import { checkPermission } from '../mcp/auth';

// Type for entity list response
interface EntityListResponse {
  data: BaseEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Type for employee from the API (BaseEntity)
interface BaseEntity {
  id: string;
  organizationId: string;
  name: string;
  displayName?: string | null;
  code?: string | null;
  entityTypes: string[];
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: any;
  parentEntityId?: string | null;
  primaryContactId?: string | null;
  taxId?: string | null;
  description?: string | null;
  notes?: string | null;
  customFields?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  status: 'active' | 'inactive' | 'archived';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function registerEmployeeTools(server: MCPServer): void {
  // List employees
  server.registerTool(
    {
      name: 'list_employees',
      description: 'Retrieve and search employee records with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for employee name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by employee status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of employees to return',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const result: EntityListResponse = await client.employees.list.query({
          search: args.search,
          isActive: args.status === 'all' ? undefined : args.status === 'active',
          limit: args.limit || 50,
          page: 1,
        });

        const employees = result.data;
        
        if (employees.length === 0) {
          return createToolResponse('No employees found matching the criteria.');
        }

        const summary = `Found ${employees.length} employee(s):`;
        
        return createDataResponse(summary, {
          total: result.total,
          employees: employees.map(employee => ({
            id: employee.id,
            name: employee.name,
            email: employee.email || 'N/A',
            phone: employee.phone || 'N/A',
            status: employee.status,
            type: employee.entityTypes.join(', '),
            metadata: employee.metadata || {},
            createdAt: employee.createdAt,
          })),
        });
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Get employee details
  server.registerTool(
    {
      name: 'get_employee',
      description: 'Get detailed information for a specific employee',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Employee ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const employee = await client.employees.getById.query({ id: args.id });
        
        if (!employee) {
          return createToolResponse(`Employee with ID ${args.id} not found`, true);
        }
        
        return createDataResponse(
          `Employee details for ${employee.name}:`,
          {
            id: employee.id,
            name: employee.name,
            email: employee.email || 'N/A',
            phone: employee.phone || 'N/A',
            status: employee.status,
            type: employee.entityTypes.join(', '),
            metadata: employee.metadata || {},
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Create employee
  server.registerTool(
    {
      name: 'create_employee',
      description: 'Create a new employee record',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Employee full name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Employee email address',
          },
          phone: {
            type: 'string',
            description: 'Employee phone number',
          },
          employeeId: {
            type: 'string',
            description: 'Employee ID or code',
          },
          department: {
            type: 'string',
            description: 'Department name',
          },
          title: {
            type: 'string',
            description: 'Job title',
          },
        },
        required: ['name'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:create');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const employee: BaseEntity = await client.employees.create.mutate({
          name: args.name,
          email: args.email,
          phone: args.phone,
          isActive: true,
          metadata: {
            employee_id: args.employeeId,
            department: args.department,
            position: args.title,
          },
        });
        
        return createDataResponse(
          `Successfully created employee: ${employee.name}`,
          {
            id: employee.id,
            name: employee.name,
            email: employee.email || 'N/A',
            phone: employee.phone || 'N/A',
            status: employee.status,
            metadata: employee.metadata || {},
            createdAt: employee.createdAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Update employee
  server.registerTool(
    {
      name: 'update_employee',
      description: 'Update an existing employee record',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Employee ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Employee full name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Employee email address',
          },
          phone: {
            type: 'string',
            description: 'Employee phone number',
          },
          employeeId: {
            type: 'string',
            description: 'Employee ID or code',
          },
          department: {
            type: 'string',
            description: 'Department name',
          },
          title: {
            type: 'string',
            description: 'Job title',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Employee status',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:update');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const updateData: any = {};
        if (args.name !== undefined) updateData.name = args.name;
        if (args.email !== undefined) updateData.email = args.email;
        if (args.phone !== undefined) updateData.phone = args.phone;
        if (args.status !== undefined) {
          updateData.status = args.status;
          updateData.isActive = args.status === 'active';
        }
        
        // Handle metadata updates
        if (args.employeeId !== undefined || args.department !== undefined || args.title !== undefined) {
          updateData.metadata = {
            ...(args.employeeId && { employee_id: args.employeeId }),
            ...(args.department && { department: args.department }),
            ...(args.title && { title: args.title }),
          };
        }
        
        const employee: BaseEntity = await client.employees.update.mutate({
          id: args.id,
          data: updateData,
        });
        
        return createDataResponse(
          `Successfully updated employee: ${employee.name}`,
          {
            id: employee.id,
            name: employee.name,
            email: employee.email || 'N/A',
            phone: employee.phone || 'N/A',
            status: employee.status,
            metadata: employee.metadata || {},
            updatedAt: employee.updatedAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  console.log('Employee tools registered successfully');
}