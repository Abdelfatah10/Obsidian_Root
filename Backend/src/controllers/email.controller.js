// Email Controller - CRUD operations and Gmail integration
import prisma from '../prisma/client.js';
import aiService from '../services/aiService.js';
import gmailService from '../services/gmailService.js';

const PREDICT_API_URL = 'https://web-production-f1b0d.up.railway.app/predict';

/**
 * Call external phishing prediction API
 */
async function predictPhishing({ subject, body, has_url }) {
    const response = await fetch(PREDICT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject || '', body: body || '', has_url: !!has_url })
    });
    
    if (!response.ok) {
        throw new Error(`Predict API returned ${response.status}`);
    }
    
    const data = await response.json();
    // Map external API response to our internal format
    const confidence = (data.confidence || 0) * 100;
    const isPhishing = data.label === 'Phishing';
    const score = confidence;
    
    let recommendation = 'safe';
    if (data.verdict === 'CRITICAL' || data.verdict === 'HIGH') recommendation = 'danger';
    else if (data.verdict === 'MEDIUM' || data.label === 'Uncertain') recommendation = 'caution';
    
    const indicators = [];
    if (isPhishing) indicators.push(`Verdict: ${data.verdict}`);
    if (has_url) indicators.push('Contains URLs');
    if (data.sender_analysis) indicators.push(`Sender: ${data.sender_analysis}`);
    if (data.recommended_action) indicators.push(data.recommended_action);
    
    return {
        success: true,
        isPhishing,
        phishingScore: parseFloat(score.toFixed(1)),
        confidence: parseFloat(confidence.toFixed(1)),
        indicators,
        reason: data.recommended_action || `${data.label} - ${data.verdict}`,
        recommendation,
        verdict: data.verdict,
        label: data.label,
        aiAnalysis: true
    };
}

/**
 * Get Gmail authorization URL
 */
export const getGmailAuthUrl = async (req, res) => {
    const userId = req.user.id;
    try {
        const authUrl = gmailService.getAuthUrl(userId);
        
        if (!authUrl) {
            throw new Error('Failed to generate Gmail authorization URL');
        }
        
        res.json({
            success: true,
            data: { authUrl }
        });
    } catch (error) {
        console.error('Error getting Gmail auth URL:', error);
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: {
                status: STATUS.INTERNAL_SERVER_ERROR,
                message: error.message || 'Failed to generate Gmail authorization URL'
            }
        });
    }
};

/**
 * Handle Gmail OAuth callback
 */
export const handleGmailCallback = async (req, res) => {
    const { code, state } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || process.env.DOMAIN_URL || 'http://localhost:9000';
    
    console.log('Gmail callback received:', { code: !!code, state, frontendUrl });
    
    if (!code) {
        const redirectUrl = `${frontendUrl}/dashboard/settings?gmail=error&reason=no_code`;
        console.log('Redirecting to:', redirectUrl);
        return res.redirect(redirectUrl);
    }
    
    try {
        const { userId } = JSON.parse(state || '{}');
        
        if (!userId) {
            const redirectUrl = `${frontendUrl}/dashboard/settings?gmail=error&reason=no_user`;
            console.log('Redirecting to:', redirectUrl);
            return res.redirect(redirectUrl);
        }
        
        await gmailService.handleOAuthCallback(code, userId);
        
        const redirectUrl = `${frontendUrl}/dashboard/settings?gmail=connected`;
        console.log('Redirecting to:', redirectUrl);
        res.redirect(redirectUrl);
    } catch (error) {
        console.error('Gmail OAuth error:', error);
        const redirectUrl = `${frontendUrl}/dashboard/settings?gmail=error&reason=${encodeURIComponent(error.message)}`;
        console.log('Redirecting to:', redirectUrl);
        res.redirect(redirectUrl);
    }
};

/**
 * Check Gmail connection status
 */
export const getGmailStatus = async (req, res) => {
    const userId = req.user.id;
    const connected = await gmailService.isGmailConnected(userId);
    
    res.json({
        success: true,
        data: { connected }
    });
};

/**
 * Disconnect Gmail
 */
export const disconnectGmail = async (req, res) => {
    const userId = req.user.id;
    await gmailService.disconnectGmail(userId);
    
    res.json({
        success: true,
        message: 'Gmail disconnected successfully'
    });
};

