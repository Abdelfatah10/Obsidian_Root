// URL Analysis Routes
import express from 'express';
import { catchAsync } from '../utils/catchAsync.js';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  analyzeUrlEndpoint,
  screenshotEndpoint,
  refreshHashesEndpoint,
  getScansEndpoint,
  getScanEndpoint,
  deleteScanEndpoint,
} from '../controllers/url.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Full URL analysis (screenshot + hash + DNS + intelligence)
router.post('/analyze', catchAsync(analyzeUrlEndpoint));

// Screenshot only (lighter)
router.post('/screenshot', catchAsync(screenshotEndpoint));

// Refresh known site hashes (admin utility)
router.post('/refresh-hashes', catchAsync(refreshHashesEndpoint));

// Get all scans for user
router.get('/scans', catchAsync(getScansEndpoint));

// Get a specific scan
router.get('/scans/:id', catchAsync(getScanEndpoint));

// Delete a scan
router.delete('/scans/:id', catchAsync(deleteScanEndpoint));

export default router;
