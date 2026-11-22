import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { AuthScreen } from './components/AuthScreen';
import {
  CarromCanvas,
  type BoardLiveState,
  type CarromCanvasHandle,
} from './components/CarromCanvas';
import { GameHUD } from './components/GameHUD';
import {
  AchievementsModal,
  BoardCollectionModal,
  ColdLaunchSplash,
  PauseModal,
  ProfileModal,
  ResultModal,
  RulesModal,
  SettingsModal,
  SetupCpuModal,
  SetupTwoPlayersModal,
  StatisticsModal,
  StrikerCollectionModal,
} from './components/Modals';
import { TitleScreen } from './components/TitleScreen';
import {
  ACHIEVEMENTS,
  BOARD_THEMES,
  COIN_STYLES,
  DEFAULT_SAVE_BUNDLE,
  STRIKER_STYLES,
} from './data/themes';
import { BOARD_CENTER, CHAMPIONSHIP_TARGET_POINTS } from './game/constants';
import { useAndroidLifecycle } from './platform/android';
import {
  loadAuthCredential,
  type AuthCredentialRecord,
} from './storage/auth';
import {
  applyMatchOutcome,
  loadSaveData,
  persistSaveData,
  resetAllSaveData,
} from './storage/db';
import type {
  AIDifficulty,
  GameMode,
  GameSettings,
  MatchFormat,
  MatchRecord,
  ModalType,
  PlayerProfile,
  PlayerSide,
  RoundSummary,
  SaveBundle,
  ScreenState,
} from './types/game';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [savedCredential, setSavedCredential] = useState<AuthCredentialRecord | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [saveData, setSaveData] = useState<SaveBundle>(DEFAULT_SAVE_BUNDLE);
  const [screen, setScreen] = useState<ScreenState>('TITLE');
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Match setup state
  const [gameMode, setGameMode] = useState<GameMode>('VS_CPU');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [format, setFormat] = useState<MatchFormat>('quick');
  const [p2LocalName, setP2LocalName] = useState('Player 2');

  // Active match & practice telemetry
  const [roundNumber, setRoundNumber] = useState(1);
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [practiceShots, setPracticeShots] = useState(0);
  const [practicePocketed, setPracticePocketed] = useState(0);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [matchWinner, setMatchWinner] = useState<PlayerSide>('p1');
  const [newlyUnlockedIds, setNewlyUnlockedIds] = useState<string[]>([]);
  const [statusBanner, setStatusBanner] = useState<{
    text: string;
    tone: 'neutral' | 'good' | 'queen' | 'foul';
  }>({
    text: 'Slide baseline or pull striker back to shoot',
    tone: 'neutral',
  });

  const [boardLive, setBoardLive] = useState<BoardLiveState>({
    activePlayer: 'p1',
    phase: 'AIMING',
    strikerX: BOARD_CENTER,
    positionClear: true,
    p1Remaining: 9,
    p2Remaining: 9,
    p1Due: 0,
    p2Due: 0,
    p1Penalties: 0,
    p2Penalties: 0,
    queenState: 'ON_BOARD',
    powerPercent: 0,
  });

  const matchStatsRef = useRef({
    coinsPocketed: 0,
    fouls: 0,
    bestTurn: 0,
    queenCoveredBy: undefined as PlayerSide | undefined,
  });

  const canvasHandleRef = useRef<CarromCanvasHandle | null>(null);

  useEffect(() => {
    let mounted = true;
    const hardTimeout = window.setTimeout(() => {
      if (mounted) {
        setAuthLoaded(true);
      }
    }, 650);

    Promise.all([loadSaveData(), loadAuthCredential()])
      .then(([loadedSave, loadedCred]) => {
        if (!mounted) return;
        window.clearTimeout(hardTimeout);
        setSaveData(loadedSave);
        soundEngine.applySettings(loadedSave.settings);
        setSavedCredential(loadedCred);
        setAuthLoaded(true);
      })
      .catch(() => {
        if (!mounted) return;
        window.clearTimeout(hardTimeout);
        setAuthLoaded(true);
      });
    const splashTimer = window.setTimeout(() => setShowSplash(false), 750);
    return () => {
      mounted = false;
      window.clearTimeout(hardTimeout);
      window.clearTimeout(splashTimer);
    };
  }, []);

  const currentTheme = useMemo(
    () =>
      BOARD_THEMES.find((b) => b.id === saveData.profile.selectedBoardId) ??
      BOARD_THEMES[0],
    [saveData.profile.selectedBoardId]
  );

  const currentStriker = useMemo(
    () =>
      STRIKER_STYLES.find((s) => s.id === saveData.profile.selectedStrikerId) ??
      STRIKER_STYLES[0],
    [saveData.profile.selectedStrikerId]
  );

  const currentCoinStyle = useMemo(
    () =>
      COIN_STYLES.find((c) => c.id === saveData.profile.selectedCoinStyleId) ??
      COIN_STYLES[0],
    [saveData.profile.selectedCoinStyleId]
  );

  const p1Name = saveData.profile.name.trim() || 'Player 1';
  const p2Name =
    gameMode === 'VS_CPU'
      ? `Computer (${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)})`
      : gameMode === 'PRACTICE'
      ? 'Practice'
      : p2LocalName.trim() || 'Player 2';

  const updateSaveBundle = useCallback((updater: (prev: SaveBundle) => SaveBundle) => {
    setSaveData((prev) => {
      const next = updater(prev);
      soundEngine.applySettings(next.settings);
      persistSaveData(next).catch(() => {});
      return next;
    });
  }, []);

  const handleUpdateProfile = useCallback(
    (patch: Partial<PlayerProfile>) => {
      updateSaveBundle((prev) => ({
        ...prev,
        profile: { ...prev.profile, ...patch },
      }));
    },
    [updateSaveBundle]
  );

  const handleUpdateSettings = useCallback(
    (patch: Partial<GameSettings>) => {
      updateSaveBundle((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
      }));
    },
    [updateSaveBundle]
  );

  const handleResetProgress = useCallback(() => {
    resetAllSaveData().then((fresh) => {
      setSaveData(fresh);
      soundEngine.applySettings(fresh.settings);
    });
  }, []);

  const launchMode = useCallback(
    (targetMode: GameMode, targetFormat: MatchFormat = format) => {
      setGameMode(targetMode);
      setFormat(targetFormat);
      setActiveModal(null);
      matchStatsRef.current = {
        coinsPocketed: 0,
        fouls: 0,
        bestTurn: 0,
        queenCoveredBy: undefined,
      };
      setRoundNumber(1);
      setP1Score(0);
      setP2Score(0);
      setPracticeShots(0);
      setPracticePocketed(0);
      setRoundSummary(null);
      setNewlyUnlockedIds([]);
      setStatusBanner({
        text:
          targetMode === 'PRACTICE'
            ? 'Practice Mode — pull striker back to take free shots'
            : `${p1Name} breaks first — pull striker back to shoot`,
        tone: 'neutral',
      });
      setScreen('PLAYING');
      window.setTimeout(() => {
        canvasHandleRef.current?.resetBoardForRound('p1');
      }, 0);
    },
    [format, p1Name]
  );

  const startNextRound = useCallback(() => {
    const nextRound = roundNumber + 1;
    const starter: PlayerSide = nextRound % 2 === 1 ? 'p1' : 'p2';
    setRoundNumber(nextRound);
    setRoundSummary(null);
    setStatusBanner({
      text: `Board ${nextRound}: ${starter === 'p1' ? p1Name : p2Name} breaks`,
      tone: 'neutral',
    });
    setScreen('PLAYING');
    window.setTimeout(() => {
      canvasHandleRef.current?.resetBoardForRound(starter);
    }, 0);
  }, [p1Name, p2Name, roundNumber]);

  const handleResetPracticeRack = useCallback(() => {
    soundEngine.playUiTick();
    setStatusBanner({
      text: 'Fresh 19-coin rack ready — line up your break shot',
      tone: 'neutral',
    });
    canvasHandleRef.current?.resetBoardForRound('p1');
  }, []);

  const handleTurnResolved = useCallback(
    (info: {
      nextPlayer: PlayerSide;
      message: string;
      tone: 'neutral' | 'good' | 'queen' | 'foul';
      p1CoinsPocketedByTurn: number;
      practiceCoinsPocketedByTurn: number;
      foulByP1: boolean;
      foulByP2: boolean;
      queenCoveredByP1: boolean;
      roundWinner: PlayerSide | null;
      roundReason?: string;
      p1Remaining: number;
      p2Remaining: number;
      p1Penalties: number;
      p2Penalties: number;
      queenState: 'ON_BOARD' | 'PENDING_P1' | 'PENDING_P2' | 'COVERED_P1' | 'COVERED_P2';
    }) => {
      setStatusBanner({ text: info.message, tone: info.tone });

      if (gameMode === 'PRACTICE') {
        setPracticeShots((s) => s + 1);
        if (info.practiceCoinsPocketedByTurn > 0) {
          setPracticePocketed((c) => c + info.practiceCoinsPocketedByTurn);
        }
        return;
      }

      if (info.p1CoinsPocketedByTurn > 0) {
        matchStatsRef.current.coinsPocketed += info.p1CoinsPocketedByTurn;
        matchStatsRef.current.bestTurn = Math.max(
          matchStatsRef.current.bestTurn,
          info.p1CoinsPocketedByTurn
        );
      }
      if (info.foulByP1) {
        matchStatsRef.current.fouls += 1;
      }
      if (info.queenCoveredByP1) {
        matchStatsRef.current.queenCoveredBy = 'p1';
      } else if (info.queenState === 'COVERED_P2') {
        matchStatsRef.current.queenCoveredBy = 'p2';
      }

      if (info.roundWinner) {
        const winner = info.roundWinner;
        const opponentCoinsLeft =
          winner === 'p1' ? info.p2Remaining : info.p1Remaining;
        const queenCoveredBy: PlayerSide | undefined =
          info.queenState === 'COVERED_P1'
            ? 'p1'
            : info.queenState === 'COVERED_P2'
            ? 'p2'
            : undefined;
        const queenBonus = queenCoveredBy === winner;
        const pointsAwarded = Math.max(1, opponentCoinsLeft + (queenBonus ? 3 : 0));

        const nextP1Score = p1Score + (winner === 'p1' ? pointsAwarded : 0);
        const nextP2Score = p2Score + (winner === 'p2' ? pointsAwarded : 0);
        setP1Score(nextP1Score);
        setP2Score(nextP2Score);

        const summary: RoundSummary = {
          roundNumber,
          winner,
          pointsAwarded,
          opponentCoinsLeft,
          queenBonus,
          queenCoveredBy,
          p1Pocketed: 9 - info.p1Remaining,
          p2Pocketed: 9 - info.p2Remaining,
          p1Remaining: info.p1Remaining,
          p2Remaining: info.p2Remaining,
          p1Penalties: info.p1Penalties,
          p2Penalties: info.p2Penalties,
          reason:
            info.roundReason ||
            `${winner === 'p1' ? p1Name : p2Name} cleared the board.`,
        };
        setRoundSummary(summary);

        const matchFinished =
          format === 'quick' ||
          nextP1Score >= CHAMPIONSHIP_TARGET_POINTS ||
          nextP2Score >= CHAMPIONSHIP_TARGET_POINTS;

        if (matchFinished) {
          const finalWinner: PlayerSide =
            format === 'quick'
              ? winner
              : nextP1Score >= nextP2Score
              ? 'p1'
              : 'p2';
          setMatchWinner(finalWinner);

          if (finalWinner === 'p1' || gameMode === 'PASS_AND_PLAY') {
            soundEngine.playWin();
          } else {
            soundEngine.playDefeat();
          }

          const record: MatchRecord = {
            id: `m_${Date.now()}`,
            timestamp: Date.now(),
            mode: gameMode,
            difficulty: gameMode === 'VS_CPU' ? difficulty : undefined,
            format,
            winner: finalWinner,
            p1Score: nextP1Score,
            p2Score: nextP2Score,
            roundsPlayed: roundNumber,
            queenCoveredBy: matchStatsRef.current.queenCoveredBy,
            p1Name,
            p2Name,
          };

          setSaveData((prev) => {
            const { nextBundle, newlyUnlocked } = applyMatchOutcome(prev, record, {
              coinsPocketed: matchStatsRef.current.coinsPocketed,
              queenCovered: matchStatsRef.current.queenCoveredBy === 'p1',
              fouls: matchStatsRef.current.fouls,
              bestTurn: matchStatsRef.current.bestTurn,
            });
            setNewlyUnlockedIds(newlyUnlocked);
            persistSaveData(nextBundle).catch(() => {});
            return nextBundle;
          });
          setScreen('MATCH_END');
        } else {
          soundEngine.playWin();
          setScreen('ROUND_END');
        }
      }
    },
    [difficulty, format, gameMode, p1Name, p1Score, p2Name, p2Score, roundNumber]
  );

  // Android Hardware Back Button + App Background Lifecycle
  const handleAndroidBack = useCallback(() => {
    if (showSplash) {
      setShowSplash(false);
      return true;
    }
    if (!isAuthenticated) {
      return false;
    }
    if (activeModal) {
      setActiveModal(null);
      return true;
    }
    if (screen === 'PLAYING') {
      setScreen('PAUSED');
      return true;
    }
    if (screen === 'PAUSED') {
      setScreen('PLAYING');
      return true;
    }
    if (screen === 'ROUND_END' || screen === 'MATCH_END') {
      setScreen('TITLE');
      return true;
    }
    return false;
  }, [activeModal, isAuthenticated, screen, showSplash]);

  const handleAndroidBackground = useCallback(() => {
    soundEngine.setAppActive(false);
    if (isAuthenticated && screen === 'PLAYING') {
      setScreen('PAUSED');
    }
  }, [isAuthenticated, screen]);

  const handleAndroidForeground = useCallback(() => {
    soundEngine.setAppActive(true);
  }, []);

  useAndroidLifecycle(handleAndroidBack, handleAndroidBackground, handleAndroidForeground);

  // Keyboard Pause shortcut (Escape / P)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isAuthenticated) return;
      if (e.key === 'Escape') {
        if (activeModal) {
          setActiveModal(null);
        } else if (screen === 'PLAYING') {
          setScreen('PAUSED');
        } else if (screen === 'PAUSED') {
          setScreen('PLAYING');
        }
      } else if ((e.key === 'p' || e.key === 'P') && !activeModal) {
        if (screen === 'PLAYING') setScreen('PAUSED');
        else if (screen === 'PAUSED') setScreen('PLAYING');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal, isAuthenticated, screen]);

  const rotatedForP2 =
    screen !== 'TITLE' &&
    gameMode === 'PASS_AND_PLAY' &&
    saveData.settings.autoFlipForP2 &&
    boardLive.activePlayer === 'p2';

  const isSimulationPaused = screen !== 'PLAYING' || activeModal !== null;
  const unlockedCount = Object.keys(saveData.unlockedAchievements).length;

  const handleAuthenticated = useCallback((credential: AuthCredentialRecord) => {
    setSavedCredential(credential);
    setIsAuthenticated(true);
  }, []);

  if (!authLoaded) {
    return (
      <div className="liquid-stage relative h-full w-full overflow-hidden text-[#f4f7ff]">
        <ColdLaunchSplash onDismiss={() => setShowSplash(false)} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="liquid-stage relative h-full w-full overflow-hidden text-[#f4f7ff]">
        <AuthScreen
          existingCredential={savedCredential}
          onAuthenticated={handleAuthenticated}
        />
        {showSplash && <ColdLaunchSplash onDismiss={() => setShowSplash(false)} />}
      </div>
    );
  }

  return (
    <div className="liquid-stage relative h-full w-full overflow-hidden text-[#f4f7ff]">
      {screen === 'TITLE' ? (
        <TitleScreen
          difficulty={difficulty}
          profile={saveData.profile}
          stats={saveData.stats}
          unlockedCount={unlockedCount}
          totalAchievements={ACHIEVEMENTS.length}
          theme={currentTheme}
          strikerStyle={currentStriker}
          coinStyle={currentCoinStyle}
          settings={saveData.settings}
          onQuickPlay={() => launchMode('VS_CPU', 'quick')}
          onStartPractice={() => launchMode('PRACTICE', 'quick')}
          onToggleSound={() =>
            handleUpdateSettings({ soundEnabled: !saveData.settings.soundEnabled })
          }
          onOpenModal={setActiveModal}
        />
      ) : (
        <main className="liquid-stage relative flex h-full w-full flex-col justify-between">
          {/* Top + Bottom HUD Layer */}
          <div className="pointer-events-none absolute inset-0 z-10">
            <GameHUD
              p1Name={p1Name}
              p1AvatarId={saveData.profile.avatarId}
              p2Name={p2Name}
              p1Score={p1Score}
              p2Score={p2Score}
              p1Remaining={boardLive.p1Remaining}
              p2Remaining={boardLive.p2Remaining}
              p1Due={boardLive.p1Due}
              p2Due={boardLive.p2Due}
              p1Penalties={boardLive.p1Penalties}
              p2Penalties={boardLive.p2Penalties}
              roundNumber={roundNumber}
              format={format}
              mode={gameMode}
              difficulty={difficulty}
              activePlayer={boardLive.activePlayer}
              phase={boardLive.phase}
              queenState={boardLive.queenState}
              strikerX={boardLive.strikerX}
              positionClear={boardLive.positionClear}
              powerPercent={boardLive.powerPercent}
              rotatedForP2={rotatedForP2}
              practiceShots={practiceShots}
              practicePocketed={practicePocketed}
              soundEnabled={saveData.settings.soundEnabled}
              statusBanner={statusBanner}
              onSlideStriker={(x) => canvasHandleRef.current?.setStrikerX(x)}
              onNudgeStriker={(dx) => canvasHandleRef.current?.nudgeStriker(dx)}
              onResetPracticeRack={handleResetPracticeRack}
              onToggleSound={() =>
                handleUpdateSettings({
                  soundEnabled: !saveData.settings.soundEnabled,
                })
              }
              onOpenSettings={() => {
                soundEngine.playUiTick();
                setActiveModal('SETTINGS');
              }}
              onPause={() => {
                soundEngine.playUiTick();
                setScreen('PAUSED');
              }}
            />
          </div>

          {/* Unobstructed Central Playfield Canvas */}
          <div className="flex flex-1 items-center justify-center px-2 pt-16 pb-20 sm:px-6 sm:pt-18 sm:pb-22">
            <div className="aspect-square w-full max-w-[min(95vw,73vh)]">
              <CarromCanvas
                ref={canvasHandleRef}
                isPaused={isSimulationPaused}
                gameMode={gameMode}
                difficulty={difficulty}
                p1Name={p1Name}
                p2Name={p2Name}
                theme={currentTheme}
                strikerStyle={currentStriker}
                coinStyle={currentCoinStyle}
                settings={saveData.settings}
                rotatedForP2={rotatedForP2}
                onStateChange={setBoardLive}
                onTurnResolved={handleTurnResolved}
              />
            </div>
          </div>
        </main>
      )}

      {/* Pause Modal */}
      {screen === 'PAUSED' && !activeModal && (
        <PauseModal
          onResume={() => setScreen('PLAYING')}
          onRestart={() => launchMode(gameMode, format)}
          onOpenRules={() => setActiveModal('RULES')}
          onOpenSettings={() => setActiveModal('SETTINGS')}
          onExitToTitle={() => setScreen('TITLE')}
        />
      )}

      {/* Round Summary / Match End Modal */}
      {(screen === 'ROUND_END' || screen === 'MATCH_END') && roundSummary && (
        <ResultModal
          isMatchOver={screen === 'MATCH_END'}
          format={format}
          roundSummary={roundSummary}
          p1Name={p1Name}
          p2Name={p2Name}
          p1Score={p1Score}
          p2Score={p2Score}
          matchWinner={matchWinner}
          newlyUnlockedIds={newlyUnlockedIds}
          onNextRound={startNextRound}
          onPlayAgain={() => launchMode(gameMode, format)}
          onExitToTitle={() => setScreen('TITLE')}
        />
      )}

      {/* Mode Setup Modals */}
      {activeModal === 'SETUP_CPU' && (
        <SetupCpuModal
          difficulty={difficulty}
          format={format}
          onChangeDifficulty={setDifficulty}
          onChangeFormat={setFormat}
          onStart={() => launchMode('VS_CPU', format)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'SETUP_2P' && (
        <SetupTwoPlayersModal
          p1Name={saveData.profile.name}
          p2Name={p2LocalName}
          format={format}
          autoFlip={saveData.settings.autoFlipForP2}
          onChangeP1Name={(name) => handleUpdateProfile({ name })}
          onChangeP2Name={setP2LocalName}
          onChangeFormat={setFormat}
          onToggleAutoFlip={(val) =>
            handleUpdateSettings({ autoFlipForP2: val })
          }
          onStart={() => launchMode('PASS_AND_PLAY', format)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Collection, Profile, Stats, Achievements, Rules & Settings Modals */}
      {activeModal === 'BOARD_COLLECTION' && (
        <BoardCollectionModal
          selectedBoardId={saveData.profile.selectedBoardId}
          selectedCoinStyleId={saveData.profile.selectedCoinStyleId}
          onSelectBoard={(id) => handleUpdateProfile({ selectedBoardId: id })}
          onSelectCoinStyle={(id) => handleUpdateProfile({ selectedCoinStyleId: id })}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'STRIKER_COLLECTION' && (
        <StrikerCollectionModal
          selectedStrikerId={saveData.profile.selectedStrikerId}
          onSelectStriker={(id) => handleUpdateProfile({ selectedStrikerId: id })}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'PROFILE' && (
        <ProfileModal
          profile={saveData.profile}
          stats={saveData.stats}
          unlockedCount={unlockedCount}
          onUpdateProfile={handleUpdateProfile}
          onOpenStatistics={() => setActiveModal('STATISTICS')}
          onOpenAchievements={() => setActiveModal('ACHIEVEMENTS')}
          onResetProgress={handleResetProgress}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'STATISTICS' && (
        <StatisticsModal
          stats={saveData.stats}
          history={saveData.history}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'ACHIEVEMENTS' && (
        <AchievementsModal
          stats={saveData.stats}
          unlockedAchievements={saveData.unlockedAchievements}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'RULES' && (
        <RulesModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'SETTINGS' && (
        <SettingsModal
          settings={saveData.settings}
          onUpdateSettings={handleUpdateSettings}
          onOpenRules={() => setActiveModal('RULES')}
          onResetProgress={handleResetProgress}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Cold-Launch Splash Screen */}
      {showSplash && <ColdLaunchSplash onDismiss={() => setShowSplash(false)} />}
    </div>
  );
}
