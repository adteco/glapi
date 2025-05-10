import express, { Request, Response, NextFunction, Router } from 'express';
import { CustomerService } from '@glapi/api-service';
import { NewCustomerSchema } from '@glapi/api-service/src/types';

const router: Router = express.Router();
const customerService = new CustomerService();

// POST /customers - Create a new customer
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = NewCustomerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body',
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const newCustomerData = validationResult.data;
    const customer = await customerService.createCustomer(newCustomerData);
    return res.status(201).json(customer);
  } catch (error) {
    // Log the error appropriately here
    next(error); // Pass to the main error handler in index.ts
  }
});

// Add other customer routes here (GET, PUT, PATCH, DELETE)

export default router; 