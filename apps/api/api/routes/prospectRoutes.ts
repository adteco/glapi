import { Router } from 'express';
import { getServiceContext } from '../middleware/clerk-auth';
import { 
  prospectService, 
  EntityListQuerySchema, 
  CreateEntitySchema, 
  UpdateEntitySchema,
  LeadProspectMetadataSchema 
} from '@glapi/api-service';
import { z } from 'zod';

const router: Router = Router();

// Define a Zod schema for creating a prospect, using the specific LeadProspectMetadataSchema
const CreateProspectPayloadSchema = CreateEntitySchema.omit({ metadata: true }).extend({
  metadata: LeadProspectMetadataSchema.optional()
});

// Define a Zod schema for updating a prospect, using the specific LeadProspectMetadataSchema
const UpdateProspectPayloadSchema = UpdateEntitySchema.omit({ metadata: true }).extend({
  metadata: LeadProspectMetadataSchema.optional()
});

// List prospects
router.get('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const query = EntityListQuerySchema.parse(req.query);
    
    const result = await prospectService.listProspects(
      context.organizationId,
      query
    );
    
    return res.json(result);
  } catch (error) {
    return next(error);
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
    
    return res.json(prospect);
  } catch (error) {
    return next(error);
  }
});

// Create prospect
router.post('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const data = CreateProspectPayloadSchema.parse(req.body);
    
    const prospect = await prospectService.createProspect(
      context.organizationId,
      data
    );
    
    return res.status(201).json(prospect);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return next(error);
  }
});

// Update prospect
router.put('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    const data = UpdateProspectPayloadSchema.parse(req.body);
    
    const prospect = await prospectService.updateProspect(
      id,
      context.organizationId,
      data
    );
    
    return res.json(prospect);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return next(error);
  }
});

// Delete prospect
router.delete('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    await prospectService.delete(id, context.organizationId);
    
    return res.status(204).send();
  } catch (error) {
    return next(error);
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
    
    return res.json(customer);
  } catch (error) {
    return next(error);
  }
});

export default router;