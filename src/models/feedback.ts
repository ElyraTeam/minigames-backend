import { GameId } from "./base.js";

export interface Feedback {
  receivedAt: number;
  email: string;
  game: GameId;
  name: string;
  message: string;
}
