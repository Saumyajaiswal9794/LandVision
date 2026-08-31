import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  console.error(`[Error] ${req.method} ${req.url}:`, error);

  const status = 'status' in error ? (error.status as number) : 500;
  const message = error.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
};
export default errorHandler;
