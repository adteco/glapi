import { Router } from 'express';
import { getServiceContext } from '../middleware/clerk-auth';
import { 
  contactService, 
  EntityListQuerySchema, 
  CreateEntitySchema, // Base schema for creation
  UpdateEntitySchema, // Base schema for updates
  ContactMetadataSchema // Specific metadata schema for contacts
} from '@glapi/api-service';
import { z } from 'zod';

const router: Router = Router();

// Define a Zod schema for creating a contact, using the specific ContactMetadataSchema
const CreateContactPayloadSchema = CreateEntitySchema.omit({ metadata: true }).extend({
  metadata: ContactMetadataSchema.optional() 
});

// Define a Zod schema for updating a contact, using the specific ContactMetadataSchema
const UpdateContactPayloadSchema = UpdateEntitySchema.omit({ metadata: true }).extend({
  metadata: ContactMetadataSchema.optional()
});

// List contacts
router.get('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const query = EntityListQuerySchema.parse(req.query);
    
    const result = await contactService.listContacts(
      context.organizationId,
      query
    );
    
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Get contact by ID
router.get('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    const contact = await contactService.findById(id, context.organizationId);
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    return res.json(contact);
  } catch (error) {
    return next(error);
  }
});

// Create contact
router.post('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    // Use the new schema for parsing
    const data = CreateContactPayloadSchema.parse(req.body);
    
    const contact = await contactService.createContact(
      context.organizationId,
      data
    );
    
    return res.status(201).json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return next(error);
  }
});

// Update contact
router.put('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    // Use the new schema for parsing
    const data = UpdateContactPayloadSchema.parse(req.body);
    
    const contact = await contactService.updateContact(
      id,
      context.organizationId,
      data
    );
    
    return res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return next(error);
  }
});

// Delete contact
router.delete('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    await contactService.delete(id, context.organizationId);
    
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

// Find contacts by company
router.get('/company/:companyId', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { companyId } = req.params;
    
    const contacts = await contactService.findByCompany(
      companyId,
      context.organizationId
    );
    
    return res.json({ data: contacts });
  } catch (error) {
    return next(error);
  }
});

// Find contacts by department
router.get('/department/:department', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { department } = req.params;
    
    const contacts = await contactService.findByDepartment(
      department,
      context.organizationId
    );
    
    return res.json({ data: contacts });
  } catch (error) {
    return next(error);
  }
});

// Set as primary contact
router.post('/:id/set-primary/:companyId', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id, companyId } = req.params;
    
    const result = await contactService.setAsPrimaryContact(
      id,
      companyId,
      context.organizationId
    );
    
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Find contacts by preferred contact method
router.get('/contact-method/:method', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { method } = req.params;
    
    if (!['email', 'phone', 'mobile'].includes(method)) {
      return res.status(400).json({ error: 'Invalid contact method' });
    }
    
    const contacts = await contactService.findByContactMethod(
      method as 'email' | 'phone' | 'mobile',
      context.organizationId
    );
    
    return res.json({ data: contacts });
  } catch (error) {
    return next(error);
  }
});

// Get contact hierarchy
router.get('/hierarchy', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    
    const hierarchy = await contactService.getContactHierarchy(
      context.organizationId
    );
    
    // Convert Map to object for JSON serialization
    const hierarchyObj: Record<string, any[]> = {};
    hierarchy.forEach((value, key) => {
      hierarchyObj[key] = value;
    });
    
    return res.json(hierarchyObj);
  } catch (error) {
    return next(error);
  }
});

export default router;