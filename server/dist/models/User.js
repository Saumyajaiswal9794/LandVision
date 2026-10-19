"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const UserSchema = new mongoose_1.Schema({
    supabaseId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    role: {
        type: String,
        enum: ['DIGITIZER', 'REVIEWER', 'ADMIN'],
        default: 'DIGITIZER',
    },
}, {
    timestamps: true,
});
exports.User = (0, mongoose_1.model)('User', UserSchema);
exports.default = exports.User;
