import { Socket } from "socket.io";
import { stringify } from "uuid";
import {
  WordGame as Game,
  WordPlayer as Player,
  PlayerValues,
  Points,
  RoundData,
  State,
  WordRoomOptions,
} from "../models/word/game.js";
import storage from "../storage.js";

export const registerPlayerSocket = (
  socket: Socket,
  game: Game,
  player: Player
) => {
  socket.on("chat", (msg) => {
    //check if player is in game
    if (!game.getPlayerBySessionId(player.sessionId)) return;
    game.chat(player.nickname, msg);
  });

  //Allow reusing lobby after game is over
  socket.on("reset-game", () => {
    if (!game.getPlayerBySessionId(player.sessionId)) return;

    if (player.sessionId == game.ownerId) {
      game.reset();

      game.syncRoom();
      game.syncPlayers();
      storage.saveGames();
    }
  });

  socket.on("ready", () => {
    if (game.ownerId === player.sessionId) return;
    if (!game.getPlayerBySessionId(player.sessionId)) return;
    player.ready = !player.ready;
    game.syncPlayers();
  });

  socket.on("options", (options: WordRoomOptions) => {
    if (!game.getPlayerBySessionId(player.sessionId)) return;
    if (player.sessionId != game.ownerId) return;

    if (
      options.maxPlayers < game.players.length ||
      options.categories.length == 0 ||
      options.letters.length == 0 ||
      options.maxPlayers < 2 ||
      options.rounds < 1
    ) {
      return;
    }

    game.options = options;
    game.syncRoom();
    game.syncOptions();
    storage.saveGames();
  });

  socket.on("start-game", () => {
    if (!game.getPlayerBySessionId(player.sessionId)) return;
    //Make sure 2 or more players are ingame
    //Also make sure you are not above round limit
    const allReady = game.players.every((p) => p.ready);
    if (
      allReady &&
      player.sessionId == game.ownerId &&
      game.state == State.LOBBY &&
      game.players.length >= 2 &&
      game.currentRound <= game.options.rounds
    ) {
      const letter = game.newRandomLetter();
      game.toAllPlayers().emit("start-timer", 3);

      setTimeout(() => {
        game.currentLetter = letter;
        game.state = State.INGAME;

        game.roundData[game.currentRound] = {
          round: game.currentRound,
          letter: game.currentLetter,
          stopClickerId: "",
          playerValues: {},
          finalPoints: {},
          confirmedVotes: [],
          votes: {},
          clientVotes: {},
        };

        game.syncRoom();
        storage.saveGames();
      }, 2200);
    }
  });

  socket.on("stop-game", () => {
    if (!game.getPlayerBySessionId(player.sessionId)) return;
    if (game.state != State.INGAME) return;

    const roundData = game.roundData[game.currentRound];
    if (!roundData) return;

    roundData.stopClickerId = player.sessionId;

    game.doneLetters.push(game.currentLetter);
    game.stoppedAt = Date.now();
    game.state = State.WAITING;
    game.syncRoom();
    storage.saveGames();

    game.players.forEach((p) => {
      p.voted = false;
      if (p.sessionId !== game.ownerId) {
        p.ready = false;
      }
      p.lastRoundScore = 0;

      if (p.online === false) {
        const values: { [category: string]: string } = {};
        game.options.categories.forEach((cat) => {
          if (!values[cat]) {
            values[cat] = "";
          }
        });
        roundData.playerValues[p.sessionId] = values;
      }

      //Values is a map of category => value
      p.getSocket()?.emit(
        "request-values",
        (values: { [catName: string]: string }) => {
          if (
            Date.now() <= game.stoppedAt + 5000 ||
            game.state != State.WAITING
          ) {
            game.options.categories.forEach((cat) => {
              if (!values[cat]) {
                values[cat] = "";
              }
              values[cat] = values[cat].trim();
            });
          } else {
            game.options.categories.forEach((cat) => {
              values[cat] = "";
            });
          }
          roundData.playerValues[p.sessionId] = values;
          //Check if every player sent their data
          if (
            Object.entries(roundData.playerValues).length >=
              game.players.length &&
            game.state != State.VOTING
          ) {
            //Start voting process
            game.currentVotingCategory = 0;
            game.prepareNewCategoryVoting();
            game.state = State.VOTING;
            game.syncRoom();
            storage.saveGames();

            game.sendNextCategoryForVoting();
          }
        }
      );
    });
  });

  socket.on("vote", (voteData: Points) => {
    const category = game.options.categories[game.currentVotingCategory];
    const roundData = game.roundData[game.currentRound];
    if (!roundData) return;

    if (!roundData.clientVotes) {
      roundData.clientVotes = {};
    }

    game.players.forEach((p) => {
      if (!roundData.clientVotes[p.sessionId]) {
        roundData.clientVotes[p.sessionId] = {};
      }
    });

    //Cant vote for self lol
    if (voteData[player.sessionId]) {
      delete voteData[player.sessionId];
    }

    if (!roundData.clientVotes[player.sessionId]) {
      roundData.clientVotes[player.sessionId] = {};
    }

    Object.entries(voteData).forEach(([playerToVoteFor, val]) => {
      if (
        game.hasPlayerWithSessionId(playerToVoteFor) &&
        playerToVoteFor !== player.sessionId
      ) {
        //give 0 for empty values
        const playerVals = roundData.playerValues[playerToVoteFor]!;
        const playerCategoryVal = playerVals[category];
        if (!playerCategoryVal || playerCategoryVal == "") {
          val = 0;
        }

        if (val == 0 || val == 5 || val == 10) {
          roundData.clientVotes[player.sessionId][playerToVoteFor] = val;
        }
      }
    });
    game.updatePlayerVotes();
    game.syncPlayers();
    storage.saveGames();
  });

  socket.on("confirm-vote", () => {
    if (game.state != State.VOTING) return;
    //Someone voted
    const category = game.options.categories[game.currentVotingCategory];
    const roundData = game.roundData[game.currentRound];
    if (!roundData) return;
    if (roundData.confirmedVotes.includes(player.sessionId)) return; //disallow revoting

    player.voted = true;
    roundData.confirmedVotes.push(player.sessionId);

    //get his final client votes and start adding
    if (roundData.clientVotes[player.sessionId]) {
      const playerVotes = roundData.clientVotes[player.sessionId];

      game.players.forEach((p) => {
        if (!playerVotes[p.sessionId] && p.sessionId !== player.sessionId) {
          playerVotes[p.sessionId] = 0;
        }
      });

      Object.keys(playerVotes).forEach((playerToVoteFor) => {
        if (
          game.hasPlayerWithSessionId(playerToVoteFor) &&
          playerToVoteFor !== player.sessionId
        ) {
          if (!roundData.votes[playerToVoteFor]) {
            roundData.votes[playerToVoteFor] = {};
          }

          if (!roundData.votes[playerToVoteFor][category]) {
            roundData.votes[playerToVoteFor][category] = {};
          }

          roundData.votes[playerToVoteFor][category][player.sessionId] =
            playerVotes[playerToVoteFor];
        }
      });
    }

    game.updateVoteCount();
    game.chat("system", `صوت ${player.nickname}.`);

    game.updatePlayerVotes();

    game.checkEveryoneVoted();

    storage.saveGames();
  });
};
