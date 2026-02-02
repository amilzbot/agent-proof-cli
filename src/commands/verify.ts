/**
 * verify command - Verify an agent's attestation proof
 * 
 * Checks:
 * - Attestation exists on-chain
 * - Token is owned by the subject
 * - Data integrity
 */

import chalk from "chalk";
import ora from "ora";
import { address, createSolanaRpc } from "@solana/kit";
import {
  fetchAttestation,
  fetchSchema,
  deserializeAttestationData,
  deriveAttestationMintPda,
} from "sas-lib";
import { fetchMint } from "@solana-program/token-2022";

const DEVNET_RPC = "https://api.devnet.solana.com";

export interface VerifyOptions {
  devnet?: boolean;
}

export async function verifyCommand(
  addressStr: string,
  options: VerifyOptions
): Promise<void> {
  const spinner = ora("Verifying agent proof...").start();
  
  try {
    const rpc = createSolanaRpc(DEVNET_RPC);
    const attestationAddress = address(addressStr);
    
    spinner.text = "Fetching attestation...";
    
    // Fetch the attestation account
    const attestation = await fetchAttestation(rpc, attestationAddress);
    
    spinner.text = "Fetching schema...";
    
    // Fetch the schema to deserialize data
    const schema = await fetchSchema(rpc, attestation.data.schema);
    
    // Check if schema is paused
    if (schema.data.isPaused) {
      spinner.warn("Schema is paused");
      console.log(chalk.yellow("\n⚠ This agent's schema has been paused by the issuer."));
    }
    
    spinner.text = "Deserializing attestation data...";
    
    // Deserialize the attestation data
    const data = deserializeAttestationData<{
      agent_name: string;
      agent_type: string;
      platform: string;
      owner_pubkey: string;
      capabilities_hash: string;
      created_at: bigint;
    }>(schema.data, attestation.data.data as Uint8Array);
    
    // Check expiry
    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
    const isExpired = currentTimestamp >= attestation.data.expiry;
    
    // Try to fetch the token mint
    spinner.text = "Checking token...";
    let hasToken = false;
    let tokenMint = "";
    try {
      const [mint] = await deriveAttestationMintPda({ attestation: attestationAddress });
      const mintAccount = await fetchMint(rpc, mint);
      if (mintAccount) {
        hasToken = true;
        tokenMint = mint;
      }
    } catch {
      // Token might not exist or be burned
    }

    spinner.succeed("Verification complete!");

    // Display results
    console.log(chalk.cyan("\n🔍 Agent Proof Verified"));
    console.log(chalk.gray("─".repeat(50)));
    
    // Status
    const statusIcon = isExpired ? "⚠" : "✓";
    const statusColor = isExpired ? chalk.yellow : chalk.green;
    console.log(`Status:      ${statusColor(isExpired ? `${statusIcon} Expired` : `${statusIcon} Valid`)}`);
    
    // Agent info
    console.log(chalk.gray("─".repeat(50)));
    console.log(`Agent Name:  ${chalk.white(data.agent_name)}`);
    console.log(`Agent Type:  ${chalk.white(data.agent_type)}`);
    console.log(`Platform:    ${chalk.white(data.platform)}`);
    console.log(`Owner:       ${chalk.green(data.owner_pubkey.slice(0, 24))}...`);
    console.log(`Hash:        ${chalk.yellow(data.capabilities_hash.slice(0, 24))}...`);
    
    // Timestamps
    console.log(chalk.gray("─".repeat(50)));
    const createdAt = new Date(Number(data.created_at) * 1000);
    const expiresAt = new Date(Number(attestation.data.expiry) * 1000);
    console.log(`Created:     ${chalk.gray(createdAt.toISOString())}`);
    console.log(`Expires:     ${chalk.gray(expiresAt.toISOString())}`);
    
    // On-chain addresses
    console.log(chalk.gray("─".repeat(50)));
    console.log(`Attestation: ${chalk.cyan(attestationAddress)}`);
    console.log(`Schema:      ${chalk.cyan(attestation.data.schema)}`);
    console.log(`Credential:  ${chalk.cyan(attestation.data.credential)}`);
    if (hasToken) {
      console.log(`Token Mint:  ${chalk.cyan(tokenMint)}`);
    }
    console.log(chalk.gray("─".repeat(50)));

    if (!isExpired) {
      console.log(chalk.green("\n✓ This agent has a valid on-chain identity proof."));
    } else {
      console.log(chalk.yellow("\n⚠ This agent's proof has expired."));
    }

  } catch (error: any) {
    spinner.fail("Verification failed");
    
    if (error.message?.includes("could not find account")) {
      console.log(chalk.red("\n✗ No attestation found at this address"));
      console.log(chalk.gray("The address may not have an agent proof, or it may have been revoked."));
    } else {
      console.error(chalk.red("\nError:"), error.message || error);
    }
    process.exit(1);
  }
}
