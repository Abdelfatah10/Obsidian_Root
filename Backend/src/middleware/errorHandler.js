import { ENV } from '../config/env.js';
import { STATUS } from '../utils/constants/statusCodes.js';
import { MESSAGES } from '../utils/constants/messages.js';

// 404 Not Found Handler
export const notFoundHandler = (req, res, next) => {
    res.status(STATUS.NOT_FOUND).json({
        success: false,
        error: {
            status: STATUS.NOT_FOUND,
            message: `Route not found: ${req.method} ${req.path}`
        }
    });
}

// Error Handling Middleware
export const errorHandler = (err, req, res, next) => {
    if (ENV.NODE_ENV !== 'production') {
        console.error('Error:', {
            message: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    }

    // Determine status code and message
    const statusCode = err.status || STATUS.INTERNAL_SERVER_ERROR;

    const message = err.message || MESSAGES.INTERNAL_SERVER_ERROR;

    res.status(statusCode).json({
        success: false,
        error: {
            status: statusCode,
            message: message
        }
    });
};