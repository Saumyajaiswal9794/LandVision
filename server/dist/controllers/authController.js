"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncUser = exports.getProfile = void 0;
const getProfile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        res.status(200).json({ user: req.user });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getProfile = getProfile;
const syncUser = async (req, res) => {
    try {
        // Boilerplate for syncing Supabase auth state metadata into MongoDB User records
        res.status(200).json({
            message: 'User synchronized successfully',
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.syncUser = syncUser;
