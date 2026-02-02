/**
 * Create command - mint a proof-of-existence attestation NFT
 */

import { Command } from "commander";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  createKeyPairSignerFromBytes,
  generateKeyPairSigner,
  lamports,
  airdropFactory,
  Address,
} from "@solana/kit";
import {
  getCreateTokenizedAttestationInstruction,
  deriveAttestationPda,
  deriveAttestationMintPda,
  deriveSasAuthorityAddress,
  fetchSchema,
  serializeAttestationData,
} from "sas-lib";
import {
  getMintSize,
  TOKEN_2022_PROGRAM_ADDRESS,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
} from "@solana-program/token-2022";
import { getClient, setRpcUrl } from "../lib/client.js";
import { sendAndConfirmInstructions } from "../lib/transaction.js";
import { CONFIG } from "../lib/config.js";

export const createCommand = new Command("create")
  .description("Create a proof-of-existence attestation for an agent")
  .requiredOption("-n, --name <name>", "Agent name (max 32 chars)")
  .requiredOption("-c, --claim <text>", "Claim text to hash as proof")
  .option("-m, --model <id>", "Model/version identifier", "unknown")
  .option("-k, --keypair <path>", "Path to keypair file (payer & recipient)")
  .option("--rpc <url>", "RPC URL (default: devnet)")
  .option("--expiry <days>", "Attestation expiry in days", "365")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    const json = options.json;
    
    if (!json) {
      console.log("\n🌑 Agent Proof - Create\n");
    }
    
    // Set RPC if provided
    if (options.rpc) {
      setRpcUrl(options.rpc);
    }
    
    const client = getClient();
    
    // Load keypair
    const payer = await loadKeypair(options.keypair);
    
    if (!json) {
      console.log(`Agent:       ${options.name}`);
      console.log(`Model:       ${options.model}`);
      console.log(`Claim:       "${options.claim.substring(0, 50)}${options.claim.length > 50 ? '...' : ''}"`);
    }
    
    // Hash the claim
    const proofHash = createHash("sha256")
      .update(options.claim)
      .digest("hex");
    
    if (!json) {
      console.log(`Proof Hash:  ${proofHash}`);
      console.log(`Payer:       ${payer.address}`);
      console.log();
    }
    
    // Check balance
    const balance = await client.rpc.getBalance(payer.address).send();
    if (balance.value < lamports(10_000_000n)) {
      if (!json) {
        console.log("📥 Low balance, requesting airdrop...");
      }
      const airdrop = airdropFactory({ rpc: client.rpc, rpcSubscriptions: client.rpcSubscriptions });
      await airdrop({
        commitment: "confirmed",
        lamports: lamports(1_000_000_000n),
        recipientAddress: payer.address,
      });
    }
    
    // Fetch schema to serialize data
    const schema = await fetchSchema(client.rpc, CONFIG.SCHEMA_ADDRESS!);
    
    // Derive PDAs
    const [attestationPda] = await deriveAttestationPda({
      credential: CONFIG.CREDENTIAL_ADDRESS!,
      schema: CONFIG.SCHEMA_ADDRESS!,
      nonce: payer.address, // Use payer as nonce (one proof per agent)
    });
    
    const [attestationMint] = await deriveAttestationMintPda({
      attestation: attestationPda,
    });
    
    const sasPda = await deriveSasAuthorityAddress();
    
    // Find ATA for recipient (payer receives the NFT)
    const [recipientAta] = await findAssociatedTokenPda({
      mint: attestationMint,
      owner: payer.address,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });
    
    if (!json) {
      console.log(`Attestation: ${attestationPda}`);
      console.log(`Mint:        ${attestationMint}`);
      console.log(`Recipient:   ${recipientAta}`);
      console.log();
    }
    
    // Check if attestation already exists
    const existingAttestation = await client.rpc.getAccountInfo(attestationPda).send();
    if (existingAttestation.value) {
      if (json) {
        console.log(JSON.stringify({
          success: false,
          error: "Attestation already exists for this agent",
          attestation: attestationPda,
        }));
      } else {
        console.log("⚠️  Attestation already exists for this agent!");
        console.log(`   View: https://explorer.solana.com/address/${attestationPda}?cluster=devnet`);
      }
      return;
    }
    
    // Prepare attestation data
    const attestationData = {
      agent_name: options.name.substring(0, 32),
      proof_hash: proofHash.substring(0, 64),
      model_id: options.model.substring(0, 32),
    };
    
    const serializedData = serializeAttestationData(schema.data, attestationData);
    
    // Calculate expiry
    const expiryDays = parseInt(options.expiry, 10);
    const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);
    
    // Calculate mint account space
    const mintSpace = getMintSize([
      {
        __kind: "GroupMemberPointer",
        authority: sasPda,
        memberAddress: attestationMint,
      },
      { __kind: "NonTransferable" },
      {
        __kind: "MetadataPointer",
        authority: sasPda,
        metadataAddress: attestationMint,
      },
      { __kind: "PermanentDelegate", delegate: sasPda },
      { __kind: "MintCloseAuthority", closeAuthority: sasPda },
      {
        __kind: "TokenMetadata",
        updateAuthority: sasPda,
        mint: attestationMint,
        name: `Agent Proof: ${options.name}`,
        symbol: CONFIG.TOKEN_SYMBOL,
        uri: `${CONFIG.TOKEN_URI_BASE}${attestationPda}`,
        additionalMetadata: new Map([
          ["attestation", attestationPda],
          ["schema", CONFIG.SCHEMA_ADDRESS!],
        ]),
      },
      {
        __kind: "TokenGroupMember",
        group: CONFIG.SCHEMA_MINT_ADDRESS!,
        mint: attestationMint,
        memberNumber: 1,
      },
    ]);
    
    if (!json) {
      console.log("🔨 Creating tokenized attestation...");
    }
    
    // Create the instruction
    const createAttestationIx = await getCreateTokenizedAttestationInstruction({
      payer,
      authority: payer, // Payer is the authorized signer
      credential: CONFIG.CREDENTIAL_ADDRESS!,
      schema: CONFIG.SCHEMA_ADDRESS!,
      attestation: attestationPda,
      schemaMint: CONFIG.SCHEMA_MINT_ADDRESS!,
      attestationMint,
      sasPda,
      recipient: payer.address,
      nonce: payer.address,
      expiry: expiryTimestamp,
      data: serializedData,
      name: `Agent Proof: ${options.name}`,
      uri: `${CONFIG.TOKEN_URI_BASE}${attestationPda}`,
      symbol: CONFIG.TOKEN_SYMBOL,
      mintAccountSpace: mintSpace,
      recipientTokenAccount: recipientAta,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });
    
    // Send transaction
    const signature = await sendAndConfirmInstructions(
      client,
      payer,
      [createAttestationIx],
      json ? undefined : "Attestation created"
    );
    
    const result = {
      success: true,
      agent: options.name,
      model: options.model,
      proofHash,
      attestation: attestationPda,
      mint: attestationMint,
      recipient: recipientAta,
      signature,
      explorer: `https://explorer.solana.com/address/${attestationMint}?cluster=devnet`,
    };
    
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log();
      console.log("🎉 Proof created successfully!");
      console.log();
      console.log(`View on Explorer:`);
      console.log(`   ${result.explorer}`);
      console.log();
    }
  });

async function loadKeypair(keypairPath?: string) {
  if (keypairPath && fs.existsSync(keypairPath)) {
    const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    return createKeyPairSignerFromBytes(new Uint8Array(secretKey));
  }
  
  // Try default Solana CLI keypair
  const defaultPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  if (fs.existsSync(defaultPath)) {
    const secretKey = JSON.parse(fs.readFileSync(defaultPath, "utf-8"));
    return createKeyPairSignerFromBytes(new Uint8Array(secretKey));
  }
  
  // Generate new keypair
  console.log("⚠️  No keypair found, generating temporary one...");
  return generateKeyPairSigner();
}
