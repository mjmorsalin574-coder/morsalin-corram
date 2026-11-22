export type ScreenState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'ROUND_END' | 'MATCH_END';

export type GameMode = 'VS_CPU' | 'PASS_AND_PLAY' | 'PRACTICE';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export type MatchFormat = 'quick' | 'championship';

export type PlayerSide = 'p1' | 'p2';

export type CoinType = 'white' | 'black' | 'queen' | 'striker';

export type QueenState =
  | 'ON_BOARD'
  | 'PENDING_P1'
  | 'PENDING_P2'
  | 'COVERED_P1'
  | 'COVERED_P2';

export type AimGuideMode = 'full' | 'short' | 'off';

export type GraphicsQuality = 'high' | 'balanced';

export type ModalType =
  | null
  | 'SETUP_CPU'
  | 'SETUP_2P'
  | 'BOARD_COLLECTION'
  | 'STRIKER_COLLECTION'
  | 'PROFILE'
  | 'STATISTICS'
  | 'ACHIEVEMENTS'
  | 'RULES'
  | 'SETTINGS';

export interface BoardTheme {
  id: string;
  name: string;
  category: string;
  subtitle: string;
  frameOuter: string;
  frameInner: string;
  frameHighlight: string;
  surfaceBase: string;
  surfaceGrain: string;
  surfaceVignette: string;
  inlayGold: string;
  lineInk: string;
  lineAccent: string;
  pocketHole: string;
  pocketRim: string;
  unlockRequirement?: string;
}

export interface StrikerStyle {
  id: string;
  name: string;
  category: string;
  subtitle: string;
  bodyColor: string;
  rimColor: string;
  accentColor: string;
  coreColor: string;
  pattern: 'rings' | 'compass' | 'lotus' | 'star' | 'chevron';
}

export interface CoinStyle {
  id: string;
  name: string;
  subtitle: string;
  whiteColors: [string, string, string];
  whiteStroke: string;
  whiteRidge: string;
  blackColors: [string, string, string];
  blackStroke: string;
  blackRidge: string;
  queenColors: [string, string, string];
  queenStroke: string;
  queenRidge: string;
  queenGem: string;
}

export interface GameSettings {
  soundEnabled: boolean;
  soundVolume: number; // 0 to 1
  musicEnabled: boolean;
  musicVolume: number; // 0 to 1
  hapticsEnabled: boolean;
  aimGuide: AimGuideMode;
  autoFlipForP2: boolean;
  powderFx: boolean;
  graphicsQuality: GraphicsQuality;
}

export interface PlayerProfile {
  name: string;
  avatarId: string;
  selectedBoardId: string;
  selectedStrikerId: string;
  selectedCoinStyleId: string;
}

export interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  totalCoinsPocketed: number;
  queensCovered: number;
  totalFouls: number;
  bestTurnPocketed: number;
  hardAiWins: number;
  localMatchesPlayed: number;
  championshipWins: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  target: number;
  statKey: keyof PlayerStats;
}

export interface MatchRecord {
  id: string;
  timestamp: number;
  mode: GameMode;
  difficulty?: AIDifficulty;
  format: MatchFormat;
  winner: PlayerSide;
  p1Score: number;
  p2Score: number;
  roundsPlayed: number;
  queenCoveredBy?: PlayerSide;
  p1Name: string;
  p2Name: string;
}

export interface SaveBundle {
  profile: PlayerProfile;
  stats: PlayerStats;
  settings: GameSettings;
  unlockedAchievements: Record<string, number>; // id -> unlock timestamp
  history: MatchRecord[];
}

export interface CoinSnapshot {
  id: string;
  type: Exclude<CoinType, 'striker'>;
  x: number;
  y: number;
}

export interface TurnOutcome {
  nextPlayer: PlayerSide;
  keepTurn: boolean;
  queenState: QueenState;
  p1PocketedDelta: number;
  p2PocketedDelta: number;
  p1DueAfter: number;
  p2DueAfter: number;
  foulCommitted: boolean;
  incorrectPocketCount: number;
  message: string;
  tone: 'neutral' | 'good' | 'queen' | 'foul';
  coinsToReturn: Array<{ type: 'white' | 'black' | 'queen' }>;
  roundWinner: PlayerSide | null;
  roundReason?: string;
}

export interface RoundSummary {
  roundNumber: number;
  winner: PlayerSide;
  pointsAwarded: number;
  opponentCoinsLeft: number;
  queenBonus: boolean;
  queenCoveredBy?: PlayerSide;
  p1Pocketed: number;
  p2Pocketed: number;
  p1Remaining: number;
  p2Remaining: number;
  p1Penalties: number;
  p2Penalties: number;
  reason: string;
}
