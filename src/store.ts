import { create } from 'zustand';
import type { CharacterSlot, GameData, InputGateState, Position, StickerSlot, VNError, VideoCutsceneState } from './types';

type DialogState = {
  speaker?: string;
  speakerId?: string;
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
  stickers: Record<string, StickerSlot>;
  characters: Partial<Record<Position, CharacterSlot>>;
  speakerOrder: string[];
  visibleCharacterIds: string[];
  currentMusic?: string;
  dialog: DialogState;
  effect?: string;
  videoCutscene: VideoCutsceneState;
  inputGate: InputGateState;
  busy: boolean;
  waitingInput: boolean;
  isFinished: boolean;
  setError: (error?: VNError) => void;
  setChapterMeta: (index: number, total: number) => void;
  setChapterLoading: (loading: boolean, progress?: number, message?: string) => void;
  setGame: (game: GameData, baseUrl: string, assetOverrides?: Record<string, string>) => void;
  setCursor: (sceneId: string, actionIndex: number) => void;
  setBackground: (url: string) => void;
  setSticker: (sticker: StickerSlot) => void;
  clearSticker: (id: string) => void;
  clearAllStickers: () => void;
  setCharacter: (position: Position, slot: CharacterSlot) => void;
  promoteSpeaker: (speakerId?: string) => void;
  setVisibleCharacters: (ids: string[]) => void;
  setMusic: (url?: string) => void;
  setDialog: (dialog: Partial<DialogState>) => void;
  setEffect: (effect?: string) => void;
  setVideoCutscene: (video: Partial<VideoCutsceneState>) => void;
  clearVideoCutscene: () => void;
  setInputGate: (inputGate: Partial<InputGateState>) => void;
  clearInputGate: () => void;
  setBusy: (busy: boolean) => void;
  setWaitingInput: (waiting: boolean) => void;
  setFinished: (finished: boolean) => void;
  resetPresentation: () => void;
};

const initialDialog: DialogState = {
  speaker: undefined,
  speakerId: undefined,
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

const initialInputGate: InputGateState = {
  active: false,
  correct: '',
  errors: [],
  attemptCount: 0,
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
  stickers: {},
  characters: {},
  speakerOrder: [],
  visibleCharacterIds: [],
  dialog: initialDialog,
  videoCutscene: initialVideoCutscene,
  inputGate: initialInputGate,
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
      stickers: {},
      characters: {},
      speakerOrder: [],
      visibleCharacterIds: [],
      currentMusic: undefined,
      dialog: initialDialog,
      videoCutscene: initialVideoCutscene,
      inputGate: initialInputGate,
      effect: undefined,
      busy: false,
      waitingInput: false,
      isFinished: false,
    }),
  setCursor: (sceneId, actionIndex) => set({ currentSceneId: sceneId, actionIndex }),
  setBackground: (url) => set({ background: url }),
  setSticker: (sticker) =>
    set((state) => ({
      stickers: {
        ...state.stickers,
        [sticker.id]: sticker,
      },
    })),
  clearSticker: (id) =>
    set((state) => {
      if (!(id in state.stickers)) {
        return state;
      }
      const next = { ...state.stickers };
      delete next[id];
      return { stickers: next };
    }),
  clearAllStickers: () => set({ stickers: {} }),
  setCharacter: (position, slot) =>
    set((state) => ({ characters: { ...state.characters, [position]: slot } })),
  promoteSpeaker: (speakerId) =>
    set((state) => {
      if (!speakerId) {
        return state;
      }
      const next = state.speakerOrder.filter((id) => id !== speakerId);
      next.unshift(speakerId);
      return { speakerOrder: next };
    }),
  setVisibleCharacters: (ids) => {
    const unique = Array.from(
      new Set(
        ids
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      ),
    );
    set({ visibleCharacterIds: unique });
  },
  setMusic: (url) => set({ currentMusic: url }),
  setDialog: (dialog) => set((state) => ({ dialog: { ...state.dialog, ...dialog } })),
  setEffect: (effect) => set({ effect }),
  setVideoCutscene: (video) => set((state) => ({ videoCutscene: { ...state.videoCutscene, ...video } })),
  clearVideoCutscene: () => set({ videoCutscene: initialVideoCutscene }),
  setInputGate: (inputGate) => set((state) => ({ inputGate: { ...state.inputGate, ...inputGate } })),
  clearInputGate: () => set({ inputGate: initialInputGate }),
  setBusy: (busy) => set({ busy }),
  setWaitingInput: (waitingInput) => set({ waitingInput }),
  setFinished: (isFinished) => set({ isFinished }),
  resetPresentation: () =>
    set({
      background: undefined,
      stickers: {},
      characters: {},
      speakerOrder: [],
      visibleCharacterIds: [],
      currentMusic: undefined,
      dialog: initialDialog,
      videoCutscene: initialVideoCutscene,
      inputGate: initialInputGate,
      effect: undefined,
      busy: false,
      waitingInput: false,
      isFinished: false,
      chapterLoading: false,
      chapterLoadingProgress: 0,
      chapterLoadingMessage: undefined,
    }),
}));
