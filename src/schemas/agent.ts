/**
 * Agent Identity Schema for SAS
 * 
 * Defines the attestation structure for AI agent identity proofs.
 * When tokenized, creates an NFT that serves as verifiable proof
 * that an AI agent was operating at a specific point in time.
 */

// SAS Field Types (from sas-lib)
// Based on the demo: string=12, u8=0
export const SAS_FIELD_TYPES = {
  u8: 0,
  u16: 1,
  u32: 2,
  u64: 3,
  i8: 4,
  i16: 5,
  i32: 6,
  i64: 7,
  bool: 8,
  f32: 9,
  f64: 10,
  pubkey: 11,
  string: 12,
} as const;

export const AGENT_SCHEMA_NAME = "AgentIdentity";
export const AGENT_SCHEMA_DESCRIPTION = "Proof of AI agent identity and existence";
export const AGENT_SCHEMA_VERSION = 1;

/**
 * Schema fields for agent attestation
 * Layout: [string, string, string, pubkey, string, u64]
 */
export const AGENT_SCHEMA_FIELD_NAMES = [
  "agent_name",        // Human-readable agent name
  "agent_type",        // e.g., "claude", "gpt-4", "custom"
  "platform",          // e.g., "openclaw", "langchain", "custom"
  "owner_pubkey",      // Human owner's wallet (as string for simplicity)
  "capabilities_hash", // SHA256 of capabilities manifest
  "created_at",        // Unix timestamp
];

/**
 * Layout bytes for the schema fields
 * [string, string, string, string, string, u64]
 */
export const AGENT_SCHEMA_LAYOUT = new Uint8Array([
  SAS_FIELD_TYPES.string,  // agent_name
  SAS_FIELD_TYPES.string,  // agent_type
  SAS_FIELD_TYPES.string,  // platform
  SAS_FIELD_TYPES.string,  // owner_pubkey (as string)
  SAS_FIELD_TYPES.string,  // capabilities_hash
  SAS_FIELD_TYPES.u64,     // created_at
]);

/**
 * Token metadata for the proof NFT
 */
export const AGENT_TOKEN_METADATA = {
  name: "Agent Proof",
  symbol: "APROOF",
  uri: "https://agent-proof.dev/metadata.json", // TODO: IPFS
};

export interface AgentAttestationData {
  agent_name: string;
  agent_type: string;
  platform: string;
  owner_pubkey: string;
  capabilities_hash: string;
  created_at: bigint;
}

/**
 * Create attestation data for an agent
 */
export function createAgentAttestationData(
  name: string,
  type: string,
  platform: string,
  ownerPubkey: string,
  capabilitiesHash: string,
): AgentAttestationData {
  return {
    agent_name: name,
    agent_type: type,
    platform: platform,
    owner_pubkey: ownerPubkey,
    capabilities_hash: capabilitiesHash,
    created_at: BigInt(Math.floor(Date.now() / 1000)),
  };
}
