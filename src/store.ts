import { create } from 'zustand';
import type { CharacterSlot, GameData, Position, VNError, VideoCutsceneState } from './types';

type DialogState = {
  speaker?: string;
  fullText: string;
  visibleText: string;
  typing: boolean;
};

type VNState = {
  game?: GameData;
  baseUrl: string;
  assetOverrides: Record<string, string>;
  error?: VNError;
  chapterIndex: number;
  chapterTotal: number;
  chapterLoading: boolean;
  chapterLoadingProgress: number;
  chapterLoadingMessage?: string;
  currentSceneId: string;
  actionIndex: number;
  background?: string;
  foregroundBg?: string;
  characters: Partial<Record<Position, CharacterSlot>>;
  currentMusic?: string;
  dialog: DialogState;
  effect?: string;
  videoCutscene: VideoCutsceneState;
  busy: boolean;
  waitingInput: boolean;
  isFinished: boolean;
  setError: (error?: VNError) => void;
  setChapterMeta: (index: number, total: number) => void;
  setChapterLoading: (loading: boolean, progress?: number, message?: string) => void;
  setGame: (game: GameData, baseUrl: string, assetOverrides?: Record<string, string>) => void;
  setCursor: (sceneId: string, actionIndex: number) => void;
  setBackground: (url: string) => void;
  setForegroundBg: (url?: string) => void;
  setCharacter: (position: Position, slot: CharacterSlot) => void;
  setMusic: (url?: string) => void;
  setDialog: (dialog: Partial<DialogState>) => void;
  setEffect: (effect?: string) => void;
  setVideoCutscene: (video: Partial<VideoCutsceneState>) => void;
  clearVideoCutscene: () => void;
  setBusy: (busy: boolean) => void;
  setWaitingInput: (waiting: boolean) => void;
  setFinished: (finished: boolean) => void;
  resetPresentation: () => void;
};

const initialDialog: DialogState = {
  speaker: undefined,
  fullText: '',
  visibleText: '',
  typing: false,
};

const initialVideoCutscene: VideoCutsceneState = {
  active: false,
  src: undefined,
  youtubeId: undefined,
  holdToSkipMs: 800,
  guideVisible: false,
  skipProgress: 0,
};

export const useVNStore = create<VNState>((set) => ({
  baseUrl: '/',
  assetOverrides: {},
  chapterIndex: 0,
  chapterTotal: 0,
  chapterLoading: false,
  chapterLoadingProgress: 0,
  chapterLoadingMessage: undefined,
  currentSceneId: '',
  actionIndex: 0,
  characters: {},
  dialog: initialDialog,
  videoCutscene: initialVideoCutscene,
  busy: false,
  waitingInput: false,
  isFinished: false,
  setError: (error) => set({ error }),
  setChapterMeta: (chapterIndex, chapterTotal) => set({ chapterIndex, chapterTotal }),
  setChapterLoading: (chapterLoading, chapterLoadingProgress = 0, chapterLoadingMessage) =>
    set({ chapterLoading, chapterLoadingProgress, chapterLoadingMessage }),
  setGame: (game, baseUrl, assetOverrides = {}) =>
    set({
      game,
      baseUrl,
      assetOverrides,
      error: undefined,
      currentSceneId: game.script[0].scene,
      actionIndex: 0,
      background: undefined,
      foregroundBg: undefined,
      characters: {},
      currentMusic: undefined,
      dialog: initialDialog,
      videoCutscene: initialVideoCutscene,
      effect: undefined,
      busy: false,
      waitingInput: false,
      isFinished: false,
    }),
  setCursor: (sceneId, actionIndex) => set({ currentSceneId: sceneId, actionIndex }),
  setBackground: (url) => set({ background: url }),
  setForegroundBg: (foregroundBg) => set({ foregroundBg }),
  setCharacter: (position, slot) =>
    set((state) => ({ characters: { ...state.characters, [position]: slot } })),
  setMusic: (url) => set({ currentMusic: url }),
  setDialog: (dialog) => set((state) => ({ dialog: { ...state.dialog, ...dialog } })),
  setEffect: (effect) => set({ effect }),
  setVideoCutscene: (video) => set((state) => ({ videoCutscene: { ...state.videoCutscene, ...video } })),
  clearVideoCutscene: () => set({ videoCutscene: initialVideoCutscene }),
  setBusy: (busy) => set({ busy }),
  setWaitingInput: (waitingInput) => set({ waitingInput }),
  setFinished: (isFinished) => set({ isFinished }),
  resetPresentation: () =>
    set({
      background: undefined,
      foregroundBg: undefined,
      characters: {},
      currentMusic: undefined,
      dialog: initialDialog,
      videoCutscene: initialVideoCutscene,
      effect: undefined,
      busy: false,
      waitingInput: false,
      isFinished: false,
      chapterLoading: false,
      chapterLoadingProgress: 0,
      chapterLoadingMessage: undefined,
    }),
}));
