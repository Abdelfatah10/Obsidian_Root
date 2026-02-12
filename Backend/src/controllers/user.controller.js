import { STATUS } from '../utils/constants/statusCodes.js';
import { MESSAGES } from '../utils/constants/messages.js';
import { catchAsync } from '../utils/catchAsync.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { singleFileUpload } from '../middleware/uploadMiddleware.js';
import User from '../models/User.js';
import { ROLES } from '../utils/constants/roles.js';

/**
 * Get current user profile
 * GET /users/me
 */
export const getCurrentUserProfile = catchAsync(async (req, res, next) => {
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

    const user = await User.getPublicProfile(userId);

    if (!user) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: MESSAGES.USER_NOT_FOUND
            }
        });
    }

    res.status(STATUS.OK).json({
        success: true,
        data: user
    });
});

/**
 * Get user profile by ID
 * GET /users/:id
 */
export const getUserProfile = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const user = await User.getPublicProfile(Number(id));

    if (!user) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: MESSAGES.USER_NOT_FOUND
            }
        });
    }

    res.status(STATUS.OK).json({
        success: true,
        data: user
    });
});

/**
 * Update user profile
 * PUT /users/me
 */
export const updateUserProfile = catchAsync(async (req, res, next) => {
    const userId = req.user?.id;
    const { firstName, lastName } = req.body;

    if (!userId) {
        return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                status: STATUS.UNAUTHORIZED,
                message: MESSAGES.UNAUTHORIZED
            }
        });
    }

    // Validate fields
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;

    if (req.fileUrl) {
        updateData.photo_url = req.fileUrl;
    }

    if (Object.keys(updateData).length === 0) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Please provide at least one field to update'
            }
        });
    }

    const user = await User.update(userId, updateData);

    res.status(STATUS.OK).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            photo_url: user.photo_url
        }
    });
});

/**
 * Upload user profile photo
 * POST /users/avatar
 */
export const uploadProfilePhoto = catchAsync(async (req, res, next) => {
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

    if (!req.fileUrl) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'No file uploaded'
            }
        });
    }

    const user = await User.updatePhotoUrl(userId, req.fileUrl);

    res.status(STATUS.OK).json({
        success: true,
        message: 'Profile photo uploaded successfully',
        data: {
            id: user.id,
            photo_url: user.photo_url
        }
    });
});

/**
 * Get all users (Admin only)
 * GET /users
 */
export const getAllUsers = catchAsync(async (req, res, next) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const users = await User.getAll(skip, Number(limit));
    const total = await User.count();

    res.status(STATUS.OK).json({
        success: true,
        data: users,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
        }
    });
});

/**
 * Search users (Admin only)
 * GET /users/search
 */
export const searchUsers = catchAsync(async (req, res, next) => {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Search query is required'
            }
        });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const users = await User.search(q, skip, Number(limit));

    res.status(STATUS.OK).json({
        success: true,
        data: users,
        pagination: {
            page: Number(page),
            limit: Number(limit)
        }
    });
});

/**
 * Update user role (Admin only)
 * PUT /users/:id/role
 */
export const updateUserRole = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    if (!role || !Object.values(ROLES).includes(role)) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Invalid role'
            }
        });
    }

    // Check if user exists
    const exists = await User.existsById(Number(id));
    if (!exists) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: MESSAGES.USER_NOT_FOUND
            }
        });
    }

    const user = await User.updateRole(Number(id), role);

    res.status(STATUS.OK).json({
        success: true,
        message: 'User role updated successfully',
        data: {
            id: user.id,
            email: user.email,
            role: user.role
        }
    });
});

/**
 * Delete user (Admin only)
 * DELETE /users/:id
 */
export const deleteUser = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    // Check if user exists
    const exists = await User.existsById(Number(id));
    if (!exists) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: MESSAGES.USER_NOT_FOUND
            }
        });
    }

    await User.delete(Number(id));

    res.status(STATUS.OK).json({
        success: true,
        message: 'User deleted successfully'
    });
});

/**
 * Get user statistics (Admin only)
 * GET /users/stats/overview
 */
export const getUserStatistics = catchAsync(async (req, res, next) => {
    const totalUsers = await User.count();
    const localUsers = await User.countByProvider('local');
    const googleUsers = await User.countByProvider('google');

    res.status(STATUS.OK).json({
        success: true,
        data: {
            totalUsers,
            localUsers,
            googleUsers
        }
    });
});

export default {
    getCurrentUserProfile,
    getUserProfile,
    updateUserProfile,
    uploadProfilePhoto,
    getAllUsers,
    searchUsers,
    updateUserRole,
    deleteUser,
    getUserStatistics
};
