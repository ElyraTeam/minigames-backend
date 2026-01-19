import { GameId } from "./base.js";

export interface GameStats {
  gameCount: number;
  playerCount: number;
}

export type AllGamesStats = {
  [key in GameId]: GameStats;
};
