/**
 * File Analysis Controller
 * Endpoints for uploading files and scanning them with VirusTotal API v3
 */
import prisma from '../prisma/client.js';
import { scanFile, getFileReport, computeSHA256, computeMD5 } from '../services/virusTotalService.js';
import { STATUS } from '../utils/constants/statusCodes.js';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/file/v1/scan
 * Upload a file and scan it with VirusTotal
 * Expects multipart/form-data with field "file"
 */
export const scanFileEndpoint = async (req, res) => {
  const userId = req.user.id;

  if (!req.file) {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      error: 'No file uploaded. Please attach a file.',
    });
  }

  const { path: filePath, originalname, size, mimetype } = req.file;

  try {
    // Run VirusTotal scan pipeline (upload → poll → report)
    const result = await scanFile(filePath, originalname);

    // Save scan to database
    const savedScan = await prisma.fileScan.create({
      data: {
        userId,
        fileName: originalname,
        fileSize: size,
        mimeType: mimetype,
        sha256: result.sha256,
        md5: result.md5,
        fileType: result.fileType || mimetype,
        maliciousCount: result.maliciousCount,
        suspiciousCount: result.suspiciousCount,
        harmlessCount: result.harmlessCount,
        undetectedCount: result.undetectedCount,
        totalEngines: result.totalEngines || 0,
        detections: result.detections || [],
        threatLevel: result.threat?.level || 'CLEAN',
        threatLabel: result.threat?.label || 'Clean',
        threatScore: result.threat?.score || 0,
        tags: result.tags || [],
        analysisTime: result.analysisTime,
        fromCache: result.fromCache || false,
        analysisStatus: result.analysisStatus || 'completed',
      },
    });

    return res.status(STATUS.OK).json({
      success: true,
      data: {
        scanId: savedScan.id,
        fileName: originalname,
        fileSize: size,
        mimeType: mimetype,
        sha256: result.sha256,
        md5: result.md5,
        fileType: result.fileType,
        threat: result.threat,
        detectionStats: result.detectionStats,
        totalEngines: result.totalEngines,
        maliciousCount: result.maliciousCount,
        suspiciousCount: result.suspiciousCount,
        harmlessCount: result.harmlessCount,
        undetectedCount: result.undetectedCount,
        detections: result.detections,
        tags: result.tags,
        fromCache: result.fromCache,
        analysisTime: result.analysisTime,
        analysisStatus: result.analysisStatus,
      },
    });
  } catch (error) {
    console.error('File scan error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to scan file',
      details: error.message,
    });
  } finally {
    // Clean up uploaded file
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) {}
  }
};

/**
 * GET /api/file/v1/report/:sha256
 * Get a stored or fresh report by SHA-256 hash
 */
export const getReportEndpoint = async (req, res) => {
  const { sha256 } = req.params;

  if (!sha256 || sha256.length !== 64) {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Valid SHA-256 hash is required',
    });
  }

  try {
    const report = await getFileReport(sha256);

    if (!report) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        error: 'File not found in VirusTotal database',
      });
    }

    return res.status(STATUS.OK).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('File report error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to retrieve file report',
      details: error.message,
    });
  }
};

/**
 * GET /api/file/v1/scans
 * Get all file scans for the authenticated user
 */
export const getScansEndpoint = async (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const scans = await prisma.fileScan.findMany({
      where: { userId },
      orderBy: { scannedAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        sha256: true,
        threatLevel: true,
        threatLabel: true,
        threatScore: true,
        maliciousCount: true,
        suspiciousCount: true,
        totalEngines: true,
        analysisTime: true,
        fromCache: true,
        scannedAt: true,
      },
    });

    return res.status(STATUS.OK).json({
      success: true,
      data: scans,
    });
  } catch (error) {
    console.error('List file scans error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to retrieve file scans',
    });
  }
};

/**
 * GET /api/file/v1/scans/:id
 * Get a full file scan detail
 */
export const getScanEndpoint = async (req, res) => {
  const userId = req.user.id;
  const scanId = parseInt(req.params.id);

  if (isNaN(scanId)) {
    return res.status(STATUS.BAD_REQUEST).json({ success: false, error: 'Invalid scan ID' });
  }

  try {
    const scan = await prisma.fileScan.findFirst({
      where: { id: scanId, userId },
    });

    if (!scan) {
      return res.status(STATUS.NOT_FOUND).json({ success: false, error: 'Scan not found' });
    }

    return res.status(STATUS.OK).json({ success: true, data: scan });
  } catch (error) {
    console.error('Get file scan error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to retrieve scan details',
    });
  }
};

/**
 * DELETE /api/file/v1/scans/:id
 * Delete a file scan record
 */
export const deleteScanEndpoint = async (req, res) => {
  const userId = req.user.id;
  const scanId = parseInt(req.params.id);

  if (isNaN(scanId)) {
    return res.status(STATUS.BAD_REQUEST).json({ success: false, error: 'Invalid scan ID' });
  }

  try {
    const scan = await prisma.fileScan.findFirst({
      where: { id: scanId, userId },
    });

    if (!scan) {
      return res.status(STATUS.NOT_FOUND).json({ success: false, error: 'Scan not found' });
    }

    await prisma.fileScan.delete({ where: { id: scanId } });

    return res.status(STATUS.OK).json({ success: true, message: 'Scan deleted' });
  } catch (error) {
    console.error('Delete file scan error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to delete scan',
    });
  }
};
