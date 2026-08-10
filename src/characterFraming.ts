import type {
  CharacterAssetDefinition,
  CharacterFramingState,
} from './types';

const FALLBACK_FRAMING_NAME = 'full';

export function resolveCharacterFraming(
  character: CharacterAssetDefinition,
  requestedFraming?: string,
): CharacterFramingState {
  const name = requestedFraming ?? character.defaultFraming ?? FALLBACK_FRAMING_NAME;
  const preset = character.framings?.[name];

  return {
    name,
    scale: preset?.scale ?? 1,
    x: preset?.x ?? 0,
    y: preset?.y ?? 0,
  };
}
