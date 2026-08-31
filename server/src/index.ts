import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { connectMongoDB, connectPostgres } from './config/db';
import errorHandler from './middleware/errorHandler';

// Import Route Groups
import documentRoutes from './routes/documents';
import recordRoutes from './routes/records';
import authRoutes from './routes/auth';
import validationRoutes from './routes/validation';
import gisRoutes from './routes/gis';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes Binding
app.use('/api/documents', documentRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/gis', gisRoutes);

// Health Check Route
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use(errorHandler);

// Database connection & Server Boot
const bootstrap = async () => {
  try {
    // Only connect in non-test modes
    if (process.env.NODE_ENV !== 'test') {
      await connectMongoDB();
      await connectPostgres();
    }

    app.listen(env.PORT, () => {
      console.log(`[Server] LandVision backend API running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Bootstrap failure:', error);
    process.exit(1);
  }
};

bootstrap();

export default app;
