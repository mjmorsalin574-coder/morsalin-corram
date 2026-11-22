import {
  Award,
  BookOpen,
  Check,
  Compass,
  Crown,
  Flower2,
  Home,
  Play,
  RotateCcw,
  Shield,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import {
  ACHIEVEMENTS,
  AVATAR_OPTIONS,
  BOARD_THEMES,
  COIN_STYLES,
  STRIKER_STYLES,
} from '../data/themes';
import type {
  AIDifficulty,
  AimGuideMode,
  BoardTheme,
  CoinStyle,
  GameSettings,
  GraphicsQuality,
  MatchFormat,
  MatchRecord,
  PlayerProfile,
  PlayerSide,
  PlayerStats,
  RoundSummary,
  StrikerStyle,
} from '../types/game';

function AvatarIcon({ id, className }: { id: string; className?: string }) {
  switch (id) {
    case 'lotus':
      return <Flower2 className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'star':
      return <Star className={className} />;
    default:
      return <Crown className={className} />;
  }
}

function StrikerPreviewSvg({ style }: { style: StrikerStyle }) {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14 shrink-0" aria-hidden="true">
      <circle cx="32" cy="34" r="24" fill="rgba(0,0,0,0.4)" />
      <circle
        cx="32"
        cy="32"
        r="24"
        fill={style.bodyColor}
        stroke={style.rimColor}
        strokeWidth="4"
      />
      {style.pattern === 'rings' && (
        <circle
          cx="32"
          cy="32"
          r="15"
          fill="none"
          stroke={style.accentColor}
          strokeWidth="2"
        />
      )}
      {style.pattern === 'compass' && (
        <g stroke={style.accentColor} strokeWidth="2.2" strokeLinecap="round">
          <line x1="32" y1="14" x2="32" y2="50" />
          <line x1="14" y1="32" x2="50" y2="32" />
        </g>
      )}
      {style.pattern === 'lotus' && (
        <g fill="none" stroke={style.accentColor} strokeWidth="1.5">
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <circle
                key={deg}
                cx={32 + Math.cos(rad) * 11}
                cy={32 + Math.sin(rad) * 11}
                r="5"
              />
            );
          })}
        </g>
      )}
      {style.pattern === 'star' && (
        <polygon
          points="32,12 37,26 51,32 37,38 32,52 27,38 13,32 27,26"
          fill="none"
          stroke={style.accentColor}
          strokeWidth="1.8"
        />
      )}
      {style.pattern === 'chevron' && (
        <g fill="none" stroke={style.accentColor} strokeWidth="2.5" strokeLinecap="round">
          <path d="M22 20 A16 16 0 0 1 42 20" />
          <path d="M44 40 A16 16 0 0 1 20 40" />
        </g>
      )}
      <circle cx="32" cy="32" r="6.5" fill={style.coreColor} />
    </svg>
  );
}

function BoardPreviewSvg({ theme }: { theme: BoardTheme }) {
  return (
    <svg viewBox="0 0 96 96" className="h-16 w-16 shrink-0 rounded-xl shadow-lg" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="92"
        height="92"
        rx="12"
        fill={theme.frameInner}
        stroke={theme.frameOuter}
        strokeWidth="3"
      />
      <rect
        x="12"
        y="12"
        width="72"
        height="72"
        rx="4"
        fill={theme.surfaceBase}
        stroke={theme.inlayGold}
        strokeWidth="1.5"
      />
      <circle cx="20" cy="20" r="5" fill={theme.pocketHole} stroke={theme.pocketRim} strokeWidth="1.5" />
      <circle cx="76" cy="20" r="5" fill={theme.pocketHole} stroke={theme.pocketRim} strokeWidth="1.5" />
      <circle cx="20" cy="76" r="5" fill={theme.pocketHole} stroke={theme.pocketRim} strokeWidth="1.5" />
      <circle cx="76" cy="76" r="5" fill={theme.pocketHole} stroke={theme.pocketRim} strokeWidth="1.5" />
      <line x1="28" y1="22" x2="68" y2="22" stroke={theme.lineInk} strokeWidth="1.2" />
      <line x1="28" y1="74" x2="68" y2="74" stroke={theme.lineInk} strokeWidth="1.2" />
      <circle cx="48" cy="48" r="14" fill="none" stroke={theme.lineInk} strokeWidth="1.3" />
      <circle cx="48" cy="48" r="5" fill={theme.lineAccent} />
    </svg>
  );
}

