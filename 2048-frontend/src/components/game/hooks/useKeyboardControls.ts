import { useEffect, useCallback } from 'react';
import { Direction } from '../../../types';

interface KeyboardControlsParams {
  onMove: (direction: Direction) => void;
  onLeave?: () => void;
  onRedeposit?: () => void;
  enabled: boolean;
}

const KEY_MAPPINGS: Record<string, Direction> = {
  'ArrowUp': Direction.UP,
  'ArrowDown': Direction.DOWN,
  'ArrowLeft': Direction.LEFT,
  'ArrowRight': Direction.RIGHT,
  'w': Direction.UP,
  'W': Direction.UP,
  's': Direction.DOWN,
  'S': Direction.DOWN,
  'a': Direction.LEFT,
  'A': Direction.LEFT,
  'd': Direction.RIGHT,
  'D': Direction.RIGHT,
};

export function useKeyboardControls({
  onMove,
  onLeave,
  onRedeposit,
  enabled
}: KeyboardControlsParams) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Handle ESC key for leaving game
    if (event.key === 'Escape' && onLeave) {
      event.preventDefault();
      onLeave();
      return;
    }

    // Handle R key for redeposit
    if ((event.key === 'r' || event.key === 'R') && onRedeposit) {
      event.preventDefault();
      onRedeposit();
      return;
    }

    const direction = KEY_MAPPINGS[event.key];
    if (direction !== undefined) {
      event.preventDefault();
      onMove(direction);
    }
  }, [onMove, onLeave, onRedeposit, enabled]);

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown, enabled]);

  return {
    isEnabled: enabled
  };
}

export default useKeyboardControls;