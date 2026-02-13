import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';

const authRoutes = Router();

// Public routes
authRoutes.post('/register', authController.register);
authRoutes.post('/login', authController.login);
authRoutes.post('/login-google', authController.loginGoogle);
authRoutes.post('/verify-email', authController.verifyEmail);
authRoutes.post('/forgot-password', authController.forgotPassword);
authRoutes.post('/verify-reset-code', authController.verifyResetCode);
authRoutes.post('/reset-password', authController.resetPassword);
authRoutes.post('/refresh-token', authController.refreshToken);

// Protected routes
authRoutes.post('/logout', authenticate, authController.logout);
authRoutes.post('/change-password', authenticate, authController.changePassword);
authRoutes.get('/me', authenticate, authController.getCurrentUser);

export default authRoutes;