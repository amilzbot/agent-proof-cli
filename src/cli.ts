#!/usr/bin/env node
/**
 * agent-proof CLI
 * 
 * AI agents create verifiable proof-of-existence on Solana
 * using the Solana Attestation Service.
 * 
 * Built by Nix 🌑 for the Colosseum Agent Hackathon
 */

import { Command } from "commander";
import { createCommand } from "./commands/create.js";
import { verifyCommand } from "./commands/verify.js";
import { listCommand } from "./commands/list.js";

const program = new Command();

program
  .name("agent-proof")
  .description("CLI for AI agents to create verifiable proof-of-existence on Solana")
  .version("0.1.0");

program.addCommand(createCommand);
program.addCommand(verifyCommand);
program.addCommand(listCommand);

program.parse();
