import aiService from '../services/aiService.js';

/**
 * @desc Analyze URL for phishing
 * @route POST /api/phishing/analyze
 * @access Public
 */
export const analyzeUrl = async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }
    
    const result = await aiService.analyzeUrl(url);
    res.json(result);
};

/**
 * @desc Analyze email content for phishing
 * @route POST /api/phishing/analyze-email
 * @access Public (for browser extension)
 */
export const analyzeEmail = async (req, res) => {
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
};

/**
 * @desc Analyze webpage content for phishing
 * @route POST /api/phishing/analyze-page
 * @access Public
 */
export const analyzePage = async (req, res) => {
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
};

/**
 * @desc Get phishing awareness training content by topic
 * @route GET /api/phishing/training/:topic
 * @access Protected
 */
export const getTrainingByTopic = async (req, res) => {
    const { topic } = req.params;
    const result = await aiService.generateTrainingContent(topic);
    res.json(result);
};

/**
 * @desc Get general phishing awareness training
 * @route GET /api/phishing/training
 * @access Protected
 */
export const getTraining = async (req, res) => {
    const result = await aiService.generateTrainingContent('general');
    res.json(result);
};

/**
 * @desc Generate phishing simulation for training
 * @route POST /api/phishing/simulation
 * @access Protected
 */
export const generateSimulation = async (req, res) => {
    const { type = 'generic', difficulty = 'medium' } = req.body;
    const result = await aiService.generatePhishingSimulation(type, difficulty);
    res.json(result);
};

/**
 * @desc Report a suspected phishing URL
 * @route POST /api/phishing/report
 * @access Public
 */
export const reportPhishing = async (req, res) => {
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
};

/**
 * @desc Analyze multiple URLs at once
 * @route POST /api/phishing/bulk-analyze
 * @access Protected
 */
export const bulkAnalyze = async (req, res) => {
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
};
