import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';


// Import environment variables and middleware
import { ENV } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';


// Get the current directory path 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express application
const app = express();


// Configure CORS (Cross-Origin Resource Sharing) middleware
app.use(cors({
    origin: ENV.DOMAIN_URL || 'http://localhost:9000',
    credentials: true
}));

// Middleware for parsing incoming request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded files as static assets
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});



// Mount Routes
app.use('/api/auth/v1', authRoutes);
app.use('/api/users/v1', userRoutes);








// 404 Not Found Handler
app.use(notFoundHandler);

// Global Error Handling Middleware
app.use(errorHandler);


export default app;