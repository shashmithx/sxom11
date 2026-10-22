import React from 'react';
import { Card, Suit } from '../game/types';

interface CardProps {
  card?: Card;
  isFaceDown?: boolean;
  isPlayable?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_TEXT_COLOR: Record<Suit, string> = {
  spades: 'text-slate-950',
  clubs: 'text-slate-950',
  hearts: 'text-rose-600',
  diamonds: 'text-rose-600',
};

const SIZE_CLASSES = {
  sm: 'w-8 h-12 sm:w-10 sm:h-[58px] rounded-md',
  md: 'w-[52px] h-[76px] sm:w-[64px] sm:h-[92px] md:w-[70px] md:h-[100px] rounded-lg',
  lg: 'w-[64px] h-[94px] sm:w-[78px] sm:h-[112px] rounded-xl',
} as const;

/**
 * Standard, readable playing card: two rank/suit indexes with a large center pip.
 * Avoid unnecessary labels/art that crowd small phone-size cards.
 */
export const CardComponent: React.FC<CardProps> = ({
  card,
  isFaceDown = false,
  isPlayable = false,
  onClick,
  className = '',
  size = 'md',
}) => {
  const dimensions = SIZE_CLASSES[size];

  if (isFaceDown || !card) {
    return (
      <div
        aria-label="Face-down playing card"
        className={`relative shrink-0 select-none overflow-hidden border border-amber-200/60
          bg-[repeating-linear-gradient(45deg,#104c3d_0px,#104c3d_5px,#0c342b_5px,#0c342b_10px)]
          shadow-[0_3px_10px_rgba(0,0,0,0.35)] ${dimensions} ${className}`}
      >
        <div className="absolute inset-[3px] rounded-[inherit] border border-amber-200/70 bg-emerald-950/35 flex items-center justify-center">
          <div className="w-[75%] h-[72%] rotate-45 border border-amber-300/55 flex items-center justify-center">
            <span className="-rotate-45 text-amber-100/90 text-[10px] sm:text-xs font-black tracking-tight">S</span>
          </div>
        </div>
      </div>
    );
  }

  const symbol = SUIT_SYMBOL[card.suit];
  const color = SUIT_TEXT_COLOR[card.suit];
  const interactive = typeof onClick === 'function';
  const blocked = interactive && !isPlayable;

  return (
    <button
      type="button"
      disabled={blocked}
      onClick={isPlayable ? onClick : undefined}
      aria-label={`${card.rank} of ${card.suit}${blocked ? ', not playable' : ''}`}
      aria-disabled={blocked}
      className={`group relative shrink-0 select-none overflow-hidden border border-stone-300
        bg-gradient-to-br from-white via-[#fffdf8] to-[#f6f0e6]
        shadow-[0_2px_5px_rgba(0,0,0,0.25),0_8px_18px_rgba(0,0,0,0.12)]
        transition-transform duration-150 ease-out touch-manipulation
        ${dimensions}
        ${isPlayable
          ? 'cursor-pointer ring-2 ring-amber-400/70 border-amber-300 hover:-translate-y-3 hover:ring-amber-300 focus-visible:-translate-y-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 active:-translate-y-1'
          : interactive ? 'cursor-not-allowed' : 'cursor-default'}
        ${className}`}
    >
      <span className={`absolute left-[3px] top-[3px] sm:left-[5px] sm:top-[5px] flex flex-col items-center leading-none ${color}`}>
        <span className="font-extrabold text-[15px] sm:text-[19px] tracking-[-0.06em]">{card.rank}</span>
        <span className="text-[12px] sm:text-[14px] leading-none" aria-hidden="true">{symbol}</span>
      </span>

      <span className={`absolute inset-0 flex items-center justify-center pointer-events-none ${color}`}>
        <span className="text-[27px] sm:text-[36px] md:text-[42px] leading-none drop-shadow-sm" aria-hidden="true">
          {symbol}
        </span>
      </span>

      <span className={`absolute bottom-[3px] right-[3px] sm:bottom-[5px] sm:right-[5px] rotate-180 flex flex-col items-center leading-none ${color}`}>
        <span className="font-extrabold text-[15px] sm:text-[19px] tracking-[-0.06em]">{card.rank}</span>
        <span className="text-[12px] sm:text-[14px] leading-none" aria-hidden="true">{symbol}</span>
      </span>

      {isPlayable && <span className="absolute inset-x-1 bottom-0 h-1 rounded-full bg-amber-400/90" />}
    </button>
  );
};
