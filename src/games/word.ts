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

  socket.on("start-game", () => {
    if (player.owner && game.state == State.LOBBY) {
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

    game.state = State.WAITING;
    game.sync();
    storage.saveGames();

    game.players.forEach((p) => {
      //Values is a map of category => value
      p.getSocket()?.emit(
        "request-values",
        (values: { [name: string]: string }) => {
          //TODO: sanitize values
          roundData.playerValues[p.nickname] = values;

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

            sendNextCategoryForVoting(game, roundData);
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

    game
      .toAllPlayers()
      .emit("update-vote-count", roundData.recievedVotes.length);

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
          p.lastRoundScore = maj;
        }
      });

      game.currentVotingCategory++;

      if (game.currentVotingCategory == game.options.categories.length) {
        roundData.recievedVotes = [];
        game.updateVoteCount();

        game.state = State.LOBBY;
        game.currentLetter = "";
        game.currentRound++;
        game.sync();
        game.syncPlayers();
        storage.saveGames();
      } else {
        roundData.recievedVotes = [];
        game.updateVoteCount();
        sendNextCategoryForVoting(game, roundData);
      }
    }
  });
};

function sendNextCategoryForVoting(game: Game, roundData: RoundData) {
  const category = game.options.categories[game.currentVotingCategory];

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
  };
  game.toAllPlayers().emit("start-vote", categoryData);
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
