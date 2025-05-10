import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import customerRoutes from './routes/customerRoutes'; // Import customer routes

// Load environment variables from .env file at the monorepo root
dotenv.config({ path: '../../.env' });

const app = express();
const port = process.env.API_PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', message: 'API is healthy' });
});

// Mount customer routes
app.use('/api/v1/customers', customerRoutes);

// Error handling middleware (simple example)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});

export default app; // Optional: export app for testing or other purposes 