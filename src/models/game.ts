export interface RoomOptions {
  rounds: number;
  letters: string[];
  categories: string[];
  maxPlayers: number;
}

export enum State {
  LOBBY,
  VOTING,
  INGAME,
}

export class Game {
  public players: Player[] = [];
  public currentRound = 0;
  public currentLetter: string = "";
  public currentCategory: string = "";
  public state: State = State.LOBBY;

  constructor(
    public id: string,
    public owner: string,
    public options: RoomOptions
  ) {}

  isFull() {
    return this.players.length == this.options.maxPlayers;
  }

  hasPlayerWithName(nickname: string) {
    return this.players.some((p) => p.nickname === nickname);
  }

  getPlayerWithName(nickname: string) {
    return this.players.find((p) => p.nickname === nickname);
  }
}
export class Player {
  public authToken: string = "";
  public online: boolean = false;

  constructor(
    public nickname: string,
    public owner: boolean,
    public sessionId: string
  ) {}
}
