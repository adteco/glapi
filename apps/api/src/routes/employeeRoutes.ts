import { Router } from 'express';
import { getServiceContext } from '../middleware/clerk-auth';
import { employeeService, EntityListQuerySchema, CreateEntitySchema, UpdateEntitySchema } from '@glapi/api-service';
import { z } from 'zod';

const router = Router();

// List employees
router.get('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const query = EntityListQuerySchema.parse(req.query);
    
    const result = await employeeService.listEmployees(
      context.organizationId,
      query
    );
    
    res.json(result);
  } catch (error) {
    next(error);
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
    
    res.json(employee);
  } catch (error) {
    next(error);
  }
});

// Create employee
router.post('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const data = CreateEntitySchema.parse(req.body);
    
    const employee = await employeeService.createEmployee(
      context.organizationId,
      data
    );
    
    res.status(201).json(employee);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Update employee
router.put('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    const data = UpdateEntitySchema.parse(req.body);
    
    const employee = await employeeService.updateEmployee(
      id,
      context.organizationId,
      data
    );
    
    res.json(employee);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Delete employee
router.delete('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    await employeeService.delete(id, context.organizationId);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Find employees by department
router.get('/department/:department', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { department } = req.params;
    
    const employees = await employeeService.findByDepartment(
      department,
      context.organizationId
    );
    
    res.json({ data: employees });
  } catch (error) {
    next(error);
  }
});

// Find direct reports
router.get('/reports-to/:managerId', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { managerId } = req.params;
    
    const reports = await employeeService.findDirectReports(
      managerId,
      context.organizationId
    );
    
    res.json({ data: reports });
  } catch (error) {
    next(error);
  }
});

// Find by employee ID
router.get('/by-employee-id/:employeeId', async (req, res, next) => {
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
    
    res.json(employee);
  } catch (error) {
    next(error);
  }
});

export default router;