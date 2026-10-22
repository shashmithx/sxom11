import { Card, PlayedCard, Suit, Trick, BotDifficulty } from './types';
import { isCardPlayable, determineTrickWinner, SUITS } from './rules';

/**
 * Intelligent Trump Selection from initial 4 cards dealt:
 * Evaluates suit count and high card points (A=4, K=3, Q=2, J=1).
 */
export function botChooseTrumpSuit(hand: Card[], difficulty: BotDifficulty = 'normal'): Suit {
  const suitScores: Record<Suit, number> = {
    spades: 0,
    hearts: 0,
    diamonds: 0,
    clubs: 0,
  };

  for (const card of hand) {
    let cardWeight = 1; // base count
    if (card.rank === 'A') cardWeight = 4;
    else if (card.rank === 'K') cardWeight = 3;
    else if (card.rank === 'Q') cardWeight = 2;
    else if (card.rank === 'J') cardWeight = 1.5;

    suitScores[card.suit] += cardWeight;
  }

  // Find suit with maximum score
  let bestSuit: Suit = 'spades';
  let bestScore = -1;

  for (const suit of SUITS) {
    let score = suitScores[suit];
    // In easy mode, add small random perturbation
    if (difficulty === 'easy') {
      score += (Math.random() - 0.5) * 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSuit = suit;
    }
  }

  return bestSuit;
}

/**
 * Intelligent Bot Card Selection for playing into a trick.
 */
export function botChooseCardToPlay(
  botSeat: number,
  hand: Card[],
  currentTrick: Trick | null,
  trumpSuit: Suit,
  difficulty: BotDifficulty = 'normal',
  tricksHistory: Trick[] = []
): Card {
  // 1. Get all strictly legal cards
  const legalCards = hand.filter((c) =>
    isCardPlayable(c, hand, currentTrick ? currentTrick.leadSuit : null)
  );

  if (legalCards.length === 1) {
    return legalCards[0];
  }

  // Easy difficulty: plays a random legal card 40% of the time
  if (difficulty === 'easy' && Math.random() < 0.4) {
    const randomIndex = Math.floor(Math.random() * legalCards.length);
    return legalCards[randomIndex];
  }

  // Partner seat: in a 4-player game, partner is (botSeat + 2) % 4
  const partnerSeat = (botSeat + 2) % 4;

  // Case A: Bot is leading the trick (no cards played yet)
  if (!currentTrick || currentTrick.cards.length === 0) {
    return botChooseLeadCard(legalCards, trumpSuit, difficulty, tricksHistory);
  }

  // Case B: Bot is following
  return botChooseFollowCard(
    botSeat,
    partnerSeat,
    legalCards,
    currentTrick,
    trumpSuit,
    difficulty,
    tricksHistory
  );
}

function botChooseLeadCard(
  legalCards: Card[],
  trumpSuit: Suit,
  difficulty: BotDifficulty,
  tricksHistory: Trick[]
): Card {
  // If Hard mode: track cards already played
  const playedCardIds = new Set<string>();
  for (const trick of tricksHistory) {
    for (const pc of trick.cards) {
      playedCardIds.add(pc.card.id);
    }
  }

  // Lead non-trump Ace (guaranteed trick winner if opponents have suit)
  const nonTrumpAces = legalCards.filter((c) => c.suit !== trumpSuit && c.rank === 'A');
  if (nonTrumpAces.length > 0) {
    return nonTrumpAces[0];
  }

  // Check if we hold the highest remaining card in a non-trump suit
  if (difficulty === 'hard') {
    for (const card of legalCards) {
      if (card.suit !== trumpSuit) {
        // Is any card higher than this one still unplayed and not in our hand?
        const isHighestRemaining = !legalCards.some(
          (c) => c.suit === card.suit && c.value > card.value
        ) && (card.rank === 'K' ? playedCardIds.has(`${card.suit}_A`) : false);
        if (isHighestRemaining) {
          return card;
        }
      }
    }
  }

  // If holding dominant trump sequence (e.g. A, K trumps), leading trump can draw out opponents' trumps
  const trumpCards = legalCards.filter((c) => c.suit === trumpSuit);
  const hasTrumpAce = trumpCards.some((c) => c.rank === 'A');
  if (hasTrumpAce && trumpCards.length >= 3 && difficulty !== 'easy') {
    return trumpCards.find((c) => c.rank === 'A')!;
  }

  // Otherwise: lead lowest card from longest non-trump suit
  const nonTrumps = legalCards.filter((c) => c.suit !== trumpSuit);
  if (nonTrumps.length > 0) {
    // Sort by lowest value
    nonTrumps.sort((a, b) => a.value - b.value);
    return nonTrumps[0];
  }

  // Only trumps left: play lowest trump
  legalCards.sort((a, b) => a.value - b.value);
  return legalCards[0];
}

