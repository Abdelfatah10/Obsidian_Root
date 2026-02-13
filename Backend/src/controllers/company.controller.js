import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client.js';
import { STATUS } from '../utils/constants/statusCodes.js';
import { catchAsync } from '../utils/catchAsync.js';
import { transporter } from '../services/mailerService.js';
import { ENV } from '../config/env.js';

// Get company profile
export const getCompanyProfile = catchAsync(async (req, res) => {
    const userId = req.user.id;

    const entreprise = await prisma.entreprise.findUnique({
        where: { userId },
        include: {
            employees: {
                select: {
                    id: true,
                    email: true,
                    status: true,
                    extensionInstalled: true,
                    invitedAt: true,
                    respondedAt: true,
                    installedAt: true,
                }
            }
        }
    });

    if (!entreprise) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'Enterprise profile not found'
            }
        });
    }

    res.status(STATUS.OK).json({
        success: true,
        data: entreprise
    });
});

// Create or update company profile
export const updateCompanyProfile = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { name, description, website, logoUrl } = req.body;

    if (!name) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Company name is required'
            }
        });
    }

    const entreprise = await prisma.entreprise.upsert({
        where: { userId },
        update: {
            name,
            description,
            website,
            logoUrl
        },
        create: {
            userId,
            name,
            description,
            website,
            logoUrl
        }
    });

    res.status(STATUS.OK).json({
        success: true,
        message: 'Company profile updated successfully',
        data: entreprise
    });
});

// Invite employee by email
export const inviteEmployee = catchAsync(async (req, res) => {
    const userId = req.user.id;
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

    // Check if user has an enterprise
    const entreprise = await prisma.entreprise.findUnique({
        where: { userId }
    });

    if (!entreprise) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'You must create a company profile first'
            }
        });
    }

    // Check if employee already invited
    const existingInvite = await prisma.companyEmployee.findUnique({
        where: {
            entrepriseId_email: {
                entrepriseId: entreprise.id,
                email
            }
        }
    });

    if (existingInvite) {
        return res.status(STATUS.CONFLICT).json({
            success: false,
            error: {
                status: STATUS.CONFLICT,
                message: 'This email has already been invited'
            }
        });
    }

    // Generate invite token
    const inviteToken = uuidv4();

    // Create employee invite
    const employee = await prisma.companyEmployee.create({
        data: {
            entrepriseId: entreprise.id,
            email,
            inviteToken
        }
    });

    // Send invitation email
    const extensionUrl = ENV.EXTENSION_URL || 'https://chrome.google.com/webstore/detail/your-extension-id';
    const acceptUrl = `${ENV.DOMAIN_URL || 'http://localhost:9000'}/invite/accept?token=${inviteToken}`;

    const mailOptions = {
        from: ENV.EMAIL_USER,
        to: email,
        subject: `${entreprise.name} invites you to join their security platform`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0ea5e9;">You've been invited!</h2>
                <p><strong>${entreprise.name}</strong> has invited you to join their phishing protection platform.</p>
                
                <h3>Get Started:</h3>
                <ol>
                    <li>
                        <strong>Install the Extension:</strong><br>
                        <a href="${extensionUrl}" style="color: #0ea5e9;">Download Chrome Extension</a>
                    </li>
                    <li>
                        <strong>Accept the Invitation:</strong><br>
                        <a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #0ea5e9, #8b5cf6); color: white; text-decoration: none; border-radius: 8px; margin-top: 10px;">Accept Invitation</a>
                    </li>
                </ol>
                
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    If you did not expect this invitation, you can ignore this email.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        // Don't fail the request, email sending is not critical
    }

    res.status(STATUS.CREATED).json({
        success: true,
        message: 'Invitation sent successfully',
        data: {
            id: employee.id,
            email: employee.email,
            status: employee.status,
            invitedAt: employee.invitedAt
        }
    });
});