/**
 * Sync emails from Gmail
 */
export const syncGmailEmails = async (req, res) => {
    const userId = req.user.id;
    const { maxResults = 50 } = req.body;
    
    const result = await gmailService.syncEmails(userId, { maxResults });
    
    res.json({
        success: true,
        message: `Synced ${result.synced} emails`,
        data: result
    });
};

/**
 * Fetch emails directly from Gmail (without storing)
 */
export const fetchGmailEmails = async (req, res) => {
    const userId = req.user.id;
    const { maxResults = 20, query, labelIds, pageToken } = req.query;
    
    const result = await gmailService.fetchEmails(userId, {
        maxResults: parseInt(maxResults),
        query,
        labelIds: labelIds ? labelIds.split(',') : undefined,
        pageToken
    });
    
    res.json({
        success: true,
        data: result
    });
};

/**
 * Get Gmail labels
 */
export const getGmailLabels = async (req, res) => {
    const userId = req.user.id;
    const labels = await gmailService.getLabels(userId);
    
    res.json({
        success: true,
        data: { labels }
    });
};

/**
 * Get all stored emails for user
 */
export const getEmails = async (req, res) => {
    const userId = req.user.id;
    const { 
        page = 1, 
        limit = 20, 
        isPhishing, 
        isAnalyzed,
        isRead,
        search,
        sortBy = 'receivedAt',
        sortOrder = 'desc'
    } = req.query;
    
    const where = {
        userId,
        isDeleted: false
    };
    
    if (isPhishing !== undefined) {
        where.isPhishing = isPhishing === 'true';
    }
    
    if (isAnalyzed !== undefined) {
        where.isAnalyzed = isAnalyzed === 'true';
    }
    
    if (isRead !== undefined) {
        where.isRead = isRead === 'true';
    }
    
    if (search) {
        where.OR = [
            { subject: { contains: search, mode: 'insensitive' } },
            { sender: { contains: search, mode: 'insensitive' } },
            { senderName: { contains: search, mode: 'insensitive' } },
            { snippet: { contains: search, mode: 'insensitive' } }
        ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [emails, total] = await Promise.all([
        prisma.email.findMany({
            where,
            skip,
            take: parseInt(limit),
            orderBy: { [sortBy]: sortOrder },
            select: {
                id: true,
                gmailId: true,
                subject: true,
                sender: true,
                senderName: true,
                snippet: true,
                isAnalyzed: true,
                isPhishing: true,
                phishingScore: true,
                recommendation: true,
                isRead: true,
                isStarred: true,
                labels: true,
                receivedAt: true,
                createdAt: true
            }
        }),
        prisma.email.count({ where })
    ]);
    
    res.json({
        success: true,
        data: {
            emails,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        }
    });
};

/**
 * Get single email by ID
 */
export const getEmailById = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    
    const email = await prisma.email.findFirst({
        where: {
            id: parseInt(id),
            userId,
            isDeleted: false
        }
    });
    
    if (!email) {
        return res.status(404).json({
            success: false,
            error: { status: 404, message: 'Email not found' }
        });
    }
    
    res.json({
        success: true,
        data: email
    });
};

/**
 * Analyze a stored email
 */
export const analyzeEmail = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    
    const email = await prisma.email.findFirst({
        where: {
            id: parseInt(id),
            userId,
            isDeleted: false
        }
    });
    
    if (!email) {
        return res.status(404).json({
            success: false,
            error: { status: 404, message: 'Email not found' }
        });
    }
    
    // Check if body contains URLs
    const linkRegex = /https?:\/\/[^\s<>"']+/gi;
    const links = email.body ? (email.body.match(linkRegex) || []) : [];
    const has_url = links.length > 0;
    
    // Analyze with external predict API
    const analysis = await predictPhishing({
        subject: email.subject || '',
        body: email.bodyPlain || email.body || '',
        has_url
    });
    
    // Update email with analysis results
    const updatedEmail = await prisma.email.update({
        where: { id: parseInt(id) },
        data: {
            isAnalyzed: true,
            isPhishing: analysis.isPhishing || false,
            phishingScore: analysis.phishingScore || 0,
            confidence: analysis.confidence || 0,
            indicators: analysis.indicators || [],
            reason: analysis.reason,
            recommendation: analysis.recommendation,
            analyzedAt: new Date()
        }
    });
    
    res.json({
        success: true,
        data: {
            email: updatedEmail,
            analysis
        }
    });
};

/**
 * Analyze email content directly (without storing)
 */
export const analyzeEmailContent = async (req, res) => {
    const { subject, body, sender, links, content } = req.body;
    
    // Support both structured and raw content
    const emailBody = content || body;
    const emailSubject = subject || content?.slice(0, 50) || 'No Subject';
    
    if (!emailBody) {
        return res.status(400).json({
            success: false,
            error: { status: 400, message: 'Email content is required' }
        });
    }
    
    // Detect URLs in the content
    const linkRegex = /https?:\/\/[^\s<>"']+/gi;
    const has_url = !!(emailBody.match(linkRegex) || links?.length);
    
    const analysis = await predictPhishing({
        subject: emailSubject,
        body: emailBody,
        has_url
    });
    
    res.json({
        success: true,
        data: analysis
    });
};

/**
 * Bulk analyze emails
 */
export const bulkAnalyzeEmails = async (req, res) => {
    const userId = req.user.id;
    const { emailIds } = req.body;
    
    if (!emailIds || !Array.isArray(emailIds)) {
        return res.status(400).json({
            success: false,
            error: { status: 400, message: 'emailIds array is required' }
        });
    }
    
    if (emailIds.length > 10) {
        return res.status(400).json({
            success: false,
            error: { status: 400, message: 'Maximum 10 emails per batch' }
        });
    }
    
    const results = [];
    
    for (const emailId of emailIds) {
        const email = await prisma.email.findFirst({
            where: {
                id: parseInt(emailId),
                userId,
                isDeleted: false
            }
        });
        
        if (!email) {
            results.push({ id: emailId, error: 'Not found' });
            continue;
        }
        
        // Check for URLs
        const linkRegex = /https?:\/\/[^\s<>"']+/gi;
        const links = email.body ? (email.body.match(linkRegex) || []) : [];
        const has_url = links.length > 0;
        
        // Analyze with external predict API
        const analysis = await predictPhishing({
            subject: email.subject || '',
            body: email.bodyPlain || email.body || '',
            has_url
        });
        
        // Update
        await prisma.email.update({
            where: { id: parseInt(emailId) },
            data: {
                isAnalyzed: true,
                isPhishing: analysis.isPhishing || false,
                phishingScore: analysis.phishingScore || 0,
                confidence: analysis.confidence || 0,
                indicators: analysis.indicators || [],
                reason: analysis.reason,
                recommendation: analysis.recommendation,
                analyzedAt: new Date()
            }
        });
        
        results.push({ id: emailId, analysis });
    }
    
    res.json({
        success: true,
        data: { results }
    });
};

/**
 * Mark email as read/unread
 */
export const updateEmailReadStatus = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { isRead } = req.body;
    
    const email = await prisma.email.findFirst({
        where: { id: parseInt(id), userId }
    });
    
    if (!email) {
        return res.status(404).json({
            success: false,
            error: { status: 404, message: 'Email not found' }
        });
    }
    
    // Update in database
    await prisma.email.update({
        where: { id: parseInt(id) },
        data: { isRead }
    });
    
    // Update in Gmail if connected
    if (email.gmailId) {
        try {
            if (isRead) {
                await gmailService.markAsRead(userId, email.gmailId);
            } else {
                await gmailService.markAsUnread(userId, email.gmailId);
            }
        } catch (error) {
            console.error('Gmail sync error:', error);
        }
    }
    
    res.json({
        success: true,
        message: `Email marked as ${isRead ? 'read' : 'unread'}`
    });
};

/**
 * Star/unstar email
 */
export const updateEmailStarred = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { isStarred } = req.body;
    
    const email = await prisma.email.findFirst({
        where: { id: parseInt(id), userId }
    });
    
    if (!email) {
        return res.status(404).json({
            success: false,
            error: { status: 404, message: 'Email not found' }
        });
    }
    
    await prisma.email.update({
        where: { id: parseInt(id) },
        data: { isStarred }
    });
    
    // Sync with Gmail
    if (email.gmailId) {
        try {
            await gmailService.setStarred(userId, email.gmailId, isStarred);
        } catch (error) {
            console.error('Gmail sync error:', error);
        }
    }
    
    res.json({
        success: true,
        message: `Email ${isStarred ? 'starred' : 'unstarred'}`
    });
};

/**
 * Archive email
 */
export const archiveEmail = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    
    const email = await prisma.email.findFirst({
        where: { id: parseInt(id), userId }
    });
    
    if (!email) {
        return res.status(404).json({
            success: false,
            error: { status: 404, message: 'Email not found' }
        });
    }
    
    await prisma.email.update({
        where: { id: parseInt(id) },
        data: { isArchived: true }
    });
    
    // Sync with Gmail
    if (email.gmailId) {
        try {
            await gmailService.archiveEmail(userId, email.gmailId);
        } catch (error) {
            console.error('Gmail sync error:', error);
        }
    }
    
    res.json({
        success: true,
        message: 'Email archived'
    });
};

