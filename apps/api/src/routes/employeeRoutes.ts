import { Router } from 'express';
import { getServiceContext } from '../middleware/clerk-auth';
import { employeeService, EntityListQuerySchema, CreateEntitySchema, UpdateEntitySchema, EmployeeMetadataSchema } from '@glapi/api-service';
import { z } from 'zod';

const router: Router = Router();

// Define a Zod schema for creating an employee, using the specific EmployeeMetadataSchema
const CreateEmployeePayloadSchema = CreateEntitySchema.omit({ metadata: true }).extend({
  metadata: EmployeeMetadataSchema.optional()
});

// Define a Zod schema for updating an employee, using the specific EmployeeMetadataSchema
const UpdateEmployeePayloadSchema = UpdateEntitySchema.omit({ metadata: true }).extend({
  metadata: EmployeeMetadataSchema.optional()
});

// List employees
router.get('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const query = EntityListQuerySchema.parse(req.query);
    
    const result = await employeeService.listEmployees(
      context.organizationId,
      query
    );
    
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Get employee by ID
router.get('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    const employee = await employeeService.findById(id, context.organizationId);
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    return res.json(employee);
  } catch (error) {
    return next(error);
  }
});

// Create employee
router.post('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const data = CreateEmployeePayloadSchema.parse(req.body);
    
    const employee = await employeeService.createEmployee(
      context.organizationId,
      data
    );
    
    return res.status(201).json(employee);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return next(error);
  }
});

// Update employee
router.put('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    const data = UpdateEmployeePayloadSchema.parse(req.body);
    
    const employee = await employeeService.updateEmployee(
      id,
      context.organizationId,
      data
    );
    
    return res.json(employee);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return next(error);
  }
});

// Delete employee
router.delete('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    await employeeService.delete(id, context.organizationId);
    
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

// Find employees by department
router.get('/department/:departmentId', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { departmentId } = req.params;
    
    const employees = await employeeService.findByDepartment(
      departmentId,
      context.organizationId
    );
    
    return res.json({ data: employees });
  } catch (error) {
    return next(error);
  }
});

// Find direct reports for a manager
router.get('/manager/:managerId/reports', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { managerId } = req.params;
    
    const employees = await employeeService.findDirectReports(
      managerId,
      context.organizationId
    );
    
    return res.json({ data: employees });
  } catch (error) {
    return next(error);
  }
});

// Find employee by employee ID
router.get('/employee-id/:employeeId', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { employeeId } = req.params;
    
    const employee = await employeeService.findByEmployeeId(
      employeeId,
      context.organizationId
    );
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    return res.json(employee);
  } catch (error) {
    return next(error);
  }
});

export default router;