// Bulk invite employees
export const bulkInviteEmployees = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'An array of emails is required'
            }
        });
    }

    const entreprise = await prisma.entreprise.findUnique({
        where: { userId }
    });

    if (!entreprise) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'You must create a company profile first'
            }
        });
    }

    const results = {
        success: [],
        failed: [],
        alreadyInvited: []
    };

    for (const email of emails) {
        try {
            // Check if already invited
            const existingInvite = await prisma.companyEmployee.findUnique({
                where: {
                    entrepriseId_email: {
                        entrepriseId: entreprise.id,
                        email
                    }
                }
            });

            if (existingInvite) {
                results.alreadyInvited.push(email);
                continue;
            }

            const inviteToken = uuidv4();

            await prisma.companyEmployee.create({
                data: {
                    entrepriseId: entreprise.id,
                    email,
                    inviteToken
                }
            });

            // Send email (non-blocking)
            const extensionUrl = ENV.EXTENSION_URL || 'https://chrome.google.com/webstore/detail/your-extension-id';
            const acceptUrl = `${ENV.DOMAIN_URL || 'http://localhost:9000'}/invite/accept?token=${inviteToken}`;

            transporter.sendMail({
                from: ENV.EMAIL_USER,
                to: email,
                subject: `${entreprise.name} invites you to join their security platform`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #0ea5e9;">You've been invited!</h2>
                        <p><strong>${entreprise.name}</strong> has invited you to join their phishing protection platform.</p>
                        <p><a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #0ea5e9, #8b5cf6); color: white; text-decoration: none; border-radius: 8px;">Accept Invitation</a></p>
                        <p>Install extension: <a href="${extensionUrl}">${extensionUrl}</a></p>
                    </div>
                `
            }).catch(err => console.error('Email send error:', err));

            results.success.push(email);
        } catch (error) {
            results.failed.push({ email, error: error.message });
        }
    }

    res.status(STATUS.OK).json({
        success: true,
        message: 'Bulk invitation completed',
        data: results
    });
});

// Get all employees (with filtering)
export const getEmployees = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { status, extensionInstalled, page = 1, limit = 20 } = req.query;

    const entreprise = await prisma.entreprise.findUnique({
        where: { userId }
    });

    if (!entreprise) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'Enterprise profile not found'
            }
        });
    }

    const where = {
        entrepriseId: entreprise.id,
        ...(status && { status }),
        ...(extensionInstalled !== undefined && { extensionInstalled: extensionInstalled === 'true' })
    };

    const [employees, total] = await Promise.all([
        prisma.companyEmployee.findMany({
            where,
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit),
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                status: true,
                extensionInstalled: true,
                invitedAt: true,
                respondedAt: true,
                installedAt: true,
                user: {
                    select: {
                        id: true,
                        email: true
                    }
                }
            }
        }),
        prisma.companyEmployee.count({ where })
    ]);

    res.status(STATUS.OK).json({
        success: true,
        data: {
            employees,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        }
    });
});

// Get employees by status
export const getEmployeesByStatus = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { status } = req.params;

    const validStatuses = ['pending', 'accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: `Status must be one of: ${validStatuses.join(', ')}`
            }
        });
    }

    const entreprise = await prisma.entreprise.findUnique({
        where: { userId }
    });

    if (!entreprise) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'Enterprise profile not found'
            }
        });
    }

    const employees = await prisma.companyEmployee.findMany({
        where: {
            entrepriseId: entreprise.id,
            status
        },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            email: true,
            status: true,
            extensionInstalled: true,
            invitedAt: true,
            respondedAt: true,
            installedAt: true
        }
    });

    res.status(STATUS.OK).json({
        success: true,
        data: employees
    });
});

// Get employee stats
export const getEmployeeStats = catchAsync(async (req, res) => {
    const userId = req.user.id;

    const entreprise = await prisma.entreprise.findUnique({
        where: { userId }
    });

    if (!entreprise) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'Enterprise profile not found'
            }
        });
    }

    const [total, pending, accepted, rejected, withExtension] = await Promise.all([
        prisma.companyEmployee.count({ where: { entrepriseId: entreprise.id } }),
        prisma.companyEmployee.count({ where: { entrepriseId: entreprise.id, status: 'pending' } }),
        prisma.companyEmployee.count({ where: { entrepriseId: entreprise.id, status: 'accepted' } }),
        prisma.companyEmployee.count({ where: { entrepriseId: entreprise.id, status: 'rejected' } }),
        prisma.companyEmployee.count({ where: { entrepriseId: entreprise.id, extensionInstalled: true } })
    ]);

    res.status(STATUS.OK).json({
        success: true,
        data: {
            total,
            pending,
            accepted,
            rejected,
            withExtension,
            acceptanceRate: total > 0 ? ((accepted / total) * 100).toFixed(1) : 0,
            extensionRate: accepted > 0 ? ((withExtension / accepted) * 100).toFixed(1) : 0
        }
    });
});

// Update employee
export const updateEmployee = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { employeeId } = req.params;
    const { email } = req.body;

    const entreprise = await prisma.entreprise.findUnique({
        where: { userId }
    });

    if (!entreprise) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'Enterprise profile not found'
            }
        });
    }

    const employee = await prisma.companyEmployee.findFirst({
        where: {
            id: parseInt(employeeId),
            entrepriseId: entreprise.id
        }
    });

    if (!employee) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'Employee not found'
            }
        });
    }

    // Only allow email update if status is pending
    if (employee.status !== 'pending' && email) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Cannot change email of an employee who has already responded'
            }
        });
    }

    const updatedEmployee = await prisma.companyEmployee.update({
        where: { id: parseInt(employeeId) },
        data: { email }
    });

    res.status(STATUS.OK).json({
        success: true,
        message: 'Employee updated successfully',
        data: updatedEmployee
    });
});

// Delete/remove employee
export const deleteEmployee = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { employeeId } = req.params;

    const entreprise = await prisma.entreprise.findUnique({
        where: { userId }
    });

    if (!entreprise) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'Enterprise profile not found'
            }
        });
    }

    const employee = await prisma.companyEmployee.findFirst({
        where: {
            id: parseInt(employeeId),
            entrepriseId: entreprise.id
        }
    });

    if (!employee) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'Employee not found'
            }
        });
    }

    await prisma.companyEmployee.delete({
        where: { id: parseInt(employeeId) }
    });

    res.status(STATUS.OK).json({
        success: true,
        message: 'Employee removed successfully'
    });
});

// Resend invitation
export const resendInvitation = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { employeeId } = req.params;

    const entreprise = await prisma.entreprise.findUnique({
        where: { userId }
    });

    if (!entreprise) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'Enterprise profile not found'
            }
        });
    }

    const employee = await prisma.companyEmployee.findFirst({
        where: {
            id: parseInt(employeeId),
            entrepriseId: entreprise.id
        }
    });

    if (!employee) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'Employee not found'
            }
        });
    }

    if (employee.status !== 'pending') {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Can only resend invitations for pending employees'
            }
        });
    }

    // Generate new token
    const newToken = uuidv4();
    await prisma.companyEmployee.update({
        where: { id: parseInt(employeeId) },
        data: { inviteToken: newToken }
    });

    // Resend email
    const extensionUrl = ENV.EXTENSION_URL || 'https://chrome.google.com/webstore/detail/your-extension-id';
    const acceptUrl = `${ENV.DOMAIN_URL || 'http://localhost:9000'}/invite/accept?token=${newToken}`;

    try {
        await transporter.sendMail({
            from: ENV.EMAIL_USER,
            to: employee.email,
            subject: `Reminder: ${entreprise.name} invites you to join their security platform`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #0ea5e9;">Reminder: You've been invited!</h2>
                    <p><strong>${entreprise.name}</strong> has invited you to join their phishing protection platform.</p>
                    <p><a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #0ea5e9, #8b5cf6); color: white; text-decoration: none; border-radius: 8px;">Accept Invitation</a></p>
                    <p>Install extension: <a href="${extensionUrl}">${extensionUrl}</a></p>
                </div>
            `
        });

        res.status(STATUS.OK).json({
            success: true,
            message: 'Invitation resent successfully'
        });
    } catch (error) {
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: {
                status: STATUS.INTERNAL_SERVER_ERROR,
                message: 'Failed to send email'
            }
        });
    }
});

