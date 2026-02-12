import { verifyAccessToken } from '../services/jwtService.js';
import User from '../models/User.js';
import { STATUS } from '../utils/constants/statusCodes.js';
import { MESSAGES } from '../utils/constants/messages.js';

// Authentication Middleware
export const authenticate = async (req, res, next) => {
    try {
        // Get token from cookies
        const token = req.cookies?.accessToken;

        if (!token) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    status: STATUS.UNAUTHORIZED,
                    message: 'Access token is required'
                }
            });
        }

        // Verify token
        const result = await verifyAccessToken(token);

        if (!result.success) {
            if (result.reason === 'expired') {
                return res.status(STATUS.UNAUTHORIZED).json({
                    success: false,
                    error: {
                        status: STATUS.UNAUTHORIZED,
                        expired: true,
                        message: 'Access token has expired'
                    }
                });
            }

            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    status: STATUS.UNAUTHORIZED,
                    message: MESSAGES.INVALID_TOKEN
                }
            });
        }
        // Check Existing User
        if (!result.decoded || !result.decoded.id || !result.decoded.email || !result.decoded.role) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    status: STATUS.UNAUTHORIZED,
                    message: 'Invalid token payload'
                }
            });
        }
        // Check User in Database
        const user = await User.findById(result.decoded.id);
        if (!user) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    status: STATUS.UNAUTHORIZED,
                    message: 'User not found'
                }
            });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: MESSAGES.INVALID_TOKEN
            }
        });
    }
};

// Authorization Middleware
export const authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    status: STATUS.UNAUTHORIZED,
                    message: 'User not found'
                }
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(STATUS.FORBIDDEN).json({
                success: false,
                error: {
                    status: 403,
                    message: 'You do not have permission to access this resource'
                }
            });
        }

        next();
    };
};