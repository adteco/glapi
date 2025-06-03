import { Router } from 'express';
import { getServiceContext } from '../middleware/clerk-auth';
import { contactService, EntityListQuerySchema, CreateEntitySchema, UpdateEntitySchema } from '@glapi/api-service';
import { z } from 'zod';

const router = Router();

// List contacts
router.get('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const query = EntityListQuerySchema.parse(req.query);
    
    const result = await contactService.listContacts(
      context.organizationId,
      query
    );
    
    res.json(result);
  } catch (error) {
    next(error);
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
    
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// Create contact
router.post('/', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const data = CreateEntitySchema.parse(req.body);
    
    const contact = await contactService.createContact(
      context.organizationId,
      data
    );
    
    res.status(201).json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Update contact
router.put('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    const data = UpdateEntitySchema.parse(req.body);
    
    const contact = await contactService.updateContact(
      id,
      context.organizationId,
      data
    );
    
    res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Delete contact
router.delete('/:id', async (req, res, next) => {
  try {
    const context = await getServiceContext(req);
    const { id } = req.params;
    
    await contactService.delete(id, context.organizationId);
    
    res.status(204).send();
  } catch (error) {
    next(error);
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
    
    res.json({ data: contacts });
  } catch (error) {
    next(error);
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
    
    res.json({ data: contacts });
  } catch (error) {
    next(error);
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
    
    res.json(result);
  } catch (error) {
    next(error);
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
    
    res.json({ data: contacts });
  } catch (error) {
    next(error);
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
    
    res.json(hierarchyObj);
  } catch (error) {
    next(error);
  }
});

export default router;