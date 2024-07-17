export interface AuthenticateRequest {
  roomId: string;
  nickname: string;
  authToken: string;
}

export interface CategoryVoteData {
  category: string;
  values: Map<string, string>;
  votes: Map<string, number>;
}

export interface ChatMessage {
  id: string;
  type: "system" | "player";
  sender: string;
  message: string;
}
