import { ObjectId } from "mongodb";
import { GameId } from "./base.js";

export interface Feedback {
  _id: ObjectId;
  receivedAt: number;
  email: string;
  game: GameId;
  name: string;
  message: string;
}
