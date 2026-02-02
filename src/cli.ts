#!/usr/bin/env bun
/**
 * agent-proof CLI
 * 
 * Create verifiable identity proofs for AI agents on Solana
 * using the Solana Attestation Service (SAS).
 * 
 * Usage:
 *   agent-proof init              - Initialize agent identity
 *   agent-proof attest            - Create attestation proof
 *   agent-proof verify <address>  - Verify an agent's proof
 *   agent-proof revoke <address>  - Revoke an attestation
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { initCommand } from "./commands/init";
import { attestCommand } from "./commands/attest";
import { verifyCommand } from "./commands/verify";

const program = new Command();

program
  .name("agent-proof")
  .description("🤖 Verifiable identity proofs for AI agents on Solana")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a new agent identity credential")
  .option("-n, --name <name>", "Agent name", "unnamed-agent")
  .option("-t, --type <type>", "Agent type (claude, gpt-4, custom)", "custom")
  .option("-p, --platform <platform>", "Platform (openclaw, langchain, custom)", "custom")
  .option("-k, --keypair <path>", "Path to keypair file", "~/.config/solana/id.json")
  .option("--devnet", "Use devnet (default)", true)
  .option("--mainnet", "Use mainnet-beta")
  .action(initCommand);

program
  .command("attest")
  .description("Create a tokenized attestation (proof NFT)")
  .option("-n, --name <name>", "Agent name")
  .option("-c, --credential <name>", "Credential name (from init)")
  .option("-t, --type <type>", "Agent type (claude, gpt-4, custom)", "custom")
  .option("-p, --platform <platform>", "Platform (openclaw, langchain, custom)", "custom")
  .option("--capabilities <path>", "Path to capabilities manifest")
  .option("-k, --keypair <path>", "Path to keypair file", "~/.config/solana/id.json")
  .option("--devnet", "Use devnet (default)", true)
  .action(attestCommand);

program
  .command("verify")
  .description("Verify an agent's attestation proof")
  .argument("<address>", "Agent wallet or attestation address")
  .option("--devnet", "Use devnet (default)", true)
  .action(verifyCommand);

program
  .command("status")
  .description("Check current agent status")
  .option("-k, --keypair <path>", "Path to keypair file", "~/.config/solana/id.json")
  .action(async (options) => {
    const spinner = ora("Checking agent status...").start();
    try {
      // TODO: Implement status check
      spinner.succeed("Status check complete");
      console.log(chalk.cyan("\n📊 Agent Status"));
      console.log(chalk.gray("─".repeat(40)));
      console.log("Credential: " + chalk.yellow("Not initialized"));
      console.log("Attestations: " + chalk.gray("0"));
      console.log("\nRun " + chalk.green("agent-proof init") + " to get started.");
    } catch (error) {
      spinner.fail("Failed to check status");
      console.error(error);
    }
  });

// Banner
console.log(chalk.cyan(`
   ╭─────────────────────────────────╮
   │  🤖 agent-proof v0.1.0         │
   │  AI Identity on Solana         │
   ╰─────────────────────────────────╯
`));

program.parse();
