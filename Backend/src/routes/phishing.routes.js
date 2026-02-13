// AI Driven Phishing Detection API Routes
import express from 'express';
import aiService from '../services/aiService.js';
import {catchAsync} from '../utils/catchAsync.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route POST /api/phishing/analyze
 * @desc Analyze a URL for phishing indicators
 * @access Public (for browser extension)
 */
router.post('/analyze', catchAsync(async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }
    
    const result = await aiService.analyzeUrl(url);
    res.json(result);
}));

/**
 * @route POST /api/phishing/analyze-email
 * @desc Analyze email content for phishing
 * @access Public (for browser extension)
 */
router.post('/analyze-email', catchAsync(async (req, res) => {
    const { subject, body, sender, links, content } = req.body;
    
    // Support both structured and raw content
    const emailData = content 
        ? { body: content, subject: '', sender: '', links: [] }
        : { subject, body, sender, links };
    
    if (!emailData.body) {
        return res.status(400).json({
            success: false,
            error: 'Email content is required'
        });
    }
    
    const result = await aiService.analyzeEmail(emailData);
    res.json(result);
}));

/**
 * @route POST /api/phishing/analyze-page
 * @desc Analyze webpage content for phishing
 * @access Public
 */
router.post('/analyze-page', catchAsync(async (req, res) => {
    const { url, title, forms, links, textContent } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }
    
    const result = await aiService.analyzePageContent({
        url,
        title,
        forms,
        links,
        textContent
    });
    
    res.json(result);
}));

/**
 * @route GET /api/phishing/training/:topic
 * @desc Get phishing awareness training content
 * @access Protected
 */
router.get('/training/:topic', authenticate, catchAsync(async (req, res) => {
    const { topic } = req.params;
    const result = await aiService.generateTrainingContent(topic);
    res.json(result);
}));

/**
 * @route GET /api/phishing/training
 * @desc Get general phishing awareness training
 * @access Protected
 */
router.get('/training', authenticate, catchAsync(async (req, res) => {
    const result = await aiService.generateTrainingContent('general');
    res.json(result);
}));

/**
 * @route POST /api/phishing/simulation
 * @desc Generate phishing simulation for training
 * @access Protected
 */
router.post('/simulation', authenticate, catchAsync(async (req, res) => {
    const { type = 'generic', difficulty = 'medium' } = req.body;
    const result = await aiService.generatePhishingSimulation(type, difficulty);
    res.json(result);
}));

/**
 * @route POST /api/phishing/report
 * @desc Report a suspected phishing URL
 * @access Public
 */
router.post('/report', catchAsync(async (req, res) => {
    const { url, reason, reporterEmail } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }
    
    // Analyze the reported URL
    const analysis = await aiService.analyzeUrl(url);
    
    // TODO: Store report in database for review
    // await PhishingReport.create({ url, reason, reporterEmail, analysis });
    
    res.json({
        success: true,
        message: 'Report submitted successfully',
        analysis
    });
}));

/**
 * @route POST /api/phishing/bulk-analyze
 * @desc Analyze multiple URLs at once
 * @access Protected
 */
router.post('/bulk-analyze', authenticate, catchAsync(async (req, res) => {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({
            success: false,
            error: 'URLs array is required'
        });
    }
    
    if (urls.length > 10) {
        return res.status(400).json({
            success: false,
            error: 'Maximum 10 URLs allowed per request'
        });
    }
    
    const results = await Promise.all(
        urls.map(url => aiService.analyzeUrl(url))
    );
    
    res.json({
        success: true,
        results: urls.map((url, i) => ({ url, ...results[i] }))
    });
}));

export default router;
