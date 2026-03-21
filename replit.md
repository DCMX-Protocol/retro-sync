# Retrosync Media Group — Enterprise Platform

## Project Overview
A decentralized media distribution and royalty management platform for the music industry. Features peer-to-peer music distribution with zero-knowledge royalty verification built on the BTTC (BitTorrent Chain) blockchain.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Shadcn UI (in `apps/web-client/`)
- **Backend**: Rust/Axum API server (in `apps/api-server/`) — not currently running as a workflow
- **WASM Frontend**: Rust/Yew alternative frontend (in `apps/wasm-frontend/`)
- **Smart Contracts**: Solidity via Foundry (in `libs/contracts/`)
- **Shared Libs**: Rust shared code, ZK circuits (in `libs/`)

## Running the App
- **Workflow**: "Start application" runs `npm run dev` → Vite serves the React frontend on port 5000
- **Host**: `0.0.0.0` with `allowedHosts: true` for Replit proxy compatibility

## Key Technologies
- React 18, TypeScript, Vite 8, Tailwind CSS, Shadcn UI
- React Router v6, TanStack Query, Framer Motion, Recharts
- Rust workspace (Cargo), Axum, Tokio
- BTTC/BTFS blockchain integration
- Zero-knowledge proofs (arkworks Groth16/BN254)
- DDEX ERN 4.1, CWR compliance protocols

## Package Management
- Frontend: npm with `--legacy-peer-deps` flag (due to Vite 8 peer dependency constraints)
- Backend/Rust: Cargo workspace

## Deployment
- Target: Static site
- Build: `npm run build`
- Public dir: `dist`
