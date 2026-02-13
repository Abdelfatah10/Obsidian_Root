// AI Driven Phishing Detection API Routes
import express from 'express';
import { catchAsync } from '../utils/catchAsync.js';
import { authenticate } from '../middleware/authMiddleware.js';
import {
    analyzeUrl,
    analyzeEmail,
    analyzePage,
    getTrainingByTopic,
    getTraining,
    generateSimulation,
    reportPhishing,
    bulkAnalyze
} from '../controllers/phishing.controller.js';

const router = express.Router();

// Public routes
router.post('/analyze', catchAsync(analyzeUrl));
router.post('/analyze-email', catchAsync(analyzeEmail));
router.post('/analyze-page', catchAsync(analyzePage));
router.post('/report', catchAsync(reportPhishing));

// Protected routes
router.get('/training/:topic', authenticate, catchAsync(getTrainingByTopic));
router.get('/training', authenticate, catchAsync(getTraining));
router.post('/simulation', authenticate, catchAsync(generateSimulation));
router.post('/bulk-analyze', authenticate, catchAsync(bulkAnalyze));

export default router;
