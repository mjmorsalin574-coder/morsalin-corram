import {
  Award,
  BarChart3,
  BookOpen,
  Compass,
  Cpu,
  Crown,
  Disc,
  Download,
  Flower2,
  LayoutGrid,
  Play,
  Settings,
  Shield,
  Star,
  Target,
  User,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useEffect } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { usePWAInstall } from '../platform/android';
import type {
  AIDifficulty,
  BoardTheme,
  CoinStyle,
  GameSettings,
  ModalType,
  PlayerProfile,
  PlayerStats,
  StrikerStyle,
} from '../types/game';
import { CarromCanvas } from './CarromCanvas';

interface TitleScreenProps {
  difficulty: AIDifficulty;
  profile: PlayerProfile;
  stats: PlayerStats;
  unlockedCount: number;
  totalAchievements: number;
  theme: BoardTheme;
  strikerStyle: StrikerStyle;
  coinStyle: CoinStyle;
  settings: GameSettings;
  onQuickPlay: () => void;
  onStartPractice: () => void;
  onToggleSound: () => void;
  onOpenModal: (modal: Exclude<ModalType, null>) => void;
}

function AvatarEmblem({ id, className }: { id: string; className?: string }) {
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

export const TitleScreen: React.FC<TitleScreenProps> = ({
  difficulty,
  profile,
  stats,
  unlockedCount,
  totalAchievements,
  theme,
  strikerStyle,
  coinStyle,
  settings,
  onQuickPlay,
  onStartPractice,
  onToggleSound,
  onOpenModal,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = React.useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
        e.preventDefault();
        soundEngine.unlock();
        soundEngine.playUiTick();
        onQuickPlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onQuickPlay]);

  const menuActions: Array<{
    id: string;
    label: string;
    sub: string;
    icon: React.ReactNode;
    onClick: () => void;
  }> = [
    {
      id: 'vs-cpu',
      label: 'Play vs Computer',
      sub: `AI · ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`,
      icon: <Cpu className="h-4 w-4 text-blue-300" />,
      onClick: () => onOpenModal('SETUP_CPU'),
    },
    {
      id: 'two-players',
      label: 'Two Players',
      sub: 'Local pass & play',
      icon: <Users className="h-4 w-4 text-violet-300" />,
      onClick: () => onOpenModal('SETUP_2P'),
    },
    {
      id: 'practice',
      label: 'Practice Mode',
      sub: 'Solo free shots',
      icon: <Target className="h-4 w-4 text-sky-300" />,
      onClick: onStartPractice,
    },
    {
      id: 'striker-collection',
      label: 'Striker Collection',
      sub: strikerStyle.name,
      icon: <Disc className="h-4 w-4 text-blue-300" />,
      onClick: () => onOpenModal('STRIKER_COLLECTION'),
    },
    {
      id: 'board-collection',
      label: 'Board Collection',
      sub: `${theme.name} · ${coinStyle.name.split(' ')[0]}`,
      icon: <LayoutGrid className="h-4 w-4 text-indigo-300" />,
      onClick: () => onOpenModal('BOARD_COLLECTION'),
    },
    {
      id: 'player-profile',
      label: 'Player Profile',
      sub: profile.name,
      icon: <User className="h-4 w-4 text-sky-300" />,
      onClick: () => onOpenModal('PROFILE'),
    },
    {
      id: 'statistics',
      label: 'Statistics',
      sub: `${stats.wins} Wins · ${stats.matchesPlayed} Played`,
      icon: <BarChart3 className="h-4 w-4 text-blue-300" />,
      onClick: () => onOpenModal('STATISTICS'),
    },
    {
      id: 'achievements',
      label: 'Achievements',
      sub: `${unlockedCount}/${totalAchievements} Unlocked`,
      icon: <Award className="h-4 w-4 text-violet-300" />,
      onClick: () => onOpenModal('ACHIEVEMENTS'),
    },
    {
      id: 'game-settings',
      label: 'Game Settings',
      sub: settings.soundEnabled ? 'Sound On' : 'Muted',
      icon: <Settings className="h-4 w-4 text-slate-200" />,
      onClick: () => onOpenModal('SETTINGS'),
    },
  ];

  return (
    <div className="liquid-stage relative flex h-full w-full flex-col overflow-y-auto text-[#f4f7ff]">
      {/* Subtle Ambient Light Pools */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-32 left-1/4 h-96 w-96 rounded-full bg-blue-500/15 blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-1/6 -bottom-32 h-96 w-96 rounded-full bg-violet-500/15 blur-[110px]"
      />

      {/* Floating Liquid Glass Top Navigation Bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between gap-4 px-4 pt-3 pb-2 sm:px-8 sm:pt-4">
        <button
          type="button"
          onClick={() => {
            soundEngine.playUiTick();
            onOpenModal('PROFILE');
          }}
          className="glass-btn flex min-h-[46px] min-w-0 items-center gap-2.5 rounded-2xl px-3.5 py-1.5 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-gradient-to-br from-blue-500/35 to-violet-500/35 text-blue-100 shadow-inner">
            <AvatarEmblem id={profile.avatarId} className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-white">
              {profile.name}
            </span>
            <span className="block text-[11px] text-slate-300 tabular-nums">
              {stats.wins} Wins · {stats.bestStreak} Best Streak
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiTick();
              onOpenModal('RULES');
            }}
            className="glass-btn flex min-h-[44px] items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium text-slate-100"
          >
            <BookOpen className="h-4 w-4 text-blue-300" />
            <span className="hidden sm:inline">Rules</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              onToggleSound();
            }}
            aria-label={settings.soundEnabled ? 'Mute sound' : 'Unmute sound'}
            className="glass-btn flex h-11 w-11 items-center justify-center rounded-2xl text-slate-100"
          >
            {settings.soundEnabled ? (
              <Volume2 className="h-4 w-4 text-blue-200" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400" />
            )}
          </button>
        </div>
      </header>

      {/* Main Responsive Portrait / Landscape Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-5 px-4 py-3 sm:px-8 sm:py-4 lg:grid lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-10">
        {/* Left: Live Realistic Wooden Carrom Board Preview inside Sleek Glass Rim */}
        <div className="flex flex-col items-center justify-center">
          <div className="glass-panel aspect-square w-full max-w-[236px] rounded-[28px] p-2 sm:max-w-[348px] lg:max-w-[496px]">
            <CarromCanvas
              previewMode
              isPaused={false}
              gameMode="VS_CPU"
              difficulty={difficulty}
              p1Name={profile.name}
              p2Name="Computer"
              theme={theme}
              strikerStyle={strikerStyle}
              coinStyle={coinStyle}
              settings={settings}
              rotatedForP2={false}
              onStateChange={() => {}}
              onTurnResolved={() => {}}
            />
          </div>
        </div>

        {/* Right: Liquid Glass Brand Lockup, Play CTA & 9 Glass Hub Tiles */}
        <div className="flex flex-col justify-center gap-4">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="flex items-center gap-3.5">
              <div className="glass-panel flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
                <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true">
                  <circle
                    cx="32"
                    cy="32"
                    r="24"
                    fill="rgba(15, 23, 42, 0.85)"
                    stroke="#93c5fd"
                    strokeWidth="2.4"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="15"
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="7"
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <circle cx="22" cy="40" r="3.6" fill="#f8fafc" />
                  <circle
                    cx="42"
                    cy="24"
                    r="3.6"
                    fill="#1e293b"
                    stroke="#94a3b8"
                    strokeWidth="1"
                  />
                </svg>
              </div>
              <div className="text-left">
                <h1 className="font-display text-2xl font-bold tracking-[0.12em] text-white sm:text-3xl">
                  MORSALIN CARROM
                </h1>
                <p className="mt-0.5 text-xs text-slate-300">
                  {theme.name} · {strikerStyle.name} · {coinStyle.name}
                </p>
              </div>
            </div>
          </div>

          {/* Primary Play Liquid Glass CTA */}
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiTick();
              onQuickPlay();
            }}
            className="glass-cta flex min-h-[56px] w-full items-center justify-between rounded-2xl px-5 py-3"
          >
            <span className="flex items-center gap-3">
              <Play className="h-5 w-5 fill-current" />
              <span className="text-base font-bold tracking-wide">Play</span>
            </span>
            <span className="text-xs font-semibold text-blue-50/95">
              Quick Match · {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} AI
            </span>
          </button>

          {/* Liquid Glass Menu Grid (9 Working Destinations) */}
          <nav
            aria-label="Main Menu"
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
          >
            {menuActions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playUiTick();
                  item.onClick();
                }}
                className="glass-btn flex min-h-[64px] flex-col justify-between rounded-2xl px-3.5 py-2.5 text-left"
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span className="truncate text-xs font-semibold text-white sm:text-[13px]">
                    {item.label}
                  </span>
                </div>
                <span className="mt-1 truncate text-[11px] text-slate-300 tabular-nums">
                  {item.sub}
                </span>
              </button>
            ))}
          </nav>

          {/* Bottom Control Hint & Optional Offline App Install */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
            <span>Slide baseline to position · Pull striker back to shoot</span>
            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={install}
                className="glass-btn flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-blue-200"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Install App</span>
              </button>
            )}
            {!isInstalled && !isInstallable && isIOS && (
              <button
                type="button"
                onClick={() => setShowIOSGuide(true)}
                className="glass-btn flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-200"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Install on iOS</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#03050c]/72 p-4 backdrop-blur-md">
          <div className="glass-sheet animate-modal-enter w-full max-w-sm rounded-3xl p-6 text-white">
            <h3 className="font-display text-lg font-bold text-white">
              Install MORSALIN CARROM
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              1. Tap the <strong>Share</strong> icon in Safari.<br />
              2. Select <strong>Add to Home Screen</strong> for full offline play.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="glass-cta mt-4 min-h-[44px] w-full rounded-2xl px-4 py-2 text-sm font-semibold"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
