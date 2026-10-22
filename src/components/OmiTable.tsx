import React, { useEffect, useMemo, useState } from 'react';
import { Card, PlayedCard, SanitizedGameState, Suit } from '../game/types';
import { CardComponent, SUIT_SYMBOL } from './CardComponent';
import { isCardPlayable } from '../game/rules';
import { translations } from '../utils/i18n';
import { sound } from '../utils/sound';

interface OmiTableProps {
  gameState: SanitizedGameState;
  mySeatIndex: number;
  onPlayCard: (cardId: string) => void;
  onSelectTrump: (suit: Suit) => void;
  reactions: Record<number, string>;
  lang: 'en' | 'si';
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
// Color styling stays local; translations are the single source of suit names.
const SUIT_DATA: Record<Suit, { classes: string }> = {
  spades: { classes: 'text-slate-900 bg-stone-50 hover:bg-stone-100' },
  hearts: { classes: 'text-rose-600 bg-rose-50 hover:bg-rose-100' },
  diamonds: { classes: 'text-rose-600 bg-rose-50 hover:bg-rose-100' },
  clubs: { classes: 'text-slate-900 bg-stone-50 hover:bg-stone-100' },
};

/** All hands are displayed relative to the current player's seat. */
export const OmiTable: React.FC<OmiTableProps> = ({
  gameState,
  mySeatIndex,
  onPlayCard,
  onSelectTrump,
  reactions,
  lang,
}) => {
  const t = translations[lang];
  const [trumpSubmitting, setTrumpSubmitting] = useState(false);
  const isSelectingTrump = gameState.phase === 'SELECTING_TRUMP';
  const isTrumpSelector = gameState.trumpSelectorIndex === mySeatIndex;
  const isMyTurn = gameState.phase === 'TRICK_PLAYING' && gameState.activePlayerIndex === mySeatIndex;
  const me = gameState.players[mySeatIndex];
  const leadSuit = gameState.currentTrick?.leadSuit || null;
  const mustFollow = Boolean(leadSuit && me.hand.some(card => card.suit === leadSuit));

  useEffect(() => {
    setTrumpSubmitting(false);
  }, [gameState.roundNumber, isSelectingTrump]);

  // A lost signaling packet must not leave the guest's trump controls locked.
  useEffect(() => {
    if (!trumpSubmitting || !isSelectingTrump) return;
    const retryTimer = window.setTimeout(() => setTrumpSubmitting(false), 5000);
    return () => window.clearTimeout(retryTimer);
  }, [trumpSubmitting, isSelectingTrump]);

  const seats = useMemo(
    () => [0, 1, 2, 3].map(offset => gameState.players[(mySeatIndex + offset) % 4]),
    [gameState.players, mySeatIndex]
  );

  const sortedHand = useMemo(
    () => [...me.hand].sort(
      (a: Card, b: Card) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || b.value - a.value
    ),
    [me.hand]
  );

  const playedBySeat = useMemo(() => {
    const played = new Map<number, PlayedCard>();
    for (const item of gameState.currentTrick?.cards || []) played.set(item.playerId, item);
    return played;
  }, [gameState.currentTrick]);

  type SeatInfo = typeof gameState.players[number];

  const playerBadge = (player: SeatInfo, isBottom = false) => {
    const isActive = gameState.activePlayerIndex === player.id;
    const isPartner = player.team === me.team && player.id !== mySeatIndex;
    return (
      <div className="relative flex min-w-0 flex-col items-center gap-1 text-center">
        {reactions[player.id] && (
          <span className="absolute z-20 -top-9 text-2xl" role="status">{reactions[player.id]}</span>
        )}
        <div className={`relative flex items-center justify-center rounded-full border-2 font-black shadow-lg
          ${isBottom ? 'h-10 w-10 sm:h-12 sm:w-12 text-sm sm:text-base' : 'h-9 w-9 sm:h-11 sm:w-11 text-xs sm:text-base'}
          ${player.team === 1 ? 'bg-blue-950 text-blue-100' : 'bg-rose-950 text-rose-100'}
          ${isActive ? 'border-amber-300 ring-[3px] ring-amber-400/50' : 'border-white/30'}`}>
          {player.name.charAt(0).toUpperCase()}
          {gameState.dealerIndex === player.id && (
            <span title="Dealer" className="absolute -top-1 -right-1 rounded-full bg-amber-400 px-1 text-[9px] text-zinc-950">D</span>
          )}
        </div>
        <span className="w-full max-w-[105px] truncate text-[10px] sm:text-xs font-bold text-white">
          {player.name}{player.id === mySeatIndex ? ` (${t.youBadge})` : ''}
        </span>
        <span className="flex max-w-full items-center gap-1 text-[9px] leading-none text-emerald-100/75">
          {isPartner ? (lang === 'si' ? 'ඔබේ පිල' : 'Partner') : `${t.team} ${player.team}`}
          {!player.isHuman && <span className="rounded bg-zinc-900/70 px-1 py-0.5 text-amber-300">BOT</span>}
        </span>
        <span className="text-[9px] text-amber-200/85">
          {gameState.trumpSelectorIndex === player.id ? '★ ' : ''}{t.tricks}: {player.tricksWon}
        </span>
      </div>
    );
  };

  const hiddenHand = (count: number, vertical = false) => {
    if (!count) return <span className="text-[10px] text-emerald-100/50">0 cards</span>;
    return (
      <div className={`relative inline-flex items-center justify-center ${vertical ? 'h-14 w-[45px]' : 'h-12 w-[82px]'}`}
        aria-label={`${count} hidden cards`}>
        {Array.from({ length: Math.min(count, 3) }, (_, i) => (
          <div
            key={i}
            className="absolute"
            style={vertical
              ? { top: `${i * 5}px`, left: `${i * 3}px` }
              : { top: 0, left: `${i * 12}px` }}
          >
            <CardComponent isFaceDown size="sm" />
          </div>
        ))}
        <span className="absolute -bottom-1 -right-1 z-10 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-zinc-950">
          {count}
        </span>
      </div>
    );
  };

  const showPlayedCard = (relativePosition: 0 | 1 | 2 | 3) => {
    const seat = seats[relativePosition];
    const played = playedBySeat.get(seat.id);
    if (!played) return null;
    const classes = [
      'bottom-1 left-1/2 -translate-x-1/2 rotate-[-4deg]',
      'top-1/2 right-1 -translate-y-1/2 rotate-[5deg]',
      'top-1 left-1/2 -translate-x-1/2 rotate-[3deg]',
      'top-1/2 left-1 -translate-y-1/2 rotate-[-6deg]',
    ] as const;
    return (
      <div
        key={played.card.id}
        className={`absolute z-10 transition-transform duration-200 ${classes[relativePosition]}`}
        title={`${seat.name}: ${played.card.rank} of ${played.card.suit}`}
      >
        <CardComponent card={played.card} size="sm" />
      </div>
    );
  };

  const currentPlayer = gameState.players[gameState.activePlayerIndex];
  const chooser = gameState.players[gameState.trumpSelectorIndex];

  return (
    <section
      className="relative flex w-full flex-1 flex-col overflow-hidden rounded-[26px] border-[3px] border-[#ad864b]/70
        bg-[radial-gradient(ellipse_at_center,#155d49_0%,#094231_65%,#05281f_100%)]
        shadow-[inset_0_0_70px_rgba(0,0,0,0.32),0_14px_40px_rgba(0,0,0,0.3)]
        min-h-[470px] sm:min-h-[550px] px-2 pb-3 pt-3 sm:px-5 sm:pb-5 select-none"
      aria-label={lang === 'si' ? 'ඕමි ක්‍රීඩා මේසය' : 'Omi playing table'}
    >
      <div className="pointer-events-none absolute inset-2 rounded-[20px] border border-amber-200/20" />

      <div className="relative z-10 flex justify-between gap-2 px-2 pb-1 text-[10px] sm:text-xs text-amber-100/90">
        <span className="rounded-full border border-amber-400/30 bg-emerald-950/75 px-2.5 py-1">
          {lang === 'si' ? 'වටය' : 'Round'} {gameState.roundNumber}
        </span>
        <span className="rounded-full border border-amber-400/30 bg-emerald-950/75 px-2.5 py-1">
          {gameState.trumpSuit
            ? `${lang === 'si' ? 'තුරුම්පු' : 'Trump'} ${SUIT_SYMBOL[gameState.trumpSuit]} ${t[gameState.trumpSuit]}`
            : (lang === 'si' ? 'තුරුම්පු තෝරා නැත' : 'Trump pending')}
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-1 pb-2">
        {playerBadge(seats[2])}
        {hiddenHand(seats[2].cardCount)}
      </div>

      <div className="relative z-10 grid flex-1 grid-cols-[minmax(62px,1fr)_minmax(132px,2.6fr)_minmax(62px,1fr)] items-center gap-0.5 sm:gap-4">
        <div className="flex min-w-0 flex-col items-center justify-center gap-1">
          {playerBadge(seats[3])}
          {hiddenHand(seats[3].cardCount, true)}
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[245px] rounded-full border border-amber-200/30 bg-emerald-950/35 shadow-[inset_0_4px_22px_rgba(0,0,0,0.25)]">
          <div className="pointer-events-none absolute inset-3 rounded-full border border-amber-300/15" />
          {gameState.currentTrick && (
            <span className="absolute left-1/2 top-[42%] z-0 -translate-x-1/2 text-[11px] font-bold text-amber-200/75">
              {SUIT_SYMBOL[gameState.currentTrick.leadSuit]}
            </span>
          )}
          {showPlayedCard(2)}
          {showPlayedCard(3)}
          {showPlayedCard(1)}
          {showPlayedCard(0)}
          {(!gameState.currentTrick || !gameState.currentTrick.cards.length) &&
            gameState.phase === 'TRICK_PLAYING' && (
              <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-[11px] sm:text-sm font-medium text-amber-100/90">
                {isMyTurn
                  ? (lang === 'si' ? 'ඔබේ වාරයයි' : 'Your turn')
                  : `${currentPlayer?.name || 'Player'} ${lang === 'si' ? 'ගේ වාරය' : 'to play'}`}
              </div>
            )}
        </div>

        <div className="flex min-w-0 flex-col items-center justify-center gap-1">
          {playerBadge(seats[1])}
          {hiddenHand(seats[1].cardCount, true)}
        </div>
      </div>

      <div className="relative z-20 flex w-full flex-col items-center gap-1.5 pt-2">
        <div className="flex min-h-7 flex-wrap items-center justify-center gap-1.5 text-center">
          <span
            aria-live="polite"
            className={`rounded-full px-3 py-1 text-[11px] sm:text-xs font-bold
              ${isMyTurn ? 'bg-amber-400 text-emerald-950 shadow-md' : 'border border-amber-200/25 bg-emerald-950/65 text-amber-50'}`}
          >
            {isMyTurn ? t.yourTurn : t.waitingTurn.replace('{name}', currentPlayer?.name || 'Player')}
          </span>
          {isMyTurn && mustFollow && leadSuit && (
            <span className="rounded-full bg-emerald-950 px-2.5 py-1 text-[10px] sm:text-xs text-amber-200">
              {t.mustFollowSuit.replace('{suit}', t[leadSuit])}
            </span>
          )}
        </div>

        <div
          className="w-full max-w-[850px] overflow-x-auto overflow-y-visible px-1 pt-3 pb-2 [scrollbar-width:thin] [scrollbar-color:#b99758_transparent]"
          aria-label={lang === 'si' ? 'ඔබේ කාඩ්පත්' : 'Your hand'}
        >
          <div className="mx-auto flex min-w-max w-max items-end justify-center pl-0 pr-3">
            {sortedHand.map((card, index) => {
              const playable = isMyTurn && isCardPlayable(card, me.hand, leadSuit);
              return (
                <div
                  key={card.id}
                  className={`relative shrink-0 hover:z-40 focus-within:z-40 ${index ? '-ml-3 sm:-ml-2' : ''}`}
                >
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
            {!sortedHand.length && (
              <span className="rounded-lg border border-amber-200/20 bg-emerald-950/70 px-4 py-5 text-xs text-amber-50/70">
                {lang === 'si' ? 'කාඩ්පත් බෙදමින්...' : 'Waiting for cards...'}
              </span>
            )}
          </div>
        </div>
        {playerBadge(seats[0], true)}
      </div>

      {isSelectingTrump && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#071910]/90 px-3 py-5 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label={t.selectTrump}
        >
          <div className="my-auto w-full max-w-md rounded-3xl border-2 border-amber-400/75 bg-[#102920] p-4 text-center shadow-2xl sm:p-6">
            <span className="mb-2 inline-block rounded-full border border-amber-400/40 bg-amber-300/10 px-3 py-1 text-[11px] font-black tracking-wider text-amber-200">
              {lang === 'si' ? 'පළමු කාඩ්පත් 4' : 'FIRST FOUR CARDS'}
            </span>
            <h2 className="text-xl font-black text-amber-200 sm:text-2xl">{t.selectTrump}</h2>
            <p className="mb-4 mt-2 text-sm leading-6 text-emerald-50/85">
              {isTrumpSelector
                ? (lang === 'si'
                  ? 'මුල් කාඩ්පත් හතර බලලා තුරුම්පු පාට තෝරන්න. එතකොට ඉතුරු කාඩ්පත් 4 ලැබෙනවා.'
                  : 'Look at your first four cards and choose the trump suit. Four more cards will then be dealt.')
                : (lang === 'si'
                  ? `${chooser.name} තුරුම්පු තෝරන තෙක් රැඳී සිටින්න.`
                  : `Waiting for ${chooser.name} to choose trump.`)}
            </p>

            {isTrumpSelector ? (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-center gap-2 rounded-xl bg-emerald-950/75 p-3">
                  {sortedHand.map(card => <CardComponent key={card.id} card={card} size="md" />)}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {SUITS.map(suit => (
                    <button
                      key={suit}
                      type="button"
                      disabled={trumpSubmitting}
                      onClick={() => {
                        if (trumpSubmitting) return;
                        setTrumpSubmitting(true);
                        sound.playTrumpSelect();
                        onSelectTrump(suit);
                      }}
                      className={`flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 border-amber-300/40
                        px-3 py-3 font-bold transition-transform hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-amber-400
                        active:scale-95 disabled:cursor-wait disabled:opacity-60 ${SUIT_DATA[suit].classes}`}
                      aria-label={`${t[suit]} ${t.trumpSuit}`}
                    >
                      <span className="text-4xl leading-none sm:text-5xl">{SUIT_SYMBOL[suit]}</span>
                      <span className="mt-1 text-sm">{t[suit]}</span>
                    </button>
                  ))}
                </div>
                {trumpSubmitting && (
                  <p className="mt-3 text-xs text-amber-200" role="status">
                    {lang === 'si' ? 'තුරුම්පු තේරීම යවමින්...' : 'Confirming trump selection...'}
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-5" role="status">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
                <span className="text-xs text-emerald-100/70">
                  {lang === 'si' ? 'කාඩ්පත් හතරෙන් තුරුම්පු තේරෙනවා...' : 'Trump is chosen from the first four cards'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
