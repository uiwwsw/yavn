import type { KeyboardEvent } from 'react';
import type { DialogueChannel } from './types';

export function resolveReadingPerspective({ channel, choiceActive, playerName, playerCharacterId, speaker, speakerId }: {
  channel: DialogueChannel;
  choiceActive: boolean;
  playerName?: string;
  playerCharacterId?: string;
  speaker?: string;
  speakerId?: string;
}): 'player' | 'other' | undefined {
  if (channel === 'message' || channel === 'card') return undefined;
  if (choiceActive) return 'player';
  const identifiedPlayer = Boolean(playerName && playerName !== '???');
  if (channel === 'thought' && identifiedPlayer && !speaker) return 'player';
  if (channel !== 'dialogue' && channel !== 'thought') return undefined;
  if (!speaker || speaker === '???') return undefined;
  return identifiedPlayer && (speaker === playerName || Boolean(playerCharacterId && playerCharacterId === speakerId))
    ? 'player' : 'other';
}

export function resolveTabDestination(key: string, index: number, count: number): number | undefined {
  if (count < 1) return undefined;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count;
  return undefined;
}

export function navigateGameTabs(event: KeyboardEvent<HTMLElement>): void {
  const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const destination = resolveTabDestination(event.key, tabs.indexOf(event.target as HTMLButtonElement), tabs.length);
  if (destination === undefined) return;
  event.preventDefault();
  event.stopPropagation();
  tabs[destination]?.focus();
  tabs[destination]?.click();
}

export function trapGameDialogFocus(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Tab' || (event.target as Element).closest('[role="dialog"]') !== event.currentTarget) return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), [tabindex="0"]',
  )].filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (!first || !last) return;
  if ((!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first)) {
    event.preventDefault();
    event.stopPropagation();
    (event.shiftKey ? last : first).focus();
  }
}
