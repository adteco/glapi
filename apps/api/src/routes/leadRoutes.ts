import { Router } from 'express';
import { getServiceContext } from '../middleware/clerk-auth';
import { leadService, EntityListQuerySchema, CreateEntitySchema, UpdateEntitySchema } from '@glapi/api-service';
import { z } from 'zod';

const router = Router();

// List leads
router.get('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const query = EntityListQuerySchema.parse(req.query);
    
    const result = await leadService.listLeads(
      context.organizationId,
      query
    );
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get lead by ID
router.get('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    const lead = await leadService.findById(id, context.organizationId);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json(lead);
  } catch (error) {
    next(error);
  }
});

// Create lead
router.post('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const data = CreateEntitySchema.parse(req.body);
    
    const lead = await leadService.createLead(
      context.organizationId,
      data
    );
    
    res.status(201).json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Update lead
router.put('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    const data = UpdateEntitySchema.parse(req.body);
    
    const lead = await leadService.updateLead(
      id,
      context.organizationId,
      data
    );
    
    res.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Delete lead
router.delete('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    await leadService.delete(id, context.organizationId);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Convert lead to customer
router.post('/:id/convert-to-customer', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    const customer = await leadService.convertToCustomer(
      id,
      context.organizationId
    );
    
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// Find leads by source
router.get('/by-source/:source', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { source } = req.params;
    
    const leads = await leadService.findBySource(
      source,
      context.organizationId
    );
    
    res.json({ data: leads });
  } catch (error) {
    next(error);
  }
});

// Find leads by assignee
router.get('/assigned-to/:assigneeId', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { assigneeId } = req.params;
    
    const leads = await leadService.findByAssignee(
      assigneeId,
      context.organizationId
    );
    
    res.json({ data: leads });
  } catch (error) {
    next(error);
  }
});

// Get lead scoring statistics
router.get('/stats/scoring', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    
    const stats = await leadService.getLeadScoreStats(
      context.organizationId
    );
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;