// Accept invitation (public route - called by invited user)
export const acceptInvitation = catchAsync(async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Invitation token is required'
            }
        });
    }

    const employee = await prisma.companyEmployee.findUnique({
        where: { inviteToken: token },
        include: { entreprise: true }
    });

    if (!employee) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'Invalid or expired invitation'
            }
        });
    }

    if (employee.status !== 'pending') {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'This invitation has already been responded to'
            }
        });
    }

    // Check if user exists with this email
    const user = await prisma.user.findUnique({
        where: { email: employee.email }
    });

    await prisma.companyEmployee.update({
        where: { id: employee.id },
        data: {
            status: 'accepted',
            respondedAt: new Date(),
            userId: user?.id || null
        }
    });

    res.status(STATUS.OK).json({
        success: true,
        message: 'Invitation accepted successfully',
        data: {
            companyName: employee.entreprise.name
        }
    });
});

// Reject invitation (public route)
export const rejectInvitation = catchAsync(async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'Invitation token is required'
            }
        });
    }

    const employee = await prisma.companyEmployee.findUnique({
        where: { inviteToken: token }
    });

    if (!employee) {
        return res.status(STATUS.NOT_FOUND).json({
            success: false,
            error: {
                status: STATUS.NOT_FOUND,
                message: 'Invalid or expired invitation'
            }
        });
    }

    if (employee.status !== 'pending') {
        return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            error: {
                status: STATUS.BAD_REQUEST,
                message: 'This invitation has already been responded to'
            }
        });
    }

    await prisma.companyEmployee.update({
        where: { id: employee.id },
        data: {
            status: 'rejected',
            respondedAt: new Date()
        }
    });

    res.status(STATUS.OK).json({
        success: true,
        message: 'Invitation rejected'
    });
});

// Mark extension as installed (called by extension)
export const markExtensionInstalled = catchAsync(async (req, res) => {
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

    const employees = await prisma.companyEmployee.updateMany({
        where: {
            email,
            extensionInstalled: false
        },
        data: {
            extensionInstalled: true,
            installedAt: new Date()
        }
    });

    res.status(STATUS.OK).json({
        success: true,
        message: employees.count > 0 ? 'Extension installation recorded' : 'No matching records to update',
        data: { updated: employees.count }
    });
});
