import { STATUS } from '../utils/constants/statusCodes.js';
import { MESSAGES } from '../utils/constants/messages.js';


const roleMiddleware = (allowedRoles = []) => {
    return (req, res, next) => {
        try {
            const userRole = req.user?.role;

            if (!userRole) {
                return res.status(401).json({ 
                    success: false,
                    error: {
                        status: STATUS.UNAUTHORIZED,
                        message: MESSAGES.UNAUTHORIZED_NO_ROLE
                    }
                });
            }

            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json({ 
                    success: false,
                    error: {
                        status: STATUS.FORBIDDEN,
                        message: MESSAGES.FORBIDDEN_INSUFFICIENT_PERMISSIONS
                    }
                });
            }

            next();
        } catch (error) {
            res.status(500).json({ 
                success: false,
                error: {
                    status: STATUS.INTERNAL_SERVER_ERROR,
                    message: MESSAGES.INTERNAL_SERVER_ERROR
                }
            });
        }
    };
};

export default roleMiddleware;