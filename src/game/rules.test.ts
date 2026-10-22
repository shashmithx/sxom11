import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOmiDeck,
  isCardPlayable,
  determineTrickWinner,
  calculateRoundScoring,
  checkMatchWinner,
  getNextPlayerIndex,
  getTeamForSeat,
  setupInitialPlayers,
} from './rules';
import { botChooseTrumpSuit, botChooseCardToPlay } from './ai';
import { Card, Trick, ScoreState } from './types';

test('createOmiDeck generates 32 authentic Sri Lankan OMI cards', () => {
  const deck = createOmiDeck();
  assert.equal(deck.length, 32);

  const spades = deck.filter((c) => c.suit === 'spades');
  const hearts = deck.filter((c) => c.suit === 'hearts');
  const diamonds = deck.filter((c) => c.suit === 'diamonds');
  const clubs = deck.filter((c) => c.suit === 'clubs');

  assert.equal(spades.length, 8);
  assert.equal(hearts.length, 8);
  assert.equal(diamonds.length, 8);
  assert.equal(clubs.length, 8);

  // Check ranks
  const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  for (const r of ranks) {
    assert.equal(deck.filter((c) => c.rank === r).length, 4);
  }
});

test('counter-clockwise turn order and seating layout', () => {
  assert.equal(getNextPlayerIndex(0), 1);
  assert.equal(getNextPlayerIndex(1), 2);
  assert.equal(getNextPlayerIndex(2), 3);
  assert.equal(getNextPlayerIndex(3), 0);

  // Partnerships: 0 and 2 are Team 1, 1 and 3 are Team 2
  assert.equal(getTeamForSeat(0), 1);
  assert.equal(getTeamForSeat(2), 1);
  assert.equal(getTeamForSeat(1), 2);
  assert.equal(getTeamForSeat(3), 2);
});

test('card playability follows strict suit-following rules', () => {
  const hand: Card[] = [
    { id: 'spades_A', suit: 'spades', rank: 'A', value: 8 },
    { id: 'spades_7', suit: 'spades', rank: '7', value: 1 },
    { id: 'hearts_K', suit: 'hearts', rank: 'K', value: 7 },
  ];

  // If leading (leadSuit is null), any card in hand is playable
  assert.equal(isCardPlayable(hand[0], hand, null), true);
  assert.equal(isCardPlayable(hand[2], hand, null), true);

  // If spades is led, player HAS spades, so MUST play spades
  assert.equal(isCardPlayable(hand[0], hand, 'spades'), true);
  assert.equal(isCardPlayable(hand[1], hand, 'spades'), true);
  assert.equal(isCardPlayable(hand[2], hand, 'spades'), false); // hearts_K illegal!

  // If diamonds is led, player has NO diamonds, so any card (even hearts or spades trump) is legal
  assert.equal(isCardPlayable(hand[0], hand, 'diamonds'), true);
  assert.equal(isCardPlayable(hand[2], hand, 'diamonds'), true);
});

test('trick winner determination respects trump and highest lead card', () => {
  const trumpSuit = 'hearts';

  // Trick 1: Spades led, no trumps played
  const trick1: Trick = {
    leadSuit: 'spades',
    cards: [
      { card: { id: 'spades_10', suit: 'spades', rank: '10', value: 4 }, playerId: 0 },
      { card: { id: 'spades_K', suit: 'spades', rank: 'K', value: 7 }, playerId: 1 },
      { card: { id: 'spades_8', suit: 'spades', rank: '8', value: 2 }, playerId: 2 },
      { card: { id: 'diamonds_A', suit: 'diamonds', rank: 'A', value: 8 }, playerId: 3 }, // discard
    ],
  };
  const winner1 = determineTrickWinner(trick1, trumpSuit);
  assert.equal(winner1.playerId, 1); // Spades K wins (diamonds A was off-suit discard)

  // Trick 2: Clubs led, but player 2 cuts with trump (hearts 7)
  const trick2: Trick = {
    leadSuit: 'clubs',
    cards: [
      { card: { id: 'clubs_A', suit: 'clubs', rank: 'A', value: 8 }, playerId: 0 },
      { card: { id: 'clubs_K', suit: 'clubs', rank: 'K', value: 7 }, playerId: 1 },
      { card: { id: 'hearts_7', suit: 'hearts', rank: '7', value: 1 }, playerId: 2 }, // trump!
      { card: { id: 'clubs_10', suit: 'clubs', rank: '10', value: 4 }, playerId: 3 },
    ],
  };
  const winner2 = determineTrickWinner(trick2, trumpSuit);
  assert.equal(winner2.playerId, 2); // Trump cuts clubs A!

  // Trick 3: Two trumps played, highest trump wins
  const trick3: Trick = {
    leadSuit: 'clubs',
    cards: [
      { card: { id: 'clubs_A', suit: 'clubs', rank: 'A', value: 8 }, playerId: 0 },
      { card: { id: 'hearts_7', suit: 'hearts', rank: '7', value: 1 }, playerId: 1 }, // small trump
      { card: { id: 'hearts_J', suit: 'hearts', rank: 'J', value: 5 }, playerId: 2 }, // higher trump!
      { card: { id: 'clubs_8', suit: 'clubs', rank: '8', value: 2 }, playerId: 3 },
    ],
  };
  const winner3 = determineTrickWinner(trick3, trumpSuit);
  assert.equal(winner3.playerId, 2); // hearts J beats hearts 7
});

