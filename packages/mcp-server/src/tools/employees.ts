import type { MCPServer } from '../mcp/server';
import type { AuthContext } from '../mcp/types';
import { createBackendClient, handleAPIError } from '../services/trpc-client';
import { createToolResponse, createDataResponse } from './index';
import { checkPermission } from '../mcp/auth';

// Type for employee from the API
interface Employee {
  id?: string;
  organizationId: string;
  employeeCode?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  departmentId?: string | null;
  status: 'active' | 'inactive' | 'terminated';
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Register employee management tools
 */
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
            enum: ['active', 'inactive', 'terminated', 'all'],
            description: 'Filter by employee status',
            default: 'active',
          },
          departmentId: {
            type: 'string',
            description: 'Filter by department ID',
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
        checkPermission(context, 'employees:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const employees: Employee[] = await client.employees.list.query({});
        
        // Filter employees based on search term if provided
        let filteredEmployees = employees;
        if (args.search) {
          const searchLower = args.search.toLowerCase();
          filteredEmployees = employees.filter((employee: Employee) => 
            employee.firstName.toLowerCase().includes(searchLower) ||
            employee.lastName.toLowerCase().includes(searchLower) ||
            (employee.email && employee.email.toLowerCase().includes(searchLower)) ||
            (employee.employeeCode && employee.employeeCode.toLowerCase().includes(searchLower))
          );
        }
        
        // Apply status filter
        if (args.status !== 'all') {
          filteredEmployees = filteredEmployees.filter((e: Employee) => e.status === args.status);
        }
        
        // Apply department filter
        if (args.departmentId) {
          filteredEmployees = filteredEmployees.filter((e: Employee) => e.departmentId === args.departmentId);
        }
        
        // Apply limit
        const limitedEmployees = filteredEmployees.slice(0, args.limit || 50);
        
        if (limitedEmployees.length === 0) {
          return createToolResponse('No employees found matching the criteria.');
        }
        
        const summary = `Found ${limitedEmployees.length} employee(s):`;
        
        return createDataResponse(summary, {
          employees: limitedEmployees.map((employee: Employee) => ({
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            employeeCode: employee.employeeCode || 'N/A',
            email: employee.email || 'N/A',
            phone: employee.phone || 'N/A',
            title: employee.title || 'N/A',
            department: employee.departmentId || 'N/A',
            status: employee.status,
            createdAt: employee.createdAt,
          })),
        });
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Get employee by ID
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
        checkPermission(context, 'employees:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const employee: Employee = await client.employees.get.query({ id: args.id });
        
        return createDataResponse(
          `Employee details for ${employee.firstName} ${employee.lastName}:`,
          {
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            employeeCode: employee.employeeCode,
            email: employee.email || 'N/A',
            phone: employee.phone || 'N/A',
            title: employee.title || 'N/A',
            departmentId: employee.departmentId,
            status: employee.status,
            metadata: employee.metadata,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Create new employee
  server.registerTool(
    {
      name: 'create_employee',
      description: 'Create a new employee record',
      inputSchema: {
        type: 'object',
        properties: {
          firstName: {
            type: 'string',
            description: 'Employee first name',
          },
          lastName: {
            type: 'string',
            description: 'Employee last name',
          },
          employeeCode: {
            type: 'string',
            description: 'Unique employee code/ID',
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
          title: {
            type: 'string',
            description: 'Job title',
          },
          departmentId: {
            type: 'string',
            description: 'Department ID (UUID)',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive'],
            description: 'Employee status',
            default: 'active',
          },
        },
        required: ['firstName', 'lastName'],
      },
    },
    async (args, context) => {
      try {
        console.log('[Employees Tool] Create employee called with:', args);
        
        checkPermission(context, 'employees:create');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        console.log('[Employees Tool] Calling tRPC to create employee...');
        const employee: Employee = await client.employees.create.mutate({
          organizationId: context.organizationId,
          firstName: args.firstName,
          lastName: args.lastName,
          employeeCode: args.employeeCode || undefined,
          email: args.email || undefined,
          phone: args.phone || undefined,
          title: args.title || undefined,
          departmentId: args.departmentId || undefined,
          status: args.status || 'active',
        });
        console.log('[Employees Tool] Employee created:', employee);
        
        return createDataResponse(
          `✅ Successfully created employee "${employee.firstName} ${employee.lastName}"`,
          {
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            employeeCode: employee.employeeCode,
            email: employee.email || 'N/A',
            phone: employee.phone || 'N/A',
            title: employee.title || 'N/A',
            status: employee.status,
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
          firstName: {
            type: 'string',
            description: 'Employee first name',
          },
          lastName: {
            type: 'string',
            description: 'Employee last name',
          },
          employeeCode: {
            type: 'string',
            description: 'Unique employee code/ID',
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
          title: {
            type: 'string',
            description: 'Job title',
          },
          departmentId: {
            type: 'string',
            description: 'Department ID (UUID)',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'terminated'],
            description: 'Employee status',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        console.log('[Employees Tool] Update employee called with:', args);
        
        checkPermission(context, 'employees:update');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        // Build update data - only include fields that were provided
        const updateData: any = {};
        if (args.firstName !== undefined) updateData.firstName = args.firstName;
        if (args.lastName !== undefined) updateData.lastName = args.lastName;
        if (args.employeeCode !== undefined) updateData.employeeCode = args.employeeCode;
        if (args.email !== undefined) updateData.email = args.email;
        if (args.phone !== undefined) updateData.phone = args.phone;
        if (args.title !== undefined) updateData.title = args.title;
        if (args.departmentId !== undefined) updateData.departmentId = args.departmentId;
        if (args.status !== undefined) updateData.status = args.status;
        
        console.log('[Employees Tool] Calling tRPC to update employee...');
        const employee: Employee = await client.employees.update.mutate({
          id: args.id,
          data: updateData,
        });
        console.log('[Employees Tool] Employee updated:', employee);
        
        return createDataResponse(
          `✅ Successfully updated employee "${employee.firstName} ${employee.lastName}"`,
          {
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            employeeCode: employee.employeeCode,
            email: employee.email || 'N/A',
            phone: employee.phone || 'N/A',
            title: employee.title || 'N/A',
            status: employee.status,
            updatedAt: employee.updatedAt,
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Delete employee
  server.registerTool(
    {
      name: 'delete_employee',
      description: 'Delete an employee record',
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
        console.log('[Employees Tool] Delete employee called with:', args);
        
        checkPermission(context, 'employees:delete');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        // Get employee name before deletion for confirmation
        const employee: Employee = await client.employees.get.query({ id: args.id });
        const employeeName = `${employee.firstName} ${employee.lastName}`;
        
        console.log('[Employees Tool] Calling tRPC to delete employee...');
        await client.employees.delete.mutate(args.id);
        console.log('[Employees Tool] Employee deleted');
        
        return createToolResponse(
          `✅ Successfully deleted employee "${employeeName}"`
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );
}