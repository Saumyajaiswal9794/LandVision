"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (error, req, res, _next) => {
    console.error(`[Error] ${req.method} ${req.url}:`, error);
    const status = 'status' in error ? error.status : 500;
    const message = error.message || 'Internal Server Error';
    res.status(status).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
};
exports.errorHandler = errorHandler;
exports.default = exports.errorHandler;
