// Gmail Service - OAuth2 and Email Management
import { google } from 'googleapis';
import prisma from '../prisma/client.js';

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.labels'
];

/**
 * Create OAuth2 client
 */
const createOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI || `${process.env.BACKEND_URL}/api/email/v1/gmail/callback`
    );
};

/**
 * Get authorization URL for Gmail OAuth
 * @param {number} userId - User ID to include in state
 * @returns {string} Authorization URL
 */
export const getAuthUrl = (userId) => {
    const oauth2Client = createOAuth2Client();
    
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        state: JSON.stringify({ userId })
    });
};

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from OAuth callback
 * @param {number} userId - User ID to store tokens for
 * @returns {Promise<Object>} Token information
 */
export const handleOAuthCallback = async (code, userId) => {
    const oauth2Client = createOAuth2Client();
    
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in database
    await prisma.user.update({
        where: { id: userId },
        data: {
            gmailAccessToken: tokens.access_token,
            gmailRefreshToken: tokens.refresh_token,
            gmailTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            gmailConnected: true
        }
    });
    
    return { success: true, connected: true };
};

/**
 * Get authenticated Gmail client for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Gmail API client
 */
export const getGmailClient = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            gmailAccessToken: true,
            gmailRefreshToken: true,
            gmailTokenExpiry: true,
            gmailConnected: true
        }
    });
    
    if (!user || !user.gmailConnected) {
        throw new Error('Gmail not connected. Please authorize first.');
    }
    
    const oauth2Client = createOAuth2Client();
    
    oauth2Client.setCredentials({
        access_token: user.gmailAccessToken,
        refresh_token: user.gmailRefreshToken,
        expiry_date: user.gmailTokenExpiry ? user.gmailTokenExpiry.getTime() : null
    });
    
    // Handle token refresh
    oauth2Client.on('tokens', async (tokens) => {
        if (tokens.access_token) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    gmailAccessToken: tokens.access_token,
                    gmailTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null
                }
            });
        }
    });
    
    return google.gmail({ version: 'v1', auth: oauth2Client });
};

/**
 * Fetch emails from Gmail
 * @param {number} userId - User ID
 * @param {Object} options - Fetch options
 * @returns {Promise<Array>} List of emails
 */
export const fetchEmails = async (userId, options = {}) => {
    const { maxResults = 20, query = '', labelIds = ['INBOX'], pageToken } = options;
    
    const gmail = await getGmailClient(userId);
    
    const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query,
        labelIds,
        pageToken
    });
    
    if (!response.data.messages) {
        return { emails: [], nextPageToken: null };
    }
    
    // Fetch full message details for each email
    const emails = await Promise.all(
        response.data.messages.map(async (msg) => {
            const fullMessage = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'full'
            });
            
            return parseGmailMessage(fullMessage.data);
        })
    );
    
    return {
        emails,
        nextPageToken: response.data.nextPageToken || null
    };
};

/**
 * Fetch a single email by ID
 * @param {number} userId - User ID
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<Object>} Email data
 */
export const fetchEmailById = async (userId, messageId) => {
    const gmail = await getGmailClient(userId);
    
    const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
    });
    
    return parseGmailMessage(response.data);
};

/**
 * Mark email as read
 * @param {number} userId - User ID
 * @param {string} messageId - Gmail message ID
 */
export const markAsRead = async (userId, messageId) => {
    const gmail = await getGmailClient(userId);
    
    await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
            removeLabelIds: ['UNREAD']
        }
    });
};

/**
 * Mark email as unread
 * @param {number} userId - User ID
 * @param {string} messageId - Gmail message ID
 */
export const markAsUnread = async (userId, messageId) => {
    const gmail = await getGmailClient(userId);
    
    await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
            addLabelIds: ['UNREAD']
        }
    });
};

/**
 * Star/unstar an email
 * @param {number} userId - User ID
 * @param {string} messageId - Gmail message ID
 * @param {boolean} starred - Whether to star or unstar
 */
export const setStarred = async (userId, messageId, starred) => {
    const gmail = await getGmailClient(userId);
    
    await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: starred
            ? { addLabelIds: ['STARRED'] }
            : { removeLabelIds: ['STARRED'] }
    });
};

/**
 * Move email to trash
 * @param {number} userId - User ID
 * @param {string} messageId - Gmail message ID
 */
export const trashEmail = async (userId, messageId) => {
    const gmail = await getGmailClient(userId);
    
    await gmail.users.messages.trash({
        userId: 'me',
        id: messageId
    });
};

/**
 * Permanently delete email
 * @param {number} userId - User ID
 * @param {string} messageId - Gmail message ID
 */
export const deleteEmail = async (userId, messageId) => {
    const gmail = await getGmailClient(userId);
    
    await gmail.users.messages.delete({
        userId: 'me',
        id: messageId
    });
};

