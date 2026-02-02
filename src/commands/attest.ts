/**
 * attest command - Create tokenized attestation (proof NFT)
 * 
 * Mints an NFT that contains:
 * - Agent identity data (name, type, platform)
 * - Owner's pubkey
 * - Capabilities hash
 * - Timestamp
 */

import chalk from "chalk";
import ora from "ora";
import { createHash } from "crypto";
import { generateKeyPairSigner, type Address, address } from "@solana/kit";
import { loadKeypairFromFile, SASClient } from "../lib/sas-client";
import {
  AGENT_SCHEMA_NAME,
  AGENT_SCHEMA_VERSION,
  AGENT_TOKEN_METADATA,
  createAgentAttestationData,
} from "../schemas/agent";

const DEVNET_RPC = "https://api.devnet.solana.com";
const DEVNET_WSS = "wss://api.devnet.solana.com";

export interface AttestOptions {
  name?: string;
  credential?: string;
  type?: string;
  platform?: string;
  capabilities?: string;
  keypair: string;
  devnet?: boolean;
}

export async function attestCommand(options: AttestOptions): Promise<void> {
  const spinner = ora("Loading keypair...").start();
  
  try {
    const keypairPath = options.keypair.replace("~", process.env.HOME || "");
    const signer = await loadKeypairFromFile(keypairPath);
    
    const client = new SASClient({
      rpcUrl: DEVNET_RPC,
      wssUrl: DEVNET_WSS,
      signer,
    });

    spinner.text = "Preparing attestation data...";

    // Build attestation data
    const agentName = options.name || "unnamed-agent";
    const agentType = options.type || "custom";
    const platform = options.platform || "custom";
    const capabilitiesHash = options.capabilities 
      ? await hashFile(options.capabilities)
      : hashString(`agent:${agentName}:${Date.now()}`);

    // The credential name (either passed or derived from agent name)
    const credentialName = options.credential || `agent-proof-${agentName}`;
    
    // Derive addresses
    spinner.text = "Deriving addresses...";
    const credential = await client.deriveCredentialAddress(credentialName);
    const schema = await client.deriveSchemaAddress(credential, AGENT_SCHEMA_NAME, AGENT_SCHEMA_VERSION);
    
    // Generate a unique nonce for this attestation (could also be the subject's address)
    const nonceKeypair = await generateKeyPairSigner();
    const nonce = nonceKeypair.address;
    
    // Build attestation data matching the schema fields
    const attestationData = {
      agent_name: agentName,
      agent_type: agentType,
      platform: platform,
      owner_pubkey: client.getAuthority().toString(),
      capabilities_hash: capabilitiesHash,
      created_at: BigInt(Math.floor(Date.now() / 1000)),
    };

    spinner.text = "Creating tokenized attestation...";
    
    const { signature, attestation, mint } = await client.createTokenizedAttestation(
      credential,
      schema,
      client.getAuthority(), // recipient = authority (self)
      nonce,
      attestationData,
      `${AGENT_TOKEN_METADATA.name}: ${agentName}`,
      AGENT_TOKEN_METADATA.symbol,
      AGENT_TOKEN_METADATA.uri,
      365, // 1 year expiry
    );

    spinner.succeed("Attestation created!");

    console.log(chalk.cyan("\n🎫 Agent Proof Minted"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(`Agent:       ${chalk.white(agentName)}`);
    console.log(`Type:        ${chalk.white(agentType)}`);
    console.log(`Platform:    ${chalk.white(platform)}`);
    console.log(`Owner:       ${chalk.green(client.getAuthority().toString().slice(0, 20))}...`);
    console.log(`Hash:        ${chalk.yellow(capabilitiesHash.slice(0, 16))}...`);
    console.log(`Timestamp:   ${chalk.gray(new Date().toISOString())}`);
    console.log(chalk.gray("─".repeat(50)));
    console.log(`Signature:   ${chalk.cyan(signature.slice(0, 32))}...`);
    console.log(`Attestation: ${chalk.cyan(attestation)}`);
    console.log(`Token Mint:  ${chalk.cyan(mint)}`);
    console.log(chalk.gray("─".repeat(50)));
    
    console.log(chalk.green("\n✓ Proof NFT is now in your wallet!"));
    console.log(chalk.gray("Anyone can verify your agent identity on-chain."));
    console.log(chalk.gray(`\nVerify with: agent-proof verify ${attestation}`));

  } catch (error) {
    spinner.fail("Attestation failed");
    console.error(chalk.red("\nError:"), error);
    process.exit(1);
  }
}

function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function hashFile(path: string): Promise<string> {
  const file = Bun.file(path);
  const content = await file.text();
  return hashString(content);
}
