import React, { useState } from 'react';
import { CardComponent } from './CardComponent';
import { Trick } from '../game/types';
import { translations } from '../utils/i18n';
import { X, Award, HelpCircle, History, Copy, Check } from 'lucide-react';

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

interface VictoryModalProps {
  winnerTeam: 1 | 2;
  team1Tokens: number;
  team2Tokens: number;
  onRematch: () => void;
  lang: 'en' | 'si';
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  winnerTeam,
  team1Tokens,
  team2Tokens,
  onRematch,
  lang,
}) => {
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-linear-to-b from-zinc-900 to-zinc-950 border-2 border-amber-400 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center animate-in zoom-in-95">
        <Award className="w-16 h-16 text-amber-400 mx-auto mb-3 animate-bounce" />
        <h2 className="text-2xl sm:text-3xl font-black text-amber-300 font-serif">
          {t.matchWinner}
        </h2>
        <p className="text-base sm:text-lg font-bold text-white mt-2">
          {winnerTeam === 1 ? t.team1Wins : t.team2Wins}
        </p>

        <div className="flex justify-center gap-6 my-6">
          <div className="flex flex-col items-center">
            <span className="text-xs text-blue-400 font-bold">Team 1</span>
            <span className="text-3xl font-mono font-black text-amber-200">{team1Tokens}</span>
          </div>
          <div className="text-2xl text-zinc-600 font-light flex items-center">-</div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-rose-400 font-bold">Team 2</span>
            <span className="text-3xl font-mono font-black text-amber-200">{team2Tokens}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onRematch}
          className="cursor-pointer w-full bg-linear-to-r from-amber-500 via-amber-400 to-amber-500 text-zinc-950 font-black py-3.5 px-6 rounded-2xl shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-98 transition-all text-base"
        >
          {t.rematch}
        </button>
      </div>
    </div>
  );
};
