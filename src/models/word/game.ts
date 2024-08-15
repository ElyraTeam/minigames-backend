import { Type } from "class-transformer";
import storage from "../../storage.js";
import { findMajority } from "../../utils/utils.js";
import { CategoryVoteData, ChatMessage, ChatMessagePart } from "./socket.js";
import { nanoid } from "nanoid";
import { BaseGame, BasePlayer, GameId } from "../base.js";
import { ChatMessageBuilder } from "../../utils/chat.js";

export interface WordRoomOptions {
  rounds: number;
  letters: string[];
  categories: string[];
  maxPlayers: number;
  isPrivate: boolean;
}

export enum State {
  LOBBY,
  VOTING,
  INGAME,
  WAITING, //used after someone stopped
  GAME_OVER,
}

export type PlayerValues = { [playerId: string]: string };
export type Points = { [playerId: string]: number };
export type Votes = { [playerId: string]: { [k: string]: number } };
export type ClientVotes = { [key: string]: { [k: string]: number } };

export const DEFAULT_CATEGORIES_ARABIC = [
  "ولد",
  "بنت",
  "حيوان",
  "جماد",
  "اكلة",
  "نبات",
  "بلد",
];
export const CHARS_ARABIC: string[] = [
  "أ",
  "ب",
  "ت",
  "ث",
  "ج",
  "ح",
  "خ",
  "د",
  "ذ",
  "ر",
  "ز",
  "س",
  "ش",
  "ص",
  "ض",
  "ط",
  "ظ",
  "ع",
  "غ",
  "ف",
  "ق",
  "ك",
  "ل",
  "م",
  "ن",
  "هـ",
  "و",
  "ى",
];

export interface RoundData {
  round: number;
  stopClickerId: string;
  letter: string;
  playerValues: { [playerId: string]: PlayerValues };
  finalPoints: Points;
  confirmedVotes: string[];

  /**
   * Final Votes
   */
  votes: { [playerId: string]: Votes };
  clientVotes: ClientVotes;
}

export class WordGame implements BaseGame {
  @Type(() => WordPlayer)
  public players: WordPlayer[] = [];
  public currentRound = 1;
  public currentLetter: string = "";
  public state: State = State.LOBBY;
  public currentVotingCategory: number = 0;
  public doneLetters: string[] = [];
  public kickedPlayerSessions: string[] = [];
  public stoppedAt: number = 0;
  public createdAt: Date = new Date();
  public gameId: GameId = "word";

  public roundData: { [key: number]: RoundData | undefined } = {};

