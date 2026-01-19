export type GameId = "word" | "minesweeper";

export interface BaseGame {
  id: string;
  gameId: GameId;
  //players is an array of any class implementing BasePlayer
  players: BasePlayer[];

  getPlayerBySessionId(sessionId: string): BasePlayer | undefined;
  getPlayerByNickname(nickname: string): BasePlayer | undefined;
}

export interface AuthenticateRequest {
  game: GameId;
  roomId: string;
  nickname: string;
  authToken: string;
}

export abstract class BasePlayer {
  public online: boolean = false;
  socketId?: string;
  public ready: boolean = false;
  public offlineAt: number = -1;

  constructor(
    protected authToken: string,
    public nickname: string,
    public sessionId: string
  ) {}

  checkAuth(token: string) {
    return this.authToken === token;
  }
}
