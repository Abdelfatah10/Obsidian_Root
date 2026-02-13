import { Router } from 'express';
import * as companyController from '../controllers/company.controller.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { ROLES } from '../utils/constants/roles.js';

const companyRoutes = Router();

// Protected routes (Enterprise users only)
companyRoutes.get('/profile', authenticate, authorize([ROLES.ENTERPRISE]), companyController.getCompanyProfile);
companyRoutes.put('/profile', authenticate, authorize([ROLES.ENTERPRISE]), companyController.updateCompanyProfile);

// Employee management
companyRoutes.post('/employees/invite', authenticate, authorize([ROLES.ENTERPRISE]), companyController.inviteEmployee);
companyRoutes.post('/employees/bulk-invite', authenticate, authorize([ROLES.ENTERPRISE]), companyController.bulkInviteEmployees);
companyRoutes.get('/employees', authenticate, authorize([ROLES.ENTERPRISE]), companyController.getEmployees);
companyRoutes.get('/employees/stats', authenticate, authorize([ROLES.ENTERPRISE]), companyController.getEmployeeStats);
companyRoutes.get('/employees/status/:status', authenticate, authorize([ROLES.ENTERPRISE]), companyController.getEmployeesByStatus);
companyRoutes.put('/employees/:employeeId', authenticate, authorize([ROLES.ENTERPRISE]), companyController.updateEmployee);
companyRoutes.delete('/employees/:employeeId', authenticate, authorize([ROLES.ENTERPRISE]), companyController.deleteEmployee);
companyRoutes.post('/employees/:employeeId/resend', authenticate, authorize([ROLES.ENTERPRISE]), companyController.resendInvitation);

// Public routes for invitation response
companyRoutes.post('/invite/accept', companyController.acceptInvitation);
companyRoutes.post('/invite/reject', companyController.rejectInvitation);

// Extension callback route
companyRoutes.post('/extension/installed', companyController.markExtensionInstalled);

export default companyRoutes;
