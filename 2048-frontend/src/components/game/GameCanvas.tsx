import React, { useState, useEffect, useRef } from 'react';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import { PlayerState } from '../../types';

interface GameCanvasProps {
  allPlayers: PlayerState[];
  currentPlayerAddress: string;
  optimisticPosition: { x: number; y: number } | null;
  queuedMoves: Array<{ predictedPosition: { x: number; y: number } }>;
  contractBoardWidth: number;
  contractBoardHeight: number;
}

export function GameCanvas({
  allPlayers,
  currentPlayerAddress,
  optimisticPosition,
  queuedMoves,
  contractBoardWidth,
  contractBoardHeight
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 800 });

  // Calculate responsive canvas size based on container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Use the smaller dimension to maintain square aspect ratio
        // Leave some padding (16px * 2 = 32px)
        const size = Math.min(containerWidth, containerHeight) - 32;

        // Minimum size for usability, maximum for performance
        const clampedSize = Math.max(300, Math.min(size, 1200));

        setCanvasSize({ width: clampedSize, height: clampedSize });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const canvasRef = useCanvasRenderer({
    allPlayers,
    currentPlayerAddress,
    optimisticPosition,
    queuedMoves,
    contractBoardWidth,
    contractBoardHeight,
    canvasWidth: canvasSize.width,
    canvasHeight: canvasSize.height
  });

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="border-2 border-gray-800 rounded-lg shadow-lg"
          style={{
            imageRendering: 'crisp-edges',
            background: 'linear-gradient(to bottom right, #f9fafb, #e5e7eb)',
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        />

        {/* Game overlay information */}
        <div className="absolute top-2 left-2 bg-white/90 rounded px-2 py-1 text-xs">
          Players: {allPlayers.length}
        </div>

        {queuedMoves.length > 0 && (
          <div className="absolute top-2 right-2 bg-yellow-100/90 rounded px-2 py-1 text-xs">
            Pending moves: {queuedMoves.length}
          </div>
        )}
      </div>
    </div>
  );
}

export default GameCanvas;