/**
 * Delete email (soft delete)
 */
export const deleteEmail = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    
    const email = await prisma.email.findFirst({
        where: { id: parseInt(id), userId }
    });
    
    if (!email) {
        return res.status(404).json({
            success: false,
            error: { status: 404, message: 'Email not found' }
        });
    }
    
    await prisma.email.update({
        where: { id: parseInt(id) },
        data: { isDeleted: true }
    });
    
    // Trash in Gmail
    if (email.gmailId) {
        try {
            await gmailService.trashEmail(userId, email.gmailId);
        } catch (error) {
            console.error('Gmail sync error:', error);
        }
    }
    
    res.json({
        success: true,
        message: 'Email deleted'
    });
};

/**
 * Permanently delete email
 */
export const permanentDeleteEmail = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    
    const email = await prisma.email.findFirst({
        where: { id: parseInt(id), userId }
    });
    
    if (!email) {
        return res.status(404).json({
            success: false,
            error: { status: 404, message: 'Email not found' }
        });
    }
    
    // Delete from Gmail first if connected
    if (email.gmailId) {
        try {
            await gmailService.deleteEmail(userId, email.gmailId);
        } catch (error) {
            console.error('Gmail delete error:', error);
        }
    }
    
    // Delete from database
    await prisma.email.delete({
        where: { id: parseInt(id) }
    });
    
    res.json({
        success: true,
        message: 'Email permanently deleted'
    });
};

