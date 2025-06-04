import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import customerRoutes from './routes/customerRoutes'; // Import customer routes
import organizationRoutes from './routes/organizationRoutes'; // Import organization routes
import subsidiaryRoutes from './routes/subsidiaryRoutes'; // Import subsidiary routes
import departmentRoutes from './routes/departmentRoutes'; // Import department routes
import locationRoutes from './routes/locationRoutes'; // Import location routes
import classRoutes from './routes/classRoutes'; // Import class routes
import glRoutes from './routes/gl.router'; // Import General Ledger routes
import vendorRoutes from './routes/vendorRoutes'; // Import vendor routes
import employeeRoutes from './routes/employeeRoutes'; // Import employee routes
import leadRoutes from './routes/leadRoutes'; // Import lead routes
import prospectRoutes from './routes/prospectRoutes'; // Import prospect routes
import contactRoutes from './routes/contactRoutes'; // Import contact routes
import { clerkAuthMiddleware } from './middleware/clerk-auth'; // Import the Clerk auth middleware

// Load environment variables from .env file at the monorepo root
dotenv.config({ path: '../../.env' });

const app: Application = express();
const port = process.env.API_PORT || 3001;

// CORS configuration for allowing the web app to access the API
const corsOptions = {
  origin: process.env.WEB_URL || 'http://localhost:3000',  // Allow web app origin
  credentials: true,  // Allow cookies to be sent with requests
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id', 'x-user-id', 'x-stytch-organization-id']
};

// Middleware
app.use(cors(corsOptions)); // Enable CORS with specific options
app.use(express.json()); // Parse JSON request bodies

// Health check route
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    message: 'API is healthy'
  });
});

// Apply auth middleware to API routes
// We add it here explicitly instead of in the individual route files
app.use('/api/v1', clerkAuthMiddleware);

// Mount API routes
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/subsidiaries', subsidiaryRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/classes', classRoutes);
app.use('/api/v1/gl', glRoutes); // Mount General Ledger routes
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/prospects', prospectRoutes);
app.use('/api/v1/contacts', contactRoutes);

// Error handling middleware (simple example)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start the server
app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});

export default app; // Optional: export app for testing or other purposes