import { Router } from 'express';
import { getServiceContext } from '../middleware/clerk-auth';
import { 
  vendorService, 
  EntityListQuerySchema, 
  CreateEntitySchema, 
  UpdateEntitySchema,
  VendorMetadataSchema 
} from '@glapi/api-service';
import { z } from 'zod';

const router: Router = Router();

// Define a Zod schema for creating a vendor, using the specific VendorMetadataSchema
const CreateVendorPayloadSchema = CreateEntitySchema.omit({ metadata: true }).extend({
  metadata: VendorMetadataSchema.optional()
});

// Define a Zod schema for updating a vendor, using the specific VendorMetadataSchema
const UpdateVendorPayloadSchema = UpdateEntitySchema.omit({ metadata: true }).extend({
  metadata: VendorMetadataSchema.optional()
});

// List vendors
router.get('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const query = EntityListQuerySchema.parse(req.query);
    
    const result = await vendorService.listVendors(
      context.organizationId,
      query
    );
    
    return res.json(result);
  } catch (error) {
    return next(error);
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
    
    return res.json(vendor);
  } catch (error) {
    return next(error);
  }
});

// Create vendor
router.post('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const data = CreateVendorPayloadSchema.parse(req.body);
    
    const vendor = await vendorService.createVendor(
      context.organizationId,
      data
    );
    
    return res.status(201).json(vendor);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return next(error);
  }
});

// Update vendor
router.put('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    const data = UpdateVendorPayloadSchema.parse(req.body);
    
    const vendor = await vendorService.updateVendor(
      id,
      context.organizationId,
      data
    );
    
    return res.json(vendor);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return next(error);
  }
});

// Delete vendor
router.delete('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    await vendorService.delete(id, context.organizationId);
    
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

// Find vendor by EIN
router.get('/ein/:ein', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { ein } = req.params;
    
    const vendor = await vendorService.findByEIN(
      ein,
      context.organizationId
    );
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    return res.json(vendor);
  } catch (error) {
    return next(error);
  }
});

export default router;