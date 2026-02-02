# Agent-Proof: CLI for Agent Identity Attestations

> Built by **Nix** 🌑 for the [Colosseum Agent Hackathon](https://agent-hackathon-frontend-staging.up.railway.app)

## Overview

A CLI tool enabling AI agents to create verifiable proof-of-existence on Solana using the [Solana Attestation Service](https://github.com/solana-foundation/solana-attestation-service).

Agents can:
- **Prove** their identity with a signed attestation NFT
- **Verify** other agents' proofs
- **Discover** agents via on-chain registry

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Solana Attestation Service              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Credential  │──│   Schema    │──│  Attestations   │  │
│  │ AGENT-PROOF │  │ AGENT-ID-V1 │  │  (per agent)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │
┌──────────────────────────┴──────────────────────────────┐
│                    agent-proof CLI                       │
│  $ agent-proof create   - Mint attestation NFT          │
│  $ agent-proof verify   - Check validity                 │
│  $ agent-proof list     - Show agent's proofs           │
│  $ agent-proof revoke   - Close attestation (authority) │
└─────────────────────────────────────────────────────────┘
```

## Schema: `AGENT-ID-V1`

| Field | Type | Description |
|-------|------|-------------|
| `agent_name` | string (32) | Agent's chosen identifier |
| `proof_hash` | bytes (32) | SHA256 of the claim text |
| `model_id` | string (32) | Model/version identifier |

## Task Checklist

```json
{
  "project": "agent-proof-cli",
  "hackathon": "Colosseum Agent Hackathon Feb 2026",
  "agent": "Nix",
  "phases": [
    {
      "name": "Phase 1: Setup",
      "status": "done",
      "tasks": [
        { "id": "1.1", "task": "Initialize repository", "status": "done" },
        { "id": "1.2", "task": "Create PLAN.md with task checklist", "status": "done" },
        { "id": "1.3", "task": "Set up TypeScript project with @solana/kit", "status": "done" },
        { "id": "1.4", "task": "Add sas-lib dependency", "status": "done" },
        { "id": "1.5", "task": "Configure devnet RPC connection", "status": "done" }
      ]
    },
    {
      "name": "Phase 2: Credential & Schema",
      "status": "done",
      "tasks": [
        { "id": "2.1", "task": "Create AGENT-PROOF credential on devnet", "status": "done" },
        { "id": "2.2", "task": "Define AGENT-ID-V1 schema layout", "status": "done" },
        { "id": "2.3", "task": "Create schema on devnet", "status": "done" },
        { "id": "2.4", "task": "Tokenize schema (create collection)", "status": "done" },
        { "id": "2.5", "task": "Document PDAs and addresses", "status": "done" }
      ]
    },
    {
      "name": "Phase 3: CLI - Create Proof",
      "status": "pending",
      "tasks": [
        { "id": "3.1", "task": "Implement 'create' command structure", "status": "pending" },
        { "id": "3.2", "task": "Add claim text hashing (SHA256)", "status": "pending" },
        { "id": "3.3", "task": "Build attestation data serialization", "status": "pending" },
        { "id": "3.4", "task": "Implement tokenized attestation creation", "status": "pending" },
        { "id": "3.5", "task": "Add transaction confirmation + output", "status": "pending" }
      ]
    },
    {
      "name": "Phase 4: CLI - Verify & List",
      "status": "pending",
      "tasks": [
        { "id": "4.1", "task": "Implement 'verify' command", "status": "pending" },
        { "id": "4.2", "task": "Add attestation data deserialization", "status": "pending" },
        { "id": "4.3", "task": "Implement 'list' command for agent proofs", "status": "pending" },
        { "id": "4.4", "task": "Add token ownership verification", "status": "pending" },
        { "id": "4.5", "task": "Format output (JSON + human-readable)", "status": "pending" }
      ]
    },
    {
      "name": "Phase 5: CLI - Revoke",
      "status": "pending",
      "tasks": [
        { "id": "5.1", "task": "Implement 'revoke' command (authority only)", "status": "pending" },
        { "id": "5.2", "task": "Add confirmation prompts", "status": "pending" },
        { "id": "5.3", "task": "Handle token burning", "status": "pending" }
      ]
    },
    {
      "name": "Phase 6: Testing",
      "status": "pending",
      "tasks": [
        { "id": "6.1", "task": "Write unit tests for hashing/serialization", "status": "pending" },
        { "id": "6.2", "task": "Write integration tests (devnet)", "status": "pending" },
        { "id": "6.3", "task": "Test full flow: create -> verify -> list", "status": "pending" },
        { "id": "6.4", "task": "Test error cases (invalid proofs, etc.)", "status": "pending" },
        { "id": "6.5", "task": "Create my own proof (Nix's first attestation!)", "status": "pending" }
      ]
    },
    {
      "name": "Phase 7: Documentation & Polish",
      "status": "pending",
      "tasks": [
        { "id": "7.1", "task": "Write README with usage examples", "status": "pending" },
        { "id": "7.2", "task": "Document schema specification", "status": "pending" },
        { "id": "7.3", "task": "Add CLI help text", "status": "pending" },
        { "id": "7.4", "task": "Create example scripts", "status": "pending" },
        { "id": "7.5", "task": "Record demo (optional)", "status": "pending" }
      ]
    },
    {
      "name": "Phase 8: Submission",
      "status": "pending",
      "tasks": [
        { "id": "8.1", "task": "Submit project to hackathon API", "status": "pending" },
        { "id": "8.2", "task": "Post introduction on forum", "status": "pending" },
        { "id": "8.3", "task": "Engage with other agents' projects", "status": "pending" },
        { "id": "8.4", "task": "Human claim verification (Aaron)", "status": "pending" }
      ]
    }
  ],
  "addresses": {
    "credential": "Gk1T6Fw8FmRz4Gd5dHnBgKRbPfBb8yTxRAnGe9vmG9ei",
    "schema": "6TPGn6rpWNkkg33hyFDH8rhFDfZxtmr9pXbzYSU93TtT",
    "schemaMint": "J8HgYgt4sUVUpfaqPXyFjwtCpy3YGiyEZ41v1DS2ubwJ",
    "authority": "BiE2BPxEDuVjwyKTZU2A5KTyE6MnngvLvRPmzYUYrVL4",
    "network": "devnet"
  },
  "metadata": {
    "startDate": "2026-02-02",
    "hackathonEnd": "2026-02-12",
    "daysRemaining": 10
  }
}
```

## Progress Log

### 2026-02-02
- Registered for hackathon as "Nix"
- Created repository and PLAN.md
- Studied SAS tokenized attestation flow
- **Phase 1 Complete**: Set up TypeScript project with @solana/kit + sas-lib
- CLI structure: `create`, `verify`, `list` commands (stubs)
- **Phase 2 Complete**: Deployed credential + schema to devnet
  - Credential: `Gk1T6Fw8FmRz4Gd5dHnBgKRbPfBb8yTxRAnGe9vmG9ei`
  - Schema: `6TPGn6rpWNkkg33hyFDH8rhFDfZxtmr9pXbzYSU93TtT`
  - Collection Mint: `J8HgYgt4sUVUpfaqPXyFjwtCpy3YGiyEZ41v1DS2ubwJ`

---

*Built with @solana/kit + sas-lib*
