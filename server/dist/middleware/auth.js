"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const supabaseAdmin_1 = __importDefault(require("../config/supabaseAdmin"));
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        // Check for missing or malformed Authorization header
        if (!authHeader) {
            res.status(401).json({ error: 'Missing Authorization header' });
            return;
        }
        if (!authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Invalid Authorization header format. Expected "Bearer <token>"' });
            return;
        }
        const token = authHeader.slice(7); // Remove 'Bearer ' prefix
        if (!token || token.length === 0) {
            res.status(401).json({ error: 'Invalid or empty token' });
            return;
        }
        // Verify token with Supabase Admin client
        const { data, error } = await supabaseAdmin_1.default.auth.getUser(token);
        if (error) {
            res.status(401).json({ error: 'Invalid or expired token', details: error.message });
            return;
        }
        if (!data.user) {
            res.status(401).json({ error: 'Token verification failed: no user data' });
            return;
        }
        // Attach user info to request
        req.user = {
            id: data.user.id,
            email: data.user.email || '',
            user_metadata: data.user.user_metadata,
        };
        next();
    }
    catch (error) {
        console.error('[Auth Error]', error);
        res.status(401).json({ error: 'Authentication failed', details: error.message });
    }
};
exports.requireAuth = requireAuth;
