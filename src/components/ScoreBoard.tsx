import React from 'react';
import { ScoreState, Suit } from '../game/types';
import { translations } from '../utils/i18n';

interface ScoreBoardProps {
  score: ScoreState;
  trumpSuit: Suit | null;
  roundNumber: number;
  lang: 'en' | 'si';
}

const SUIT_ICONS: Record<Suit, { symbol: string; color: string; nameEn: string; nameSi: string }> = {
  spades: { symbol: '♠', color: 'text-zinc-100', nameEn: 'Spades', nameSi: 'ඉස්පික' },
  hearts: { symbol: '♥', color: 'text-rose-500', nameEn: 'Hearts', nameSi: 'හර්ත' },
  diamonds: { symbol: '♦', color: 'text-rose-500', nameEn: 'Diamonds', nameSi: 'රූබ' },
  clubs: { symbol: '♣', color: 'text-zinc-100', nameEn: 'Clubs', nameSi: 'කලාවර' },
};

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ score, trumpSuit, roundNumber, lang }) => {
  const t = translations[lang];

  return (
    <div className="flex items-center justify-between gap-2 bg-zinc-950/80 backdrop-blur-md border border-amber-500/30 rounded-2xl p-2 sm:p-3 px-3 sm:px-4 shadow-xl text-white select-none max-w-4xl mx-auto w-full">
      {/* Team 1 Tokens (Blue/Gold) */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-linear-to-br from-blue-700 to-indigo-900 border-2 border-amber-400 flex items-center justify-center font-bold text-sm sm:text-base text-amber-200 shadow-md">
          {score.team1Tokens}
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] sm:text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse" />
            Team 1
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] sm:text-xs text-zinc-400">
              {t.tricks}: <strong className="text-amber-300 font-mono text-sm">{score.team1RoundTricks}</strong>/8
            </span>
          </div>
        </div>
      </div>

      {/* Center: Trump Suit & Round Info */}
      <div className="flex flex-col items-center justify-center px-2">
        {trumpSuit ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-amber-400/60 shadow-lg shadow-amber-500/10">
            <span className={`text-lg sm:text-xl font-black ${SUIT_ICONS[trumpSuit].color}`}>
              {SUIT_ICONS[trumpSuit].symbol}
            </span>
            <span className="text-xs sm:text-sm font-bold text-amber-300 font-serif">
              {lang === 'si' ? SUIT_ICONS[trumpSuit].nameSi : SUIT_ICONS[trumpSuit].nameEn}
            </span>
          </div>
        ) : (
          <div className="text-[11px] sm:text-xs text-amber-400/80 font-medium italic animate-pulse">
            {lang === 'si' ? 'තුරුම්පු තෝරමින්...' : 'Choosing Trump...'}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
          <span>
            {lang === 'si' ? `වටය ${roundNumber}` : `Round ${roundNumber}`}
          </span>
          {score.carriedTokens > 0 && (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded-full font-semibold">
              +{score.carriedTokens} {t.carried}
            </span>
          )}
          <span className="text-zinc-500 font-mono">10 to win</span>
        </div>
      </div>

      {/* Team 2 Tokens (Red/Gold) */}
      <div className="flex items-center gap-2 text-right">
        <div className="flex flex-col items-end">
          <span className="text-[11px] sm:text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1">
            Team 2
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block animate-pulse" />
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] sm:text-xs text-zinc-400">
              {t.tricks}: <strong className="text-amber-300 font-mono text-sm">{score.team2RoundTricks}</strong>/8
            </span>
          </div>
        </div>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-linear-to-br from-rose-700 to-red-950 border-2 border-amber-400 flex items-center justify-center font-bold text-sm sm:text-base text-amber-200 shadow-md">
          {score.team2Tokens}
        </div>
      </div>
    </div>
  );
};
