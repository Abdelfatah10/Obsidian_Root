import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import { ENV } from "../config/env.js";
import User from "../models/User.js";
import { prisma } from "../prisma/client.js";
import { transporter } from "./mailerService.js";
import { generateResetPasswordToken } from "./jwtService.js";

const clientID = ENV.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(clientID);


export async function verifyGoogleToken(token) {
    if (!token) {
        return { success: false, message: "No token provided" };
    }

    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: clientID,
        });

        if (!ticket) {
            return { success: false, message: "Invalid token" };
        }

        const payload = ticket.getPayload();

        if (!payload || !payload.sub || !payload.email) {
            return { success: false, message: "Invalid token payload" };
        }

        return {
            success: true,
            user: {
                email: payload.email,
                googleId: payload.sub,
            }
        };
    } catch (error) {
        return { success: false, message: "Token verification failed" };
    }
}

/**
 * Find user by email
 */
export async function findUserByEmail(email) {
    return await User.findByEmail(email);
}

/**
 * Find user by ID
 */
export async function findUserById(id) {
    const user = await User.findById(id);
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }
    return user;
}

/**
 * Register a new user
 */
export async function registerUser(email, password, role) {
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
        const error = new Error('User already exists with this email');
        error.statusCode = 409;
        throw error;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({ email, password: hashedPassword, role: role || 'user' });
    const createdUser = await user.create();
    return createdUser;
}

/**
 * Create verification code
 */
export async function createVerificationCode(userId, type) {
    // Delete existing code of same type
    await prisma.verificationCode.deleteMany({
        where: { userId, type }
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return await prisma.verificationCode.create({
        data: {
            userId,
            code,
            type,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        }
    });
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(user, code) {
    await transporter.sendMail({
        from: ENV.EMAIL_USER,
        to: user.email,
        subject: `${ENV.APP_NAME} - Verify your email`,
        html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`
    });
}

/**
 * Login user with email and password
 */
export async function loginUser(email, password) {
    const user = await User.findByEmail(email);
    if (!user) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
    }

    if (!user.password) {
        const error = new Error('This account uses Google sign-in. Please login with Google.');
        error.statusCode = 401;
        throw error;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
    }

    return user;
}

/**
 * Login or register with Google
 */
export async function loginWithGoogle(googleUser) {
    let user = await User.findByGoogleId(googleUser.googleId);

    if (!user) {
        user = await User.findByEmail(googleUser.email);
        if (user) {
            // Link Google account to existing user
            user = await User.update(user.id, { googleId: googleUser.googleId, verified: true });
        } else {
            // Create new user
            const newUser = new User({
                email: googleUser.email,
                googleId: googleUser.googleId,
            });
            user = await newUser.createWithGoogle();
        }
    }

    return user;
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email) {
    const user = await User.findByEmail(email);
    if (!user) {
        const error = new Error('No account found with this email');
        error.statusCode = 404;
        throw error;
    }

    const resetToken = generateResetPasswordToken(user.id, user.email);
    return { user, resetToken };
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${ENV.DOMAIN_URL}/reset-password?token=${resetToken}`;
    await transporter.sendMail({
        from: ENV.EMAIL_USER,
        to: user.email,
        subject: `${ENV.APP_NAME} - Reset your password`,
        html: `<p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 15 minutes.</p>`
    });
}

/**
 * Reset password
 */
export async function resetPassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    return await User.update(userId, { password: hashedPassword });
}

/**
 * Change password
 */
export async function changePassword(userId, oldPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    if (!user.password) {
        const error = new Error('This account uses Google sign-in and has no password to change');
        error.statusCode = 400;
        throw error;
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
        const error = new Error('Current password is incorrect');
        error.statusCode = 401;
        throw error;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    return await User.update(userId, { password: hashedPassword });
}

/**
 * Verify email with code
 */
export async function verifyEmailWithCode(email, code) {
    const user = await User.findByEmail(email);
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    const verificationCode = await prisma.verificationCode.findFirst({
        where: {
            userId: user.id,
            code,
            type: 'email_verification',
            expiresAt: { gt: new Date() }
        }
    });

    if (!verificationCode) {
        const error = new Error('Invalid or expired verification code');
        error.statusCode = 400;
        throw error;
    }

    // Mark user as verified and delete the code
    const updatedUser = await User.update(user.id, { verified: true });
    await prisma.verificationCode.delete({ where: { id: verificationCode.id } });

    return updatedUser;
}