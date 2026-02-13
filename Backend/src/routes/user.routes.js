import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';

const userRoutes = Router();

// Public routes (no authentication required)
userRoutes.get('/profile/:id', userController.getUserProfile);

// Protected routes (authentication required)
userRoutes.get('/me', authenticate, userController.getCurrentUserProfile);
userRoutes.put('/me', authenticate, userController.updateUserProfile);


export default userRoutes;
