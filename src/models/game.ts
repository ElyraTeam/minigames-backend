import { Socket } from "socket.io";
import storage from "../storage";

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

  sync() {
    storage.io.to(this.id).emit("sync", {
      id: this.id,
      owner: this.owner,
      state: this.state,
      currentRound: this.currentRound,
      currentCategory: this.currentCategory,
    });
  }

  syncOptions() {
    storage.io.to(this.id).emit("options", {
      id: this.id,
      options: this.options,
    });
  }

  syncPlayers() {
    storage.io.to(this.id).emit("players", {
      id: this.id,
      players: this.players.map((p) => ({
        nickname: p.nickname,
        online: p.online,
        owner: p.owner,
        totalScore: p.totalScore,
        lastRoundScore: p.lastRoundScore,
      })),
    });
  }

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
  public socket?: Socket;
  public totalScore = 0;
  public lastRoundScore = 0;

  constructor(
    public nickname: string,
    public owner: boolean,
    public sessionId: string
  ) {}
}
