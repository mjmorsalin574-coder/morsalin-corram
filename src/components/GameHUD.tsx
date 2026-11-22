import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Crown,
  Flower2,
  Pause,
  RotateCcw,
  Settings,
  Shield,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React from 'react';
import { BASELINE_MAX_X, BASELINE_MIN_X } from '../game/constants';
import type {
  AIDifficulty,
  GameMode,
  MatchFormat,
  PlayerSide,
  QueenState,
} from '../types/game';

interface GameHUDProps {
  p1Name: string;
  p1AvatarId: string;
  p2Name: string;
  p1Score: number;
  p2Score: number;
  p1Remaining: number;
  p2Remaining: number;
  p1Due: number;
  p2Due: number;
  p1Penalties: number;
  p2Penalties: number;
  roundNumber: number;
  format: MatchFormat;
  mode: GameMode;
  difficulty: AIDifficulty;
  activePlayer: PlayerSide;
  phase: 'AIMING' | 'SHOOTING' | 'AI_THINKING';
  queenState: QueenState;
  strikerX: number;
  positionClear: boolean;
  powerPercent: number;
  rotatedForP2: boolean;
  practiceShots: number;
  practicePocketed: number;
  soundEnabled: boolean;
  statusBanner: { text: string; tone: 'neutral' | 'good' | 'queen' | 'foul' };
  onSlideStriker: (x: number) => void;
  onNudgeStriker: (dx: number) => void;
  onResetPracticeRack: () => void;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  onPause: () => void;
}

function PlayerEmblem({ id }: { id: string }) {
  const cls = 'h-3.5 w-3.5 text-blue-200';
  switch (id) {
    case 'lotus':
      return <Flower2 className={cls} />;
    case 'compass':
      return <Compass className={cls} />;
    case 'shield':
      return <Shield className={cls} />;
    case 'star':
      return <Star className={cls} />;
    default:
      return <Crown className={cls} />;
  }
}