function CoinSetPreviewSvg({ style }: { style: CoinStyle }) {
  return (
    <svg viewBox="0 0 88 52" className="h-12 w-20 shrink-0" aria-hidden="true">
      <circle cx="20" cy="27" r="14" fill="rgba(0,0,0,0.4)" />
      <circle cx="20" cy="25" r="14" fill={style.whiteColors[1]} stroke={style.whiteStroke} strokeWidth="1.5" />
      <circle cx="20" cy="25" r="9" fill="none" stroke={style.whiteRidge} strokeWidth="1" />
      <circle cx="44" cy="27" r="14" fill="rgba(0,0,0,0.4)" />
      <circle cx="44" cy="25" r="14" fill={style.queenColors[1]} stroke={style.queenStroke} strokeWidth="1.5" />
      <circle cx="44" cy="25" r="3" fill={style.queenGem} />
      <circle cx="68" cy="27" r="14" fill="rgba(0,0,0,0.4)" />
      <circle cx="68" cy="25" r="14" fill={style.blackColors[1]} stroke={style.blackStroke} strokeWidth="1.5" />
      <circle cx="68" cy="25" r="9" fill="none" stroke={style.blackRidge} strokeWidth="1" />
    </svg>
  );
}

/* 1. Cold-Launch Splash Screen */
export const ColdLaunchSplash: React.FC<{ onDismiss: () => void }> = ({
  onDismiss,
}) => {
  return (
    <div
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onDismiss();
      }}
      className="liquid-stage fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center p-6 text-center"
    >
      <div className="glass-sheet flex h-32 w-32 items-center justify-center rounded-[32px] p-3">
        <img
          src="/pwa-192x192.png"
          alt="Morsalin Carrom Crest"
          className="h-full w-full rounded-2xl shadow-lg"
        />
      </div>
      <h1 className="font-display mt-6 text-2xl font-bold tracking-[0.22em] text-white sm:text-3xl">
        MORSALIN CARROM
      </h1>
      <p className="mt-2 text-xs tracking-[0.2em] text-blue-200/80">
        OFFLINE TABLETOP EDITION
      </p>
    </div>
  );
};

