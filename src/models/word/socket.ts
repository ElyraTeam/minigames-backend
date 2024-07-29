import { ClientVotes, PlayerValues, State, WordRoomOptions } from "./game.js";

export interface CategoryVoteData {
  category: string;
  values: PlayerValues;
  votes: ClientVotes;
  categoryIndex: number;
}

export interface RoomSyncData {
  id: string;
  state: State;
  ownerId: string;
  currentRound: number;
  currentLetter: string;
  stopClicker?: string;
}

export interface OptionsSyncData {
  id: string;
  options: WordRoomOptions;
}

interface SyncPlayer {
  id: string;
  nickname: string;
  online: boolean;
  owner: boolean;
  ready: boolean;
  totalScore: number;
  lastRoundScore: number;
  voted: boolean;
}
export interface PlayersSyncData {
  id: string;
  players: SyncPlayer[];
}

export interface ChatMessage {
  id: string;
  type: "system" | "player";
  sender: string;
  message: string;
  font: "normal" | "bold";
}
