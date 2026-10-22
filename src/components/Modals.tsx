import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CardComponent } from './CardComponent';
import { RoundSummary, ScoreState, Trick } from '../game/types';
import { translations } from '../utils/i18n';
import { X, HelpCircle, History, Copy, Check, Trophy, Frown, Scale } from 'lucide-react';

interface LastTrickModalProps {
  isOpen: boolean;
  onClose: () => void;
  trick: Trick | null;
  playerNames: Record<number, string>;
  lang: 'en' | 'si';
}

export const LastTrickModal: React.FC<LastTrickModalProps> = ({
  isOpen,
  onClose,
  trick,
  playerNames,
  lang,
}) => {
  if (!isOpen) return null;
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-amber-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer absolute top-4 right-4 text-zinc-400 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg sm:text-xl font-black text-amber-300 font-serif mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" />
          {t.lastTrick}
        </h3>

        {!trick || trick.cards.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-6">{t.noLastTrick}</p>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-4">
              {trick.cards.map((pc, idx) => {
                const isWinner = pc.playerId === trick.winnerPlayerId;
                return (
                  <div key={idx} className="flex flex-col items-center">
                    <div className={isWinner ? 'ring-4 ring-amber-400 rounded-lg scale-105' : ''}>
                      <CardComponent card={pc.card} size="md" />
                    </div>
                    <span className="text-xs font-semibold text-zinc-200 mt-1">
                      {playerNames[pc.playerId] || `Player ${pc.playerId + 1}`}
                    </span>
                    {isWinner && (
                      <span className="text-[10px] bg-amber-400 text-zinc-950 font-bold px-1.5 py-0.2 rounded-full mt-0.5">
                        WINNER
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-zinc-400 mt-2">
              Lead Suit: <strong className="uppercase text-amber-300">{trick.leadSuit}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'si';
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative text-zinc-200">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer absolute top-4 right-4 text-zinc-400 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl sm:text-2xl font-black text-amber-300 font-serif mb-4 flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-amber-400" />
          {t.howToPlay}
        </h3>

        <div className="text-xs sm:text-sm leading-relaxed space-y-3 whitespace-pre-line font-normal text-zinc-300">
          {t.howToPlayContent}
        </div>
      </div>
    </div>
  );
};

interface ManualSDPModalProps {
  isOpen: boolean;
  onClose: () => void;
  localSDP: string;
  onApplyRemoteSDP: (sdp: string) => void;
  lang: 'en' | 'si';
}

export const ManualSDPModal: React.FC<ManualSDPModalProps> = ({
  isOpen,
  onClose,
  localSDP,
  onApplyRemoteSDP,
  lang,
}) => {
  const [remoteSDP, setRemoteSDP] = useState('');
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-amber-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative text-zinc-200">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer absolute top-4 right-4 text-zinc-400 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg sm:text-xl font-black text-amber-300 font-serif mb-2">
          {t.manualWebRTC}
        </h3>
        <p className="text-xs text-zinc-400 mb-4">{t.manualPrompt}</p>

        {/* Copy Local Offer / Answer */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            1. Your SDP (Share with peer):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={localSDP || 'Generating SDP...'}
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-zinc-400 truncate"
            />
            <button
              type="button"
              onClick={() => {
                if (navigator?.clipboard?.writeText) {
                  navigator.clipboard.writeText(localSDP).catch(() => {});
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="cursor-pointer bg-amber-400 hover:bg-amber-300 text-zinc-950 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Paste Remote Offer / Answer */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            2. Paste Peer's SDP:
          </label>
          <textarea
            rows={3}
            value={remoteSDP}
            onChange={(e) => setRemoteSDP(e.target.value)}
            placeholder='Paste JSON {"type":"answer", ...}'
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <button
          type="button"
          disabled={!remoteSDP.trim()}
          onClick={() => {
            onApplyRemoteSDP(remoteSDP.trim());
            onClose();
          }}
          className="w-full bg-linear-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-50"
        >
          {t.apply}
        </button>
      </div>
    </div>
  );
};

interface RoundResultModalProps {
  summary: RoundSummary;
  score: ScoreState;
  myTeam: 1 | 2;
  lang: 'en' | 'si';
  onClose: () => void;
}

/** A readable, short intermission between hands, on BOTH player devices. */
export const RoundResultModal: React.FC<RoundResultModalProps> = ({
  summary, score, myTeam, lang, onClose,
}) => {
  const t = translations[lang];
  const reducedMotion = useReducedMotion() === true;
  const isDraw = summary.winnerTeam === 0;
  const won = summary.winnerTeam === myTeam;
  const title = isDraw ? t.roundDraw : won ? t.roundWon : t.roundLost;
  const Icon = isDraw ? Scale : won ? Trophy : Frown;
  const accent = isDraw ? 'text-blue-300' : won ? 'text-amber-300' : 'text-rose-300';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#050e0b]/90 px-3 py-5 backdrop-blur-md"
      role="dialog" aria-modal="true" aria-labelledby="omi-round-result-heading">
      <motion.div
        key={`round-result-${summary.handNumber}`}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.86, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.35, type: 'spring', bounce: 0.2 }}
        className="my-auto w-full max-w-md overflow-hidden rounded-[28px] border border-amber-400/55 bg-gradient-to-b from-[#164735] via-[#0d2c24] to-[#091d19] px-5 py-6 text-center text-white shadow-[0_25px_85px_rgba(0,0,0,0.75)] sm:p-8"
      >
        <div className="mb-2 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-100/80">
          {t.roundOver} · {summary.handNumber}
        </div>
        <div className={`mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full border-2 border-current bg-black/20 ${accent}`}>
          <Icon className="h-9 w-9" aria-hidden="true" />
        </div>
        <h2 id="omi-round-result-heading" className={`mt-4 text-2xl font-black leading-relaxed sm:text-3xl ${accent}`}>
          {title}
        </h2>
        {summary.isKapothi && (
          <span className="mt-2 inline-flex rounded-full bg-amber-400 px-4 py-1 text-xs font-black text-emerald-950">
            {lang === 'si' ? 'කපෝති! අත් 8ම එකම පිලට' : 'KAPOTHI! All 8 tricks'}
          </span>
        )}
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-white/15 bg-black/25 p-3">
          <div className={`rounded-xl px-2 py-2 ${myTeam === 1 ? 'bg-blue-600/25 ring-1 ring-blue-400/50' : ''}`}>
            <span className="block text-xs font-bold text-blue-200">{t.team} 1 {myTeam === 1 ? '• ' + t.youBadge : ''}</span>
            <span className="text-3xl font-black tabular-nums text-white">{summary.team1Tricks}</span>
            <span className="block text-[10px] text-emerald-100/65">{t.tricks}</span>
            <span className="mt-1 block text-xs font-bold text-amber-200">{score.team1Tokens} {t.tokens}</span>
          </div>
          <span className="text-sm font-black text-amber-200/80">VS</span>
          <div className={`rounded-xl px-2 py-2 ${myTeam === 2 ? 'bg-rose-600/25 ring-1 ring-rose-400/50' : ''}`}>
            <span className="block text-xs font-bold text-rose-200">{t.team} 2 {myTeam === 2 ? '• ' + t.youBadge : ''}</span>
            <span className="text-3xl font-black tabular-nums text-white">{summary.team2Tricks}</span>
            <span className="block text-[10px] text-emerald-100/65">{t.tricks}</span>
            <span className="mt-1 block text-xs font-bold text-amber-200">{score.team2Tokens} {t.tokens}</span>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-300/10 px-4 py-3">
          <div className="text-sm font-bold text-amber-100">
            {isDraw ? t.roundCarry : t.roundAward}
          </div>
          <div className="mt-1 text-2xl font-black tabular-nums text-amber-300">
            {isDraw ? score.carriedTokens : `+${summary.tokensAwarded}`}
          </div>
        </div>
        <p className="mt-4 text-xs text-emerald-100/70">{t.roundNextSoon}</p>
        <button type="button" onClick={onClose}
          className="mt-3 min-h-12 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-emerald-950 shadow-lg transition-colors hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">
          {t.roundContinue}
        </button>
      </motion.div>
    </div>
  );
};

interface VictoryModalProps {
  winnerTeam: 1 | 2;
  myTeam: 1 | 2;
  team1Tokens: number;
  team2Tokens: number;
  onRematch: () => void;
  lang: 'en' | 'si';
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  winnerTeam, myTeam, team1Tokens, team2Tokens, onRematch, lang,
}) => {
  const t = translations[lang];
  const reducedMotion = useReducedMotion() === true;
  const didWin = winnerTeam === myTeam;
  const Icon = didWin ? Trophy : Frown;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-[#050e0b]/90 px-3 py-5 backdrop-blur-md"
      role="dialog" aria-modal="true" aria-labelledby="omi-match-result-heading">
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.85, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.4, type: 'spring', bounce: 0.2 }}
        className="my-auto w-full max-w-md rounded-[30px] border-2 border-amber-400 bg-gradient-to-b from-[#164735] to-[#081e17] px-5 py-8 text-center shadow-[0_24px_85px_rgba(0,0,0,0.75)] sm:p-8">
        <Icon className={`mx-auto mb-4 h-16 w-16 ${didWin ? 'text-amber-300' : 'text-rose-300'}`} aria-hidden="true" />
        <h2 id="omi-match-result-heading" className={`text-2xl font-black leading-relaxed sm:text-3xl ${didWin ? 'text-amber-300' : 'text-rose-300'}`}>
          {didWin ? t.matchWon : t.matchLost}
        </h2>
        <p className="mt-2 text-sm font-semibold text-white/85">
          {winnerTeam === 1 ? t.team1Wins : t.team2Wins}
        </p>
        <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-white/15 bg-black/30 px-3 py-4">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-bold text-blue-300">{t.team} 1 {myTeam === 1 ? '• ' + t.youBadge : ''}</span>
            <span className="text-4xl font-black tabular-nums text-amber-100">{team1Tokens}</span>
          </div>
          <span className="text-xl font-bold text-white/50">:</span>
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-bold text-rose-300">{t.team} 2 {myTeam === 2 ? '• ' + t.youBadge : ''}</span>
            <span className="text-4xl font-black tabular-nums text-amber-100">{team2Tokens}</span>
          </div>
        </div>
        <button type="button" onClick={onRematch}
          className="min-h-12 w-full rounded-2xl bg-amber-400 px-6 py-3.5 text-sm font-black text-emerald-950 shadow-xl transition-colors hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">
          {t.rematch}
        </button>
      </motion.div>
    </div>
  );
};
