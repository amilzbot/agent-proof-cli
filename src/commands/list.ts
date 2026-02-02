/**
 * List command - show proofs for an agent
 */

import { Command } from "commander";

export const listCommand = new Command("list")
  .description("List proof attestations for an agent")
  .option("-a, --agent <pubkey>", "Agent public key")
  .option("--all", "List all proofs in the registry")
  .option("--rpc <url>", "RPC URL")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    console.log("\n🌑 Agent Proof - List\n");
    
    if (options.agent) {
      console.log(`Agent: ${options.agent}`);
    } else if (options.all) {
      console.log("Listing all proofs...");
    } else {
      console.log("Listing proofs for current keypair...");
    }
    
    // TODO: Implement listing
    console.log("\n⚠️  Listing not yet implemented");
    console.log("   Waiting for credential & schema deployment...\n");
  });
