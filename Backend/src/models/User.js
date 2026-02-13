import { prisma } from '../prisma/client.js';
import bcrypt from 'bcryptjs';


export default class User {

    // Constructor
    constructor({ id, email, password, role, verified, provider, googleId, createdAt, updatedAt }) {
        this.id = id;
        this.email = email;
        this.password = password;
        this.role = role;
        this.verified = verified;
        this.provider = provider;
        this.googleId = googleId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }


    static async findById(id) {
        return await prisma.user.findUnique({
            where: { id },
            include: {
                verificationCodes: true
            }
        });
    }

    static async findByEmail(email) {
        return await prisma.user.findUnique({
            where: { email },
            include: {
                verificationCodes: true
            }
        });
    }

    static async findByGoogleId(googleId) {
        return await prisma.user.findUnique({
            where: { googleId }
        });
    }


    async create(email, password, role, code) {
        const createdUser = await prisma.user.create({
            data: {
                email: email,
                password: password,
                role: role || 'user',
                provider: 'local',
                verified: false
            }
        });
        const verificationCode = await prisma.verificationCode.create({
            data: {
                userId: createdUser.id,
                code: code,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
            }
        });
        this.id = createdUser.id;
        this.createdAt = createdUser.createdAt;
        this.updatedAt = createdUser.updatedAt;
        return createdUser;
    }

    async createWithGoogle(email, googleId, role) {
        const createdUser = await prisma.user.create({
            data: {
                email: email,
                googleId: googleId,
                role: role || 'user',
                provider: 'google',
                verified: true
            }
        });
        this.id = createdUser.id;
        this.createdAt = createdUser.createdAt;
        this.updatedAt = createdUser.updatedAt;
        return createdUser;
    }

    // Update user by ID
    static async update(id, data) {
        return await prisma.user.update({
            where: { id },
            data
        });
    }

    // Delete user by ID
    static async delete(id) {
        return await prisma.user.delete({
            where: { id }
        });
    }

    // Get all users (paginated)
    static async getAll(skip = 0, take = 10) {
        return await prisma.user.findMany({
            skip,
            take,
            select: {
                id: true,
                email: true,
                role: true,
                verified: true,
                provider: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    // Count total users
    static async count() {
        return await prisma.user.count();
    }


    // Get users by role (paginated)
    static async getByRole(role, skip = 0, take = 10) {
        return await prisma.user.findMany({
            where: { role },
            skip,
            take,
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    // Update user role
    static async updateRole(id, role) {
        return await prisma.user.update({
            where: { id },
            data: { role }
        });
    }

    // Toggle user verification status
    static async toggleVerification(id, verified) {
        return await prisma.user.update({
            where: { id },
            data: { verified }
        });
    }



    // Get public profile of user (without sensitive info)
    static async getPublicProfile(id) {
        return await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                role: true,
                verified: true,
                provider: true,
                createdAt: true
            }
        });
    }

    // Count users by provider
    static async countByProvider(provider) {
        return await prisma.user.count({
            where: { provider }
        });
    }


    // Reset password for user
    static async resetPassword(userId, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        return await User.update(userId, { password: hashedPassword });
    }

    // Change password for authenticated user
    static async changePassword(userId, oldPassword, newPassword) {
        const user = await User.findByIdOrFail(userId);

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

    // Verify email with code
    static async verifyEmail(email, code) {
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

        const updatedUser = await User.update(user.id, { verified: true });
        await prisma.verificationCode.delete({ where: { id: verificationCode.id } });

        return updatedUser;
    }
    async saveResetPasswordCode (user, code) {
        await prisma.verificationCode.create({
            data: {
                userId: user.id,
                code: code,
                type: 'password_reset',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
            }
        });
    }

    async sendResetPasswordEmail(user, code) {
        const mailOptions = {
            from: '"Phishing Awareness" <>',
            to: user.email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Use the following code to reset your password: ${code}. This code will expire in 15 minutes. If you did not request this, please ignore this email.`
        };
        await transporter.sendMail(mailOptions);
    }

}