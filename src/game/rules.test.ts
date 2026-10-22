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
  setupSoloPlayers,
  canDealerShuffle,
  sanitizeStateForPlayer,
} from './rules';
import { botChooseTrumpSuit, botChooseCardToPlay } from './ai';
import { Card, Trick, ScoreState, GameState } from './types';

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

test('solo practice contains exactly one human in both team modes', () => {
  for (const mode of ['same_team', 'opposite_teams'] as const) {
    const players = setupSoloPlayers(mode, 'Kasun');
    assert.equal(players.length, 4);
    assert.deepEqual(players.filter(p => p.isHuman).map(p => p.id), [0]);
    assert.equal(players[0].name, 'Kasun');
    assert.equal(players[1].isHuman, false);
    assert.equal(players[2].isHuman, false);
    assert.equal(players[3].isHuman, false);
  }
});

test('trump rotates from host at opening dealer seat 3 to later seats', () => {
  let dealer = 3;
  const selectors = [];
  for (let round = 0; round < 4; round++) {
    selectors.push(getNextPlayerIndex(dealer));
    dealer = getNextPlayerIndex(dealer);
  }
  assert.deepEqual(selectors, [0, 1, 2, 3]);
});

test('sanitization hides opponent hands and never leaks undealt deck', () => {
  const players = setupInitialPlayers('same_team', 'Host', 'Guest');
  const deck = createOmiDeck();
  for (let seat = 0; seat < 4; seat++) {
    players[seat].hand = deck.slice(seat * 4, seat * 4 + 4);
  }
  const state: GameState = {
    roomCode: 'OMI-TEST', teamMode: 'same_team', botDifficulty: 'normal',
    phase: 'SELECTING_TRUMP', dealerIndex: 3, trumpSelectorIndex: 0,
    trumpSuit: null, activePlayerIndex: 0, currentTrick: null, lastCompletedTrick: null,
    tricksHistory: [], players, roundNumber: 1, roundSummaries: [],
    winningTeam: null, message: '', messageSi: '',
    score: {
      team1Tokens: 0, team2Tokens: 0, carriedTokens: 0,
      team1RoundTricks: 0, team2RoundTricks: 0, targetTokens: 10,
    },
  };
  (state as GameState & { remainingDeck?: Card[] }).remainingDeck = deck.slice(16);
  const host = sanitizeStateForPlayer(state, 0);
  const guest = sanitizeStateForPlayer(state, 2);
  assert.equal(host.players[0].hand.length, 4);
  assert.equal(host.players[2].hand.length, 0);
  assert.equal(guest.players[2].hand.length, 4);
  assert.equal(guest.players[0].hand.length, 0);
  assert.equal('remainingDeck' in host, false);
  assert.equal('remainingDeck' in guest, false);
});

test('played cards and trick winners stay immutable in each network snapshot', () => {
  const deck = createOmiDeck();
  const players = setupInitialPlayers('opposite_teams', 'Host', 'Friend');
  players[0].hand = [deck[0]];
  players[1].hand = [deck[1]];
  const currentTrick: Trick = {
    leadSuit: deck[0].suit,
    cards: [{ playerId: 0, card: deck[0] }],
  };
  const state: GameState = {
    roomCode: 'OMI-TEST', teamMode: 'opposite_teams', botDifficulty: 'normal',
    phase: 'TRICK_PLAYING', dealerIndex: 3, trumpSelectorIndex: 0,
    trumpSuit: 'hearts', activePlayerIndex: 1, currentTrick,
    lastCompletedTrick: null, tricksHistory: [], players, roundNumber: 1,
    roundSummaries: [], winningTeam: null, message: '', messageSi: '',
    score: {
      team1Tokens: 0, team2Tokens: 0, carriedTokens: 0,
      team1RoundTricks: 0, team2RoundTricks: 0, targetTokens: 10,
    },
  };

  const beforeBotPlay = sanitizeStateForPlayer(state, 1);
  state.currentTrick!.cards.push({ playerId: 1, card: deck[1] });
  state.currentTrick!.winnerPlayerId = 1;
  state.score.team2RoundTricks++;
  const afterBotPlay = sanitizeStateForPlayer(state, 1);

  assert.equal(beforeBotPlay.currentTrick?.cards.length, 1);
  assert.equal(beforeBotPlay.currentTrick?.winnerPlayerId, undefined);
  assert.equal(beforeBotPlay.score.team2RoundTricks, 0);
  assert.equal(afterBotPlay.currentTrick?.cards.length, 2);
  assert.equal(afterBotPlay.currentTrick?.winnerPlayerId, 1);
  assert.equal(afterBotPlay.score.team2RoundTricks, 1);
  assert.equal(afterBotPlay.players[0].hand.length, 0, 'host hand stays hidden on guest device');
});

test('only the dealer can shuffle, and they must shuffle before dealing', () => {
  const players = setupInitialPlayers('opposite_teams', 'Host', 'Guest');
  const round: GameState = {
    roomCode: 'TEST', teamMode: 'opposite_teams', botDifficulty: 'normal',
    phase: 'SHUFFLING', dealerIndex: 1, shuffleCount: 0,
    trumpSelectorIndex: 2, trumpSuit: null, activePlayerIndex: 1,
    currentTrick: null, lastCompletedTrick: null, tricksHistory: [],
    players, roundNumber: 3, roundSummaries: [], winningTeam: null,
    message: '', messageSi: '', score: {
      team1Tokens: 0, team2Tokens: 0, carriedTokens: 0,
      team1RoundTricks: 0, team2RoundTricks: 0, targetTokens: 10,
    },
  };
  assert.equal(canDealerShuffle(round, 1, 'shuffle'), true);
  assert.equal(canDealerShuffle(round, 0, 'shuffle'), false);
  assert.equal(canDealerShuffle(round, 1, 'deal'), false);
  round.shuffleCount = 2;
  assert.equal(canDealerShuffle(round, 1, 'deal'), true);
  round.shuffleCount = 8;
  assert.equal(canDealerShuffle(round, 1, 'shuffle'), false);
  round.phase = 'TRICK_PLAYING';
  assert.equal(canDealerShuffle(round, 1, 'deal'), false);
  assert.equal(canDealerShuffle(round, 1, 'shuffle'), false);
});

test('multiple dealer shuffles keep a complete 32-card deck without duplicates', () => {
  const deck = createOmiDeck();
  const first = shuffleDeck(deck, () => 0.5);
  const second = shuffleDeck(first, () => 0.25);
  assert.equal(second.length, 32);
  assert.equal(new Set(second.map(card => card.id)).size, 32);
  assert.deepEqual(deck.map(card => card.id).sort(), second.map(card => card.id).sort());
  assert.notDeepEqual(deck, first);
});