/**
 * Bulk delete emails
 */
export const bulkDeleteEmails = async (req, res) => {
    const userId = req.user.id;
    const { emailIds } = req.body;
    
    if (!emailIds || !Array.isArray(emailIds)) {
        return res.status(400).json({
            success: false,
            error: { status: 400, message: 'emailIds array is required' }
        });
    }
    
    const result = await prisma.email.updateMany({
        where: {
            id: { in: emailIds.map(id => parseInt(id)) },
            userId
        },
        data: { isDeleted: true }
    });
    
    res.json({
        success: true,
        message: `Deleted ${result.count} emails`
    });
};

/**
 * Get dashboard statistics (overview page)
 */
export const getDashboardStats = async (req, res) => {
    const userId = req.user.id;
    
    const [total, analyzed, phishing, safe, suspicious, unread] = await Promise.all([
        prisma.email.count({ where: { userId, isDeleted: false } }),
        prisma.email.count({ where: { userId, isDeleted: false, isAnalyzed: true } }),
        prisma.email.count({ where: { userId, isDeleted: false, isPhishing: true } }),
        prisma.email.count({ where: { userId, isDeleted: false, isAnalyzed: true, isPhishing: false, phishingScore: { lt: 40 } } }),
        prisma.email.count({ where: { userId, isDeleted: false, isAnalyzed: true, phishingScore: { gte: 40, lt: 70 } } }),
        prisma.email.count({ where: { userId, isDeleted: false, isRead: false } })
    ]);
    
    // Recent analyzed emails for alerts table
    const recentAlerts = await prisma.email.findMany({
        where: { userId, isDeleted: false, isAnalyzed: true },
        orderBy: { analyzedAt: 'desc' },
        take: 10,
        select: {
            id: true,
            subject: true,
            sender: true,
            snippet: true,
            isPhishing: true,
            phishingScore: true,
            recommendation: true,
            analyzedAt: true,
            receivedAt: true
        }
    });
    
    // Daily analysis stats for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    
    const dailyEmails = await prisma.email.findMany({
        where: {
            userId,
            isDeleted: false,
            isAnalyzed: true,
            analyzedAt: { gte: sevenDaysAgo }
        },
        select: {
            analyzedAt: true,
            isPhishing: true,
            phishingScore: true
        }
    });
    
    // Group by day
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyMap = {};
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = d.toISOString().split('T')[0];
        dailyMap[key] = { day: dayNames[d.getDay()], total: 0, threats: 0 };
    }
    
    for (const email of dailyEmails) {
        if (email.analyzedAt) {
            const key = email.analyzedAt.toISOString().split('T')[0];
            if (dailyMap[key]) {
                dailyMap[key].total++;
                if (email.isPhishing || email.phishingScore >= 40) {
                    dailyMap[key].threats++;
                }
            }
        }
    }
    
    const dailyStats = Object.values(dailyMap).map((d) => ({
        ...d,
        detectionRate: d.total > 0 ? Math.round((d.threats / d.total) * 100) : 0
    }));
    
    // Threat type distribution by recommendation
    const byRecommendation = await prisma.email.groupBy({
        by: ['recommendation'],
        where: { userId, isDeleted: false, isAnalyzed: true },
        _count: true
    });
    
    res.json({
        success: true,
        data: {
            kpis: {
                totalScanned: total,
                suspiciousCount: suspicious,
                confirmedPhishing: phishing,
                blockedProtected: phishing + suspicious,
            },
            dailyStats,
            threatDistribution: byRecommendation.map(r => ({
                name: r.recommendation || 'Unknown',
                value: r._count
            })),
            recentAlerts: recentAlerts.map(a => ({
                id: a.id,
                target: a.subject || a.sender || 'Unknown',
                type: 'Email',
                result: a.isPhishing ? 'Phishing' : (a.phishingScore >= 40 ? 'Suspicious' : 'Safe'),
                confidence: `${(a.phishingScore || 0).toFixed(1)}%`,
                time: a.analyzedAt ? timeAgo(a.analyzedAt) : 'N/A'
            }))
        }
    });
};