/**
 * Archive email (remove from inbox)
 * @param {number} userId - User ID
 * @param {string} messageId - Gmail message ID
 */
export const archiveEmail = async (userId, messageId) => {
    const gmail = await getGmailClient(userId);
    
    await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
            removeLabelIds: ['INBOX']
        }
    });
};

/**
 * Get Gmail labels
 * @param {number} userId - User ID
 * @returns {Promise<Array>} List of labels
 */
export const getLabels = async (userId) => {
    const gmail = await getGmailClient(userId);
    
    const response = await gmail.users.labels.list({
        userId: 'me'
    });
    
    return response.data.labels || [];
};

/**
 * Disconnect Gmail
 * @param {number} userId - User ID
 */
export const disconnectGmail = async (userId) => {
    await prisma.user.update({
        where: { id: userId },
        data: {
            gmailAccessToken: null,
            gmailRefreshToken: null,
            gmailTokenExpiry: null,
            gmailConnected: false
        }
    });
};

/**
 * Check if Gmail is connected
 * @param {number} userId - User ID
 * @returns {Promise<boolean>}
 */
export const isGmailConnected = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { gmailConnected: true }
    });
    
    return user?.gmailConnected || false;
};

/**
 * Parse Gmail message to our format
 * @param {Object} message - Raw Gmail message
 * @returns {Object} Parsed email data
 */
const parseGmailMessage = (message) => {
    const headers = message.payload?.headers || [];
    
    const getHeader = (name) => {
        const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        return header?.value || null;
    };
    
    // Extract body
    let body = '';
    let bodyPlain = '';
    
    const extractBody = (part) => {
        if (part.mimeType === 'text/html' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.mimeType === 'text/plain' && part.body?.data) {
            bodyPlain = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.parts) {
            part.parts.forEach(extractBody);
        }
    };
    
    if (message.payload) {
        extractBody(message.payload);
    }
    
    // If no HTML body, use plain text
    if (!body && bodyPlain) {
        body = bodyPlain;
    }
    
    // Parse sender
    const fromHeader = getHeader('From') || '';
    const senderMatch = fromHeader.match(/(?:"?([^"<]*)"?\s*)?<?([^>]*)>?/);
    const senderName = senderMatch?.[1]?.trim() || null;
    const sender = senderMatch?.[2]?.trim() || fromHeader;
    
    // Parse recipients
    const toHeader = getHeader('To') || '';
    const recipients = toHeader.split(',').map(r => {
        const match = r.match(/<?([^>]*)>?/);
        return match?.[1]?.trim() || r.trim();
    }).filter(Boolean);
    
    // Extract links from body
    const linkRegex = /https?:\/\/[^\s<>"']+/gi;
    const links = body ? (body.match(linkRegex) || []) : [];
    
    return {
        gmailId: message.id,
        threadId: message.threadId,
        subject: getHeader('Subject'),
        sender,
        senderName,
        recipients,
        snippet: message.snippet,
        body,
        bodyPlain,
        links,
        labels: message.labelIds || [],
        isRead: !message.labelIds?.includes('UNREAD'),
        isStarred: message.labelIds?.includes('STARRED'),
        receivedAt: message.internalDate ? new Date(parseInt(message.internalDate)) : null
    };
};

/**
 * Sync emails from Gmail to database
 * @param {number} userId - User ID
 * @param {Object} options - Sync options
 * @returns {Promise<Object>} Sync results
 */
export const syncEmails = async (userId, options = {}) => {
    const { maxResults = 50 } = options;
    
    const { emails } = await fetchEmails(userId, { maxResults });
    
    let synced = 0;
    let skipped = 0;
    
    for (const email of emails) {
        // Check if email already exists
        const existing = await prisma.email.findUnique({
            where: { gmailId: email.gmailId }
        });
        
        if (existing) {
            skipped++;
            continue;
        }
        
        // Create new email record
        await prisma.email.create({
            data: {
                userId,
                gmailId: email.gmailId,
                threadId: email.threadId,
                subject: email.subject,
                sender: email.sender,
                senderName: email.senderName,
                recipients: email.recipients,
                snippet: email.snippet,
                body: email.body,
                bodyPlain: email.bodyPlain,
                labels: email.labels,
                isRead: email.isRead,
                isStarred: email.isStarred,
                receivedAt: email.receivedAt
            }
        });
        
        synced++;
    }
    
    return { synced, skipped, total: emails.length };
};

export default {
    getAuthUrl,
    handleOAuthCallback,
    getGmailClient,
    fetchEmails,
    fetchEmailById,
    markAsRead,
    markAsUnread,
    setStarred,
    trashEmail,
    deleteEmail,
    archiveEmail,
    getLabels,
    disconnectGmail,
    isGmailConnected,
    syncEmails
};
