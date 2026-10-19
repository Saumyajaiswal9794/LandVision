"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRole = exports.requireRole = void 0;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const userRole = req.user.user_metadata?.role;
        if (!userRole) {
            res.status(403).json({
                error: 'Forbidden: User role not set. Please complete profile setup.'
            });
            return;
        }
        if (!allowedRoles.includes(userRole)) {
            res.status(403).json({
                error: `Forbidden: Your role (${userRole}) does not have access to this resource.`
            });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
// Legacy export for backward compatibility
const checkRole = (allowedRoles) => (0, exports.requireRole)(allowedRoles);
exports.checkRole = checkRole;
