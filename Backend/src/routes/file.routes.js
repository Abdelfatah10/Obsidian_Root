// File Analysis Routes – VirusTotal file scanning
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { catchAsync } from '../utils/catchAsync.js';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  scanFileEndpoint,
  getReportEndpoint,
  getScansEndpoint,
  getScanEndpoint,
  deleteScanEndpoint,
} from '../controllers/file.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temp uploads directory for VT scans
const vtUploadsDir = path.join(__dirname, '../../uploads/vt-temp');
if (!fs.existsSync(vtUploadsDir)) fs.mkdirSync(vtUploadsDir, { recursive: true });

// Multer config – allow common file types up to 32 MB
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, vtUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${name}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 32 * 1024 * 1024 }, // 32 MB (VT limit for direct upload)
});

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Upload & scan a file
router.post('/scan', upload.single('file'), catchAsync(scanFileEndpoint));

// Get VT report by SHA-256
router.get('/report/:sha256', catchAsync(getReportEndpoint));

// User scan history
router.get('/scans', catchAsync(getScansEndpoint));

// Single scan detail
router.get('/scans/:id', catchAsync(getScanEndpoint));

// Delete scan
router.delete('/scans/:id', catchAsync(deleteScanEndpoint));

export default router;
