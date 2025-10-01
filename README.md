# Agar.gg - On-Chain Multiplayer Game

An Agar-style multiplayer game built entirely on-chain, deployed on Monad testnet. Play live at **[agar.gg](https://agar.gg)**

## Game Rules

Agar.gg is a real-time multiplayer game where players control cells in a competitive arena:

- **Enter the Game**: Deposit MON tokens to spawn as a player cell in the game arena (20000x20000 world)
- **Move Around**: Control your cell using WASD or arrow keys to navigate the arena
- **Grow by Eating**: Collide with smaller players to absorb them and grow larger
- **Size Matters**: Your cell's radius is determined by your MON balance: `radius = sqrt(monAmount / π) * 10`
- **Speed vs Size**: Larger cells move slower - velocity is inversely proportional to your size
- **Survive**: Avoid larger players or risk being absorbed and losing your tokens
- **Cash Out**: Leave the game at any time to withdraw your accumulated MON tokens

## How to Play

1. Visit **[agar.gg](https://agar.gg)**
2. Connect your wallet (Privy integration for easy onboarding)
3. Get testnet MON tokens from the faucet
4. Enter the game by depositing MON tokens
5. Use WASD or arrow keys to move your cell
6. Eat smaller players to grow, avoid larger ones
7. Leave the game to cash out your winnings

## Features

- **Fully On-Chain**: All game logic and state stored on Monad blockchain
- **Real-Time Gameplay**: Fast block times enable smooth multiplayer experience
- **Optimistic Updates**: Instant UI feedback for responsive gameplay
- **Collision Detection**: On-chain collision detection with automatic fund transfers
- **WebSocket Sync**: Real-time game state synchronization across all clients

## Project Structure

```
├── 2048-contracts/     # Solidity smart contracts (Foundry project)
│   ├── src/           # Game contracts (AgarGame.sol)
│   ├── script/        # Deployment scripts
│   └── test/          # Contract tests
│
└── 2048-frontend/     # React + Vite frontend
    ├── src/           # Frontend source code
    ├── backend/       # Node.js WebSocket server & RPC proxy
    └── public/        # Static assets
```

## Development

### Smart Contracts

Built with [Foundry](https://book.getfoundry.sh/):

```bash
cd 2048-contracts
forge install        # Install dependencies
forge build         # Compile contracts
forge test          # Run tests
```

See [`2048-contracts/README.md`](2048-contracts/README.md) for deployment details.

### Frontend

Built with React, Vite, and Privy:

```bash
cd 2048-frontend
bun install         # Install dependencies
bun run dev        # Start dev server (port 5173)
```

### Backend Server

WebSocket server for real-time game state sync:

```bash
cd 2048-frontend
npm start          # Start backend (port 3001)
```

## Environment Setup

Copy the example env files and fill in your values:

- `2048-contracts/.env.example` → `.env`
- `2048-frontend/.env.local.example` → `.env.local`

Required environment variables:
- `VITE_PRIVY_APP_ID`: Your Privy app ID
- `ALCHEMY_API_KEY`: Alchemy API key for Monad RPC
- `DEPLOYER_PRIVATE_KEY`: Private key for contract deployment

## Technology Stack

- **Smart Contracts**: Solidity, Foundry
- **Blockchain**: Monad Testnet (Chain ID: 10143)
- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Wallet**: Privy (embedded wallets)
- **Backend**: Node.js, Express, WebSocket
- **State Management**: Valtio (optimistic updates)

## License

MIT
