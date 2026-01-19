export {};

declare global {
  namespace Express {
    interface Request {
      auth?: string;
      session?: { id?: string };
    }
  }
}