export const GameHUD: React.FC<GameHUDProps> = ({
  p1Name,
  p1AvatarId,
  p2Name,
  p1Score,
  p2Score,
  p1Remaining,
  p2Remaining,
  p1Due,
  p2Due,
  p1Penalties,
  p2Penalties,
  roundNumber,
  format,
  mode,
  difficulty,
  activePlayer,
  phase,
  queenState,
  strikerX,
  positionClear,
  powerPercent,
  rotatedForP2,
  practiceShots,
  practicePocketed,
  soundEnabled,
  statusBanner,
  onSlideStriker,
  onNudgeStriker,
  onResetPracticeRack,
  onToggleSound,
  onOpenSettings,
  onPause,
}) => {
  const isPractice = mode === 'PRACTICE';
  const isHumanTurn =
    phase === 'AIMING' && !(mode === 'VS_CPU' && activePlayer === 'p2');
  const displaySliderX = rotatedForP2
    ? BASELINE_MIN_X + BASELINE_MAX_X - strikerX
    : strikerX;

  const modeLabel =
    mode === 'PRACTICE'
      ? 'Practice Mode'
      : mode === 'VS_CPU'
      ? `Vs Computer · ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`
      : 'Two Players';

  const queenLabel = isPractice
    ? `${19 - p1Remaining - p2Remaining - (queenState === 'ON_BOARD' ? 1 : 0)}/19 Cleared`
    : queenState === 'ON_BOARD'
    ? 'Queen on Board'
    : queenState === 'PENDING_P1'
    ? `${p1Name} Covering Queen`
    : queenState === 'PENDING_P2'
    ? `${p2Name} Covering Queen`
    : queenState === 'COVERED_P1'
    ? `Queen · ${p1Name} (+3)`
    : `Queen · ${p2Name} (+3)`;

  const bannerToneClass =
    statusBanner.tone === 'foul'
      ? 'text-red-300'
      : statusBanner.tone === 'queen'
      ? 'text-amber-200'
      : statusBanner.tone === 'good'
      ? 'text-emerald-300'
      : 'text-slate-200';

  return (
    <div className="pointer-events-none flex h-full w-full flex-col justify-between gap-2 px-3 py-2 sm:px-6 sm:py-3">
      {/* Top Floating Liquid Glass Score & Utility Header */}
      <header className="pointer-events-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Player 1 Glass Score Panel */}
        <div
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-1.5 transition-all duration-150 ${
            activePlayer === 'p1'
              ? 'glass-btn-active'
              : 'glass-panel opacity-80'
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-blue-500/30 to-violet-500/30">
            <PlayerEmblem id={p1AvatarId} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <span className="truncate">{p1Name}</span>
              {!isPractice && activePlayer === 'p1' && (
                <span className="shrink-0 text-[10px] font-bold tracking-wider text-blue-300">
                  TURN
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-300 tabular-nums">
              {isPractice ? (
                <span>
                  {practiceShots} Shots · {practicePocketed} Pocketed
                </span>
              ) : (
                <>
                  <span>
                    {9 - p1Remaining}/9 W
                    <span className="hidden sm:inline"> ({p1Remaining} left)</span>
                  </span>
                  {queenState === 'COVERED_P1' && (
                    <span className="font-semibold text-rose-300">+3Q</span>
                  )}
                  {p1Due > 0 ? (
                    <span className="font-semibold text-red-300">{p1Due} Due</span>
                  ) : (
                    p1Penalties > 0 && (
                      <span className="text-red-300/90">{p1Penalties} Pen</span>
                    )
                  )}
                  {format === 'championship' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-blue-200">{p1Score} pts</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center Match Info + Floating Glass Utility Buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="glass-panel hidden flex-col items-center rounded-2xl px-3.5 py-1.5 text-center md:flex">
            <span className="text-[11px] font-semibold text-white tabular-nums">
              {modeLabel}
              {!isPractice &&
                ` · ${format === 'championship' ? `Board ${roundNumber} / 25` : 'Single Board'}`}
            </span>
            <span className="text-[11px] text-blue-200/85">{queenLabel}</span>
          </div>

          {isPractice && (
            <button
              type="button"
              onClick={onResetPracticeRack}
              aria-label="Reset practice rack"
              className="glass-btn flex h-11 items-center gap-1.5 rounded-2xl px-3 text-xs font-medium text-blue-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset Rack</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
            className="glass-btn flex h-11 w-11 items-center justify-center rounded-2xl text-slate-100"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-blue-200" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Game settings"
            className="glass-btn flex h-11 w-11 items-center justify-center rounded-2xl text-slate-100"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onPause}
            aria-label="Pause game"
            className="glass-btn flex h-11 w-11 items-center justify-center rounded-2xl text-slate-100"
          >
            <Pause className="h-4 w-4" />
          </button>
        </div>

        {/* Player 2 / Computer Glass Score Panel */}
        {!isPractice ? (
          <div
            className={`flex min-w-0 flex-1 items-center justify-end gap-2 rounded-2xl px-3 py-1.5 text-right transition-all duration-150 ${
              activePlayer === 'p2'
                ? 'glass-btn-active'
                : 'glass-panel opacity-80'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-white">
                {activePlayer === 'p2' && (
                  <span className="shrink-0 text-[10px] font-bold tracking-wider text-violet-300">
                    TURN
                  </span>
                )}
                <span className="truncate">{p2Name}</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-[11px] text-slate-300 tabular-nums">
                {format === 'championship' && (
                  <>
                    <span className="font-semibold text-violet-200">{p2Score} pts</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                {p2Due > 0 ? (
                  <span className="font-semibold text-red-300">{p2Due} Due</span>
                ) : (
                  p2Penalties > 0 && (
                    <span className="text-red-300/90">{p2Penalties} Pen</span>
                  )
                )}
                {queenState === 'COVERED_P2' && (
                  <span className="font-semibold text-rose-300">+3Q</span>
                )}
                <span>
                  <span className="hidden sm:inline">({p2Remaining} left) </span>
                  {9 - p2Remaining}/9 B
                </span>
              </div>
            </div>
            <span
              className="h-4 w-4 shrink-0 rounded-full border border-slate-400/60 bg-gradient-to-br from-slate-600 to-slate-950 shadow-inner"
              aria-hidden="true"
            />
          </div>
        ) : (
          <div className="glass-panel hidden min-w-0 flex-1 items-center justify-end gap-2 rounded-2xl px-3.5 py-1.5 text-right sm:flex">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white">Solo Free-Play</div>
              <div className="text-[11px] text-slate-300 tabular-nums">
                {queenLabel} · No Fouls
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Bottom Floating Glass Status, Shot Power Meter & Baseline Dock */}
      <footer className="pointer-events-auto mx-auto flex w-full max-w-xl flex-col gap-1.5">
        <div className="glass-panel flex items-center justify-between gap-2 rounded-2xl px-3.5 py-1.5 text-xs">
          <span className={`truncate font-medium ${bannerToneClass}`}>
            {!positionClear && isHumanTurn
              ? 'Striker blocked — slide to an open spot on baseline'
              : phase === 'AI_THINKING'
              ? `${p2Name} is lining up a shot...`
              : statusBanner.text}
          </span>
          <span className="shrink-0 font-mono-tabular text-[11px] text-slate-300 md:hidden">
            {queenLabel}
          </span>
          {powerPercent > 0 && (
            <div className="flex shrink-0 items-center gap-2">
              <div className="h-2.5 w-20 overflow-hidden rounded-full border border-white/20 bg-black/45 p-[1px]">
                <div
                  className={`h-full rounded-full transition-[width] duration-75 ${
                    powerPercent < 45
                      ? 'bg-gradient-to-r from-sky-400 to-blue-500'
                      : powerPercent < 80
                      ? 'bg-gradient-to-r from-blue-400 to-violet-500'
                      : 'bg-gradient-to-r from-violet-400 to-rose-500'
                  }`}
                  style={{ width: `${powerPercent}%` }}
                />
              </div>
              <span className="font-mono-tabular text-xs font-bold text-blue-200">
                {powerPercent}%
              </span>
            </div>
          )}
        </div>

        {/* Baseline Striker Liquid Glass Slider Bar */}
        <div className="glass-panel flex items-center gap-2 rounded-2xl px-2.5 py-1.5">
          <button
            type="button"
            disabled={!isHumanTurn}
            onClick={() => onNudgeStriker(rotatedForP2 ? 14 : -14)}
            aria-label="Move striker left"
            className="glass-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-100 disabled:opacity-35"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <input
            type="range"
            min={BASELINE_MIN_X}
            max={BASELINE_MAX_X}
            step={1}
            value={Math.round(displaySliderX)}
            disabled={!isHumanTurn}
            aria-label="Position striker along baseline"
            onChange={(e) => {
              const raw = Number(e.target.value);
              onSlideStriker(
                rotatedForP2 ? BASELINE_MIN_X + BASELINE_MAX_X - raw : raw
              );
            }}
            className="carrom-slider h-10 flex-1"
          />

          <button
            type="button"
            disabled={!isHumanTurn}
            onClick={() => onNudgeStriker(rotatedForP2 ? -14 : 14)}
            aria-label="Move striker right"
            className="glass-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-100 disabled:opacity-35"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  );
};