/* 2. Play vs Computer Setup Modal */
export const SetupCpuModal: React.FC<{
  difficulty: AIDifficulty;
  format: MatchFormat;
  onChangeDifficulty: (d: AIDifficulty) => void;
  onChangeFormat: (f: MatchFormat) => void;
  onStart: () => void;
  onClose: () => void;
}> = ({
  difficulty,
  format,
  onChangeDifficulty,
  onChangeFormat,
  onStart,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#03050c]/72 p-4 backdrop-blur-md">
      <div className="glass-sheet animate-modal-enter w-full max-w-md rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/12 px-5 py-4">
          <h2 className="font-display text-xl font-bold text-white">
            Play vs Computer
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close setup"
            className="glass-btn flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <span className="text-xs font-medium text-slate-300">
              Computer Difficulty
            </span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ['easy', 'Easy', 'Casual shots'],
                  ['medium', 'Medium', 'Balanced aim'],
                  ['hard', 'Hard', 'Sharp & safe'],
                ] as const
              ).map(([id, title, desc]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiTick();
                    onChangeDifficulty(id);
                  }}
                  className={`flex min-h-[62px] flex-col items-center justify-center rounded-2xl px-2 py-2 text-center ${
                    difficulty === id
                      ? 'glass-btn-active text-white'
                      : 'glass-btn text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="mt-0.5 text-[10px] opacity-80">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-300">Match Format</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTick();
                  onChangeFormat('quick');
                }}
                className={`min-h-[48px] rounded-2xl px-3 py-2 text-sm font-medium ${
                  format === 'quick'
                    ? 'glass-btn-active text-white'
                    : 'glass-btn text-slate-300'
                }`}
              >
                Single Board
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTick();
                  onChangeFormat('championship');
                }}
                className={`min-h-[48px] rounded-2xl px-3 py-2 text-sm font-medium ${
                  format === 'championship'
                    ? 'glass-btn-active text-white'
                    : 'glass-btn text-slate-300'
                }`}
              >
                First to 25 Pts
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiTick();
              onStart();
            }}
            className="glass-cta flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Start Match</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* 3. Two Players Local Setup Modal */
export const SetupTwoPlayersModal: React.FC<{
  p1Name: string;
  p2Name: string;
  format: MatchFormat;
  autoFlip: boolean;
  onChangeP1Name: (name: string) => void;
  onChangeP2Name: (name: string) => void;
  onChangeFormat: (f: MatchFormat) => void;
  onToggleAutoFlip: (val: boolean) => void;
  onStart: () => void;
  onClose: () => void;
}> = ({
  p1Name,
  p2Name,
  format,
  autoFlip,
  onChangeP1Name,
  onChangeP2Name,
  onChangeFormat,
  onToggleAutoFlip,
  onStart,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#03050c]/72 p-4 backdrop-blur-md">
      <div className="glass-sheet animate-modal-enter w-full max-w-md rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/12 px-5 py-4">
          <h2 className="font-display text-xl font-bold text-white">
            Two Players (Local)
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close setup"
            className="glass-btn flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="setup-p1"
                className="flex items-center gap-1.5 text-xs text-slate-300"
              >
                <span
                  className="inline-block h-3 w-3 rounded-full border border-slate-300 bg-slate-100"
                  aria-hidden="true"
                />
                <span>Player 1 (9 White)</span>
              </label>
              <input
                id="setup-p1"
                type="text"
                maxLength={16}
                placeholder="Player 1"
                value={p1Name}
                onChange={(e) => onChangeP1Name(e.target.value)}
                className="glass-input mt-1.5 min-h-[44px] w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="setup-p2"
                className="flex items-center gap-1.5 text-xs text-slate-300"
              >
                <span
                  className="inline-block h-3 w-3 rounded-full border border-slate-500 bg-slate-900"
                  aria-hidden="true"
                />
                <span>Player 2 (9 Black)</span>
              </label>
              <input
                id="setup-p2"
                type="text"
                maxLength={16}
                placeholder="Player 2"
                value={p2Name}
                onChange={(e) => onChangeP2Name(e.target.value)}
                className="glass-input mt-1.5 min-h-[44px] w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-300">Match Format</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTick();
                  onChangeFormat('quick');
                }}
                className={`min-h-[44px] rounded-2xl px-3 py-2 text-sm font-medium ${
                  format === 'quick'
                    ? 'glass-btn-active text-white'
                    : 'glass-btn text-slate-300'
                }`}
              >
                Single Board
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTick();
                  onChangeFormat('championship');
                }}
                className={`min-h-[44px] rounded-2xl px-3 py-2 text-sm font-medium ${
                  format === 'championship'
                    ? 'glass-btn-active text-white'
                    : 'glass-btn text-slate-300'
                }`}
              >
                First to 25 Pts
              </button>
            </div>
          </div>

          <label className="glass-cell flex min-h-[48px] cursor-pointer items-center justify-between gap-4 rounded-2xl px-3.5 py-2.5">
            <div>
              <div className="text-sm text-white">Auto-Rotate for Player 2</div>
              <div className="text-xs text-slate-400">
                Turns board 180° when passing the phone
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoFlip}
              onChange={(e) => onToggleAutoFlip(e.target.checked)}
              className="h-5 w-5 accent-blue-500"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiTick();
              onStart();
            }}
            className="glass-cta flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Start Two-Player Match</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* 4. Pause Modal */
export const PauseModal: React.FC<{
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onExitToTitle: () => void;
}> = ({ onResume, onRestart, onOpenSettings, onOpenRules, onExitToTitle }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#03050c]/72 p-4 backdrop-blur-md">
      <div className="glass-sheet animate-modal-enter w-full max-w-sm rounded-[28px] p-6">
        <h2 className="font-display text-center text-2xl font-bold text-white">
          Match Paused
        </h2>
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiTick();
              onResume();
            }}
            className="glass-cta flex min-h-[50px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Resume</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiTick();
              onRestart();
            }}
            className="glass-btn flex min-h-[46px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white"
          >
            <RotateCcw className="h-4 w-4 text-blue-300" />
            <span>Restart Match</span>
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTick();
                onOpenRules();
              }}
              className="glass-btn min-h-[46px] rounded-2xl px-3 py-2 text-sm font-medium text-slate-100"
            >
              Rules
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTick();
                onOpenSettings();
              }}
              className="glass-btn min-h-[46px] rounded-2xl px-3 py-2 text-sm font-medium text-slate-100"
            >
              Settings
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiTick();
              onExitToTitle();
            }}
            className="glass-danger mt-1 flex min-h-[46px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-red-100"
          >
            <Home className="h-4 w-4" />
            <span>Home Screen</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* 5. Round / Match Result Modal */
export const ResultModal: React.FC<{
  isMatchOver: boolean;
  format: MatchFormat;
  roundSummary: RoundSummary;
  p1Name: string;
  p2Name: string;
  p1Score: number;
  p2Score: number;
  matchWinner: PlayerSide;
  newlyUnlockedIds: string[];
  onNextRound: () => void;
  onPlayAgain: () => void;
  onExitToTitle: () => void;
}> = ({
  isMatchOver,
  format,
  roundSummary,
  p1Name,
  p2Name,
  p1Score,
  p2Score,
  matchWinner,
  newlyUnlockedIds,
  onNextRound,
  onPlayAgain,
  onExitToTitle,
}) => {
  const winnerName =
    (isMatchOver ? matchWinner : roundSummary.winner) === 'p1' ? p1Name : p2Name;

  const unlockedList = ACHIEVEMENTS.filter((a) => newlyUnlockedIds.includes(a.id));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#03050c]/75 p-4 backdrop-blur-md">
      <div className="glass-sheet animate-modal-enter w-full max-w-md rounded-[28px] p-6">
        <div className="flex flex-col items-center text-center">
          <div className="glass-btn-active flex h-14 w-14 items-center justify-center rounded-2xl text-blue-200">
            <Trophy className="h-7 w-7" />
          </div>
          <h2 className="font-display mt-3 text-2xl font-bold text-white">
            {isMatchOver
              ? `${winnerName} Wins the Match`
              : `Board ${roundSummary.roundNumber} Complete`}
          </h2>
          <p className="mt-1 text-sm text-slate-300">{roundSummary.reason}</p>
        </div>

        <div className="glass-cell mt-4 rounded-2xl p-3.5 tabular-nums">
          <div className="grid grid-cols-3 border-b border-white/10 pb-2 text-[11px] font-semibold text-slate-400">
            <span>Board Breakdown</span>
            <span className="truncate text-right text-white">{p1Name}</span>
            <span className="truncate text-right text-white">{p2Name}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 text-xs text-slate-300">
            <span>Pocketed Coins</span>
            <span className="text-right">{roundSummary.p1Pocketed}/9</span>
            <span className="text-right">{roundSummary.p2Pocketed}/9</span>
          </div>
          <div className="mt-1.5 grid grid-cols-3 text-xs text-slate-300">
            <span>Remaining</span>
            <span className="text-right">{roundSummary.p1Remaining}</span>
            <span className="text-right">{roundSummary.p2Remaining}</span>
          </div>
          <div className="mt-1.5 grid grid-cols-3 text-xs text-slate-300">
            <span>Queen Points</span>
            <span className="text-right text-blue-300">
              {roundSummary.queenCoveredBy === 'p1' ? '+3' : '0'}
            </span>
            <span className="text-right text-violet-300">
              {roundSummary.queenCoveredBy === 'p2' ? '+3' : '0'}
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-3 text-xs text-slate-300">
            <span>Penalties (Fouls)</span>
            <span className="text-right text-red-300/90">
              {roundSummary.p1Penalties}
            </span>
            <span className="text-right text-red-300/90">
              {roundSummary.p2Penalties}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2.5 text-sm font-bold text-blue-200">
            <span>Board Points ({roundSummary.winner === 'p1' ? p1Name : p2Name})</span>
            <span>+{roundSummary.pointsAwarded} pts</span>
          </div>
        </div>

        <div className="glass-cell mt-3 grid grid-cols-2 gap-3 rounded-2xl p-3 text-center tabular-nums">
          <div>
            <div className="truncate text-xs text-slate-300">
              {p1Name} {format === 'championship' ? 'Match Total' : 'Score'}
            </div>
            <div className="text-xl font-bold text-white">{p1Score}</div>
          </div>
          <div>
            <div className="truncate text-xs text-slate-300">
              {p2Name} {format === 'championship' ? 'Match Total' : 'Score'}
            </div>
            <div className="text-xl font-bold text-white">{p2Score}</div>
          </div>
        </div>

        {unlockedList.length > 0 && (
          <div className="mt-4 rounded-2xl border border-blue-400/35 bg-blue-500/15 p-3 backdrop-blur-md">
            <div className="text-xs font-semibold text-blue-200">
              Achievements Unlocked
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              {unlockedList.map((a) => (
                <div key={a.id} className="text-xs text-white">
                  {a.title} — <span className="text-slate-300">{a.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          {!isMatchOver ? (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTick();
                onNextRound();
              }}
              className="glass-cta flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Start Next Board</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTick();
                onPlayAgain();
              }}
              className="glass-cta flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Play Again</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiTick();
              onExitToTitle();
            }}
            className="glass-btn flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-100"
          >
            <Home className="h-4 w-4" />
            <span>Home Screen</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* 6. Board & Coin Collection Modal */
export const BoardCollectionModal: React.FC<{
  selectedBoardId: string;
  selectedCoinStyleId: string;
  onSelectBoard: (id: string) => void;
  onSelectCoinStyle: (id: string) => void;
  onClose: () => void;
}> = ({
  selectedBoardId,
  selectedCoinStyleId,
  onSelectBoard,
  onSelectCoinStyle,
  onClose,
}) => {
  const [tab, setTab] = useState<'boards' | 'coins'>('boards');

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#03050c]/72 p-4 backdrop-blur-md">
      <div className="glass-sheet animate-modal-enter flex max-h-[88vh] w-full max-w-xl flex-col rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/12 px-5 py-4">
          <h2 className="font-display text-xl font-bold text-white">
            Board &amp; Coin Collection
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close board collection"
            className="glass-btn flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiTick();
              setTab('boards');
            }}
            className={`min-h-[42px] rounded-xl text-xs font-semibold ${
              tab === 'boards'
                ? 'glass-btn-active text-white'
                : 'glass-btn text-slate-300'
            }`}
          >
            Board Themes ({BOARD_THEMES.length})
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiTick();
              setTab('coins');
            }}
            className={`min-h-[42px] rounded-xl text-xs font-semibold ${
              tab === 'coins'
                ? 'glass-btn-active text-white'
                : 'glass-btn text-slate-300'
            }`}
          >
            Coin Styles ({COIN_STYLES.length})
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
          {tab === 'boards'
            ? BOARD_THEMES.map((t) => {
                const active = t.id === selectedBoardId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiTick();
                      onSelectBoard(t.id);
                    }}
                    className={`flex items-center gap-3.5 rounded-2xl p-3.5 text-left ${
                      active ? 'glass-btn-active' : 'glass-btn'
                    }`}
                  >
                    <BoardPreviewSvg theme={t} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-white">
                          {t.name}
                        </span>
                        {active && <Check className="h-4 w-4 shrink-0 text-blue-300" />}
                      </div>
                      <div className="text-[11px] font-medium text-blue-300/90">
                        {t.category}
                      </div>
                      <p className="mt-1 text-xs leading-snug text-slate-300">
                        {t.subtitle}
                      </p>
                      <span className="mt-2 inline-block text-[11px] font-semibold text-blue-200">
                        {active ? 'Equipped' : 'Tap to Equip'}
                      </span>
                    </div>
                  </button>
                );
              })
            : COIN_STYLES.map((c) => {
                const active = c.id === selectedCoinStyleId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiTick();
                      onSelectCoinStyle(c.id);
                    }}
                    className={`flex items-center gap-3 rounded-2xl p-3.5 text-left ${
                      active ? 'glass-btn-active' : 'glass-btn'
                    }`}
                  >
                    <CoinSetPreviewSvg style={c} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-white">
                          {c.name}
                        </span>
                        {active && <Check className="h-4 w-4 shrink-0 text-blue-300" />}
                      </div>
                      <p className="mt-1 text-xs leading-snug text-slate-300">
                        {c.subtitle}
                      </p>
                      <span className="mt-2 inline-block text-[11px] font-semibold text-blue-200">
                        {active ? 'Equipped' : 'Tap to Equip'}
                      </span>
                    </div>
                  </button>
                );
              })}
        </div>
      </div>
    </div>
  );
};

/* 7. Striker Collection Modal */
export const StrikerCollectionModal: React.FC<{
  selectedStrikerId: string;
  onSelectStriker: (id: string) => void;
  onClose: () => void;
}> = ({ selectedStrikerId, onSelectStriker, onClose }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#03050c]/72 p-4 backdrop-blur-md">
      <div className="glass-sheet animate-modal-enter flex max-h-[88vh] w-full max-w-xl flex-col rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/12 px-5 py-4">
          <h2 className="font-display text-xl font-bold text-white">
            Striker Collection
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close striker collection"
            className="glass-btn flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
          {STRIKER_STYLES.map((st) => {
            const active = st.id === selectedStrikerId;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  soundEngine.playUiTick();
                  onSelectStriker(st.id);
                }}
                className={`flex items-center gap-3.5 rounded-2xl p-3.5 text-left ${
                  active ? 'glass-btn-active' : 'glass-btn'
                }`}
              >
                <StrikerPreviewSvg style={st} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-white">
                      {st.name}
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0 text-blue-300" />}
                  </div>
                  <div className="text-[11px] font-medium text-violet-300/95">
                    {st.category}
                  </div>
                  <p className="mt-1 text-xs leading-snug text-slate-300">
                    {st.subtitle}
                  </p>
                  <span className="mt-2 inline-block text-[11px] font-semibold text-blue-200">
                    {active ? 'Equipped' : 'Tap to Equip'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* 8. Player Profile Modal */
export const ProfileModal: React.FC<{
  profile: PlayerProfile;
  stats: PlayerStats;
  unlockedCount: number;
  onUpdateProfile: (patch: Partial<PlayerProfile>) => void;
  onOpenStatistics: () => void;
  onOpenAchievements: () => void;
  onResetProgress: () => void;
  onClose: () => void;
}> = ({
  profile,
  stats,
  unlockedCount,
  onUpdateProfile,
  onOpenStatistics,
  onOpenAchievements,
  onResetProgress,
  onClose,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const equippedBoard =
    BOARD_THEMES.find((b) => b.id === profile.selectedBoardId)?.name ?? 'Royal Rosewood';
  const equippedStriker =
    STRIKER_STYLES.find((s) => s.id === profile.selectedStrikerId)?.name ??
    'Heritage Ivory';
  const equippedCoins =
    COIN_STYLES.find((c) => c.id === profile.selectedCoinStyleId)?.name ??
    'Classic Ivory & Ebony';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#03050c]/72 p-4 backdrop-blur-md">
      <div className="glass-sheet animate-modal-enter flex max-h-[88vh] w-full max-w-lg flex-col rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/12 px-5 py-4">
          <h2 className="font-display text-xl font-bold text-white">
            Player Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="glass-btn flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="glass-cell flex flex-col gap-4 rounded-2xl p-4">
            <div className="flex items-center gap-3.5">
              <div className="glass-btn-active flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-blue-100">
                <AvatarIcon id={profile.avatarId} className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <label htmlFor="profile-name" className="block text-xs text-slate-300">
                  Player Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  maxLength={16}
                  value={profile.name}
                  onChange={(e) => onUpdateProfile({ name: e.target.value })}
                  className="glass-input mt-1 min-h-[42px] w-full rounded-xl px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-300">Profile Emblem</span>
              <div className="mt-2 flex gap-2">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    aria-label={av.label}
                    onClick={() => {
                      soundEngine.playUiTick();
                      onUpdateProfile({ avatarId: av.id });
                    }}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                      profile.avatarId === av.id
                        ? 'glass-btn-active text-white'
                        : 'glass-btn text-slate-300 hover:text-white'
                    }`}
                  >
                    <AvatarIcon id={av.id} className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div className="glass-cell rounded-2xl p-3">
              <div className="text-slate-400">Equipped Board</div>
              <div className="mt-1 truncate text-sm font-semibold text-white">
                {equippedBoard}
              </div>
            </div>
            <div className="glass-cell rounded-2xl p-3">
              <div className="text-slate-400">Equipped Striker</div>
              <div className="mt-1 truncate text-sm font-semibold text-white">
                {equippedStriker}
              </div>
            </div>
            <div className="glass-cell rounded-2xl p-3">
              <div className="text-slate-400">Coin Style</div>
              <div className="mt-1 truncate text-sm font-semibold text-white">
                {equippedCoins}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTick();
                onOpenStatistics();
              }}
              className="glass-btn min-h-[44px] rounded-2xl px-3 py-2 text-xs font-semibold text-blue-200"
            >
              Statistics ({stats.wins} Wins)
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTick();
                onOpenAchievements();
              }}
              className="glass-btn min-h-[44px] rounded-2xl px-3 py-2 text-xs font-semibold text-violet-200"
            >
              Achievements ({unlockedCount}/{ACHIEVEMENTS.length})
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-xs text-slate-400">Stored offline on device</span>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="glass-danger min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-medium text-red-200"
              >
                Reset Progress
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetProgress();
                    setConfirmReset(false);
                  }}
                  className="min-h-[38px] rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="glass-btn min-h-[38px] rounded-xl px-3 py-1.5 text-xs text-slate-200"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* 9. Statistics & Match History Modal */
