/**
 * Setup script: Deploy credential & schema to devnet
 * 
 * This creates:
 * 1. AGENT-PROOF credential (authority)
 * 2. AGENT-ID-V1 schema (defines attestation structure)
 * 3. Tokenized schema (collection mint for attestation NFTs)
 */

import {
  airdropFactory,
  lamports,
  generateKeyPairSigner,
  createKeyPairSignerFromBytes,
  Signature,
} from "@solana/kit";
import {
  getCreateCredentialInstruction,
  getCreateSchemaInstruction,
  getTokenizeSchemaInstruction,
  deriveCredentialPda,
  deriveSchemaPda,
  deriveSchemaMintPda,
  deriveSasAuthorityAddress,
} from "sas-lib";
import { getMintSize, TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022";
import { getClient } from "../lib/client.js";
import { sendAndConfirmInstructions } from "../lib/transaction.js";
import * as fs from "fs";
import * as path from "path";

const CONFIG = {
  CREDENTIAL_NAME: "AGENT-PROOF",
  SCHEMA_NAME: "AGENT-ID",
  SCHEMA_VERSION: 1,
  SCHEMA_DESCRIPTION: "Agent identity proof - verifiable AI agent existence on Solana",
  
  // Schema layout: 3 fields (type codes from SAS)
  // Types: 0=u8, 1=u16, 2=u32, 3=u64, 4=u128, 5=i8, 6=i16, 7=i32, 8=i64, 9=i128, 10=f32, 11=f64, 12=string
  // Simpler approach: just 3 strings
  SCHEMA_LAYOUT: Buffer.from([12, 12, 12]),  // 3 strings
  SCHEMA_FIELDS: ["agent_name", "proof_hash", "model_id"],
};

async function loadOrCreateKeypair(keypairPath?: string) {
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
  console.log("⚠️  No keypair found, generating new one...");
  return generateKeyPairSigner();
}

async function main() {
  console.log("\n🌑 Agent Proof - Schema Setup\n");
  console.log("Network: devnet\n");
  
  const client = getClient();
  
  // Load keypair (will be authority)
  const authority = await loadOrCreateKeypair();
  console.log(`Authority: ${authority.address}`);
  
  // Check balance
  const balance = await client.rpc.getBalance(authority.address).send();
  console.log(`Balance: ${Number(balance.value) / 1e9} SOL`);
  
  if (balance.value < lamports(100_000_000n)) {
    console.log("\n📥 Requesting airdrop...");
    const airdrop = airdropFactory({ rpc: client.rpc, rpcSubscriptions: client.rpcSubscriptions });
    await airdrop({
      commitment: "confirmed",
      lamports: lamports(1_000_000_000n),
      recipientAddress: authority.address,
    });
    console.log("   Airdrop complete!\n");
  }
  
  // Step 1: Create Credential
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Step 1: Creating Credential...\n");
  
  const [credentialPda] = await deriveCredentialPda({
    authority: authority.address,
    name: CONFIG.CREDENTIAL_NAME,
  });
  
  console.log(`Credential Name: ${CONFIG.CREDENTIAL_NAME}`);
  console.log(`Credential PDA:  ${credentialPda}`);
  
  // Check if already exists
  const credentialAccount = await client.rpc.getAccountInfo(credentialPda).send();
  
  if (credentialAccount.value) {
    console.log("✅ Credential already exists, skipping...\n");
  } else {
    const createCredentialIx = getCreateCredentialInstruction({
      payer: authority,
      credential: credentialPda,
      authority: authority,
      name: CONFIG.CREDENTIAL_NAME,
      signers: [authority.address], // Authority is also the authorized signer
    });
    
    await sendAndConfirmInstructions(
      client,
      authority,
      [createCredentialIx],
      "Credential created"
    );
    console.log();
  }
  
  // Step 2: Create Schema
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Step 2: Creating Schema...\n");
  
  const [schemaPda] = await deriveSchemaPda({
    credential: credentialPda,
    name: CONFIG.SCHEMA_NAME,
    version: CONFIG.SCHEMA_VERSION,
  });
  
  console.log(`Schema Name:    ${CONFIG.SCHEMA_NAME}`);
  console.log(`Schema Version: ${CONFIG.SCHEMA_VERSION}`);
  console.log(`Schema PDA:     ${schemaPda}`);
  console.log(`Fields:         ${CONFIG.SCHEMA_FIELDS.join(", ")}`);
  
  const schemaAccount = await client.rpc.getAccountInfo(schemaPda).send();
  
  if (schemaAccount.value) {
    console.log("✅ Schema already exists, skipping...\n");
  } else {
    const createSchemaIx = getCreateSchemaInstruction({
      authority: authority,
      payer: authority,
      name: CONFIG.SCHEMA_NAME,
      credential: credentialPda,
      description: CONFIG.SCHEMA_DESCRIPTION,
      fieldNames: CONFIG.SCHEMA_FIELDS,
      schema: schemaPda,
      layout: CONFIG.SCHEMA_LAYOUT,
    });
    
    await sendAndConfirmInstructions(
      client,
      authority,
      [createSchemaIx],
      "Schema created"
    );
    console.log();
  }
  
  // Step 3: Tokenize Schema
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Step 3: Tokenizing Schema (Collection)...\n");
  
  const [schemaMint] = await deriveSchemaMintPda({ schema: schemaPda });
  const sasPda = await deriveSasAuthorityAddress();
  
  console.log(`Schema Mint:    ${schemaMint}`);
  console.log(`SAS Authority:  ${sasPda}`);
  
  const mintAccount = await client.rpc.getAccountInfo(schemaMint).send();
  
  if (mintAccount.value) {
    console.log("✅ Schema already tokenized, skipping...\n");
  } else {
    const schemaMintSpace = getMintSize([
      {
        __kind: "GroupPointer",
        authority: sasPda,
        groupAddress: schemaMint,
      },
    ]);
    
    const tokenizeSchemaIx = getTokenizeSchemaInstruction({
      payer: authority,
      authority: authority,
      credential: credentialPda,
      schema: schemaPda,
      mint: schemaMint,
      sasPda,
      maxSize: schemaMintSpace,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });
    
    await sendAndConfirmInstructions(
      client,
      authority,
      [tokenizeSchemaIx],
      "Schema tokenized"
    );
    console.log();
  }
  
  // Output summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Setup Complete!\n");
  console.log("Addresses (save these!):\n");
  console.log(`CREDENTIAL_ADDRESS: "${credentialPda}"`);
  console.log(`SCHEMA_ADDRESS:     "${schemaPda}"`);
  console.log(`SCHEMA_MINT:        "${schemaMint}"`);
  console.log(`AUTHORITY:          "${authority.address}"`);
  console.log();
  
  // Save to file
  const addresses = {
    network: "devnet",
    credential: credentialPda,
    schema: schemaPda,
    schemaMint: schemaMint,
    authority: authority.address,
    createdAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    "addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("📝 Saved to addresses.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Setup failed:", err);
    process.exit(1);
  });
