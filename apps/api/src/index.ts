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
import { combinedAuthMiddleware } from './middleware/api-key-auth'; // Import combined auth middleware

// Load environment variables from .env file at the monorepo root
dotenv.config({ path: '../../.env' });

const app: Application = express();
const port = process.env.API_PORT || 3001;

// CORS configuration for allowing the web app and docs app to access the API
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.WEB_URL || 'http://localhost:3000',
      process.env.DOCS_URL || 'https://docs.glapi.net',
      'http://localhost:3000',
      'http://localhost:3002',
      'https://web.glapi.net',
      'https://docs.glapi.net'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,  // Allow cookies to be sent with requests
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-organization-id', 'x-user-id', 'x-stytch-organization-id']
};

// Middleware
app.use(cors(corsOptions)); // Enable CORS with specific options
app.use(express.json()); // Parse JSON request bodies

// Health check route
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    message: 'API is healthy'
  });
});

// Apply combined auth middleware to API routes
// This supports both API key and Clerk JWT authentication
app.use('/', combinedAuthMiddleware);

// Mount API routes
app.use('/customers', customerRoutes);
app.use('/organizations', organizationRoutes);
app.use('/subsidiaries', subsidiaryRoutes);
app.use('/departments', departmentRoutes);
app.use('/locations', locationRoutes);
app.use('/classes', classRoutes);
app.use('/gl', glRoutes); // Mount General Ledger routes
app.use('/vendors', vendorRoutes);
app.use('/employees', employeeRoutes);
app.use('/leads', leadRoutes);
app.use('/prospects', prospectRoutes);
app.use('/contacts', contactRoutes);

// Error handling middleware (simple example)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start the server only if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });
}

module.exports = app; // Export app for Vercel