import React, { useMemo } from 'react';
import { Card, PlayedCard, SanitizedGameState, Suit, Trick } from '../game/types';
import { CardComponent } from './CardComponent';
import { isCardPlayable } from '../game/rules';
import { translations } from '../utils/i18n';
import { sound } from '../utils/sound';

interface OmiTableProps {
  gameState: SanitizedGameState;
  mySeatIndex: number;
  onPlayCard: (cardId: string) => void;
  onSelectTrump: (suit: Suit) => void;
  reactions: Record<number, string>; // seatIndex -> emoji
  lang: 'en' | 'si';
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_DATA: Record<Suit, { icon: string; nameEn: string; nameSi: string; color: string }> = {
  spades: { icon: '♠', nameEn: 'Spades', nameSi: 'ඉස්පික', color: 'text-zinc-900 bg-zinc-100 hover:bg-zinc-200' },
  hearts: { icon: '♥', nameEn: 'Hearts', nameSi: 'හර්ත', color: 'text-rose-600 bg-rose-50 hover:bg-rose-100' },
  diamonds: { icon: '♦', nameEn: 'Diamonds', nameSi: 'රූබ', color: 'text-rose-600 bg-rose-50 hover:bg-rose-100' },
  clubs: { icon: '♣', nameEn: 'Clubs', nameSi: 'කලාවර', color: 'text-zinc-900 bg-zinc-100 hover:bg-zinc-200' },
};

export const OmiTable: React.FC<OmiTableProps> = ({
  gameState,
  mySeatIndex,
  onPlayCard,
  onSelectTrump,
  reactions,
  lang,
}) => {
  const t = translations[lang];

  // Rotate seats so mySeatIndex is ALWAYS at bottom (index 0 relative to viewer)
  // relative 0: Bottom (Self)
  // relative 1: Right (to my right)
  // relative 2: Top (Opposite / Partner)
  // relative 3: Left (to my left)
  const relativeSeats = useMemo(() => {
    return [0, 1, 2, 3].map((offset) => {
      const actualSeat = (mySeatIndex + offset) % 4;
      return gameState.players[actualSeat];
    });
  }, [gameState.players, mySeatIndex]);

  const me = gameState.players[mySeatIndex];
  const isMyTurn = gameState.activePlayerIndex === mySeatIndex && gameState.phase === 'TRICK_PLAYING';
  const isTrumpSelector = gameState.trumpSelectorIndex === mySeatIndex;
  const isSelectingTrumpPhase = gameState.phase === 'SELECTING_TRUMP';

  const leadSuit = gameState.currentTrick ? gameState.currentTrick.leadSuit : null;

  // Render a player seat avatar & indicators
  const renderPlayerBadge = (
    player: (typeof gameState.players)[0],
    position: 'bottom' | 'top' | 'left' | 'right'
  ) => {
    const isActive = gameState.activePlayerIndex === player.id;
    const isDealer = gameState.dealerIndex === player.id;
    const isTrumpCaller = gameState.trumpSelectorIndex === player.id;
    const isPartner = player.team === me.team && player.id !== me.id;
    const isSelf = player.id === me.id;
    const reaction = reactions[player.id];

    return (
      <div
        className={`relative flex flex-col items-center select-none transition-all duration-300 ${
          position === 'bottom'
            ? 'mb-1 sm:mb-2'
            : position === 'top'
            ? 'mt-1 sm:mt-2'
            : position === 'left'
            ? 'ml-1 sm:ml-2'
            : 'mr-1 sm:mr-2'
        }`}
      >
        {/* Reaction popup */}
        {reaction && (
          <div className="absolute -top-10 text-3xl animate-bounce z-40 bg-zinc-900/90 rounded-full px-2 py-0.5 border border-amber-400 shadow-lg">
            {reaction}
          </div>
        )}

        {/* Avatar Ring */}
        <div
          className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-bold text-base sm:text-lg border-2 shadow-lg transition-transform ${
            isActive
              ? 'ring-4 ring-amber-400 border-amber-300 scale-110 shadow-amber-500/50 animate-pulse'
              : 'border-amber-400/30'
          } ${
            player.team === 1
              ? 'bg-linear-to-br from-blue-700 via-blue-900 to-indigo-950 text-blue-100'
              : 'bg-linear-to-br from-rose-700 via-rose-900 to-red-950 text-rose-100'
          }`}
        >
          {player.name.charAt(0).toUpperCase()}

          {/* Badges */}
          {isDealer && (
            <span
              title="Dealer"
              className="absolute -top-1 -right-1 bg-amber-500 text-zinc-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-white shadow"
            >
              D
            </span>
          )}
          {isTrumpCaller && (
            <span
              title="Trump Caller"
              className="absolute -bottom-1 -right-1 bg-amber-400 text-zinc-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-white shadow"
            >
              T
            </span>
          )}
        </div>

        {/* Name & Role tag */}
        <div className="flex flex-col items-center mt-1">
          <span className="text-xs sm:text-sm font-semibold text-white drop-shadow flex items-center gap-1 max-w-[100px] truncate">
            {player.name}
            {isSelf && <span className="text-[9px] text-amber-300 font-bold">({t.youBadge})</span>}
          </span>

          <div className="flex items-center gap-1 mt-0.5">
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                player.team === 1 ? 'bg-blue-600/80 text-blue-100' : 'bg-rose-600/80 text-rose-100'
              }`}
            >
              Team {player.team}
            </span>
            {!player.isHuman && (
              <span className="text-[8px] bg-zinc-800 text-zinc-300 px-1 py-0.2 rounded">
                BOT
              </span>
            )}
            {isPartner && (
              <span className="text-[8px] bg-emerald-700 text-emerald-100 px-1 py-0.2 rounded font-bold">
                {t.partnerBadge}
              </span>
            )}
          </div>

          {/* Tricks won this round */}
          <span className="text-[10px] text-amber-300/90 font-mono mt-0.5">
            {t.tricks}: {player.tricksWon}
          </span>
        </div>
      </div>
    );
  };

