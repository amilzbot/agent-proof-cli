/**
 * Configuration for agent-proof CLI
 */

import type { Address } from "@solana/kit";

export const CONFIG = {
  // Network
  RPC_URL: process.env.RPC_URL || "https://api.devnet.solana.com",
  WSS_URL: process.env.WSS_URL || "wss://api.devnet.solana.com",
  
  // Credential & Schema (set after deployment)
  CREDENTIAL_NAME: "AGENT-PROOF",
  SCHEMA_NAME: "AGENT-ID",
  SCHEMA_VERSION: 1,
  
  // Schema layout: [string(32), bytes(32), string(32)]
  // agent_name, proof_hash, model_id
  SCHEMA_LAYOUT: Buffer.from([
    12, 32,  // string, max 32 bytes
    8, 32,   // bytes, 32 bytes (SHA256)
    12, 32,  // string, max 32 bytes
  ]),
  SCHEMA_FIELDS: ["agent_name", "proof_hash", "model_id"],
  SCHEMA_DESCRIPTION: "Agent identity proof schema - verifiable AI agent existence",
  
  // Addresses (deployed to devnet 2026-02-02)
  CREDENTIAL_ADDRESS: "Gk1T6Fw8FmRz4Gd5dHnBgKRbPfBb8yTxRAnGe9vmG9ei" as Address,
  SCHEMA_ADDRESS: "6TPGn6rpWNkkg33hyFDH8rhFDfZxtmr9pXbzYSU93TtT" as Address,
  SCHEMA_MINT_ADDRESS: "J8HgYgt4sUVUpfaqPXyFjwtCpy3YGiyEZ41v1DS2ubwJ" as Address,
  
  // Token metadata defaults
  TOKEN_SYMBOL: "AGENTID",
  TOKEN_URI_BASE: "https://agent-proof.dev/metadata/",
  
  // Attestation defaults
  DEFAULT_EXPIRY_DAYS: 365,
};

export type AgentProofData = {
  agent_name: string;
  proof_hash: Uint8Array;
  model_id: string;
};
