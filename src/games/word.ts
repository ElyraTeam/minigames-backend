import { Socket } from "socket.io";
import { stringify } from "uuid";
import {
  Game,
  Player,
  PlayerValues,
  Points,
  RoundData,
  State,
} from "../models/word/game";
import storage from "../storage";

export const registerPlayerSocket = (
  socket: Socket,
  game: Game,
  player: Player
) => {
  socket.on("chat", (msg) => {
    game.chat(player.nickname, msg);
  });

  //Allow reusing lobby after game is over
  socket.on("reset-game", () => {
    if (player.owner) {
      game.reset();

      game.sync();
      game.syncPlayers();
      storage.saveGames();
    }
  });

  socket.on("start-game", () => {
    //Make sure 2 or more players are ingame
    //Also make sure you are not above round limit
    if (
      player.owner &&
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
          stopClicker: "",
          playerValues: {},
          finalPoints: {},
          confirmedVotes: [],
          votes: {},
          clientVotes: {},
        };

        game.sync();
        storage.saveGames();
      }, 2200);
    }
  });

  socket.on("stop-game", () => {
    if (game.state != State.INGAME) return;

    const roundData = game.roundData[game.currentRound];
    if (!roundData) return;

    roundData.stopClicker = player.nickname;

    game.doneLetters.push(game.currentLetter);
    game.stoppedAt = Date.now();
    game.state = State.WAITING;
    game.sync();
    storage.saveGames();

    game.players.forEach((p) => {
      p.voted = false;
      p.lastRoundScore = 0;

      const values: { [name: string]: string } = {};
      game.options.categories.forEach((cat) => {
        if (!values[cat]) {
          values[cat] = "";
        }
      });
      roundData.playerValues[p.nickname] = values;

      //Values is a map of category => value
      p.getSocket()?.emit(
        "request-values",
        (values: { [name: string]: string }) => {
          if (Date.now() <= game.stoppedAt + 5000) {
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
          roundData.playerValues[p.nickname] = values;
          //Check if every player sent their data
          if (
            Object.entries(roundData.playerValues).length >= game.players.length
          ) {
            //Start voting process
            game.currentVotingCategory = 0;
            game.prepareNewCategoryVoting();
            game.state = State.VOTING;
            game.sync();
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
      if (!roundData.clientVotes[p.nickname]) {
        roundData.clientVotes[p.nickname] = {};
      }
    });

    //Cant vote for self lol
    if (voteData[player.nickname]) {
      delete voteData[player.nickname];
    }

    if (!roundData.clientVotes[player.nickname]) {
      roundData.clientVotes[player.nickname] = {};
    }

    Object.entries(voteData).forEach(([playerToVoteFor, val]) => {
      if (
        game.hasPlayerWithName(playerToVoteFor) &&
        playerToVoteFor !== player.nickname
      ) {
        //give 0 for empty values
        const playerVals = roundData.playerValues[playerToVoteFor]!;
        const playerCategoryVal = playerVals[category];
        if (!playerCategoryVal || playerCategoryVal == "") {
          val = 0;
        }

        if (val == 0 || val == 5 || val == 10) {
          roundData.clientVotes[player.nickname][playerToVoteFor] = val;
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
    if (roundData.confirmedVotes.includes(player.nickname)) return; //disallow revoting

    player.voted = true;
    roundData.confirmedVotes.push(player.nickname);

    //get his final client votes and start adding
    if (roundData.clientVotes[player.nickname]) {
      const playerVotes = roundData.clientVotes[player.nickname];

      game.players.forEach((p) => {
        if (!playerVotes[p.nickname] && p.nickname !== player.nickname) {
          playerVotes[p.nickname] = 0;
        }
      });

      Object.keys(playerVotes).forEach((playerToVoteFor) => {
        if (
          game.hasPlayerWithName(playerToVoteFor) &&
          playerToVoteFor !== player.nickname
        ) {
          if (!roundData.votes[playerToVoteFor]) {
            roundData.votes[playerToVoteFor] = {};
          }

          if (!roundData.votes[playerToVoteFor][category]) {
            roundData.votes[playerToVoteFor][category] = {};
          }

          roundData.votes[playerToVoteFor][category][player.nickname] =
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
