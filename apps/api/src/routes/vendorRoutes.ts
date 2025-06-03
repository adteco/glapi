import { Router } from 'express';
import { getServiceContext } from '../middleware/clerk-auth';
import { vendorService, EntityListQuerySchema, CreateEntitySchema, UpdateEntitySchema } from '@repo/api-service';
import { z } from 'zod';

const router = Router();

// List vendors
router.get('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const query = EntityListQuerySchema.parse(req.query);
    
    const result = await vendorService.listVendors(
      context.organizationId,
      query
    );
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get vendor by ID
router.get('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    const vendor = await vendorService.findById(id, context.organizationId);
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

// Create vendor
router.post('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const data = CreateEntitySchema.parse(req.body);
    
    const vendor = await vendorService.createVendor(
      context.organizationId,
      data
    );
    
    res.status(201).json(vendor);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Update vendor
router.put('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    const data = UpdateEntitySchema.parse(req.body);
    
    const vendor = await vendorService.updateVendor(
      id,
      context.organizationId,
      data
    );
    
    res.json(vendor);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Delete vendor
router.delete('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    await vendorService.delete(id, context.organizationId);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Find vendor by EIN
router.get('/by-ein/:ein', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { ein } = req.params;
    
    const vendor = await vendorService.findByEIN(ein, context.organizationId);
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

export default router;