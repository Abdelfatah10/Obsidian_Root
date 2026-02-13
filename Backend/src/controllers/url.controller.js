/**
 * URL Analysis Controller
 * Endpoints for screenshot capture, visual phishing detection, and URL intelligence
 */
import prisma from '../prisma/client.js';
import { analyzeUrl, refreshKnownHashes, takeScreenshot, computePerceptualHash, compareToKnownSites } from '../services/urlAnalysisService.js';
import { STATUS } from '../utils/constants/statusCodes.js';
import { MESSAGES } from '../utils/constants/messages.js';

/**
 * POST /api/url/v1/analyze
 * Full URL analysis: screenshot + hash comparison + DNS + URL intelligence
 */
export const analyzeUrlEndpoint = async (req, res) => {
  const userId = req.user.id;
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      error: 'URL is required',
    });
  }

  try {
    const result = await analyzeUrl(url);
    
    // Save scan to database
    const savedScan = await prisma.urlScan.create({
      data: {
        userId,
        url: result.url,
        hostname: result.hostname,
        screenshot: result.screenshot,
        screenshotHash: result.screenshotHash,
        screenshotError: result.screenshotError,
        visualMatches: result.visualMatches,
        topMatch: result.topVisualMatch?.site || null,
        topSimilarity: result.topVisualMatch?.similarity || null,
        dnsInfo: result.dns,
        urlIntel: result.urlIntel,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        riskFactors: result.riskFactors,
        isTrusted: result.isTrusted,
        analysisTime: result.analysisTime,
        knownSitesCount: result.knownSitesCount,
      },
    });
    
    return res.status(STATUS.OK).json({
      success: true,
      data: result,
      scanId: savedScan.id,
    });
  } catch (error) {
    console.error('URL analysis error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to analyze URL',
      details: error.message,
    });
  }
};

/**
 * POST /api/url/v1/screenshot
 * Take a screenshot only (lighter endpoint)
 */
export const screenshotEndpoint = async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      error: 'URL is required',
    });
  }

  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const { base64, buffer } = await takeScreenshot(normalizedUrl);
    const hash = await computePerceptualHash(buffer);
    const matches = await compareToKnownSites(hash);

    return res.status(STATUS.OK).json({
      success: true,
      data: {
        screenshot: `data:image/png;base64,${base64}`,
        hash: hash.hex,
        visualMatches: matches,
      },
    });
  } catch (error) {
    console.error('Screenshot error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to take screenshot',
      details: error.message,
    });
  }
};

/**
 * POST /api/url/v1/refresh-hashes
 * Refresh known site hashes by re-screenshotting them
 */
export const refreshHashesEndpoint = async (req, res) => {
  try {
    const results = await refreshKnownHashes();
    return res.status(STATUS.OK).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Hash refresh error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to refresh hashes',
      details: error.message,
    });
  }
};

/**
 * GET /api/url/v1/scans
 * Get all URL scans for the authenticated user
 */
export const getScansEndpoint = async (req, res) => {
  const userId = req.user.id;
  
  try {
    const scans = await prisma.urlScan.findMany({
      where: { userId },
      orderBy: { scannedAt: 'desc' },
      select: {
        id: true,
        url: true,
        hostname: true,
        riskScore: true,
        riskLevel: true,
        isTrusted: true,
        topMatch: true,
        topSimilarity: true,
        analysisTime: true,
        scannedAt: true,
      },
    });
    
    return res.status(STATUS.OK).json({
      success: true,
      data: scans,
    });
  } catch (error) {
    console.error('Get scans error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to retrieve scans',
      details: error.message,
    });
  }
};

/**
 * GET /api/url/v1/scans/:id
 * Get a specific URL scan by ID
 */
export const getScanEndpoint = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  
  try {
    const scan = await prisma.urlScan.findUnique({
      where: { id: parseInt(id) },
    });
    
    if (!scan || scan.userId !== userId) {
      return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Scan not found',
      });
    }
    
    return res.status(STATUS.OK).json({
      success: true,
      data: scan,
    });
  } catch (error) {
    console.error('Get scan error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to retrieve scan',
      details: error.message,
    });
  }
};

/**
 * DELETE /api/url/v1/scans/:id
 * Delete a URL scan
 */
export const deleteScanEndpoint = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  
  try {
    const scan = await prisma.urlScan.findUnique({
      where: { id: parseInt(id) },
    });
    
    if (!scan || scan.userId !== userId) {
      return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Scan not found',
      });
    }
    
    await prisma.urlScan.delete({
      where: { id: parseInt(id) },
    });
    
    return res.status(STATUS.OK).json({
      success: true,
      message: 'Scan deleted successfully',
    });
  } catch (error) {
    console.error('Delete scan error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to delete scan',
      details: error.message,
    });
  }
};
