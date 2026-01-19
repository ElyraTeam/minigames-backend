import { nanoid } from "nanoid";
import { ChatMessage, ChatMessagePart } from "../models/word/socket.js";

export class ChatMessageBuilder {
  private parts: ChatMessagePart[] = [];

  constructor(private sender: string, private type: "system" | "player") {}

  static new(sender: string, type: "system" | "player") {
    return new ChatMessageBuilder(sender, type);
  }

  addText(
    text: string,
    bold = false,
    italic = false,
    underline = false,
    color?: string
  ) {
    this.parts.push({ text, bold, italic, underline, color });
    return this;
  }

  build(): ChatMessage {
    return {
      id: nanoid(),
      type: this.type,
      sender: this.sender,
      parts: this.parts,
    };
  }
}
