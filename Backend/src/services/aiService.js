// AI Service using Google Gemini API for Phishing Detection
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini model configuration
const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
    },
});

/**
 * Analyze URL for phishing indicators using Gemini AI
 * @param {string} url - The URL to analyze
 * @returns {Promise<Object>} Analysis result
 */
export const analyzeUrl = async (url) => {
    try {
        const prompt = `You are a cybersecurity expert specialized in phishing detection. Analyze the following URL for phishing indicators and potential security threats.

        URL: ${url}

        Analyze the URL for:
        1. Domain legitimacy (typosquatting, brand impersonation)
        2. Suspicious patterns (IP addresses, unusual TLDs, excessive subdomains)
        3. URL structure anomalies (encoded characters, unusual paths)
        4. Known phishing patterns

        Respond in JSON format only:
        {
            "isPhishing": boolean,
            "score": number (0-100, higher = more dangerous),
            "confidence": number (0-100),
            "indicators": [list of detected suspicious indicators],
            "reason": "brief explanation",
            "recommendation": "safe/caution/danger"
        }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();
        
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            return {
                success: true,
                ...analysis,
                aiAnalysis: true
            };
        }
        
        throw new Error('Invalid AI response format');
    } catch (error) {
        console.error('AI URL analysis error:', error);
        return {
            success: false,
            error: error.message,
            isPhishing: false,
            score: 0,
            indicators: [],
            reason: 'AI analysis failed'
        };
    }
};

/**
 * Analyze email content for phishing attempts using Gemini AI
 * @param {Object} emailData - Email data to analyze
 * @returns {Promise<Object>} Analysis result
 */
export const analyzeEmail = async (emailData) => {
    try {
        const { subject, body, sender, links = [] } = emailData;
        
        const prompt = `You are a cybersecurity expert specialized in phishing email detection. Analyze the following email for phishing indicators.

        Email Details:
        - Sender: ${sender || 'Unknown'}
        - Subject: ${subject || 'No subject'}
        - Body: ${body || 'No content'}
        - Links in email: ${links.join(', ') || 'None'}

        Analyze for:
        1. Social engineering tactics (urgency, fear, authority)
        2. Suspicious sender patterns
        3. Grammar/spelling issues common in phishing
        4. Mismatched or suspicious links
        5. Requests for sensitive information
        6. Brand impersonation attempts

        Respond in JSON format only:
        {
            "isPhishing": boolean,
            "score": number (0-100, higher = more dangerous),
            "confidence": number (0-100),
            "indicators": [list of detected suspicious elements],
            "tactics": [identified social engineering tactics],
            "reason": "brief explanation",
            "recommendation": "safe/suspicious/dangerous"
        }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            return {
                success: true,
                ...analysis,
                aiAnalysis: true
            };
        }
        
        throw new Error('Invalid AI response format');
    } catch (error) {
        console.error('AI email analysis error:', error);
        return {
            success: false,
            error: error.message,
            isPhishing: false,
            score: 0,
            indicators: [],
            reason: 'AI analysis failed'
        };
    }
};

/**
 * Analyze website content for phishing indicators
 * @param {Object} pageData - Page content data
 * @returns {Promise<Object>} Analysis result
 */
export const analyzePageContent = async (pageData) => {
    try {
        const { url, title, forms, links, textContent } = pageData;
        
        const prompt = `You are a cybersecurity expert. Analyze this webpage data for phishing indicators.

Page Data:
- URL: ${url}
- Title: ${title || 'No title'}
- Number of forms: ${forms?.length || 0}
- Form actions: ${forms?.map(f => f.action).join(', ') || 'None'}
- Has password fields: ${forms?.some(f => f.hasPassword) || false}
- External links count: ${links?.external || 0}
- Page text snippet: ${(textContent || '').substring(0, 500)}

Analyze for:
1. Login form on suspicious domain
2. Brand impersonation in content
3. Credential harvesting indicators
4. Suspicious form submissions
5. Mismatched branding vs domain

Respond in JSON format only:
{
    "isPhishing": boolean,
    "score": number (0-100),
    "confidence": number (0-100),
    "indicators": [list of suspicious elements],
    "impersonatedBrand": "brand name or null",
    "reason": "brief explanation",
    "recommendation": "safe/suspicious/dangerous"
}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            return {
                success: true,
                ...analysis,
                aiAnalysis: true
            };
        }
        
        throw new Error('Invalid AI response format');
    } catch (error) {
        console.error('AI page analysis error:', error);
        return {
            success: false,
            error: error.message,
            isPhishing: false,
            score: 0,
            indicators: [],
            reason: 'AI analysis failed'
        };
    }
};

/**
 * Generate phishing awareness training content
 * @param {string} topic - Training topic
 * @returns {Promise<Object>} Training content
 */
export const generateTrainingContent = async (topic = 'general') => {
    try {
        const prompt = `Generate educational content about phishing awareness for the topic: "${topic}"

Include:
1. What is this type of phishing
2. Common examples and red flags
3. How to identify it
4. Prevention tips
5. What to do if targeted

Format as JSON:
{
    "topic": "topic name",
    "title": "engaging title",
    "description": "brief overview",
    "examples": [list of real-world examples],
    "redFlags": [warning signs to look for],
    "preventionTips": [actionable tips],
    "quiz": [
        {
            "question": "quiz question",
            "options": ["a", "b", "c", "d"],
            "correct": 0,
            "explanation": "why this is correct"
        }
    ]
}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return {
                success: true,
                content: JSON.parse(jsonMatch[0])
            };
        }
        
        throw new Error('Invalid AI response format');
    } catch (error) {
        console.error('AI training content error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Generate simulated phishing email for training
 * @param {string} type - Type of phishing simulation
 * @param {string} difficulty - Difficulty level
 * @returns {Promise<Object>} Simulated phishing email
 */
export const generatePhishingSimulation = async (type = 'generic', difficulty = 'medium') => {
    try {
        const prompt = `Generate a realistic phishing email simulation for security awareness training.

Type: ${type}
Difficulty: ${difficulty}

Create a mock phishing email that would be used for employee training. Include obvious and subtle red flags based on difficulty level.

Format as JSON:
{
    "type": "${type}",
    "difficulty": "${difficulty}",
    "email": {
        "from": "spoofed sender",
        "subject": "email subject",
        "body": "email body with HTML formatting",
        "links": [{"text": "link text", "url": "suspicious URL"}]
    },
    "redFlags": [list of phishing indicators in this email],
    "educationalPoints": [what users should learn from this]
}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return {
                success: true,
                simulation: JSON.parse(jsonMatch[0])
            };
        }
        
        throw new Error('Invalid AI response format');
    } catch (error) {
        console.error('AI simulation generation error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

export default {
    analyzeUrl,
    analyzeEmail,
    analyzePageContent,
    generateTrainingContent,
    generatePhishingSimulation
};
