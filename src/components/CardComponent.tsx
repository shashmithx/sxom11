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

const SUIT_ICONS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_COLORS: Record<Suit, string> = {
  spades: 'text-zinc-900',
  hearts: 'text-rose-600',
  diamonds: 'text-rose-600',
  clubs: 'text-zinc-900',
};

export const CardComponent: React.FC<CardProps> = ({
  card,
  isFaceDown = false,
  isPlayable = false,
  onClick,
  className = '',
  size = 'md',
}) => {
  // Sizing tokens tailored for mobile portrait & desktop
  const sizeClasses = {
    sm: 'w-7 h-10 sm:w-10 sm:h-14 text-[9px] sm:text-xs rounded-md',
    md: 'w-10 h-16 sm:w-14 sm:h-20 md:w-16 md:h-24 text-xs sm:text-sm md:text-base rounded-lg',
    lg: 'w-14 h-20 sm:w-18 sm:h-26 md:w-20 md:h-28 text-sm sm:text-base md:text-lg rounded-xl',
  }[size];

  if (isFaceDown || !card) {
    return (
      <div
        className={`relative select-none border border-amber-500/40 bg-linear-to-br from-emerald-950 via-emerald-900 to-zinc-950 shadow-md overflow-hidden flex items-center justify-center ${sizeClasses} ${className}`}
      >
        {/* SHANEX luxury patterned card back */}
        <div className="absolute inset-1 rounded-sm border border-amber-400/30 bg-emerald-900/60 flex items-center justify-center p-0.5">
          <div className="w-full h-full border border-dashed border-amber-400/20 flex flex-col items-center justify-center text-center">
            <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-amber-300/80 font-serif">
              SHANEX
            </span>
            <span className="text-[7px] font-semibold text-amber-400/60 uppercase tracking-widest">
              OMI
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const colorClass = isRed ? 'text-rose-600' : 'text-slate-900';
  const suitIcon = SUIT_ICONS[card.suit];

  return (
    <button
      type="button"
      disabled={!isPlayable && !!onClick}
      onClick={isPlayable ? onClick : undefined}
      aria-label={`${card.rank} of ${card.suit}`}
      className={`relative select-none bg-linear-to-b from-white via-amber-50/30 to-amber-100/60 border shadow-md transition-all duration-150 flex flex-col justify-between p-1 sm:p-1.5 ${sizeClasses} ${
        isPlayable
          ? 'cursor-pointer hover:-translate-y-2 hover:shadow-xl hover:shadow-amber-400/30 ring-2 ring-amber-400 border-amber-400 scale-105 active:scale-95'
          : 'border-slate-300 opacity-90'
      } ${className}`}
    >
      {/* Top Left Rank & Suit */}
      <div className={`flex flex-col items-center leading-none ${colorClass}`}>
        <span className="font-extrabold text-sm sm:text-base tracking-tight">{card.rank}</span>
        <span className="text-sm sm:text-base font-black">{suitIcon}</span>
      </div>

      {/* Center Art */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`text-2xl sm:text-3xl font-black ${colorClass} opacity-80`}>
          {suitIcon}
        </span>
        {['J', 'Q', 'K', 'A'].includes(card.rank) && (
          <span className="text-[10px] sm:text-[11px] font-serif font-black text-amber-700 tracking-wider mt-0.5">
            {card.rank === 'A' ? 'ACE' : card.rank === 'K' ? 'KING' : card.rank === 'Q' ? 'QUEEN' : 'JACK'}
          </span>
        )}
      </div>

      {/* Bottom Right Inverted Rank & Suit */}
      <div className={`flex flex-col items-center leading-none rotate-180 self-end ${colorClass}`}>
        <span className="font-extrabold text-sm sm:text-base tracking-tight">{card.rank}</span>
        <span className="text-sm sm:text-base font-black">{suitIcon}</span>
      </div>
    </button>
  );
};
