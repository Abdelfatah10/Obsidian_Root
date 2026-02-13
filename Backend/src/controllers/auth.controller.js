import validator from 'validator';
import bcrypt from 'bcryptjs';
import { STATUS } from '../utils/constants/statusCodes.js';
import { MESSAGES } from '../utils/constants/messages.js';
import { catchAsync } from '../utils/catchAsync.js';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken, setAuthCookies, clearAuthCookies } from '../services/jwtService.js';
import User from '../models/User.js';


// Register Controller
export const register = catchAsync(async (req, res, next) => {
    const { email, password, role } = req.body;

    // Validate required fields
    if (!email || !password || !role) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Email, password, and role are required'
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
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
        return res.status(STATUS.CONFLICT).json({
            success: false,
            error: {
                status: STATUS.CONFLICT,
                message: 'Email is already registered'
            }
        });
    }
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create user
    const user = await User.create( email, hashedPassword, role, verificationCode);
    if (!user) {
        return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: {
                status: STATUS.INTERNAL_SERVER_ERROR,
                message: 'Failed to create user'
            }
        });
    }

    // Send verification email
    await User.sendVerificationEmail(user, verificationCode);

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

// Login Controller
export const login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Email, password, and role are required'
            }
        });
    }

    if (!validator.isEmail(email)) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Invalid email format'
            }
        });
    }
    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (!existingUser) {
        return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: MESSAGES.INVALID_CREDENTIALS
            }
        });
    }
    // Check if email is verified
    if (!existingUser.verified) {
        return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: 'Email is not verified. Please check your inbox for the verification code.'
            }        
        });
    }

    // Generate tokens
    const accessToken = generateAccessToken(existingUser.id, existingUser.email, existingUser.role);
    const refreshToken = generateRefreshToken(existingUser.id, existingUser.email, existingUser.role);

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.LOGIN_SUCCESS
    });
});

// Google Login Controller
export const loginGoogle = catchAsync(async (req, res, next) => {
    const { token, role } = req.body;

    // Validate token
    if (!token || !role) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Google token and role are required'
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
    // Check existing user by email
    const existingUser = await User.findByEmail(googleResult.user.email);
    if (!existingUser) {
        const user = await User.createWithGoogle(googleResult.user.email, googleResult.user.googleId, role);
        if (!user) {
            return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: {
                    status: STATUS.INTERNAL_SERVER_ERROR,
                    message: 'Failed to create user with Google account'
                }
            });
        }
    }
    if (existingUser && existingUser.provider !== 'google') {
        return res.status(STATUS.CONFLICT).json({
            success: false,
            error: {
                status: STATUS.CONFLICT,
                message: 'Email is already registered with a different provider'
            }
        });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id, user.email, user.role);

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.LOGIN_SUCCESS
    });
});


// Refresh Token Controller
export const refreshToken = catchAsync(async (req, res, next) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
        return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: 'Refresh token is required'
            }
        });
    }

    // Verify refresh token
    const result = verifyRefreshToken(refreshToken);

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
    const newRefreshToken = generateRefreshToken(id, email, role);

     // Set new cookies
    setAuthCookies(res, newAccessToken, newRefreshToken);

    res.status(STATUS.OK).json({
        success: true,
        message: 'Token refreshed successfully'
    });
});

// Logout Controller
export const logout = catchAsync(async (req, res, next) => {
    clearAuthCookies(res);

    res.status(STATUS.OK).json({
        success: true,
        message: 'Logout successful'
    });
});

// Forgot Password Controller
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
    if (!validator.isEmail(email)) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Invalid email format'
            }
        });
    }
    // Check if user exists
    const user = await User.findByEmail(email);
    if (!user) {
        return res.status(STATUS.OK).json({
            success: true,
            message: MESSAGES.PASSWORD_RESET_EMAIL_SENT
        });
    }
    // Generate reset token
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Save Code
    await User.saveResetPasswordCode(user, resetCode);
    // Send reset email
    await User.sendResetPasswordEmail(user, resetCode);

    res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.PASSWORD_RESET_EMAIL_SENT
    });
});

export const verifyResetCode = catchAsync(async (req, res, next) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Email and reset code are required'
            }
        });
    }
    if (!validator.isEmail(email)) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Invalid email format'
            }
        });
    }
    // Verify reset code
    const result = await User.verifyResetPasswordCode(email, code);

    if (!result.success) {
        return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: result.message || 'Invalid reset code'
            }
        });
    }
    // Send reset token
    const { generateResetPasswordToken } = await import('../services/jwtService.js');
    const resetToken = generateResetPasswordToken(result.user.id);
    res.cookie('resetToken', resetToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000 // 15 minutes
    });
    res.status(STATUS.OK).json({
        success: true,
        message: 'Reset code verified successfully'
    });
});

// Reset Password Controller
export const resetPassword = catchAsync(async (req, res, next) => {
    const { newPassword } = req.body;
    const { resetToken: token } = req.cookies;

    // Verify Token
    if (!token) {
        return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: 'Reset token is required'
            }
        });
    }
    

    // Validate required fields
    if (!token || !newPassword ) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Token and new password are required'
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

// Change Password Controller
export const changePassword = catchAsync(async (req, res, next) => {
    const { oldPassword, newPassword } = req.body;
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
    if (!oldPassword || !newPassword ) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Old password, new password are required'
            }
        });
    }

    // Change password
    const user = await User.changePassword(userId, oldPassword, newPassword);

    res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.PASSWORD_CHANGED,
        data: {
            id: user.id,
            email: user.email
        }
    });
});

// Verify Email Controller
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

    if (!validator.isEmail(email)) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Invalid email format'
            }
        });
    }

    // Verify email
    const user = await User.verifyEmail(email, code);

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

// Get Current User Controller
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
    const user = await User.findById(userId);

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