function botChooseFollowCard(
  botSeat: number,
  partnerSeat: number,
  legalCards: Card[],
  currentTrick: Trick,
  trumpSuit: Suit,
  difficulty: BotDifficulty,
  _tricksHistory: Trick[]
): Card {
  // Determine who currently holds the highest winning card in this trick
  const currentWinningPlay: PlayedCard = determineTrickWinner(currentTrick, trumpSuit);
  const partnerIsWinning = currentWinningPlay.playerId === partnerSeat;

  const leadSuit = currentTrick.leadSuit;
  const leadSuitCards = legalCards.filter((c) => c.suit === leadSuit);

  // Subcase 1: We must follow suit (we have cards of leadSuit)
  if (leadSuitCards.length > 0) {
    leadSuitCards.sort((a, b) => a.value - b.value); // lowest to highest

    if (partnerIsWinning) {
      // Partner is already winning the trick!
      // Save high cards; play the lowest legal card of this suit.
      return leadSuitCards[0];
    }

    // Opponent is winning. Can we beat the winning play?
    // Note: if opponent trumped a non-trump lead, we cannot beat it with a lead suit card!
    if (currentWinningPlay.card.suit === trumpSuit && leadSuit !== trumpSuit) {
      // Opponent cut with trump; our lead suit cards cannot beat it, so discard lowest
      return leadSuitCards[0];
    }

    // Opponent's card is in lead suit (or both are trump)
    const winningCards = leadSuitCards.filter((c) => c.value > currentWinningPlay.card.value);
    if (winningCards.length > 0) {
      // Play the lowest card that beats opponent's card (win cheaply)
      return winningCards[0];
    }

    // Cannot beat opponent's card: play our lowest card to minimize loss
    return leadSuitCards[0];
  }

  // Subcase 2: We are VOID in lead suit!
  // We can play any card: trump (to ruff/cut) or discard another suit.
  const trumpCards = legalCards.filter((c) => c.suit === trumpSuit);
  const discardCards = legalCards.filter((c) => c.suit !== trumpSuit);

  // If partner is already winning:
  if (partnerIsWinning) {
    // Partner has this trick! Do NOT waste trump.
    // Discard lowest non-trump card.
    if (discardCards.length > 0) {
      discardCards.sort((a, b) => a.value - b.value);
      return discardCards[0];
    }
    // Only trumps left: play lowest trump
    trumpCards.sort((a, b) => a.value - b.value);
    return trumpCards[0];
  }

  // Opponent is winning:
  if (trumpCards.length > 0) {
    trumpCards.sort((a, b) => a.value - b.value);

    // If opponent already played a trump:
    if (currentWinningPlay.card.suit === trumpSuit) {
      // Can we beat opponent's trump?
      const higherTrumps = trumpCards.filter((c) => c.value > currentWinningPlay.card.value);
      if (higherTrumps.length > 0) {
        // Ruff with the lowest trump that beats opponent's trump!
        return higherTrumps[0];
      }
      // Cannot beat opponent's trump: don't waste our trumps! Discard non-trump.
      if (discardCards.length > 0) {
        discardCards.sort((a, b) => a.value - b.value);
        return discardCards[0];
      }
      return trumpCards[0];
    } else {
      // Opponent winning with non-trump:
      // We can cut/ruff with our lowest trump!
      return trumpCards[0];
    }
  }

  // No trumps: discard lowest non-trump card
  if (discardCards.length > 0) {
    discardCards.sort((a, b) => a.value - b.value);
    return discardCards[0];
  }

  return legalCards[0];
}
