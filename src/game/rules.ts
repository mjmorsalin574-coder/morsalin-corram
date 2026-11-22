import type { CoinType, PlayerSide, QueenState, TurnOutcome } from '../types/game';

export interface EvaluateTurnInput {
  activePlayer: PlayerSide;
  queenStateBefore: QueenState;
  p1RemainingBefore: number;
  p2RemainingBefore: number;
  p1DueBefore?: number;
  p2DueBefore?: number;
  pocketedThisTurn: CoinType[];
  strikerPocketed: boolean;
  opponentName: string;
  activeName: string;
}

export function evaluateCarromTurn(input: EvaluateTurnInput): TurnOutcome {
  const {
    activePlayer,
    queenStateBefore,
    p1RemainingBefore,
    p2RemainingBefore,
    p1DueBefore = 0,
    p2DueBefore = 0,
    pocketedThisTurn,
    strikerPocketed,
    activeName,
    opponentName,
  } = input;

  const ownCoinType: 'white' | 'black' = activePlayer === 'p1' ? 'white' : 'black';
  const oppCoinType: 'white' | 'black' = activePlayer === 'p1' ? 'black' : 'white';
  const opponent: PlayerSide = activePlayer === 'p1' ? 'p2' : 'p1';

  const whitePocketed = pocketedThisTurn.filter((c) => c === 'white').length;
  const blackPocketed = pocketedThisTurn.filter((c) => c === 'black').length;
  const queenPocketed = pocketedThisTurn.includes('queen');

  const ownPocketed = activePlayer === 'p1' ? whitePocketed : blackPocketed;
  const oppPocketed = activePlayer === 'p1' ? blackPocketed : whitePocketed;

  let p1RemainingAfter = Math.max(0, p1RemainingBefore - whitePocketed);
  let p2RemainingAfter = Math.max(0, p2RemainingBefore - blackPocketed);
  let p1DueAfter = p1DueBefore;
  let p2DueAfter = p2DueBefore;

  const coinsToReturn: Array<{ type: 'white' | 'black' | 'queen' }> = [];
  let nextQueenState: QueenState = queenStateBefore;

  const pendingForActive =
    (activePlayer === 'p1' && queenStateBefore === 'PENDING_P1') ||
    (activePlayer === 'p2' && queenStateBefore === 'PENDING_P2');

  // 1. Handle Striker Foul first (Striker pocketed)
  if (strikerPocketed) {
    // Return Queen if pocketed this turn OR pending cover by active player
    if (queenPocketed || pendingForActive) {
      nextQueenState = 'ON_BOARD';
      coinsToReturn.push({ type: 'queen' });
    }

    // Return 1 already-pocketed coin of the fouling player, or record 1 owed due coin
    const ownRemainingBefore = activePlayer === 'p1' ? p1RemainingBefore : p2RemainingBefore;
    const totalOwnPocketedSoFar = 9 - ownRemainingBefore + ownPocketed;
    let returnedOwnCoin = false;

    if (totalOwnPocketedSoFar > 0) {
      coinsToReturn.push({ type: ownCoinType });
      returnedOwnCoin = true;
      if (activePlayer === 'p1') p1RemainingAfter = Math.min(9, p1RemainingAfter + 1);
      else p2RemainingAfter = Math.min(9, p2RemainingAfter + 1);
    } else {
      if (activePlayer === 'p1') p1DueAfter += 1;
      else p2DueAfter += 1;
    }

    const p1Delta = whitePocketed - (activePlayer === 'p1' && returnedOwnCoin ? 1 : 0);
    const p2Delta = blackPocketed - (activePlayer === 'p2' && returnedOwnCoin ? 1 : 0);

    // Check if opponent had their final coin pocketed on this foul
    const oppRemainingAfter = opponent === 'p1' ? p1RemainingAfter : p2RemainingAfter;
    if (oppRemainingAfter === 0) {
      return {
        nextPlayer: opponent,
        keepTurn: false,
        queenState: nextQueenState,
        p1PocketedDelta: p1Delta,
        p2PocketedDelta: p2Delta,
        p1DueAfter,
        p2DueAfter,
        foulCommitted: true,
        incorrectPocketCount: oppPocketed,
        message: `Foul! ${opponentName} clears the final coin and wins the board.`,
        tone: 'foul',
        coinsToReturn,
        roundWinner: opponent,
        roundReason: `${activeName} pocketed the striker while clearing ${opponentName}'s final coin.`,
      };
    }

    const queenSuffix =
      queenPocketed || pendingForActive ? ' Queen returns to center.' : '';

    return {
      nextPlayer: opponent,
      keepTurn: false,
      queenState: nextQueenState,
      p1PocketedDelta: p1Delta,
      p2PocketedDelta: p2Delta,
      p1DueAfter,
      p2DueAfter,
      foulCommitted: true,
      incorrectPocketCount: oppPocketed,
      message: returnedOwnCoin
        ? `Striker foul! 1 ${ownCoinType} penalty coin returned.${queenSuffix}`
        : `Striker foul! 1 ${ownCoinType} penalty due on next pocket.${queenSuffix}`,
      tone: 'foul',
      coinsToReturn,
      roundWinner: null,
    };
  }

  // 2. Legal Stroke: evaluate Queen covering / pending
  let queenMessage = '';
  let queenTone: TurnOutcome['tone'] = 'neutral';

  if (pendingForActive) {
    if (ownPocketed > 0) {
      nextQueenState = activePlayer === 'p1' ? 'COVERED_P1' : 'COVERED_P2';
      queenMessage = `Queen covered! +3 bonus secured for ${activeName}.`;
      queenTone = 'queen';
    } else {
      nextQueenState = 'ON_BOARD';
      coinsToReturn.push({ type: 'queen' });
      queenMessage =
        oppPocketed > 0
          ? `Incorrect pocket — cover missed, Queen returns to center.`
          : `Cover missed — Queen returns to center.`;
      queenTone = oppPocketed > 0 ? 'foul' : 'neutral';
    }
  } else if (queenPocketed) {
    if (ownPocketed > 0) {
      // Pocketed Queen AND own coin in the same legal stroke!
      nextQueenState = activePlayer === 'p1' ? 'COVERED_P1' : 'COVERED_P2';
      queenMessage = `Queen pocketed & covered in one stroke! (+3 pts)`;
      queenTone = 'queen';
    } else {
      nextQueenState = activePlayer === 'p1' ? 'PENDING_P1' : 'PENDING_P2';
      queenMessage = `Queen pocketed! Pocket a ${ownCoinType} coin next to cover.`;
      queenTone = 'queen';
    }
  }

  // 3. Pay off any previously owed due penalty coins from legal own pockets
  let duePaid = 0;
  if (ownPocketed > 0) {
    const activeDue = activePlayer === 'p1' ? p1DueAfter : p2DueAfter;
    if (activeDue > 0) {
      duePaid = Math.min(ownPocketed, activeDue);
      for (let i = 0; i < duePaid; i++) {
        coinsToReturn.push({ type: ownCoinType });
      }
      if (activePlayer === 'p1') {
        p1RemainingAfter = Math.min(9, p1RemainingAfter + duePaid);
        p1DueAfter -= duePaid;
      } else {
        p2RemainingAfter = Math.min(9, p2RemainingAfter + duePaid);
        p2DueAfter -= duePaid;
      }
    }
  }

  const p1Delta = whitePocketed - (activePlayer === 'p1' ? duePaid : 0);
  const p2Delta = blackPocketed - (activePlayer === 'p2' ? duePaid : 0);

  // 4. Evaluate Round End conditions
  const ownRemainingAfter = activePlayer === 'p1' ? p1RemainingAfter : p2RemainingAfter;
  const oppRemainingAfter = opponent === 'p1' ? p1RemainingAfter : p2RemainingAfter;

  // Case 1: Active player sank their last coin while Queen is still on the board -> Forfeit board!
  if (ownRemainingAfter === 0 && nextQueenState === 'ON_BOARD') {
    return {
      nextPlayer: opponent,
      keepTurn: false,
      queenState: nextQueenState,
      p1PocketedDelta: p1Delta,
      p2PocketedDelta: p2Delta,
      p1DueAfter,
      p2DueAfter,
      foulCommitted: false,
      incorrectPocketCount: oppPocketed,
      message: `Last ${ownCoinType} pocketed before Queen — ${opponentName} wins the board!`,
      tone: 'foul',
      coinsToReturn,
      roundWinner: opponent,
      roundReason: `${activeName} cleared their final ${ownCoinType} coin while the Queen was still on the board.`,
    };
  }

  // Case 2: Active player cleared all own coins and Queen is covered (by either player)
  if (
    ownRemainingAfter === 0 &&
    (nextQueenState === 'COVERED_P1' || nextQueenState === 'COVERED_P2')
  ) {
    return {
      nextPlayer: activePlayer,
      keepTurn: false,
      queenState: nextQueenState,
      p1PocketedDelta: p1Delta,
      p2PocketedDelta: p2Delta,
      p1DueAfter,
      p2DueAfter,
      foulCommitted: false,
      incorrectPocketCount: oppPocketed,
      message: `${activeName} clears the board!`,
      tone: 'good',
      coinsToReturn,
      roundWinner: activePlayer,
      roundReason: `${activeName} pocketed all ${ownCoinType} coins.`,
    };
  }

  // Case 3: Opponent's final coin(s) got pocketed by active player
  if (oppRemainingAfter === 0) {
    return {
      nextPlayer: opponent,
      keepTurn: false,
      queenState: nextQueenState,
      p1PocketedDelta: p1Delta,
      p2PocketedDelta: p2Delta,
      p1DueAfter,
      p2DueAfter,
      foulCommitted: false,
      incorrectPocketCount: oppPocketed,
      message: `${opponentName}'s final ${oppCoinType} coin cleared — ${opponentName} wins the board!`,
      tone: 'neutral',
      coinsToReturn,
      roundWinner: opponent,
      roundReason: `${activeName} accidentally pocketed ${opponentName}'s final ${oppCoinType} coin.`,
    };
  }

  // 5. Turn continuation: keep turn if pocketed >= 1 own coin OR just pocketed Queen (pending cover)
  const keepTurn =
    ownPocketed > 0 ||
    nextQueenState === 'PENDING_P1' ||
    nextQueenState === 'PENDING_P2';

  let message = queenMessage;
  let tone: TurnOutcome['tone'] = queenMessage ? queenTone : 'neutral';

  if (!message) {
    if (duePaid > 0) {
      message = `${duePaid} owed ${ownCoinType} penalty coin returned to center. Shoot again.`;
      tone = 'neutral';
    } else if (ownPocketed > 0 && oppPocketed > 0) {
      message = `${activeName} pocketed ${ownPocketed} ${ownCoinType} & ${oppPocketed} ${oppCoinType} — shoot again.`;
      tone = 'good';
    } else if (ownPocketed > 0) {
      message =
        ownPocketed > 1
          ? `${activeName} pocketed ${ownPocketed} ${ownCoinType} coins! Shoot again.`
          : `${activeName} pocketed a ${ownCoinType} coin. Shoot again.`;
      tone = 'good';
    } else if (oppPocketed > 0) {
      message = `Incorrect pocket — ${oppPocketed} ${oppCoinType} coin goes to ${opponentName}. Turn passes.`;
      tone = 'foul';
    } else {
      message = `${opponentName}'s turn.`;
      tone = 'neutral';
    }
  } else if (duePaid > 0) {
    message = `${message} (${duePaid} owed penalty coin returned.)`;
  }

  return {
    nextPlayer: keepTurn ? activePlayer : opponent,
    keepTurn,
    queenState: nextQueenState,
    p1PocketedDelta: p1Delta,
    p2PocketedDelta: p2Delta,
    p1DueAfter,
    p2DueAfter,
    foulCommitted: false,
    incorrectPocketCount: oppPocketed,
    message,
    tone,
    coinsToReturn,
    roundWinner: null,
  };
}
