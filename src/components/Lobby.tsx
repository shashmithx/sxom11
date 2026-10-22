import React, { useState } from 'react';
import { BotDifficulty, TeamMode } from '../game/types';
import { translations } from '../utils/i18n';
import { Users, Bot, Copy, Check, Play, Globe } from 'lucide-react';

interface LobbyProps {
  isHost: boolean;
  roomCode: string;
  playerName: string;
  setPlayerName: (name: string) => void;
  teamMode: TeamMode;
  setTeamMode: (mode: TeamMode) => void;
  botDifficulty: BotDifficulty;
  setBotDifficulty: (diff: BotDifficulty) => void;
  peerStatus: string;
  hasPeerJoined: boolean;
  peerName?: string;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onStartGame: () => void;
  onSoloTestStart: () => void;
  onOpenManualSDP: () => void;
  lang: 'en' | 'si';
}

export const Lobby: React.FC<LobbyProps> = ({
  isHost,
  roomCode,
  playerName,
  setPlayerName,
  teamMode,
  setTeamMode,
  botDifficulty,
  setBotDifficulty,
  peerStatus,
  hasPeerJoined,
  peerName,
  onCreateRoom,
  onJoinRoom,
  onStartGame,
  onSoloTestStart,
  onOpenManualSDP,
  lang,
}) => {
  const t = translations[lang];
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (!roomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 p-4 sm:p-6 text-white select-none">
      {/* Brand Header */}
      <div className="text-center">
        <h1 className="text-3xl sm:text-5xl font-black font-serif tracking-wider text-transparent bg-clip-text bg-linear-to-r from-amber-200 via-amber-400 to-amber-200 drop-shadow">
          SHANEX OMI
        </h1>
        <p className="text-xs sm:text-sm text-amber-300/80 mt-1 font-medium">
          {t.appSubtitle}
        </p>
      </div>

      {/* Main Lobby Card */}
      <div className="bg-zinc-950/90 border border-amber-500/30 rounded-3xl p-4 sm:p-8 shadow-2xl backdrop-blur-md">
        {/* Name input */}
        <div className="mb-6 max-w-md mx-auto">
          <label className="block text-xs sm:text-sm font-semibold text-zinc-300 mb-1.5">
            {t.playerName}
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder={t.enterName}
            maxLength={18}
            className="w-full bg-zinc-900 border border-amber-500/40 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          />
        </div>

        {/* Create / Join Tabs if no room is created yet */}
        {!roomCode ? (
          <div>
            <div className="flex border-b border-zinc-800 mb-6 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setTab('create')}
                className={`flex-1 pb-3 text-center font-bold text-sm sm:text-base cursor-pointer transition-colors ${
                  tab === 'create'
                    ? 'text-amber-400 border-b-2 border-amber-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t.createRoom}
              </button>
              <button
                type="button"
                onClick={() => setTab('join')}
                className={`flex-1 pb-3 text-center font-bold text-sm sm:text-base cursor-pointer transition-colors ${
                  tab === 'join'
                    ? 'text-amber-400 border-b-2 border-amber-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t.joinRoom}
              </button>
            </div>

            {tab === 'create' ? (
              <div className="flex flex-col gap-6">
                {/* Mode Selector */}
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-amber-300 mb-3 text-center sm:text-left">
                    {t.teamMode}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* MODE A */}
                    <div
                      onClick={() => setTeamMode('same_team')}
                      className={`cursor-pointer rounded-2xl p-4 border-2 transition-all ${
                        teamMode === 'same_team'
                          ? 'border-amber-400 bg-emerald-950/40 shadow-lg shadow-amber-500/10'
                          : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm sm:text-base text-amber-200">
                          {t.modeSameTeam}
                        </span>
                        <Users className="w-5 h-5 text-amber-400" />
                      </div>
                      <p className="text-xs text-zinc-400 mb-3">{t.modeSameTeamDesc}</p>

                      {/* Mini Table Preview */}
                      <div className="relative w-full h-24 rounded-xl bg-emerald-950 border border-amber-500/20 flex items-center justify-center p-2 text-[9px] font-bold">
                        <span className="absolute top-1 text-blue-400">P2 (Human)</span>
                        <span className="absolute bottom-1 text-blue-400">P1 (You)</span>
                        <span className="absolute left-2 text-rose-400">Bot 2</span>
                        <span className="absolute right-2 text-rose-400">Bot 1</span>
                        <span className="text-[10px] text-amber-300 font-serif">TEAM 1 vs 2</span>
                      </div>
                    </div>

                    {/* MODE B */}
                    <div
                      onClick={() => setTeamMode('opposite_teams')}
                      className={`cursor-pointer rounded-2xl p-4 border-2 transition-all ${
                        teamMode === 'opposite_teams'
                          ? 'border-amber-400 bg-emerald-950/40 shadow-lg shadow-amber-500/10'
                          : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm sm:text-base text-amber-200">
                          {t.modeOppositeTeams}
                        </span>
                        <Bot className="w-5 h-5 text-amber-400" />
                      </div>
                      <p className="text-xs text-zinc-400 mb-3">{t.modeOppositeTeamsDesc}</p>

                      {/* Mini Table Preview */}
                      <div className="relative w-full h-24 rounded-xl bg-emerald-950 border border-amber-500/20 flex items-center justify-center p-2 text-[9px] font-bold">
                        <span className="absolute top-1 text-blue-400">Bot 1 (Partner)</span>
                        <span className="absolute bottom-1 text-blue-400">P1 (You)</span>
                        <span className="absolute left-2 text-rose-400">Bot 2</span>
                        <span className="absolute right-2 text-rose-400">P2 (Human)</span>
                        <span className="text-[10px] text-amber-300 font-serif">RIVALS</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bot Difficulty Selector */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800">
                  <span className="text-xs sm:text-sm font-semibold text-zinc-300">
                    {t.botDifficulty}:
                  </span>
                  <div className="flex gap-2">
                    {(['easy', 'normal', 'hard'] as BotDifficulty[]).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setBotDifficulty(diff)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          botDifficulty === diff
                            ? 'bg-amber-400 text-zinc-950 shadow-md'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {t[diff]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onCreateRoom}
                    className="flex-1 cursor-pointer bg-linear-to-r from-amber-500 via-amber-400 to-amber-500 text-zinc-950 font-black py-3 px-6 rounded-2xl shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    {t.createRoom}
                  </button>

                  <button
                    type="button"
                    onClick={onSoloTestStart}
                    className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold py-3 px-5 rounded-2xl transition-all text-xs sm:text-sm flex items-center justify-center gap-2 border border-zinc-700"
                  >
                    <Bot className="w-4 h-4" />
                    {lang === 'si' ? 'තනිව පුහුණු වන්න (Solo vs Bots)' : 'Practice Solo (vs 3 Bots)'}
                  </button>
                </div>
              </div>
            ) : (
              /* Join Room Form */
              <div className="max-w-md mx-auto flex flex-col gap-4 py-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-zinc-300 mb-1.5">
                    {t.roomCode}
                  </label>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder={t.enterRoomCode}
                    className="w-full bg-zinc-900 border border-amber-500/40 rounded-xl px-4 py-3 text-white font-mono text-center tracking-widest text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <button
                  type="button"
                  disabled={!inputCode.trim()}
                  onClick={() => onJoinRoom(inputCode.trim())}
                  className="cursor-pointer bg-linear-to-r from-amber-500 to-amber-400 text-zinc-950 font-black py-3 px-6 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.joinRoom}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ACTIVE ROOM SCREEN (Waiting / Connected) */
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="text-center">
              <span className="text-xs uppercase font-bold text-amber-400 tracking-widest">
                {t.roomCode}
              </span>
              <div className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-white mt-1">
                {roomCode}
              </div>
            </div>

            {/* Share link button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="cursor-pointer flex items-center gap-2 bg-emerald-950/80 hover:bg-emerald-900 border border-amber-400/50 text-amber-300 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-lg transition-transform hover:scale-105"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? t.linkCopied : t.shareLink}
            </button>

            {/* Mode Preview */}
            <div className="w-full max-w-md bg-zinc-900/80 rounded-2xl p-3 border border-zinc-800 text-center text-xs text-zinc-300">
              <span className="font-bold text-amber-300">
                {teamMode === 'same_team' ? t.modeSameTeam : t.modeOppositeTeams}
              </span>
              <div className="text-zinc-400 mt-0.5 text-[11px]">
                {teamMode === 'same_team' ? t.modeSameTeamDesc : t.modeOppositeTeamsDesc}
              </div>
            </div>

            {/* Peer Connection Status */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-amber-400/30">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    hasPeerJoined ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                  }`}
                />
                <span className="text-xs sm:text-sm font-semibold text-zinc-200">
                  {hasPeerJoined
                    ? `${t.player2Connected} (${peerName || 'Player 2'})`
                    : t.waitingForPlayer2}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">{peerStatus}</span>
            </div>

            {/* Start Game Action */}
            <div className="w-full max-w-sm flex flex-col gap-2">
              {isHost && (
                <button
                  type="button"
                  onClick={onStartGame}
                  className="cursor-pointer w-full bg-linear-to-r from-amber-500 via-amber-400 to-amber-500 text-zinc-950 font-black py-3.5 px-8 rounded-2xl shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-98 transition-all text-base"
                >
                  {t.startGame}
                </button>
              )}

              {/* Manual WebRTC fallback button */}
              <button
                type="button"
                onClick={onOpenManualSDP}
                className="text-[11px] text-zinc-400 hover:text-amber-300 underline text-center cursor-pointer pt-1"
              >
                {t.manualWebRTC} (SDP Pair Fallback)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 px-2">
        <span className="flex items-center gap-1">
          <Globe className="w-3.5 h-3.5 text-amber-400" />
          WebRTC P2P Multiplayer · Shanex PrintHub Sri Lanka
        </span>
        <span className="font-serif text-amber-400/80">AUTHENTIC SRI LANKAN OMI</span>
      </div>
    </div>
  );
};
