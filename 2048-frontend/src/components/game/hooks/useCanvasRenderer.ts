import { useEffect, useRef, useCallback } from 'react';
import { getRadius } from '../../../utils/game';
import { DEFAULT_BOARD_WIDTH, DEFAULT_BOARD_HEIGHT, PLAYER_COLORS } from '../../../constants';
import { PlayerState } from '../../../types';

interface CanvasRendererParams {
  allPlayers: PlayerState[];
  currentPlayerAddress: string;
  optimisticPosition: { x: number; y: number } | null;
  queuedMoves: Array<{ predictedPosition: { x: number; y: number } }>;
  contractBoardWidth: number;
  contractBoardHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function useCanvasRenderer({
  allPlayers,
  currentPlayerAddress,
  optimisticPosition,
  queuedMoves,
  contractBoardWidth,
  contractBoardHeight,
  canvasWidth,
  canvasHeight
}: CanvasRendererParams) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // Calculate scale factors using dynamic canvas dimensions
  const scaleX = canvasWidth / contractBoardWidth;
  const scaleY = canvasHeight / contractBoardHeight;
  const scaleR = (scaleX + scaleY) / 2;

  const drawPlayer = useCallback((
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    isCurrentPlayer: boolean,
    isPending: boolean = false
  ) => {
    const x = Number(player.x) * scaleX;
    const y = Number(player.y) * scaleY;
    const radius = getRadius(player.monAmount) * scaleR;

    // Draw player circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);

    if (isPending) {
      // Dashed line for pending moves
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = PLAYER_COLORS.CURRENT_PLAYER_BORDER;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Regular player rendering
      ctx.fillStyle = isCurrentPlayer
        ? PLAYER_COLORS.CURRENT_PLAYER
        : PLAYER_COLORS.OTHER_PLAYER;
      ctx.fill();

      if (isCurrentPlayer) {
        ctx.strokeStyle = PLAYER_COLORS.CURRENT_PLAYER_BORDER;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // Draw player label
    ctx.fillStyle = '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const monAmount = Number(player.monAmount) / 1e18;
    const label = `${player.address.slice(0, 6)}... (${monAmount.toFixed(2)} MON)`;
    ctx.fillText(label, x, y);
  }, [scaleX, scaleY, scaleR]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw background grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    const gridSize = 50;

    for (let x = 0; x <= canvasWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    for (let y = 0; y <= canvasHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    // Draw all players (including current player's CONFIRMED state as solid circle)
    for (const player of allPlayers) {
      const isCurrentPlayer = player.address.toLowerCase() === currentPlayerAddress;
      drawPlayer(ctx, player, isCurrentPlayer, false); // Always draw solid circle for confirmed state
    }

    // Draw optimistic position for current player as DASHED CIRCLE (on top of solid circle)
    if (optimisticPosition) {
      const currentPlayer = allPlayers.find(
        p => p.address.toLowerCase() === currentPlayerAddress
      );

      if (currentPlayer) {
        const optimisticPlayer = {
          ...currentPlayer,
          x: BigInt(optimisticPosition.x),
          y: BigInt(optimisticPosition.y)
        };
        drawPlayer(ctx, optimisticPlayer, true, true); // isPending: true for dashed rendering
      }
    }

    // NOTE: queuedMoves are now handled by the optimisticPosition calculation
    // No need to draw individual queued moves since optimisticPosition is the final result
    // of confirmed_position + all_pending_moves

    // Draw border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

  }, [allPlayers, currentPlayerAddress, optimisticPosition, queuedMoves, drawPlayer, canvasWidth, canvasHeight]);

  // Debug: Log when canvas re-renders due to player changes
  useEffect(() => {
    console.log(`🎨 Canvas re-rendering: ${allPlayers.length} players`, 
      allPlayers.map(p => ({ 
        addr: p.address.slice(0,6), 
        pos: `(${Number(p.x)}, ${Number(p.y)})`,
        size: p.monAmount.toString()
      }))
    );
  }, [allPlayers]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  return canvasRef;
}

export default useCanvasRenderer;