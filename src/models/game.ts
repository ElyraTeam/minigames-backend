import storage from "../storage";
import { findMajority } from "../utils/utils";
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
export type Votes = { [name: string]: { [k: string]: number } };
export type ClientVotes = { [key: string]: { [k: string]: number } };

export interface RoundData {
  round: number;
  stopClicker: string;
  letter: string;
  playerValues: { [name: string]: PlayerValues };
  finalPoints: Points;
  confirmedVotes: string[];

  /**
   * Final Votes
   */
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
    this.players.forEach((p) => {
      p.totalScore = 0;
      p.voted = false;
      p.lastRoundScore = 0;
    });
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
      categoryIndex: this.currentVotingCategory,
    };
    return categoryData;
  }

  prepareNewCategoryVoting() {
    const newCategory = this.options.categories[this.currentVotingCategory];
    const roundData = this.roundData[this.currentRound]!;

    roundData.confirmedVotes = [];
    roundData.clientVotes = {};
    this.players.forEach((p) => {
      p.voted = false;
      if (!roundData.votes[p.nickname]) {
        roundData.votes[p.nickname] = {};
      }

      if (newCategory && !roundData.votes[p.nickname][newCategory]) {
        roundData.votes[p.nickname][newCategory] = {};
      }
    });

    if (this.options.categories[this.currentVotingCategory]) {
      this.chat(
        "system",
        `بداية التصويت لـ(${
          this.options.categories[this.currentVotingCategory]
        })`,
        "bold"
      );
    }
  }

  checkEveryoneVoted() {
    const roundData = this.roundData[this.currentRound];
    const category = this.options.categories[this.currentVotingCategory];
    if (roundData && roundData.confirmedVotes.length === this.players.length) {
      //voting done, update final points and initiate new round

      Object.keys(roundData.votes).forEach((nick) => {
        const v = Object.values(roundData.votes[nick][category]);
        let maj = 0;
        if (v.length > 0) {
          maj = findMajority(v);
        }
        const p = this.getPlayerWithName(nick);
        if (p) {
          p.totalScore += maj;
          p.lastRoundScore += maj;
        }
      });

      this.currentVotingCategory++;
      this.prepareNewCategoryVoting();
      this.updatePlayerVotes();
      this.updateVoteCount();

      if (this.currentVotingCategory == this.options.categories.length) {
        //if last round, send game over
        if (this.currentRound == this.options.rounds) {
          this.state = State.GAME_OVER;
        } else {
          this.state = State.LOBBY;
          this.currentRound++;
        }

        this.currentLetter = "";
        this.sync();
      } else {
        this.sendNextCategoryForVoting();
      }

      this.syncPlayers();
    }
  }

  sendNextCategoryForVoting() {
    this.toAllPlayers().emit("start-vote", this.getCurrentCategoryVoteData());
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

  chat(sender: string, message: string, font: "normal" | "bold" = "normal") {
    storage.io.to(this.id).emit("chat", {
      type: sender === "system" ? "system" : "player",
      sender,
      message,
      font,
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
      this.roundData[this.currentRound]?.confirmedVotes.length ?? 0
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
    const roundData = this.roundData[this.currentRound];
    if (roundData) {
      if (roundData.clientVotes[nickname]) {
        delete roundData.clientVotes[nickname];
      }

      if (roundData.confirmedVotes.includes(nickname)) {
        roundData.confirmedVotes = roundData.confirmedVotes.filter(
          (n) => n !== nickname
        );
      }

      if (roundData.votes[nickname]) {
        delete roundData.votes[nickname];
      }

      if (roundData.playerValues[nickname]) {
        delete roundData.playerValues[nickname];
      }

      this.players.forEach((p) => {
        if (p.nickname !== nickname && roundData.votes[p.nickname]) {
          Object.keys(roundData.votes[p.nickname]).forEach((voteCat) => {
            if (roundData.votes[p.nickname][voteCat][nickname]) {
              delete roundData.votes[p.nickname][voteCat][nickname];
            }
          });
        }
      });
    }

    if (this.state == State.VOTING) {
      this.updateVoteCount();
      this.updatePlayerVotes();
      this.sendNextCategoryForVoting();
    }

    this.players = this.players.filter((p) => p.nickname !== nickname);
  }

  removePlayerLogic(nickname: string) {
    const foundPlayer = this.getPlayerWithName(nickname);
    if (foundPlayer) {
      this.removePlayer(nickname);
      if (this.players.length == 0) {
        //last player, delete game;
        storage.removeGame(this.id);
      } else if (this.players.length > 0) {
        //find another owner, for now get next player
        if (foundPlayer.owner) {
          const newOwner = this.players[0];
          newOwner.owner = true;
          this.owner = newOwner.nickname;

          this.chat("system", `اصبح ${this.owner} المسؤول.`);
        }
      }

      this.checkEveryoneVoted();
    }
  }
}
export class Player {
  public authToken?: string;
  public online: boolean = false;
  public totalScore = 0;
  public lastRoundScore = 0;
  public socketId?: string;
  public voted: boolean = false;
  public offlineAt = 0;

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
