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
  WAITING, //used after someone stopped
  GAME_OVER,
}

export type PlayerValues = { [name: string]: string };
export type Points = { [name: string]: number };
export type Votes = { [name: string]: number[] };
export type ClientVotes = { [key: string]: { [k: string]: number } };

export interface RoundData {
  round: number;
  stopClicker: string;
  letter: string;
  playerValues: { [name: string]: PlayerValues };
  finalPoints: Points;
  recievedVotes: string[];
  votes: { [name: string]: Votes };
  clientVotes: ClientVotes;
}

export class Game {
  public players: Player[] = [];
  public currentRound = 1;
  public currentLetter: string = "";
  public state: State = State.LOBBY;
  public currentVotingCategory: number = 0;
  public doneLetters: string[] = [];
  public kickedPlayerSessions: string[] = [];
  public stoppedAt: number = 0;

  public roundData: { [key: number]: RoundData | undefined } = {};

  constructor(
    public id: string,
    public owner: string,
    public options: RoomOptions
  ) {}

  toJson() {
    return JSON.stringify(
      this,
      (key, value) =>
        value instanceof Map ? Object.fromEntries(value) : value,
      2
    );
  }

  reset() {
    this.state = State.LOBBY;
    this.currentLetter = "";
    this.doneLetters = [];
    this.roundData = {};
    this.currentVotingCategory = 0;
    this.currentRound = 1;
    this.stoppedAt = 0;
  }

  getCurrentCategoryVoteData() {
    const category = this.options.categories[this.currentVotingCategory];
    const roundData = this.roundData[this.currentRound]!;

    let plrData: PlayerValues = {};
    Object.entries(roundData.playerValues).forEach(([key, val]) => {
      const categoryValue = val[category];
      plrData[key] = categoryValue;

      //TODO: calculate initial votes
      roundData.finalPoints[key] = 0;
    });

    //send first category
    const categoryData = {
      category,
      values: plrData,
      votes: roundData.finalPoints,
    };
    return categoryData;
  }

  sync() {
    storage.io.to(this.id).emit("sync", {
      id: this.id,
      owner: this.owner,
      state: this.state,
      currentRound: this.currentRound,
      currentLetter: this.currentLetter,
      stopClicker: this.roundData[this.currentRound]?.stopClicker,
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
        voted: p.voted,
      })),
    });
  }

  kick(toKick: Player) {
    if (toKick.socketId) {
      toKick.getSocket()?.emit("kick", "تم طردك من الغرفة.");
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

  updateVoteCount() {
    this.toAllPlayers().emit(
      "update-vote-count",
      this.roundData[this.currentRound]?.recievedVotes.length ?? 0
    );
  }

  updatePlayerVotes() {
    this.toAllPlayers().emit(
      "player-votes",
      this.roundData[this.currentRound]?.clientVotes ?? {}
    );
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
  public voted: boolean = false;

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
