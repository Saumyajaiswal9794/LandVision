"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Missing or malformed Authorization header' });
            return;
        }
        const token = authHeader.split(' ')[1];
        // Placeholder: Real implementation would verify JWT using env.SUPABASE_JWT_SECRET or Supabase client
        if (!token) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        // Mock decode for scaffolding purposes:
        req.user = {
            id: 'usr_mock_123',
            email: 'mock@landvision.gov.in',
            role: 'REVIEWER',
        };
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Unauthorized', details: error.message });
    }
};
exports.requireAuth = requireAuth;
