import { Card, GameState, PlayedCard, PlayerInfo, Rank, RoundSummary, SanitizedGameState, ScoreState, Suit, TeamMode, Trick } from './types';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: { rank: Rank; value: number }[] = [
  { rank: '7', value: 1 },
  { rank: '8', value: 2 },
  { rank: '9', value: 3 },
  { rank: '10', value: 4 },
  { rank: 'J', value: 5 },
  { rank: 'Q', value: 6 },
  { rank: 'K', value: 7 },
  { rank: 'A', value: 8 },
];

/**
 * Creates a standard 32-card Sri Lankan OMI deck
 * (Suits: ♠, ♥, ♦, ♣; Ranks: 7, 8, 9, 10, J, Q, K, A)
 */
export function createOmiDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const { rank, value } of RANKS) {
      deck.push({
        id: `${suit}_${rank}`,
        suit,
        rank,
        value,
      });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle
 */
export function shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Direction in Sri Lankan OMI is counter-clockwise (to the right):
 * 0 (South) -> 1 (East) -> 2 (North) -> 3 (West) -> 0 (South)
 */
export function getNextPlayerIndex(currentIndex: number): number {
  return (currentIndex + 1) % 4;
}

/**
 * Determine team (1 or 2) from seat index:
 * Seats 0 & 2 are Team 1 (partners sitting opposite)
 * Seats 1 & 3 are Team 2 (partners sitting opposite)
 */
export function getTeamForSeat(seatIndex: number): 1 | 2 {
  return seatIndex % 2 === 0 ? 1 : 2;
}

/**
 * Checks if a specific card can be legally played.
 * Sri Lankan OMI rule:
 * - If leading the trick (no leadSuit), any card is legal.
 * - If following, player MUST follow lead suit if they hold any card of that suit.
 * - Only if player has no cards of lead suit can they play any other card (trump or discard).
 */
export function isCardPlayable(card: Card, hand: Card[], leadSuit: Suit | null): boolean {
  if (!leadSuit) {
    return true; // leading player can play any card in their hand
  }
  const hasLeadSuit = hand.some((c) => c.suit === leadSuit);
  if (hasLeadSuit) {
    return card.suit === leadSuit;
  }
  return true; // void in lead suit: can play any card
}

/**
 * Determines the winner of a completed 4-card trick.
 * Rule:
 * 1. If any trump cards are played, highest trump card wins.
 * 2. Otherwise, highest card of the led suit wins.
 */
export function determineTrickWinner(trick: Trick, trumpSuit: Suit): PlayedCard {
  if (!trick.cards || trick.cards.length === 0) {
    throw new Error('Trick is empty');
  }

  // Look for trumps
  const trumpCards = trick.cards.filter((p) => p.card.suit === trumpSuit);
  if (trumpCards.length > 0) {
    // Highest value trump wins
    let highest = trumpCards[0];
    for (let i = 1; i < trumpCards.length; i++) {
      if (trumpCards[i].card.value > highest.card.value) {
        highest = trumpCards[i];
      }
    }
    return highest;
  }

  // No trump played: highest card of lead suit wins
  const leadCards = trick.cards.filter((p) => p.card.suit === trick.leadSuit);
  if (leadCards.length > 0) {
    let highest = leadCards[0];
    for (let i = 1; i < leadCards.length; i++) {
      if (leadCards[i].card.value > highest.card.value) {
        highest = leadCards[i];
      }
    }
    return highest;
  }

  // Fallback to first card played
  return trick.cards[0];
}

export interface RoundScoringResult {
  winnerTeam: 1 | 2 | 0; // 0 for draw
  tokensAwarded: number;
  newTeam1Tokens: number;
  newTeam2Tokens: number;
  newCarriedTokens: number;
  isKapothi: boolean;
  messageEn: string;
  messageSi: string;
}

/**
 * Calculates tokens awarded at the end of an 8-trick OMI round.
 * Sri Lankan OMI authentic scoring:
 * - 8 tricks total.
 * - Trump caller's team wins 5, 6, or 7 tricks: 1 token (+ any carried tokens).
 * - Defending team wins 5, 6, or 7 tricks: 2 tokens (+ any carried tokens).
 * - Either team wins all 8 tricks: KAPOTHI! 3 tokens (+ any carried tokens).
 * - 4–4 Draw: 0 tokens awarded, 1 token carried forward to the next decisive round.
 */
export function calculateRoundScoring(
  team1Tricks: number,
  team2Tricks: number,
  trumpSelectorSeat: number,
  currentScore: ScoreState
): RoundScoringResult {
  const trumpTeam = getTeamForSeat(trumpSelectorSeat);
  const defendingTeam: 1 | 2 = trumpTeam === 1 ? 2 : 1;
  const carried = currentScore.carriedTokens;

  let winnerTeam: 1 | 2 | 0 = 0;
  let tokensAwarded = 0;
  let newCarried = 0;
  let isKapothi = false;
  let messageEn = '';
  let messageSi = '';

  const trumpTeamTricks = trumpTeam === 1 ? team1Tricks : team2Tricks;
  const defendingTeamTricks = defendingTeam === 1 ? team1Tricks : team2Tricks;

  if (team1Tricks === 4 && team2Tricks === 4) {
    // 4-4 Draw / Bada
    winnerTeam = 0;
    tokensAwarded = 0;
    newCarried = carried + 1;
    messageEn = `4–4 Draw! 1 token carried over to the next round (${newCarried} total carried).`;
    messageSi = `4–4 සමයි (බඩ)! ඊළඟ අතට කැට 1ක් ඉදිරියට ගෙන යන ලදී (එකතුව ${newCarried}).`;
  } else if (trumpTeamTricks === 8) {
    // Trump team Kapothi
    winnerTeam = trumpTeam;
    isKapothi = true;
    tokensAwarded = 3 + carried;
    newCarried = 0;
    const bonusText = carried > 0 ? ` (3 + ${carried} carried)` : '';
    messageEn = `KAPOTHI! Trump Team won all 8 tricks! +${tokensAwarded} tokens${bonusText}!`;
    messageSi = `කපෝති! තුරුම්පු පිල අත් 8 ම දිනාගත්තා! කැට +${tokensAwarded}${bonusText}!`;
  } else if (defendingTeamTricks === 8) {
    // Defending team Kapothi
    winnerTeam = defendingTeam;
    isKapothi = true;
    tokensAwarded = 3 + carried;
    newCarried = 0;
    const bonusText = carried > 0 ? ` (3 + ${carried} carried)` : '';
    messageEn = `KAPOTHI! Defending Team won all 8 tricks! +${tokensAwarded} tokens${bonusText}!`;
    messageSi = `කපෝති! විරුද්ධ පිල අත් 8 ම දිනාගත්තා! කැට +${tokensAwarded}${bonusText}!`;
  } else if (trumpTeamTricks >= 5) {
    // Trump team normal win
    winnerTeam = trumpTeam;
    tokensAwarded = 1 + carried;
    newCarried = 0;
    const bonusText = carried > 0 ? ` (1 + ${carried} carried)` : '';
    messageEn = `Trump Team won ${trumpTeamTricks} tricks! +${tokensAwarded} token(s)${bonusText}.`;
    messageSi = `තුරුම්පු පිල අත් ${trumpTeamTricks}ක් දිනුවා! කැට +${tokensAwarded}${bonusText}.`;
  } else {
    // Defending team win (defenders beat trump callers, awarded 2 tokens)
    winnerTeam = defendingTeam;
    tokensAwarded = 2 + carried;
    newCarried = 0;
    const bonusText = carried > 0 ? ` (2 + ${carried} carried)` : '';
    messageEn = `Defenders beat Trump Team (${defendingTeamTricks} tricks)! +${tokensAwarded} tokens${bonusText}.`;
    messageSi = `විරුද්ධ පිල ජයග්‍රහණය කළා (අත් ${defendingTeamTricks})! කැට +${tokensAwarded}${bonusText}.`;
  }

  const newTeam1Tokens = currentScore.team1Tokens + (winnerTeam === 1 ? tokensAwarded : 0);
  const newTeam2Tokens = currentScore.team2Tokens + (winnerTeam === 2 ? tokensAwarded : 0);

  return {
    winnerTeam,
    tokensAwarded,
    newTeam1Tokens,
    newTeam2Tokens,
    newCarriedTokens: newCarried,
    isKapothi,
    messageEn,
    messageSi,
  };
}

/**
 * First to 10 tokens wins the match
 */
export function checkMatchWinner(team1Tokens: number, team2Tokens: number, target: number = 10): 1 | 2 | null {
  if (team1Tokens >= target && team1Tokens > team2Tokens) return 1;
  if (team2Tokens >= target && team2Tokens > team1Tokens) return 2;
  return null;
}

/**
 * Configure players based on selected TeamMode:
 * Mode A (Same Team):
 * - Seat 0: Human 1 (Host, South)
 * - Seat 1: AI Bot 1 (East)
 * - Seat 2: Human 2 (Guest, North) -> Human 1 Partner!
 * - Seat 3: AI Bot 2 (West) -> AI 1 Partner!
 *
 * Mode B (Opposite Teams):
 * - Seat 0: Human 1 (Host, South)
 * - Seat 1: Human 2 (Guest, East)
 * - Seat 2: AI Bot 1 (North) -> Human 1 Partner!
 * - Seat 3: AI Bot 2 (West) -> Human 2 Partner!
 */
export function setupInitialPlayers(
  teamMode: TeamMode,
  hostName: string = 'Player 1',
  guestName: string = 'Player 2'
): PlayerInfo[] {
  if (teamMode === 'same_team') {
    return [
      { id: 0, name: hostName, isHuman: true, peerId: 'host', team: 1, hand: [], tricksWon: 0 },
      { id: 1, name: 'Bot Ravi', isHuman: false, team: 2, hand: [], tricksWon: 0 },
      { id: 2, name: guestName, isHuman: true, peerId: 'guest', team: 1, hand: [], tricksWon: 0 },
      { id: 3, name: 'Bot Kamal', isHuman: false, team: 2, hand: [], tricksWon: 0 },
    ];
  } else {
    return [
      { id: 0, name: hostName, isHuman: true, peerId: 'host', team: 1, hand: [], tricksWon: 0 },
      { id: 1, name: guestName, isHuman: true, peerId: 'guest', team: 2, hand: [], tricksWon: 0 },
      { id: 2, name: 'Bot Ravi', isHuman: false, team: 1, hand: [], tricksWon: 0 },
      { id: 3, name: 'Bot Kamal', isHuman: false, team: 2, hand: [], tricksWon: 0 },
    ];
  }
}

/**
 * Sanitizes game state before sending over network to a specific player seat.
 * Hides all other players' hand cards so opponents cannot cheat by inspecting the DOM/payload.
 */
export function sanitizeStateForPlayer(gameState: GameState, seatIndex: number): SanitizedGameState {
  return {
    ...gameState,
    mySeatIndex: seatIndex,
    players: gameState.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHuman: p.isHuman,
      team: p.team,
      cardCount: p.hand.length,
      hand: p.id === seatIndex ? [...p.hand] : [],
      tricksWon: p.tricksWon,
    })),
  };
}
