import { NextFunction, Request, Response } from "express";
import { errors } from "../config/errors.js";
import env from "../env.js";
import jwt, { JwtPayload } from "jsonwebtoken";

export const authTokenMiddleware = (
  req: Request,
  _: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const accessToken = authHeader.substring(7, authHeader.length);
    req.auth = accessToken;
  }
  next();
};

export const authUserMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.auth) {
    throw errors.invalidAuth;
  }

  try {
    const decoded = jwt.verify(req.auth, env.JWT_SECRET) as JwtPayload;

    if (decoded.sub) {
      req.session = { id: decoded.sub as string };
      next();
    }
  } catch (err) {
    throw errors.invalidAuth;
  }
};

export const authMiddlewares = [authTokenMiddleware, authUserMiddleware];
