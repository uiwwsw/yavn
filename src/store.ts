import { create } from 'zustand';
import type { CharacterSlot, GameData, Position, VNError } from './types';

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
  currentSceneId: string;
  actionIndex: number;
  background?: string;
  foregroundBg?: string;
  characters: Partial<Record<Position, CharacterSlot>>;
  currentMusic?: string;
  dialog: DialogState;
  effect?: string;
  busy: boolean;
  waitingInput: boolean;
  isFinished: boolean;
  setError: (error?: VNError) => void;
  setGame: (game: GameData, baseUrl: string, assetOverrides?: Record<string, string>) => void;
  setCursor: (sceneId: string, actionIndex: number) => void;
  setBackground: (url: string) => void;
  setForegroundBg: (url?: string) => void;
  setCharacter: (position: Position, slot: CharacterSlot) => void;
  setMusic: (url?: string) => void;
  setDialog: (dialog: Partial<DialogState>) => void;
  setEffect: (effect?: string) => void;
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

export const useVNStore = create<VNState>((set) => ({
  baseUrl: '/',
  assetOverrides: {},
  currentSceneId: '',
  actionIndex: 0,
  characters: {},
  dialog: initialDialog,
  busy: false,
  waitingInput: false,
  isFinished: false,
  setError: (error) => set({ error }),
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
      effect: undefined,
      busy: false,
      waitingInput: false,
      isFinished: false,
    }),
}));
