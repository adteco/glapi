import { Router } from 'express';
import { getServiceContext } from '../middleware/clerk-auth';
import { prospectService, EntityListQuerySchema, CreateEntitySchema, UpdateEntitySchema } from '@repo/api-service';
import { z } from 'zod';

const router = Router();

// List prospects
router.get('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const query = EntityListQuerySchema.parse(req.query);
    
    const result = await prospectService.listProspects(
      context.organizationId,
      query
    );
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get prospect by ID
router.get('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    const prospect = await prospectService.findById(id, context.organizationId);
    
    if (!prospect) {
      return res.status(404).json({ error: 'Prospect not found' });
    }
    
    res.json(prospect);
  } catch (error) {
    next(error);
  }
});

// Create prospect
router.post('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const data = CreateEntitySchema.parse(req.body);
    
    const prospect = await prospectService.createProspect(
      context.organizationId,
      data
    );
    
    res.status(201).json(prospect);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Update prospect
router.put('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    const data = UpdateEntitySchema.parse(req.body);
    
    const prospect = await prospectService.updateProspect(
      id,
      context.organizationId,
      data
    );
    
    res.json(prospect);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Delete prospect
router.delete('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    await prospectService.delete(id, context.organizationId);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Convert prospect to lead
router.post('/:id/convert-to-lead', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    const lead = await prospectService.convertToLead(
      id,
      context.organizationId
    );
    
    res.json(lead);
  } catch (error) {
    next(error);
  }
});

// Convert prospect to customer
router.post('/:id/convert-to-customer', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    const customer = await prospectService.convertToCustomer(
      id,
      context.organizationId
    );
    
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// Find prospects by industry
router.get('/by-industry/:industry', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { industry } = req.params;
    
    const prospects = await prospectService.findByIndustry(
      industry,
      context.organizationId
    );
    
    res.json({ data: prospects });
  } catch (error) {
    next(error);
  }
});

// Find high-value prospects
router.get('/high-value', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const minRevenue = req.query.minRevenue ? Number(req.query.minRevenue) : 1000000;
    
    const prospects = await prospectService.findHighValueProspects(
      context.organizationId,
      minRevenue
    );
    
    res.json({ data: prospects });
  } catch (error) {
    next(error);
  }
});

export default router;