import { BaseGame, BasePlayer, GameId } from "../base.js";

export enum MsDifficulty {
  EASY, // 9x9
  MEDIUM, // 16x16
  HARD, // 32x16
  CUSTOM,
}

export interface MsRoomOptions {
  coop: boolean;
  difficulty: MsDifficulty;
}

export class MsGame implements BaseGame {
  public players: MsPlayer[] = [];
  public gameId: GameId = "word";

  constructor(
    public id: string,
    public owner: MsPlayer,
    public options: MsRoomOptions
  ) {}
  getPlayerBySessionId(sessionId: string): BasePlayer | undefined {
    throw new Error("Method not implemented.");
  }
  getPlayerByNickname(nickname: string): BasePlayer | undefined {
    throw new Error("Method not implemented.");
  }
}

export class MsPlayer extends BasePlayer {}