  // Played card inside center trick area
  const renderTrickCard = (playedCard?: PlayedCard, position?: 'bottom' | 'top' | 'left' | 'right') => {
    if (!playedCard) return null;
    const player = gameState.players[playedCard.playerId];

    const posOffset = {
      bottom: 'translate-y-6 sm:translate-y-8',
      top: '-translate-y-6 sm:-translate-y-8',
      left: '-translate-x-6 sm:-translate-x-8',
      right: 'translate-x-6 sm:translate-x-8',
    }[position || 'bottom'];

    return (
      <div
        className={`absolute flex flex-col items-center transition-all duration-300 animate-in fade-in zoom-in-95 ${posOffset}`}
      >
        <CardComponent card={playedCard.card} size="md" />
        <span
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 border shadow ${
            player.team === 1
              ? 'bg-blue-900/90 text-blue-200 border-blue-400'
              : 'bg-rose-900/90 text-rose-200 border-rose-400'
          }`}
        >
          {player.name}
        </span>
      </div>
    );
  };

  // Find cards in current trick by relative position
  const trickCardsByRelativePos = useMemo(() => {
    const map: Record<'bottom' | 'top' | 'left' | 'right', PlayedCard | undefined> = {
      bottom: undefined,
      top: undefined,
      left: undefined,
      right: undefined,
    };
    if (!gameState.currentTrick || !gameState.currentTrick.cards) return map;
    for (const pc of gameState.currentTrick.cards) {
      const relIdx = (pc.playerId - mySeatIndex + 4) % 4;
      if (relIdx === 0) map.bottom = pc;
      else if (relIdx === 1) map.right = pc;
      else if (relIdx === 2) map.top = pc;
      else if (relIdx === 3) map.left = pc;
    }
    return map;
  }, [gameState.currentTrick, mySeatIndex]);

  return (
    <div className="relative w-full flex-1 min-h-[500px] flex flex-col justify-between items-center rounded-3xl overflow-hidden border-4 border-amber-600/40 bg-linear-to-b from-emerald-950 via-emerald-900 to-emerald-950 shadow-2xl p-2 sm:p-4 select-none">
      {/* Felt texture & luxury gold filigree pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(#fef08a_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute inset-2 sm:inset-4 rounded-2xl border border-amber-400/20 pointer-events-none" />

      {/* Center Table Oval with Gold Ring */}
      <div className="absolute inset-6 sm:inset-10 rounded-full border border-amber-400/10 pointer-events-none flex items-center justify-center">
        <div className="text-center opacity-15">
          <div className="text-3xl sm:text-5xl font-black font-serif tracking-widest text-amber-200">
            SHANEX OMI
          </div>
          <div className="text-xs sm:text-sm font-semibold tracking-widest text-amber-400 uppercase mt-1">
            ශ්‍රී ලංකා ඔමි
          </div>
        </div>
      </div>

      {/* TOP SEAT (Relative 2: Partner in Mode A, Opponent in Mode B) */}
      <div className="z-10 flex flex-col items-center">
        {renderPlayerBadge(relativeSeats[2], 'top')}
        {/* Top Player Card Backs */}
        <div className="flex -space-x-4 sm:-space-x-6 mt-1">
          {Array.from({ length: relativeSeats[2].cardCount }).map((_, i) => (
            <CardComponent key={i} isFaceDown size="sm" />
          ))}
        </div>
      </div>

      {/* MIDDLE SECTION: Left Player, Center Trick Area, Right Player */}
      <div className="relative w-full flex items-center justify-between px-2 sm:px-8 z-10">
        {/* LEFT SEAT (Relative 3) */}
        <div className="flex flex-col items-center">
          {renderPlayerBadge(relativeSeats[3], 'left')}
          <div className="flex -space-x-5 sm:-space-x-6 mt-1">
            {Array.from({ length: relativeSeats[3].cardCount }).map((_, i) => (
              <CardComponent key={i} isFaceDown size="sm" />
            ))}
          </div>
        </div>

        {/* CENTER TRICK PLAYFIELD */}
        <div className="relative w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full bg-emerald-950/70 border border-amber-400/30 flex items-center justify-center shadow-inner my-2">
          {/* Active trick indicators */}
          {gameState.currentTrick && (
            <div className="absolute top-1 sm:top-2 text-[9px] sm:text-xs text-amber-300 font-semibold bg-emerald-900/90 px-2 py-0.5 rounded-full border border-amber-400/40">
              Lead: <span className="font-bold uppercase">{gameState.currentTrick.leadSuit}</span>
            </div>
          )}

          {/* Cards currently in center trick */}
          {renderTrickCard(trickCardsByRelativePos.top, 'top')}
          {renderTrickCard(trickCardsByRelativePos.left, 'left')}
          {renderTrickCard(trickCardsByRelativePos.right, 'right')}
          {renderTrickCard(trickCardsByRelativePos.bottom, 'bottom')}

          {/* Waiting banner if center is empty */}
          {(!gameState.currentTrick || gameState.currentTrick.cards.length === 0) &&
            gameState.phase === 'TRICK_PLAYING' && (
              <div className="text-center p-3">
                <span className="text-xs sm:text-sm font-semibold text-amber-200/80 animate-pulse">
                  {gameState.activePlayerIndex === mySeatIndex
                    ? (lang === 'si' ? 'ඔබේ වාරයයි! කාඩ්පතක් අදින්න.' : 'Your turn! Lead a card.')
                    : (lang === 'si'
                        ? `${gameState.players[gameState.activePlayerIndex].name} අත අදියි...`
                        : `${gameState.players[gameState.activePlayerIndex].name} to lead...`)}
                </span>
              </div>
            )}
        </div>

        {/* RIGHT SEAT (Relative 1) */}
        <div className="flex flex-col items-center">
          {renderPlayerBadge(relativeSeats[1], 'right')}
          <div className="flex -space-x-5 sm:-space-x-6 mt-1">
            {Array.from({ length: relativeSeats[1].cardCount }).map((_, i) => (
              <CardComponent key={i} isFaceDown size="sm" />
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM SEAT (You / Human 1 or 2) */}
      <div className="z-20 flex flex-col items-center w-full max-w-2xl px-2">
        {/* Turn prompt & suit alert */}
        <div className="mb-1 flex items-center gap-2">
          {isMyTurn ? (
            <span className="bg-amber-400 text-zinc-950 font-black text-xs sm:text-sm px-3 py-0.5 rounded-full shadow-lg shadow-amber-400/30 animate-bounce">
              {t.yourTurn}
            </span>
          ) : (
            <span className="text-xs text-zinc-300 font-medium">
              {t.waitingTurn.replace('{name}', gameState.players[gameState.activePlayerIndex]?.name || 'Player')}
            </span>
          )}

          {isMyTurn && leadSuit && (
            <span className="text-[11px] bg-emerald-950/90 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/50">
              {t.mustFollowSuit.replace('{suit}', leadSuit.toUpperCase())}
            </span>
          )}
        </div>

        {/* Human player hand cards (Fan layout - single row, non-wrapping) */}
        <div className="flex flex-nowrap justify-center -space-x-3 sm:-space-x-4 md:-space-x-3 pb-3 px-1 w-full max-w-full overflow-visible">
          {me.hand.map((card) => {
            const playable = isMyTurn && isCardPlayable(card, me.hand, leadSuit);
            return (
              <div key={card.id} className="transition-transform">
                <CardComponent
                  card={card}
                  isPlayable={playable}
                  onClick={() => {
                    if (playable) {
                      sound.playCardSnap();
                      onPlayCard(card.id);
                    }
                  }}
                  size="md"
                />
              </div>
            );
          })}
        </div>

        {renderPlayerBadge(relativeSeats[0], 'bottom')}
      </div>

      {/* TRUMP SELECTION MODAL OVERLAY */}
      {isSelectingTrumpPhase && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border-2 border-amber-400 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center">
            <h3 className="text-xl sm:text-2xl font-black text-amber-300 font-serif mb-1">
              {t.selectTrump}
            </h3>
            <p className="text-sm text-zinc-300 mb-6">
              {isTrumpSelector
                ? t.selectTrumpPrompt
                : (lang === 'si'
                    ? `${gameState.players[gameState.trumpSelectorIndex].name} තුරුම්පු තෝරමින් සිටී...`
                    : `Waiting for ${gameState.players[gameState.trumpSelectorIndex].name} to choose Trump...`)}
            </p>

            {/* If I am the trump chooser, show suit buttons */}
            {isTrumpSelector ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {SUITS.map((suit) => {
                  const data = SUIT_DATA[suit];
                  return (
                    <button
                      key={suit}
                      type="button"
                      onClick={() => {
                        sound.playTrumpSelect();
                        onSelectTrump(suit);
                      }}
                      className={`cursor-pointer rounded-2xl p-4 flex flex-col items-center justify-center border-2 border-amber-400/40 shadow-lg transition-transform hover:scale-105 active:scale-95 ${data.color}`}
                    >
                      <span className="text-4xl sm:text-5xl font-black">{data.icon}</span>
                      <span className="font-bold text-sm sm:text-base mt-2">
                        {lang === 'si' ? data.nameSi : data.nameEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex justify-center p-6">
                <div className="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
