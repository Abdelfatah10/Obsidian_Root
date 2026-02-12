import { prisma } from '../prisma/client.js';


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


    async create() {
        const createdUser = await prisma.user.create({
            data: {
                email: this.email,
                password: this.password,
                role: this.role || 'user',
                provider: 'local',
                verified: false
            }
        });
        const verificationCode = await prisma.verificationCode.create({
            data: {
                userId: createdUser.id,
                code: Math.floor(100000 + Math.random() * 900000).toString(),
                expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
            }
        });
        this.id = createdUser.id;
        this.createdAt = createdUser.createdAt;
        this.updatedAt = createdUser.updatedAt;
        return createdUser;
    }

    async createWithGoogle() {
        const createdUser = await prisma.user.create({
            data: {
                email: this.email,
                googleId: this.googleId,
                provider: 'google',
                verified: true
            }
        });
        this.id = createdUser.id;
        this.createdAt = createdUser.createdAt;
        this.updatedAt = createdUser.updatedAt;
        return createdUser;
    }

    /**
     * Update user by ID
     * @param {string} id - User ID
     * @param {Object} data - Data to update
     * @returns {Promise<Object>} Updated user
     */
    static async update(id, data) {
        return await prisma.user.update({
            where: { id },
            data
        });
    }

    /**
     * Delete user by ID
     * @param {string} id - User ID
     * @returns {Promise<Object>} Deleted user
     */
    static async delete(id) {
        return await prisma.user.delete({
            where: { id }
        });
    }

    /**
     * Get all users (paginated)
     * @param {number} skip - Number of records to skip
     * @param {number} take - Number of records to take
     * @returns {Promise<Array>} Array of users
     */
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

    /**
     * Count total users
     * @returns {Promise<number>} Total user count
     */
    static async count() {
        return await prisma.user.count();
    }

    /**
     * Search users by email or name
     * @param {string} searchTerm - Search term
     * @param {number} skip - Number of records to skip
     * @param {number} take - Number of records to take
     * @returns {Promise<Array>} Array of matched users
     */
    static async search(searchTerm, skip = 0, take = 10) {
        return await prisma.user.findMany({
            where: {
                email: { contains: searchTerm, mode: 'insensitive' }
            },
            skip,
            take,
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Get users by role
     * @param {string} role - User role
     * @param {number} skip - Number of records to skip
     * @param {number} take - Number of records to take
     * @returns {Promise<Array>} Array of users with specified role
     */
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

    /**
     * Check if user exists by email
     * @param {string} email - User email
     * @returns {Promise<boolean>} True if user exists
     */
    static async existsByEmail(email) {
        const user = await prisma.user.findUnique({
            where: { email }
        });
        return !!user;
    }

    /**
     * Check if user exists by ID
     * @param {string} id - User ID
     * @returns {Promise<boolean>} True if user exists
     */
    static async existsById(id) {
        const user = await prisma.user.findUnique({
            where: { id }
        });
        return !!user;
    }

    /**
     * Update user role
     * @param {string} id - User ID
     * @param {string} role - New role
     * @returns {Promise<Object>} Updated user
     */
    static async updateRole(id, role) {
        return await prisma.user.update({
            where: { id },
            data: { role }
        });
    }

    /**
     * Toggle user verification status
     * @param {string} id - User ID
     * @param {boolean} verified - Verification status
     * @returns {Promise<Object>} Updated user
     */
    static async toggleVerification(id, verified) {
        return await prisma.user.update({
            where: { id },
            data: { verified }
        });
    }



    /**
     * Get user public profile (safe information)
     * @param {string} id - User ID
     * @returns {Promise<Object>} User public profile
     */
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

    /**
     * Get user count by provider
     * @param {string} provider - OAuth provider name
     * @returns {Promise<number>} Count of users for provider
     */
    static async countByProvider(provider) {
        return await prisma.user.count({
            where: { provider }
        });
    }
}