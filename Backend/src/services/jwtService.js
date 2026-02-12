import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';


const JWT_ACCESS_SECRET = ENV.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = ENV.JWT_REFRESH_SECRET;
const JWT_RESET_PASSWORD_SECRET = ENV.JWT_RESET_PASSWORD_SECRET;

const JWT_EXPIRES_IN_ACCESS = ENV.JWT_EXPIRES_IN_ACCESS;
const JWT_EXPIRES_IN_REFRESH = ENV.JWT_EXPIRES_IN_REFRESH;
const JWT_EXPIRES_IN_RESET_PASSWORD = ENV.JWT_EXPIRES_IN_RESET_PASSWORD;

// Access Token Functions
export const generateAccessToken = (id, email, role) => {
    const payload = { id, email, role };
    return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: JWT_EXPIRES_IN_ACCESS });
};

export const verifyAccessToken = (token) => {
    try {
        return { success: true, decoded: jwt.verify(token, JWT_ACCESS_SECRET) };
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { success: false, reason: 'expired' };
        }
        return { success: false, reason: 'invalid' };
    }
};

// Refresh Token Functions
export const generateRefreshToken = (id, email, role) => {
    const payload = { id, email, role };
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_EXPIRES_IN_REFRESH });
};

export const verifyRefreshToken = (token) => {
    try {
        return { success: true, decoded: jwt.verify(token, JWT_REFRESH_SECRET) };
    } catch (error) {
        return { success: false , reason: 'invalid'};
    }
};

// Reset Password Token Functions
export const generateResetPasswordToken = (id, email, role) => {
    const payload = { id, email, role };
    return jwt.sign(payload, JWT_RESET_PASSWORD_SECRET, { expiresIn: JWT_EXPIRES_IN_RESET_PASSWORD });
};

export const verifyResetPasswordToken = (token) => {
    try {
        return { success: true, decoded: jwt.verify(token, JWT_RESET_PASSWORD_SECRET) };
    } catch (error) {
        return { success: false , reason: 'invalid'};
    }
};


// Cookie Management Functions
export const setAuthCookies = (res, accessToken, refreshToken) => {
    const cookieOptions = {
        httpOnly: true,
        sameSite: 'Strict',
        secure: ENV.NODE_ENV === 'production',
    };
    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
};

export const setResetPasswordCookie = (res, resetToken) => {
    const cookieOptions = {
        httpOnly: true,
        sameSite: 'Strict',
        secure: ENV.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000,
    };
    res.cookie('resetToken', resetToken, cookieOptions);
};

export const clearAuthCookies = (res) => {
    const cookieOptions = {
        httpOnly: true,
        sameSite: 'Strict',
        secure: ENV.NODE_ENV === 'production',
        maxAge: 0,
    };
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
};

export const clearResetPasswordCookie = (res) => {
    const cookieOptions = {
        httpOnly: true,
        sameSite: 'Strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 0,
    };
    res.clearCookie('resetToken', cookieOptions);
}
