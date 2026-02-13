// Email Routes - Email analyzer, Gmail integration, and CRUD operations
import express from 'express';
import { catchAsync } from '../utils/catchAsync.js';
import { authenticate } from '../middleware/authMiddleware.js';
import {
    // Gmail Integration
    getGmailAuthUrl,
    handleGmailCallback,
    getGmailStatus,
    disconnectGmail,
    syncGmailEmails,
    fetchGmailEmails,
    getGmailLabels,
    
    // Email CRUD
    getEmails,
    getEmailById,
    updateEmailReadStatus,
    updateEmailStarred,
    archiveEmail,
    deleteEmail,
    permanentDeleteEmail,
    bulkDeleteEmails,
    
    // Analysis
    analyzeEmail,
    analyzeEmailContent,
    bulkAnalyzeEmails,
    
    // Stats
    getEmailStats,
    getDashboardStats
} from '../controllers/email.controller.js';

const router = express.Router();

/* ========== Gmail Integration Routes ========== */

/**
 * @route GET /api/email/v1/gmail/auth
 * @desc Get Gmail OAuth authorization URL
 * @access Protected
 */
router.get('/gmail/auth', authenticate, catchAsync(getGmailAuthUrl));

/**
 * @route GET /api/email/v1/gmail/callback
 * @desc Handle Gmail OAuth callback
 * @access Public (OAuth redirect)
 */
router.get('/gmail/callback', catchAsync(handleGmailCallback));

/**
 * @route GET /api/email/v1/gmail/status
 * @desc Check if Gmail is connected
 * @access Protected
 */
router.get('/gmail/status', authenticate, catchAsync(getGmailStatus));

/**
 * @route DELETE /api/email/v1/gmail/disconnect
 * @desc Disconnect Gmail account
 * @access Protected
 */
router.delete('/gmail/disconnect', authenticate, catchAsync(disconnectGmail));

/**
 * @route POST /api/email/v1/gmail/sync
 * @desc Sync emails from Gmail to database
 * @access Protected
 */
router.post('/gmail/sync', authenticate, catchAsync(syncGmailEmails));

/**
 * @route GET /api/email/v1/gmail/fetch
 * @desc Fetch emails directly from Gmail (without storing)
 * @access Protected
 */
router.get('/gmail/fetch', authenticate, catchAsync(fetchGmailEmails));

/**
 * @route GET /api/email/v1/gmail/labels
 * @desc Get Gmail labels
 * @access Protected
 */
router.get('/gmail/labels', authenticate, catchAsync(getGmailLabels));

/* ========== Email CRUD Routes ========== */

/**
 * @route GET /api/email/v1/emails
 * @desc Get all stored emails for user
 * @access Protected
 * @query page, limit, isPhishing, isAnalyzed, isRead, search, sortBy, sortOrder
 */
router.get('/emails', authenticate, catchAsync(getEmails));

/**
 * @route GET /api/email/v1/emails/stats
 * @desc Get email statistics for user
 * @access Protected
 */
router.get('/emails/stats', authenticate, catchAsync(getEmailStats));

/**
 * @route GET /api/email/v1/dashboard/stats
 * @desc Get dashboard overview statistics
 * @access Protected
 */
router.get('/dashboard/stats', authenticate, catchAsync(getDashboardStats));

/**
 * @route GET /api/email/v1/emails/:id
 * @desc Get single email by ID
 * @access Protected
 */
router.get('/emails/:id', authenticate, catchAsync(getEmailById));

/**
 * @route PATCH /api/email/v1/emails/:id/read
 * @desc Mark email as read/unread
 * @access Protected
 * @body { isRead: boolean }
 */
router.patch('/emails/:id/read', authenticate, catchAsync(updateEmailReadStatus));

/**
 * @route PATCH /api/email/v1/emails/:id/star
 * @desc Star/unstar email
 * @access Protected
 * @body { isStarred: boolean }
 */
router.patch('/emails/:id/star', authenticate, catchAsync(updateEmailStarred));

/**
 * @route POST /api/email/v1/emails/:id/archive
 * @desc Archive email
 * @access Protected
 */
router.post('/emails/:id/archive', authenticate, catchAsync(archiveEmail));

/**
 * @route DELETE /api/email/v1/emails/:id
 * @desc Soft delete email (move to trash)
 * @access Protected
 */
router.delete('/emails/:id', authenticate, catchAsync(deleteEmail));

/**
 * @route DELETE /api/email/v1/emails/:id/permanent
 * @desc Permanently delete email
 * @access Protected
 */
router.delete('/emails/:id/permanent', authenticate, catchAsync(permanentDeleteEmail));

/**
 * @route POST /api/email/v1/emails/bulk-delete
 * @desc Bulk delete emails
 * @access Protected
 * @body { emailIds: number[] }
 */
router.post('/emails/bulk-delete', authenticate, catchAsync(bulkDeleteEmails));

/* ========== Analysis Routes ========== */

/**
 * @route POST /api/email/v1/emails/:id/analyze
 * @desc Analyze a stored email for phishing
 * @access Protected
 */
router.post('/emails/:id/analyze', authenticate, catchAsync(analyzeEmail));

/**
 * @route POST /api/email/v1/analyze
 * @desc Analyze email content directly (without storing)
 * @access Protected
 * @body { subject?, body, sender?, links?, content? }
 */
router.post('/analyze', authenticate, catchAsync(analyzeEmailContent));

/**
 * @route POST /api/email/v1/bulk-analyze
 * @desc Bulk analyze stored emails
 * @access Protected
 * @body { emailIds: number[] }
 */
router.post('/bulk-analyze', authenticate, catchAsync(bulkAnalyzeEmails));

export default router;
