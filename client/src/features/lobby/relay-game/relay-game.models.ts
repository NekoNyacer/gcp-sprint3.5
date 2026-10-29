import type { PointGroup } from 'signature_pad';

export const RELAY_GAME_CODE = '004' as const;

export type RelayMode = 'activity' | 'tabletop';
export type RelayRoomStatus = '遊戲準備中' | '遊戲進行中' | '等待揭露' | '公開揭露' | '遊戲結束';
export type RelayGroupStatus = 'waiting' | 'playing' | 'completed';
export type RelayPageKind = 'drawing' | 'guess' | 'skipped';

export type RelayPoint = {
  x: number;
  y: number;
  pressure: number;
  time: number;
};

export type RelayStroke = Omit<PointGroup, 'points'> & {
  points: RelayPoint[];
};

export type RelayPlayer = {
  uid: string;
  displayName: string;
  avatarSeed: string;
  avatarUrl: string;
  joinedAt: number;
};

export type RelayGroupSummary = {
  id: string;
  name: string;
  playerCount: number;
  status: RelayGroupStatus;
};

export type RelayRoom = {
  gameCode: typeof RELAY_GAME_CODE;
  seq: string;
  name: string;
  roomMasterId: string;
  status: RelayRoomStatus;
  mode: RelayMode;
  /** When true, the room owner controls the game but is not a player. */
  hostMode: boolean;
  drawingSeconds: number;
  guessingSeconds: number;
  isPaused: boolean;
  groups: RelayGroupSummary[];
  players: RelayPlayer[];
  createdAt: number;
};

export type RelayGroup = {
  id: string;
  name: string;
  status: RelayGroupStatus;
  players: RelayPlayer[];
  turnOrder: string[];
  topic: string;
  topicsByBook: Record<string, string>;
  currentTurnIndex: number;
  currentRoundIndex: number;
  roundSubmissions: string[];
  turnEndsAt: number | null;
  remainingMs: number | null;
  forcedEnd: boolean;
  updatedAt: number;
};

export type RelayPage = {
  id: string;
  groupId: string;
  bookId: string;
  pageIndex: number;
  playerUid: string;
  playerName: string;
  playerAvatarSeed: string;
  kind: RelayPageKind;
  strokes: RelayStroke[];
  submittedAt: number;
};

export const relayInitialState: RelayRoom = {
  gameCode: RELAY_GAME_CODE,
  seq: '',
  name: '',
  roomMasterId: '',
  status: '遊戲準備中',
  mode: 'activity',
  hostMode: true,
  drawingSeconds: 0,
  guessingSeconds: 0,
  isPaused: false,
  groups: [],
  players: [],
  createdAt: 0,
};

/**
 * 傳情畫意題庫：單一常見物品名詞。
 *
 * 題目要能用幾個輪廓與關鍵特徵畫出，但不能像水果或汽車一樣一眼猜中；
 * 因此避免人物、動作、地點、故事情境與需要大量細節的物件。
 */
export const RELAY_TOPICS = [
  '雨傘',
  '眼鏡',
  '手錶',
  '鬧鐘',
  '鑰匙圈',
  '錢包',
  '書包',
  '耳機',
  '遙控器',
  '手電筒',
  '相機',
  '望遠鏡',
  '放大鏡',
  '指南針',
  '溫度計',
  '捲尺',
  '計算機',
  '訂書機',
  '打孔機',
  '迴紋針',
  '長尾夾',
  '膠帶台',
  '自動鉛筆',
  '螢光筆',
  '調色盤',
  '畫框',
  '衣架',
  '髮夾',
  '髮圈',
  '領帶',
  '安全帽',
  '口罩',
  '便當盒',
  '水壺',
  '保溫瓶',
  '量杯',
  '湯鍋',
  '平底鍋',
  '鍋鏟',
  '打蛋器',
  '開瓶器',
  '胡椒罐',
  '砧板',
  '濾網',
  '漏斗',
  '吹風機',
  '吸塵器',
  '電風扇',
  '檯燈',
  '延長線',
  '插座',
  '印表機',
  '鍵盤',
  '麥克風',
  '喇叭',
  '手機架',
  '充電器',
  '門鈴',
  '花瓶',
  '摺疊椅',
  '書架',
  '信箱',
  '鳥籠',
  '魚缸',
  '花盆',
  '羽球拍',
  '輪椅',
  '行李箱',
  '口紅',
  '香水瓶',
  '雨鞋',
  '圍巾',
] as const;
