import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CardComponent } from './CardComponent';

interface ShuffleDeckProps {
  dealerName: string;
  isMyTurn: boolean;
  count: number;
  roundNumber: number;
  lang: 'si' | 'en';
  onShuffle: () => void;
  onDeal: () => void;
}

/**
 * Player-directed riffle shuffle. The visual deck contains only card backs:
 * the authoritative host keeps the secret randomized 32-card order.
 * Tap, swipe across the deck, or use the button to shuffle.
 */
export const ShuffleDeck: React.FC<ShuffleDeckProps> = ({
  dealerName,
  isMyTurn,
  count,
  roundNumber,
  lang,
  onShuffle,
  onDeal,
}) => {
  const reducedMotion = useReducedMotion() === true;
  const [pendingShuffle, setPendingShuffle] = useState(false);
  const [pendingDeal, setPendingDeal] = useState(false);
  const pointerStart = useRef<number | null>(null);
  const swallowNextClick = useRef(false);
  const canShuffle = isMyTurn && !pendingShuffle && !pendingDeal && count < 8;
  const canDeal = isMyTurn && count >= 1 && !pendingShuffle && !pendingDeal;

  useEffect(() => {
    setPendingShuffle(false);
  }, [count]);

  useEffect(() => {
    setPendingShuffle(false);
    setPendingDeal(false);
  }, [roundNumber]);

  // A dropped network packet must not permanently lock the guest's controls.
  useEffect(() => {
    if (!pendingShuffle && !pendingDeal) return;
    const timer = window.setTimeout(() => {
      setPendingShuffle(false);
      setPendingDeal(false);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [pendingShuffle, pendingDeal]);

  const shuffle = () => {
    if (!canShuffle) return;
    setPendingShuffle(true);
    onShuffle();
  };

  const deal = () => {
    if (!canDeal) return;
    setPendingDeal(true);
    onDeal();
  };

  const suits = ['♠', '♥', '♦', '♣'];

  return (
    <div className="absolute inset-0 z-[55] flex items-center justify-center overflow-y-auto bg-[#061a14]/95 px-3 py-6 backdrop-blur-md"
      role="dialog" aria-modal="true"
      aria-label={lang === 'si' ? 'කොළ අනන වාරය' : 'Shuffle the deck'}>
      <div className="my-auto flex w-full max-w-md flex-col items-center rounded-[30px] border border-amber-300/50 bg-gradient-to-b from-emerald-950 via-[#0d3429] to-emerald-950 px-5 py-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:px-8">
        <span className="rounded-full border border-amber-400/35 bg-amber-400/10 px-4 py-1.5 text-xs font-black tracking-wide text-amber-200">
          {lang === 'si' ? `වටය ${roundNumber} • කොළ අනනවා` : `Round ${roundNumber} • Shuffle`}
        </span>
        <h2 className="mt-3 text-xl font-black text-amber-100 sm:text-2xl">
          {isMyTurn
            ? (lang === 'si' ? 'දැන් ඔබේ කොළ අනන වාරයයි!' : 'Your turn to shuffle!')
            : (lang === 'si' ? `${dealerName} කොළ අනනවා...` : `${dealerName} is shuffling...`)}
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-emerald-100/75">
          {isMyTurn
            ? (lang === 'si'
              ? 'කොළ මිටිය ස්වයිප් කරන්න, නැත්නම් “කොළ අනන්න” ඔබන්න. කැමති වාර ගණනක් අනලා බෙදන්න.'
              : 'Swipe the deck or press Shuffle. Shuffle as many times as you like, then deal.')
            : (lang === 'si'
              ? 'අනන වාරය ඔබට ආවම ඔබටත් කොළ අනන්න පුළුවන්.'
              : 'When you become the dealer, you get to shuffle too.')}
        </p>

        <div className="relative my-5 flex h-40 w-full items-center justify-center sm:h-44">
          <div aria-hidden="true" className="pointer-events-none absolute bottom-2 h-8 w-56 rounded-[100%] bg-black/60 blur-xl" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`riffle-${roundNumber}-${count}`}
              className="pointer-events-none absolute flex items-center justify-center"
              initial={reducedMotion ? false : { scale: 0.92, opacity: 0.3 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
              transition={{ duration: reducedMotion ? 0 : 0.25 }}
            >
              <motion.div
                initial={reducedMotion ? false : { x: -9, rotate: -4 }}
                animate={{ x: reducedMotion ? 0 : [0, -42, -5, 0], rotate: reducedMotion ? 0 : [-3, -14, 6, 0] }}
                transition={{ duration: reducedMotion ? 0 : 0.7, ease: 'easeInOut' }}
                className="relative z-10 origin-bottom-right"
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} aria-hidden="true" className="absolute"
                    style={{ left: -16 - i * 3, top: -50 - i * 2, transform: `rotate(${-i * 3}deg)` }}>
                    <CardComponent isFaceDown size="lg" />
                  </span>
                ))}
              </motion.div>
              <motion.div
                initial={reducedMotion ? false : { x: 9, rotate: 4 }}
                animate={{ x: reducedMotion ? 0 : [0, 42, 5, 0], rotate: reducedMotion ? 0 : [3, 14, -6, 0] }}
                transition={{ duration: reducedMotion ? 0 : 0.7, ease: 'easeInOut' }}
                className="relative z-20 origin-bottom-left"
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} aria-hidden="true" className="absolute"
                    style={{ left: -12 + i * 3, top: -50 - i * 2, transform: `rotate(${i * 3}deg)` }}>
                    <CardComponent isFaceDown size="lg" />
                  </span>
                ))}
              </motion.div>
            </motion.div>
          </AnimatePresence>
          {isMyTurn && (
            <button
              type="button"
              disabled={!canShuffle}
              onPointerDown={event => {
                if (canShuffle) pointerStart.current = event.clientX;
              }}
              onPointerUp={event => {
                const delta = pointerStart.current === null ? 0 : Math.abs(event.clientX - pointerStart.current);
                pointerStart.current = null;
                if (delta > 35) {
                  swallowNextClick.current = true;
                  shuffle();
                }
              }}
              onPointerCancel={() => { pointerStart.current = null; }}
              onClick={() => {
                if (swallowNextClick.current) {
                  swallowNextClick.current = false;
                  return;
                }
                shuffle();
              }}
              aria-label={lang === 'si' ? 'කොළ මිටිය අනන්න' : 'Shuffle the deck'}
              className="absolute z-30 h-36 w-56 cursor-grab rounded-2xl border border-transparent bg-transparent outline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-300 active:cursor-grabbing disabled:cursor-wait touch-none"
            />
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {suits.map((suit, i) => (
            <span key={i} className={i === 1 || i === 2 ? 'text-lg text-rose-400' : 'text-lg text-amber-300'}>{suit}</span>
          ))}
          <span className="rounded-full border border-amber-400/40 bg-black/30 px-3 py-1 text-sm font-bold tabular-nums text-amber-200">
            {lang === 'si' ? `අනපු වාර: ${count}` : `Shuffles: ${count}`}
          </span>
        </div>

        {isMyTurn ? (
          <div className="mt-5 grid w-full grid-cols-2 gap-3">
            <button type="button" onClick={shuffle} disabled={!canShuffle}
              className="min-h-12 rounded-xl border border-amber-300/55 bg-emerald-800 px-3 py-3 text-sm font-black text-amber-100 transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-45">
              {lang === 'si' ? '🃏 කොළ අනන්න' : '🃏 Shuffle'}
            </button>
            <button type="button" onClick={deal} disabled={!canDeal}
              className="min-h-12 rounded-xl bg-amber-400 px-3 py-3 text-sm font-black text-emerald-950 shadow-lg transition-colors hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-40">
              {lang === 'si' ? 'කොළ බෙදන්න →' : 'Deal cards →'}
            </button>
          </div>
        ) : (
          <div role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-amber-300/25 bg-black/20 px-4 py-3 text-xs text-emerald-100/85">
            <span className="h-3 w-3 animate-pulse rounded-full bg-amber-300" />
            {lang === 'si' ? 'කොළ බෙදන තුරු රැඳී සිටින්න...' : 'Waiting for the dealer...'}
          </div>
        )}
      </div>
    </div>
  );
};
