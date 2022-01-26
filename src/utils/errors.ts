const error = (code: number, message: string) => ({
  errorCode: code,
  error: message,
});

export const roomNotFound = error(1000, "Room not found.");
export const roomFull = error(1001, "Room full.");
export const nicknameInUse = error(1002, "Nickname already in use.");
export const gameRunning = error(1003, "Game is running.");

export const unexpectedError = error(1010, "Unexpected error.");