test('Sri Lankan OMI scoring rules: trump team win, defending team win, Kapothi, and 4-4 draw', () => {
  const initialScore: ScoreState = {
    team1Tokens: 2,
    team2Tokens: 1,
    carriedTokens: 0,
    team1RoundTricks: 0,
    team2RoundTricks: 0,
    targetTokens: 10,
  };

  // Case 1: Trump team (Team 1, seat 0 called) wins 5 tricks
  const res1 = calculateRoundScoring(5, 3, 0, initialScore);
  assert.equal(res1.winnerTeam, 1);
  assert.equal(res1.tokensAwarded, 1);
  assert.equal(res1.newTeam1Tokens, 3);
  assert.equal(res1.newTeam2Tokens, 1);
  assert.equal(res1.newCarriedTokens, 0);
  assert.equal(res1.isKapothi, false);

  // Case 2: Defending team (Team 2) beats trump callers (Team 1, seat 0 called) with 5 tricks -> 2 tokens!
  const res2 = calculateRoundScoring(3, 5, 0, initialScore);
  assert.equal(res2.winnerTeam, 2);
  assert.equal(res2.tokensAwarded, 2);
  assert.equal(res2.newTeam2Tokens, 3);
  assert.equal(res2.newCarriedTokens, 0);

  // Case 3: 4-4 Draw / Bada -> 1 carried token
  const res3 = calculateRoundScoring(4, 4, 0, initialScore);
  assert.equal(res3.winnerTeam, 0);
  assert.equal(res3.tokensAwarded, 0);
  assert.equal(res3.newCarriedTokens, 1);

  // Case 4: Subsequent round with carried token: Kapothi! (all 8 tricks) -> 3 + 1 = 4 tokens
  const scoreWithCarried: ScoreState = { ...initialScore, carriedTokens: 1 };
  const res4 = calculateRoundScoring(8, 0, 0, scoreWithCarried);
  assert.equal(res4.winnerTeam, 1);
  assert.equal(res4.isKapothi, true);
  assert.equal(res4.tokensAwarded, 4); // 3 for Kapothi + 1 carried
  assert.equal(res4.newCarriedTokens, 0);
});

test('checkMatchWinner determines 10 tokens threshold', () => {
  assert.equal(checkMatchWinner(9, 6, 10), null);
  assert.equal(checkMatchWinner(10, 6, 10), 1);
  assert.equal(checkMatchWinner(8, 10, 10), 2);
});

test('AI bot chooses trump and plays legal cards intelligently', () => {
  const fourCards: Card[] = [
    { id: 'spades_A', suit: 'spades', rank: 'A', value: 8 },
    { id: 'spades_K', suit: 'spades', rank: 'K', value: 7 },
    { id: 'hearts_7', suit: 'hearts', rank: '7', value: 1 },
    { id: 'clubs_8', suit: 'clubs', rank: '8', value: 2 },
  ];
  const trump = botChooseTrumpSuit(fourCards, 'hard');
  assert.equal(trump, 'spades'); // 2 high spades beats 1 card in other suits

  // Bot play: must follow suit
  const hand: Card[] = [
    { id: 'hearts_A', suit: 'hearts', rank: 'A', value: 8 },
    { id: 'spades_8', suit: 'spades', rank: '8', value: 2 },
    { id: 'spades_10', suit: 'spades', rank: '10', value: 4 },
  ];
  const trick: Trick = {
    leadSuit: 'spades',
    cards: [
      { card: { id: 'spades_9', suit: 'spades', rank: '9', value: 3 }, playerId: 0 },
    ],
  };
  const chosen = botChooseCardToPlay(1, hand, trick, 'diamonds', 'hard');
  assert.equal(chosen.suit, 'spades'); // strictly follows suit!
});

test('setupInitialPlayers handles Mode A (Same Team) and Mode B (Opposite Teams)', () => {
  const sameTeam = setupInitialPlayers('same_team', 'Kasun', 'Nimal');
  assert.equal(sameTeam[0].name, 'Kasun');
  assert.equal(sameTeam[2].name, 'Nimal');
  assert.equal(sameTeam[0].team, sameTeam[2].team); // Partners on Team 1!
  assert.equal(sameTeam[1].isHuman, false); // Bots on Team 2!
  assert.equal(sameTeam[3].isHuman, false);

  const oppTeams = setupInitialPlayers('opposite_teams', 'Kasun', 'Nimal');
  assert.equal(oppTeams[0].name, 'Kasun');
  assert.equal(oppTeams[1].name, 'Nimal');
  assert.notEqual(oppTeams[0].team, oppTeams[1].team); // Opponents!
  assert.equal(oppTeams[2].isHuman, false); // Kasun's partner is Bot Ravi
  assert.equal(oppTeams[0].team, oppTeams[2].team);
});
