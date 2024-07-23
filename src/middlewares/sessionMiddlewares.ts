import { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";

export const sessionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.session) {
    req.session = {};
  }

  if (!req.session.id) {
    req.session.id = nanoid();
  }
  next();
};
