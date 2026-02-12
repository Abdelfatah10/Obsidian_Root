import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { singleFileUpload } from '../middleware/uploadMiddleware.js';
import { ROLES } from '../utils/constants/roles.js';

const userRoutes = Router();

// Public routes (no authentication required)
userRoutes.get('/profile/:id', userController.getUserProfile);

// Protected routes (authentication required)
userRoutes.get('/me', authenticate, userController.getCurrentUserProfile);
userRoutes.put('/me', authenticate, userController.updateUserProfile);
userRoutes.post('/avatar', authenticate, singleFileUpload, userController.uploadProfilePhoto);

// Admin routes (admin role required)
userRoutes.get('/', authenticate, authorize([ROLES.ADMIN]), userController.getAllUsers);
userRoutes.get('/search', authenticate, authorize([ROLES.ADMIN]), userController.searchUsers);
userRoutes.get('/stats/overview', authenticate, authorize([ROLES.ADMIN]), userController.getUserStatistics);
userRoutes.put('/:id/role', authenticate, authorize([ROLES.ADMIN]), userController.updateUserRole);
userRoutes.delete('/:id', authenticate, authorize([ROLES.ADMIN]), userController.deleteUser);

export default userRoutes;
