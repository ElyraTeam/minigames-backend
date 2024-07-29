import { Server, Socket } from "socket.io";
import { AuthenticateRequest } from "../models/base.js";
import { ClientVotes, Points, WordRoomOptions } from "../models/word/game.js";
import {
  CategoryVoteData,
  ChatMessage,
  OptionsSyncData,
  PlayersSyncData,
  RoomSyncData,
} from "../models/word/socket.js";

export interface WordClientToServerEvents {
  /**Client authenticating with server */
  authenticate: (
    data: AuthenticateRequest,
    ack?: (res: string) => void
  ) => void;
  /**For /ping and offline checks */
  ping: (cb: () => void) => void;
  /**Client sending chat message to member */
  chat: (msg: string) => void;
  /**Room owner resetting the game */
  "reset-game": () => void;
  /**Player toggling ready status */
  ready: () => void;
  /**Room owner changing room options */
  options: (options: WordRoomOptions, ack?: (message: string) => void) => void;
  /**Room owner starting game */
  "start-game": () => void;
  /**Player pressing stop */
  "stop-game": () => void;
  /**Player voting a number*/
  vote: (voteData: Points) => void;
  /**Player confirming vote */
  "confirm-vote": () => void;
}

export interface WordServerToClientEvents {
  /**Server requesting a timer */
  "start-timer": (timeInSecond: number) => void;
  /**Server sending vote and category data to clients for voting phase */
  "start-vote": (data: CategoryVoteData) => void;
  /**Server sending updated room data to player */
  sync: (data: RoomSyncData) => void;
  /**Server sending updated options to player */
  options: (data: OptionsSyncData) => void;
  /**Server sending updated player data to player */
  players: (data: PlayersSyncData) => void;
  /**Server sending kick request to player */
  kick: (message: string) => void;
  /**Server broadcasting chat message to players */
  chat: (message: ChatMessage) => void;
  "update-vote-count": (count: number) => void;
  "player-votes": (votes: ClientVotes) => void;
  "request-values": (
    ack: (values: { [catName: string]: string }) => void
  ) => void;
}

export type WordSocket = Socket<
  WordClientToServerEvents,
  WordServerToClientEvents
>;

export type WordServer = Server<
  WordClientToServerEvents,
  WordServerToClientEvents
>;
