import validator from 'validator';
import { STATUS } from '../utils/constants/statusCodes.js';
import { MESSAGES } from '../utils/constants/messages.js';
import { catchAsync } from '../utils/catchAsync.js';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken, setAuthCookies, clearAuthCookies } from '../services/jwtService.js';
import * as authService from '../services/authService.js';

/**
 * Register Controller
 * POST /auth/register
 */
export const register = catchAsync(async (req, res, next) => {
    const { email, password, role } = req.body;

    // Validate required fields
    if (!email || !password) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Email and password are required'
            }
        });
    }
    // Validate email format & password strength
    if (!validator.isEmail(email)) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Invalid email format'
            }
        });
    }
    if (!validator.isStrongPassword(password, { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 })) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character'
            }
        });
    }

    // Validate role if provided
    const { ROLES } = await import('../utils/constants/roles.js');
    const validRoles = Object.values(ROLES);
    if (role && !validRoles.includes(role)) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
            }
        });
    }

    // Check if user already exists
    const existingUser = await authService.findUserByEmail(email);

    // Register user
    const user = await authService.registerUser(email, password, role);

    // Create verification code
    const verificationCode = await authService.createVerificationCode(user.id, 'email_verification');

    // Send verification email
    await authService.sendVerificationEmail(user, verificationCode.code);

    res.status(STATUS.CREATED).json({
        success: true,
        message: MESSAGES.REGISTRATION_SUCCESS,
        data: {
            id: user.id,
            email: user.email,
            role: user.role
        }
    });
});

/**
 * Login Controller
 * POST /auth/login
 */
export const login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Email and password are required'
            }
        });
    }

    // Login user
    const user = await authService.loginUser(email, password);

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id, user.email, user.role);

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.LOGIN_SUCCESS,
        data: {
            id: user.id,
            email: user.email,
            role: user.role,
            verified: user.verified
        },
        tokens: {
            accessToken,
            refreshToken
        }
    });
});

/**
 * Google Login Controller
 * POST /auth/login-google
 */
export const loginGoogle = catchAsync(async (req, res, next) => {
    const { token } = req.body;

    // Validate token
    if (!token) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Google token is required'
            }
        });
    }

    // Verify Google token
    const googleResult = await authService.verifyGoogleToken(token);

    if (!googleResult.success) {
        return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: googleResult.message || MESSAGES.INVALID_TOKEN
            }
        });
    }

    // Login or create user
    const user = await authService.loginWithGoogle(googleResult.user);

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id, user.email, user.role);

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.LOGIN_SUCCESS,
        data: {
            id: user.id,
            email: user.email,
            role: user.role,
            verified: user.verified,
            isNewUser: !user.googleId
        },
        tokens: {
            accessToken,
            refreshToken
        }
    });
});

/**
 * Refresh Token Controller
 * POST /auth/refresh-token
 */
export const refreshToken = catchAsync(async (req, res, next) => {
    const { refreshToken: token } = req.body;
    const cookieToken = req.cookies?.refreshToken;

    const refreshTokenValue = token || cookieToken;

    if (!refreshTokenValue) {
        return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: 'Refresh token is required'
            }
        });
    }

    // Verify refresh token
    const result = verifyRefreshToken(refreshTokenValue);

    if (!result.success) {
        return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: MESSAGES.INVALID_TOKEN
            }
        });
    }

    const { id, email, role } = result.decoded;

    // Generate new access token
    const newAccessToken = generateAccessToken(id, email, role);

    // Set cookie
    res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        sameSite: 'Strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000
    });

    res.status(STATUS.OK).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
            accessToken: newAccessToken
        }
    });
});

/**
 * Logout Controller
 * POST /auth/logout
 */
export const logout = catchAsync(async (req, res, next) => {
    clearAuthCookies(res);

    res.status(STATUS.OK).json({
        success: true,
        message: 'Logout successful'
    });
});

/**
 * Forgot Password Controller
 * POST /auth/forgot-password
 */
export const forgotPassword = catchAsync(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Email is required'
            }
        });
    }

    // Request password reset
    const { user, resetToken } = await authService.requestPasswordReset(email);

    // Send reset email
    await authService.sendPasswordResetEmail(user, resetToken);

    res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.PASSWORD_RESET_EMAIL_SENT
    });
});

/**
 * Reset Password Controller
 * POST /auth/reset-password
 */
export const resetPassword = catchAsync(async (req, res, next) => {
    const { token, newPassword, confirmPassword } = req.body;

    // Validate required fields
    if (!token || !newPassword || !confirmPassword) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Token, new password, and confirm password are required'
            }
        });
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Passwords do not match'
            }
        });
    }

    // Verify reset token
    const { verifyResetPasswordToken } = await import('../services/jwtService.js');
    const result = verifyResetPasswordToken(token);

    if (!result.success) {
        return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: MESSAGES.INVALID_RESET_TOKEN
            }
        });
    }

    const { id } = result.decoded;

    // Reset password
    const user = await authService.resetPassword(id, newPassword);

    res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.PASSWORD_RESET_SUCCESS,
        data: {
            id: user.id,
            email: user.email
        }
    });
});

/**
 * Change Password Controller
 * POST /auth/change-password
 */
export const changePassword = catchAsync(async (req, res, next) => {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user?.id;

    // Validate authentication
    if (!userId) {
        return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: MESSAGES.UNAUTHORIZED
            }
        });
    }

    // Validate required fields
    if (!oldPassword || !newPassword || !confirmPassword) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Old password, new password, and confirm password are required'
            }
        });
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'New passwords do not match'
            }
        });
    }

    // Change password
    const user = await authService.changePassword(userId, oldPassword, newPassword);

    res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.PASSWORD_CHANGED,
        data: {
            id: user.id,
            email: user.email
        }
    });
});

/**
 * Verify Email Controller
 * POST /auth/verify-email
 */
export const verifyEmail = catchAsync(async (req, res, next) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Email and verification code are required'
            }
        });
    }

    // Verify email
    const user = await authService.verifyEmailWithCode(email, code);

    res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.EMAIL_VERIFIED,
        data: {
            id: user.id,
            email: user.email,
            verified: user.verified
        }
    });
});

/**
 * Get Current User Controller
 * GET /auth/me
 */
export const getCurrentUser = catchAsync(async (req, res, next) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: MESSAGES.UNAUTHORIZED
            }
        });
    }

    // Find user
    const user = await authService.findUserById(userId);

    res.status(STATUS.OK).json({
        success: true,
        data: {
            id: user.id,
            email: user.email,
            role: user.role,
            verified: user.verified,
            provider: user.provider,
            createdAt: user.createdAt
        }
    });
});