function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/**
 * Get email statistics
 */
export const getEmailStats = async (req, res) => {
    const userId = req.user.id;
    
    const [total, analyzed, phishing, safe, unread] = await Promise.all([
        prisma.email.count({ where: { userId, isDeleted: false } }),
        prisma.email.count({ where: { userId, isDeleted: false, isAnalyzed: true } }),
        prisma.email.count({ where: { userId, isDeleted: false, isPhishing: true } }),
        prisma.email.count({ where: { userId, isDeleted: false, isAnalyzed: true, isPhishing: false } }),
        prisma.email.count({ where: { userId, isDeleted: false, isRead: false } })
    ]);
    
    // Get phishing breakdown by score
    const phishingByScore = await prisma.email.groupBy({
        by: ['recommendation'],
        where: { userId, isDeleted: false, isAnalyzed: true },
        _count: true
    });
    
    // Get average phishing score and suspicious emails count
    const scoreData = await prisma.email.aggregate({
        where: { userId, isDeleted: false, isAnalyzed: true },
        _avg: { phishingScore: true }
    });
    
    const suspicious = await prisma.email.count({
        where: { 
            userId, 
            isDeleted: false, 
            isAnalyzed: true,
            phishingScore: { gte: 40, lt: 70 }
        }
    });
    
    const averageScore = scoreData._avg?.phishingScore || 0;
    
    res.json({
        success: true,
        data: {
            totalEmails: total,
            analyzedEmails: analyzed,
            pendingEmails: total - analyzed,
            phishingEmails: phishing,
            safeEmails: safe,
            suspiciousEmails: suspicious,
            unreadEmails: unread,
            averagePhishingScore: parseFloat(averageScore.toFixed(1)),
            phishingRate: total > 0 ? ((phishing / total) * 100).toFixed(1) : 0,
            byRecommendation: phishingByScore.reduce((acc, item) => {
                acc[item.recommendation || 'unknown'] = item._count;
                return acc;
            }, {})
        }
    });
};
