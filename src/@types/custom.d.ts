declare namespace Express {
  export interface Request {
    session?: Session;
  }
}
interface Session {
  id?: string;
}