  constructor(
    public id: string,
    public ownerId: string,
    public options: WordRoomOptions
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
      p.ready = this.ownerId === p.sessionId;
      p.lastRoundScore = 0;
    });
  }

  checkDuplicatedCategoryValue(value: string, category: string) {
    const roundData = this.roundData[this.currentRound];
    if (roundData) {
      const values = Object.values(roundData.playerValues).map(
        (val) => val[category]
      );
      const occurrences = values.filter(
        (val) => val !== "" && val != undefined && val != null && val == value
      ).length;
      return occurrences > 1;
    }
    return false;
  }

  getCurrentCategoryVoteData(): CategoryVoteData {
    const category = this.options.categories[this.currentVotingCategory];
    const roundData = this.roundData[this.currentRound]!;

    let plrData: PlayerValues = {};
    Object.entries(roundData.playerValues).forEach(([playerId, val]) => {
      const categoryValue = val[category];
      plrData[playerId] = categoryValue;
    });

    //send first category
    const categoryData = {
      category,
      values: plrData,
      votes: this.roundData[this.currentRound]?.clientVotes ?? {},
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
      if (!roundData.votes[p.sessionId]) {
        roundData.votes[p.sessionId] = {};
      }

      if (newCategory && !roundData.votes[p.sessionId][newCategory]) {
        roundData.votes[p.sessionId][newCategory] = {};
      }

      if (!roundData.clientVotes[p.sessionId]) {
        roundData.clientVotes[p.sessionId] = {};
      }
    });

    Object.entries(roundData.playerValues).forEach(([playerId, val]) => {
      const categoryValue = val[newCategory];

      let initialVal: number | null = null;
      if (!categoryValue || categoryValue == "") {
        initialVal = 0;
      }

      console.log(playerId, categoryValue, newCategory, initialVal);

      //if the value is duplicated, everyone should vote 5 for this player except himself
      if (this.checkDuplicatedCategoryValue(categoryValue, newCategory)) {
        initialVal = 5;
      }

      //everyone should vote 0 for this player except himself
      this.players.forEach((p) => {
        if (p.sessionId !== playerId && initialVal !== null) {
          if (roundData.clientVotes[p.sessionId]) {
            roundData.clientVotes[p.sessionId][playerId] = initialVal;
          } else {
            roundData.clientVotes[p.sessionId] = { [playerId]: initialVal };
          }
        }
      });
    });

    if (this.options.categories[this.currentVotingCategory]) {
      this.chat(
        ChatMessageBuilder.new("system", "system")
          .addText("بداية التصويت لـ(")
          .addText(this.options.categories[this.currentVotingCategory], true)
          .addText(")")
          .build()
      );
    }
  }

  emitGameOver(to: WordPlayer | undefined = undefined) {
    const top3 = this.players
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 3);

    if (to) {
      to.getSocket()?.emit("game-over", top3);
    } else {
      this.toAllPlayers().emit("game-over", top3);
    }
  }

  checkEveryoneVoted() {
    const roundData = this.roundData[this.currentRound];
    const category = this.options.categories[this.currentVotingCategory];
    if (roundData && roundData.confirmedVotes.length === this.players.length) {
      //voting done, update final points and initiate new round

      Object.keys(roundData.votes).forEach((id) => {
        const v = Object.values(roundData.votes[id][category]);
        let maj = 0;
        if (v.length > 0) {
          maj = findMajority(v);
        }
        const p = this.getPlayerBySessionId(id);
        if (p) {
          p.totalScore += maj;
          p.lastRoundScore += maj;
          roundData.finalPoints[id] = maj;
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
          this.emitGameOver();
        } else {
          this.state = State.LOBBY;
          this.currentRound++;
        }

        this.currentLetter = "";
        this.syncRoom();
      } else {
        this.sendNextCategoryForVoting();
      }

      this.syncPlayers();
    }
  }

  sendNextCategoryForVoting() {
    this.toAllPlayers().emit("start-vote", this.getCurrentCategoryVoteData());
    this.updatePlayerVotes();
  }

  /**
   * Syncs the room state to all players
   * State includes: current round, current letter, current state, stop clicker
   */
  syncRoom() {
    storage.io.to(this.id).emit("sync", {
      id: this.id,
      state: this.state,
      ownerId: this.ownerId,
      currentRound: this.currentRound,
      currentLetter: this.currentLetter,
      stopClicker: this.roundData[this.currentRound]?.stopClickerId,
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
        id: p.sessionId,
        nickname: p.nickname,
        online: p.online,
        owner: p.sessionId == this.ownerId,
        totalScore: p.totalScore,
        lastRoundScore: p.lastRoundScore,
        voted: p.voted,
        ready: p.ready,
      })),
    });
  }

  kick(toKick: WordPlayer) {
    this.kickedPlayerSessions.push(toKick.sessionId);
    this.removePlayerLogic(toKick.sessionId);

    this.chat(
      ChatMessageBuilder.new("system", "system")
        .addText("تم طرد ")
        .addText(toKick.nickname, true)
        .addText(".")
        .build()
    );

    toKick.getSocket()?.emit("kick", "تم طردك من الغرفة.");
    toKick.getSocket()?.disconnect(true);
  }

  leave(toLeave: WordPlayer) {
    this.removePlayerLogic(toLeave.sessionId);

    this.chat(
      ChatMessageBuilder.new("system", "system")
        .addText("غادر ")
        .addText(toLeave.nickname, true)
        .addText(".")
        .build()
    );

    toLeave.getSocket()?.disconnect(true);
  }

  chat(msg: ChatMessage) {
    storage.io.to(this.id).emit("chat", msg);
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

  getOnlinePlayers() {
    return this.players.filter((p) => p.online);
  }

  hasPlayerWithName(nickname: string) {
    return this.players.some((p) => p.nickname === nickname);
  }

  hasPlayerWithSessionId(sessionId: string) {
    return this.players.some((p) => p.sessionId === sessionId);
  }

  getPlayerByNickname(nickname: string) {
    return this.players.find((p) => p.nickname === nickname);
  }

  getPlayerBySessionId(sessionId: string) {
    return this.players.find((p) => p.sessionId === sessionId);
  }

  private removePlayer(sessionId: string) {
    const roundData = this.roundData[this.currentRound];
    if (roundData) {
      if (roundData.clientVotes[sessionId]) {
        delete roundData.clientVotes[sessionId];
      }

      if (roundData.confirmedVotes.includes(sessionId)) {
        roundData.confirmedVotes = roundData.confirmedVotes.filter(
          (n) => n !== sessionId
        );
      }

      if (roundData.votes[sessionId]) {
        delete roundData.votes[sessionId];
      }

      if (roundData.playerValues[sessionId]) {
        delete roundData.playerValues[sessionId];
      }

      this.players.forEach((p) => {
        if (p.sessionId !== sessionId && roundData.votes[p.sessionId]) {
          Object.keys(roundData.votes[p.sessionId]).forEach((voteCat) => {
            if (roundData.votes[p.sessionId][voteCat][sessionId]) {
              delete roundData.votes[p.sessionId][voteCat][sessionId];
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

    this.players = this.players.filter((p) => p.sessionId !== sessionId);
    if (this.state == State.VOTING) {
      this.checkEveryoneVoted();
    }
  }

  removePlayerLogic(sessionId: string) {
    const foundPlayer = this.getPlayerBySessionId(sessionId);
    if (foundPlayer) {
      this.removePlayer(sessionId);
      if (this.players.length == 0) {
        //last player, delete game;
        storage.wordStorage.removeGame(this.id);
      } else if (this.players.length > 0) {
        //find another owner, for now get next player
        if (foundPlayer.sessionId == this.ownerId) {
          const newOwner = this.players[0];
          this.ownerId = newOwner.sessionId;
          newOwner.ready = true;

          this.chat(
            ChatMessageBuilder.new("system", "system")
              .addText("اصبح ")
              .addText(newOwner.nickname, true)
              .addText(" المسؤول.")
              .build()
          );
        }
      }
    }
  }
}
export class WordPlayer extends BasePlayer {
  public totalScore = 0;
  public lastRoundScore = 0;
  public voted: boolean = false;

  constructor(
    public nickname: string,
    public sessionId: string,
    protected authToken: string
  ) {
    super(authToken, nickname, sessionId);
  }

  getSocket() {
    if (!this.socketId) {
      return undefined;
    }
    return storage.io.sockets.sockets.get(this.socketId);
  }

  setAuthToken(authToken: string) {
    this.authToken = authToken;
  }

  checkAuth(authToken: string) {
    return this.authToken === authToken;
  }
}
