import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import customerRoutes from './routes/customerRoutes'; // Import customer routes
import organizationRoutes from './routes/organizationRoutes'; // Import organization routes
import subsidiaryRoutes from './routes/subsidiaryRoutes'; // Import subsidiary routes
import { authMiddleware } from './middleware/auth'; // Import the auth middleware

// Load environment variables from .env file at the monorepo root
dotenv.config({ path: '../../.env' });

const app = express();
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
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    message: 'API is healthy'
  });
});

// Apply auth middleware to API routes
// We add it here explicitly instead of in the individual route files
app.use('/api/v1', authMiddleware);

// Mount API routes
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/subsidiaries', subsidiaryRoutes);

// Error handling middleware (simple example)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start the server
app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});

export default app; // Optional: export app for testing or other purposes