/**
 * init command - Initialize agent identity
 * 
 * Creates:
 * 1. Credential (authority to issue attestations)
 * 2. Schema (defines agent attestation structure)
 * 3. Tokenizes schema (enables NFT proofs)
 */

import chalk from "chalk";
import ora from "ora";
import { loadKeypairFromFile, SASClient } from "../lib/sas-client";
import {
  AGENT_SCHEMA_NAME,
  AGENT_SCHEMA_DESCRIPTION,
  AGENT_SCHEMA_FIELD_NAMES,
  AGENT_SCHEMA_LAYOUT,
  AGENT_SCHEMA_VERSION,
} from "../schemas/agent";

const DEVNET_RPC = "https://api.devnet.solana.com";
const DEVNET_WSS = "wss://api.devnet.solana.com";
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";
const MAINNET_WSS = "wss://api.mainnet-beta.solana.com";

export interface InitOptions {
  name: string;
  type: string;
  platform: string;
  keypair: string;
  devnet?: boolean;
  mainnet?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const spinner = ora("Loading keypair...").start();
  
  try {
    // Expand ~ to home directory
    const keypairPath = options.keypair.replace("~", process.env.HOME || "");
    const signer = await loadKeypairFromFile(keypairPath);
    
    spinner.text = "Initializing SAS client...";
    
    const isMainnet = options.mainnet;
    const client = new SASClient({
      rpcUrl: isMainnet ? MAINNET_RPC : DEVNET_RPC,
      wssUrl: isMainnet ? MAINNET_WSS : DEVNET_WSS,
      signer,
    });

    // Check balance
    spinner.text = "Checking balance...";
    const balance = await client.getBalance();
    const solBalance = Number(balance) / 1e9;
    
    if (solBalance < 0.05) {
      spinner.warn("Low balance detected");
      console.log(chalk.yellow(`\nBalance: ${solBalance.toFixed(4)} SOL`));
      console.log(chalk.gray("You may need more SOL for transactions."));
      
      if (!isMainnet) {
        console.log(chalk.cyan("\nRequesting airdrop..."));
        const sig = await client.airdrop();
        console.log(chalk.green(`✓ Airdrop: ${sig.slice(0, 16)}...`));
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    const credentialName = `agent-proof-${options.name}`;
    let totalCuUsed = 0;
    
    // Step 1: Create Credential
    spinner.text = "Creating credential...";
    const { signature: credSig, credential, cuUsed: credCu } = await client.createCredential({
      name: credentialName,
    });
    totalCuUsed += credCu;
    console.log(chalk.green(`\n✓ Credential: ${credSig.slice(0, 16)}...`) + chalk.gray(` (${credCu.toLocaleString()} CU)`));
    
    // Step 2: Create Schema
    spinner.text = "Creating schema...";
    const { signature: schemaSig, schema, cuUsed: schemaCu } = await client.createSchema({
      credentialName,
      name: AGENT_SCHEMA_NAME,
      description: AGENT_SCHEMA_DESCRIPTION,
      layout: AGENT_SCHEMA_LAYOUT,
      fieldNames: AGENT_SCHEMA_FIELD_NAMES,
      version: AGENT_SCHEMA_VERSION,
    });
    totalCuUsed += schemaCu;
    console.log(chalk.green(`✓ Schema: ${schemaSig.slice(0, 16)}...`) + chalk.gray(` (${schemaCu.toLocaleString()} CU)`));
    
    // Step 3: Tokenize Schema
    spinner.text = "Tokenizing schema...";
    const { signature: tokenSig, mint, cuUsed: tokenCu } = await client.tokenizeSchema(credential, schema);
    totalCuUsed += tokenCu;
    console.log(chalk.green(`✓ Tokenized: ${tokenSig.slice(0, 16)}...`) + chalk.gray(` (${tokenCu.toLocaleString()} CU)`));

    spinner.succeed("Initialization complete!");
    
    console.log(chalk.cyan("\n📋 Agent Identity Initialized"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(`Network:     ${chalk.yellow(isMainnet ? "mainnet-beta" : "devnet")}`);
    console.log(`Authority:   ${chalk.green(client.getAuthority())}`);
    console.log(`Agent Name:  ${chalk.white(options.name)}`);
    console.log(`Agent Type:  ${chalk.white(options.type)}`);
    console.log(`Platform:    ${chalk.white(options.platform)}`);
    console.log(chalk.gray("─".repeat(50)));
    console.log(`Credential:  ${chalk.cyan(credential)}`);
    console.log(`Schema:      ${chalk.cyan(schema)}`);
    console.log(`Schema Mint: ${chalk.cyan(mint)}`);
    console.log(`Total CU:    ${chalk.magenta(totalCuUsed.toLocaleString())} (3 txns)`);
    console.log(chalk.gray("─".repeat(50)));
    
    console.log(chalk.green("\n✓ Ready to create attestations!"));
    console.log(chalk.gray(`Run: agent-proof attest --name "${options.name}"`));

  } catch (error) {
    spinner.fail("Initialization failed");
    console.error(chalk.red("\nError:"), error);
    process.exit(1);
  }
}
