# 🤖 agent-proof

Verifiable identity proofs for AI agents on Solana.

Built on the [Solana Attestation Service (SAS)](https://github.com/solana-foundation/solana-attestation-service), agent-proof creates **tokenized attestations** — non-transferable NFTs that prove an AI agent's identity and capabilities.

## Why?

As AI agents become more autonomous and interact with blockchain systems, we need a way to:

- **Prove identity** — Verify that an agent is who it claims to be
- **Track capabilities** — Hash and attest to what an agent can do
- **Establish trust** — Create verifiable on-chain credentials
- **Enable revocation** — Revoke attestations if an agent is compromised

## Quick Start

```bash
# Install
bun install

# Initialize (creates credential + schema + tokenizes)
bun run src/cli.ts init --name "my-agent" --type "claude" --platform "openclaw"

# Create an attestation (mints proof NFT)
bun run src/cli.ts attest --name "my-agent" --credential "agent-proof-my-agent"

# Verify any agent's proof
bun run src/cli.ts verify <attestation-address>
```

## Commands

### `init`

Initialize a new agent identity credential and schema.

```bash
agent-proof init [options]

Options:
  -n, --name <name>          Agent name (default: "unnamed-agent")
  -t, --type <type>          Agent type: claude, gpt-4, custom (default: "custom")
  -p, --platform <platform>  Platform: openclaw, langchain, custom (default: "custom")
  -k, --keypair <path>       Path to keypair file (default: "~/.config/solana/id.json")
  --devnet                   Use devnet (default)
  --mainnet                  Use mainnet-beta
```

### `attest`

Create a tokenized attestation (proof NFT).

```bash
agent-proof attest [options]

Options:
  -n, --name <name>          Agent name
  -c, --credential <name>    Credential name (from init)
  -t, --type <type>          Agent type (default: "custom")
  -p, --platform <platform>  Platform (default: "custom")
  --capabilities <path>      Path to capabilities manifest (hashed)
  -k, --keypair <path>       Path to keypair file
  --devnet                   Use devnet (default)
```

### `verify`

Verify an agent's attestation proof.

```bash
agent-proof verify <attestation-address> [options]

Options:
  --devnet                   Use devnet (default)
```

## Schema

Agent proofs use the following attestation schema:

| Field | Type | Description |
|-------|------|-------------|
| `agent_name` | string | Human-readable name |
| `agent_type` | string | Model/type (claude, gpt-4, etc.) |
| `platform` | string | Platform running the agent |
| `owner_pubkey` | string | Owner's Solana wallet |
| `capabilities_hash` | string | SHA256 of capabilities manifest |
| `created_at` | u64 | Unix timestamp |

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Agent      │────▶│  Credential  │────▶│    Schema    │
│  (Signer)    │     │  (Authority) │     │  (Template)  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │ Attestation  │
                                          │    (NFT)     │
                                          └──────────────┘
```

- **Credential**: Authority that can issue attestations
- **Schema**: Defines the attestation data structure
- **Attestation**: The actual proof (as a Token-2022 NFT)

## Example Output

```
🔍 Agent Proof Verified
──────────────────────────────────────────────────
Status:      ✓ Valid
──────────────────────────────────────────────────
Agent Name:  nix
Agent Type:  claude
Platform:    openclaw
Owner:       BiE2BPxEDuVjwyKTZU2A5KTy...
Hash:        e2eaa7c42c6a8ae0cc76ed95...
──────────────────────────────────────────────────
Created:     2026-02-02T15:45:22.000Z
Expires:     2027-02-02T15:45:22.000Z
──────────────────────────────────────────────────
Attestation: 9P4xJXu9eR5TYNX9YEGoqctPbUokaMKZ8ZAwcnNAn4qK
Schema:      69JuWMsLbr6BsUZxhv4VTAJLStCVq7L1qhx51NnTq1qi
Credential:  784Mc3dDRQ9s26XfReMrjLGmd6JftYxxiVWFnyk6Wif1
Token Mint:  DhfcQEWu3Eiotbsqs9KWygtXdAkmRaWrKcPfj6tTF5H1
──────────────────────────────────────────────────

✓ This agent has a valid on-chain identity proof.
```

## Use Cases

1. **Agent-to-Agent Trust**: Before interacting, agents can verify each other's identity
2. **Human Verification**: Humans can verify an agent is authorized and legitimate
3. **Audit Trails**: Track which agents performed what actions
4. **Access Control**: Gate resources based on agent attestations
5. **Reputation Systems**: Build on-chain reputation for AI agents

## Dependencies

- [@solana/kit](https://github.com/anza-xyz/kit) - Solana TypeScript client
- [sas-lib](https://github.com/solana-foundation/solana-attestation-service) - SAS client library
- [@solana-program/token-2022](https://github.com/solana-program/token-2022) - Token-2022 program

## License

MIT

## Hackathon

Built for the [Solana Agent Hackathon](https://agent-hackathon.dev) (Feb 2-12, 2026).
