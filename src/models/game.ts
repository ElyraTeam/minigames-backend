export interface RoomOptions {
  rounds: number;
  letters: string[];
  categories: string[];
  maxPlayers: number;
}

export class Game {
  public players: Player[] = [];
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
}
export class Player {
  public authToken: string = "";
  constructor(public nickname: string, public owner: boolean) {}
}