export const StatisticsModal: React.FC<{
  stats: PlayerStats;
  history: MatchRecord[];
  onClose: () => void;
}> = ({ stats, history, onClose }) => {
  const winRate =
    stats.matchesPlayed > 0
      ? Math.round((stats.wins / stats.matchesPlayed) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#03050c]/72 p-4 backdrop-blur-md">
      <div className="glass-sheet animate-modal-enter flex max-h-[88vh] w-full max-w-2xl flex-col rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/12 px-5 py-4">
          <h2 className="font-display text-xl font-bold text-white">
            Statistics &amp; Match History
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close statistics"
            className="glass-btn flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Matches Played', stats.matchesPlayed],
              ['Total Wins', stats.wins],
              ['Win Rate', `${winRate}%`],
              ['Best Streak', stats.bestStreak],
              ['Coins Pocketed', stats.totalCoinsPocketed],
              ['Queens Covered', stats.queensCovered],
              ['Best Turn', stats.bestTurnPocketed],
              ['Hard AI Wins', stats.hardAiWins],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                className="glass-cell rounded-2xl p-3.5"
              >
                <div className="text-xs text-slate-400">{label}</div>
                <div className="mt-1 text-xl font-bold text-white tabular-nums">
                  {val}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-200">Recent Matches</h3>
            {history.length === 0 ? (
              <div className="glass-cell mt-3 rounded-2xl py-8 text-center text-sm text-slate-400">
                No completed matches yet. Play a board to record your results.
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                {history.map((m) => (
                  <div
                    key={m.id}
                    className="glass-cell flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">
                        {m.p1Name} vs {m.p2Name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>
                          {m.mode === 'VS_CPU'
                            ? `Vs AI (${m.difficulty ?? 'medium'})`
                            : 'Two Players'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {m.format === 'championship' ? 'First to 25' : 'Single Board'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(m.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <div
                        className={`text-sm font-bold ${
                          m.winner === 'p1' ? 'text-blue-300' : 'text-slate-300'
                        }`}
                      >
                        {m.winner === 'p1' ? `${m.p1Name} Won` : `${m.p2Name} Won`}
                      </div>
                      <div className="text-xs text-slate-400">
                        {m.p1Score} - {m.p2Score}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* 10. Achievements Modal */
export const AchievementsModal: React.FC<{
  stats: PlayerStats;
  unlockedAchievements: Record<string, number>;
  onClose: () => void;
}> = ({ stats, unlockedAchievements, onClose }) => {
  const unlockedCount = Object.keys(unlockedAchievements).length;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#03050c]/72 p-4 backdrop-blur-md">
      <div className="glass-sheet animate-modal-enter flex max-h-[88vh] w-full max-w-2xl flex-col rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/12 px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Achievements
            </h2>
            <p className="text-xs text-slate-300 tabular-nums">
              {unlockedCount} of {ACHIEVEMENTS.length} milestones completed
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close achievements"
            className="glass-btn flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
          {ACHIEVEMENTS.map((ach) => {
            const unlockedAt = unlockedAchievements[ach.id];
            const currentVal = Math.min(ach.target, stats[ach.statKey]);
            const pct = Math.round((currentVal / ach.target) * 100);
            return (
              <div
                key={ach.id}
                className={`rounded-2xl p-3.5 ${
                  unlockedAt ? 'glass-btn-active' : 'glass-cell'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {ach.title}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-300">{ach.description}</p>
                  </div>
                  <Award
                    className={`h-5 w-5 shrink-0 ${
                      unlockedAt ? 'text-blue-300' : 'text-white/20'
                    }`}
                  />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-300 tabular-nums">
                    {currentVal}/{ach.target}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* 11. Rules Modal */
export const RulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#03050c]/72 p-4 backdrop-blur-md">
      <div className="glass-sheet animate-modal-enter flex max-h-[88vh] w-full max-w-lg flex-col rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/12 px-5 py-4">
          <h2 className="font-display text-xl font-bold text-white">
            Carrom Rules &amp; Controls
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="glass-btn flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 text-sm leading-relaxed text-slate-200">
          <div className="glass-cell rounded-2xl p-3.5">
            <h3 className="font-semibold text-blue-200">1. Objective</h3>
            <p className="mt-1 text-xs text-slate-300">
              Player 1 plays the 9 White coins; Player 2 (or Computer) plays the 9 Black coins. Pocket all of your own coins first—while ensuring the Red Queen is covered—to win the board.
            </p>
          </div>
          <div className="glass-cell rounded-2xl p-3.5">
            <h3 className="font-semibold text-blue-200">2. Controls</h3>
            <p className="mt-1 text-xs text-slate-300">
              Slide the striker along your baseline using the bottom slider bar or by tapping directly on the baseline. Touch and pull back from the striker to aim and set shot power, then release to strike. Pull back to center to cancel.
            </p>
          </div>
          <div className="glass-cell rounded-2xl p-3.5">
            <h3 className="font-semibold text-blue-200">3. Turn Continuation</h3>
            <p className="mt-1 text-xs text-slate-300">
              Pocketing one or more of your own coins legally grants another shot. Pocketing only an opponent&apos;s coin or missing passes the turn.
            </p>
          </div>
          <div className="glass-cell rounded-2xl p-3.5">
            <h3 className="font-semibold text-blue-200">4. The Red Queen (+3 Points)</h3>
            <p className="mt-1 text-xs text-slate-300">
              After pocketing the Queen, you must cover it by pocketing one of your own coins on the same shot or your very next shot. If you fail to cover, pocket only an opponent&apos;s coin, or commit a foul, the Queen returns to the center circle.
            </p>
          </div>
          <div className="glass-cell rounded-2xl p-3.5">
            <h3 className="font-semibold text-blue-200">5. Fouls &amp; Penalties</h3>
            <p className="mt-1 text-xs text-slate-300">
              Pocketing the striker returns 1 of your pocketed coins to the center (or adds 1 owed penalty coin due on your next pocket) and ends your turn. Clearing your final coin while the Queen is still on the board forfeits the board.
            </p>
          </div>
          <div className="glass-cell rounded-2xl p-3.5">
            <h3 className="font-semibold text-blue-200">6. Practice Mode</h3>
            <p className="mt-1 text-xs text-slate-300">
              Take unlimited solo shots from the bottom baseline with no fouls or opponent turns. Use Reset Rack anytime to practice breaks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* 12. Game Settings Modal */
export const SettingsModal: React.FC<{
  settings: GameSettings;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onOpenRules: () => void;
  onResetProgress: () => void;
  onClose: () => void;
}> = ({ settings, onUpdateSettings, onOpenRules, onResetProgress, onClose }) => {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#03050c]/72 p-4 backdrop-blur-md">
      <div className="glass-sheet animate-modal-enter flex max-h-[88vh] w-full max-w-md flex-col rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/12 px-5 py-4">
          <h2 className="font-display text-xl font-bold text-white">
            Game Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="glass-btn flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          {/* Audio & Music Section */}
          <div className="glass-cell space-y-3 rounded-2xl p-4">
            <div className="text-xs font-semibold tracking-wide text-blue-300">
              Audio &amp; Music
            </div>

            <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-4">
              <span className="text-white">Sound Effects</span>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => {
                  soundEngine.unlock();
                  onUpdateSettings({ soundEnabled: e.target.checked });
                }}
                className="h-5 w-5 accent-blue-500"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-slate-300 tabular-nums">
                <span>SFX Volume</span>
                <span>{Math.round(settings.soundVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.soundVolume}
                onChange={(e) => {
                  soundEngine.unlock();
                  onUpdateSettings({ soundVolume: Number(e.target.value) });
                }}
                className="glass-range w-full"
              />
            </div>

            <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-4 border-t border-white/10 pt-2.5">
              <span className="text-white">Ambient Background Music</span>
              <input
                type="checkbox"
                checked={settings.musicEnabled}
                onChange={(e) => {
                  soundEngine.unlock();
                  onUpdateSettings({ musicEnabled: e.target.checked });
                }}
                className="h-5 w-5 accent-blue-500"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-slate-300 tabular-nums">
                <span>Music Volume</span>
                <span>{Math.round(settings.musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume}
                onChange={(e) => {
                  soundEngine.unlock();
                  onUpdateSettings({ musicVolume: Number(e.target.value) });
                }}
                className="glass-range w-full"
              />
            </div>
          </div>

          {/* Graphics & Vibration Section */}
          <div className="glass-cell space-y-3 rounded-2xl p-4">
            <div className="text-xs font-semibold tracking-wide text-violet-300">
              Graphics &amp; Touch
            </div>

            <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-4">
              <span className="text-white">Haptic Vibration</span>
              <input
                type="checkbox"
                checked={settings.hapticsEnabled}
                onChange={(e) => onUpdateSettings({ hapticsEnabled: e.target.checked })}
                className="h-5 w-5 accent-blue-500"
              />
            </label>

            <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-4">
              <span className="text-white">Boric Powder Collision FX</span>
              <input
                type="checkbox"
                checked={settings.powderFx}
                onChange={(e) => onUpdateSettings({ powderFx: e.target.checked })}
                className="h-5 w-5 accent-blue-500"
              />
            </label>

            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-xs text-slate-300">Rendering Quality</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['high', 'High Detail'],
                    ['balanced', 'Balanced (60 FPS)'],
                  ] as Array<[GraphicsQuality, string]>
                ).map(([q, label]) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiTick();
                      onUpdateSettings({ graphicsQuality: q });
                    }}
                    className={`min-h-[42px] rounded-xl px-3 py-1.5 text-xs font-semibold ${
                      settings.graphicsQuality === q
                        ? 'glass-btn-active text-white'
                        : 'glass-btn text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Gameplay Section */}
          <div className="glass-cell space-y-3 rounded-2xl p-4">
            <div className="text-xs font-semibold tracking-wide text-sky-300">
              Gameplay
            </div>

            <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4">
              <div>
                <div className="text-white">Auto-Rotate Board (Two Players)</div>
                <div className="text-xs text-slate-400">
                  Flips board 180° for Player 2 when passing device
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoFlipForP2}
                onChange={(e) => onUpdateSettings({ autoFlipForP2: e.target.checked })}
                className="h-5 w-5 accent-blue-500"
              />
            </label>

            <div className="flex flex-col gap-2 pt-1">
              <span className="text-xs text-slate-300">Aim Guide</span>
              <div className="grid grid-cols-3 gap-2">
                {(['full', 'short', 'off'] as AimGuideMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiTick();
                      onUpdateSettings({ aimGuide: mode });
                    }}
                    className={`min-h-[42px] rounded-xl px-3 py-1.5 text-xs font-semibold capitalize ${
                      settings.aimGuide === mode
                        ? 'glass-btn-active text-white'
                        : 'glass-btn text-slate-300'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Rules & Offline Data Reset */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTick();
                onOpenRules();
              }}
              className="glass-btn flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold text-white"
            >
              <BookOpen className="h-4 w-4 text-blue-300" />
              <span>View Carrom Rules &amp; Controls</span>
            </button>

            <div className="glass-cell flex items-center justify-between rounded-2xl px-3.5 py-2.5">
              <span className="text-xs text-slate-400">Saved locally offline</span>
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="glass-danger min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-medium text-red-200"
                >
                  Reset Game Data
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onResetProgress();
                      setConfirmReset(false);
                    }}
                    className="min-h-[38px] rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="glass-btn min-h-[38px] rounded-xl px-3 py-1.5 text-xs text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
