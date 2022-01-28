import { Socket } from "socket.io";
import storage from "../storage";
import { ChatMessage } from "./socket";

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
  WAITING, //used in between rounds
}

export interface RoundData {
  round: number;
  stopClicker: string;
  letter: string;
  playerValues: Map<string, { [name: string]: string }>;
  finalPoints: Map<string, number>;
  recievedVotes: string[];
  votes: Map<string, number[]>;
}

export class Game {
  public players: Player[] = [];
  public currentRound = 1;
  public currentLetter: string = "";
  public state: State = State.LOBBY;
  private doneLetters: string[] = [];
  public kickedPlayerSessions: string[] = [];

  public roundData: Map<number, RoundData> = new Map();

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
      currentLetter: this.currentLetter,
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

  kick(toKick: Player) {
    if (toKick.socketId) {
      toKick.getSocket()?.emit("kick", "You were kicked.");
      toKick.getSocket()?.disconnect();
    }
  }

  chat(sender: string, message: string) {
    storage.io.to(this.id).emit("chat", {
      type: sender === "system" ? "system" : "player",
      sender,
      message,
    } as ChatMessage);
  }

  newRandomLetter() {
    let letter =
      this.options.letters[
        Math.floor(Math.random() * this.options.letters.length)
      ];
    while (this.doneLetters.includes(letter)) {
      letter =
        this.options.letters[
          Math.floor(Math.random() * this.options.letters.length)
        ];
    }
    return letter;
  }

  toAllPlayers() {
    return storage.io.to(this.id);
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

  removePlayer(nickname: string) {
    this.players = this.players.filter((p) => p.nickname !== nickname);
  }
}
export class Player {
  public authToken?: string;
  public online: boolean = false;
  public totalScore = 0;
  public lastRoundScore = 0;
  public socketId?: string;

  constructor(
    public nickname: string,
    public owner: boolean,
    public sessionId: string
  ) {}

  getSocket() {
    if (!this.socketId) {
      return undefined;
    }
    return storage.io.sockets.sockets.get(this.socketId);
  }
}
