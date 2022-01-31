import { Socket } from "socket.io";
import { stringify } from "uuid";
import {
  Game,
  Player,
  PlayerValues,
  Points,
  RoundData,
  State,
} from "../models/game";
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
    if (player.owner && game.state != State.INGAME) {
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
          recievedVotes: [],
          votes: {},
        };

        game.sync();
        storage.saveGames();
      }, 2200);
    }
  });

  socket.on("stop-game", () => {
    if (game.state != State.INGAME) return;

    const roundData = game.roundData[game.currentRound]!;
    roundData.stopClicker = player.nickname;

    game.stoppedAt = Date.now();
    game.state = State.WAITING;
    game.sync();
    storage.saveGames();

    game.players.forEach((p) => {
      p.lastRoundScore = 0;
      //Values is a map of category => value
      p.getSocket()?.emit(
        "request-values",
        (values: { [name: string]: string }) => {
          //Check if send window is open
          if (Date.now() <= game.stoppedAt + 5000) {
            game.options.categories.forEach((cat) => {
              if (!values[cat]) {
                values[cat] = "";
              }
            });
            roundData.playerValues[p.nickname] = values;
          }

          //Check if every player sent their data
          if (
            Object.entries(roundData.playerValues).length ===
            game.players.length
          ) {
            //Start voting process
            game.currentVotingCategory = 0;
            game.state = State.VOTING;
            game.sync();
            storage.saveGames();

            sendNextCategoryForVoting(game);
          }
        }
      );
    });
  });

  socket.on("vote", (voteData: Points) => {
    if (game.state != State.VOTING) return;
    //Someone voted
    const roundData = game.roundData[game.currentRound]!;
    if (roundData.recievedVotes.includes(player.nickname)) return; //disallow revoting

    roundData.recievedVotes.push(player.nickname);

    const category = game.options.categories[game.currentVotingCategory];

    game.updateVoteCount();

    //default vote 0 for all players
    game.players.forEach((p) => {
      if (!voteData[p.nickname]) {
        voteData[p.nickname] = 0;
      }
    });

    //Cant vote for self lol
    if (voteData[player.nickname]) {
      delete voteData[player.nickname];
    }

    Object.entries(voteData).forEach(([playerToVoteFor, val]) => {
      if (!roundData.votes[playerToVoteFor]) {
        roundData.votes[playerToVoteFor] = [];
      }

      //give 0 for empty values
      const playerVals = roundData.playerValues[playerToVoteFor]!;
      const playerCategoryVal = playerVals[category];
      if (!playerCategoryVal || playerCategoryVal == "") {
        val = 0;
      }

      if (val == 0 || val == 5 || val == 10) {
        roundData.votes[playerToVoteFor]!.push(val);
      }
    });

    if (roundData.recievedVotes.length === game.players.length) {
      //voting done, update final points and initiate new round

      Object.entries(roundData.votes).forEach(([nick, v]) => {
        let maj = 0;
        if (v.length > 0) {
          maj = findMajority(v);
        }
        const p = game.getPlayerWithName(nick);
        if (p) {
          p.totalScore += maj;
          p.lastRoundScore += maj;
        }
      });

      game.currentVotingCategory++;

      if (game.currentVotingCategory == game.options.categories.length) {
        roundData.recievedVotes = [];
        game.updateVoteCount();

        //if last round, send game over
        if (game.currentRound == game.options.rounds) {
          game.state = State.GAME_OVER;
        } else {
          game.state = State.LOBBY;
          game.currentRound++;
        }

        game.currentLetter = "";
        game.sync();
        game.syncPlayers();
        storage.saveGames();
      } else {
        roundData.recievedVotes = [];
        game.updateVoteCount();
        sendNextCategoryForVoting(game);
      }
    }
  });
};

function sendNextCategoryForVoting(game: Game) {
  game.toAllPlayers().emit("start-vote", game.getCurrentCategoryVoteData());
}

function findMajority(nums: number[]) {
  let count = 0,
    candidate = -1;

  // Finding majority candidate
  for (let index = 0; index < nums.length; index++) {
    if (count == 0) {
      candidate = nums[index];
      count = 1;
    } else {
      if (nums[index] == candidate) count++;
      else count--;
    }
  }

  // Checking if majority candidate occurs more than
  // n/2 times
  for (let index = 0; index < nums.length; index++) {
    if (nums[index] == candidate) count++;
  }
  if (count > nums.length / 2) return candidate;
  return Math.max(...nums);

  // The last for loop and the if statement step can
  // be skip if a majority element is confirmed to
  // be present in an array just return candidate
  // in that case
}
