/**
 * SAS Client - Wrapper around Solana Attestation Service
 * 
 * Uses sas-lib for:
 * - PDA derivation (deriveCredentialPda, deriveSchemaPda, etc.)
 * - Instruction building (getCreateCredentialInstruction, etc.)
 * - Data serialization (serializeAttestationData)
 */

import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  createKeyPairSignerFromBytes,
  address,
  type Address,
  type KeyPairSigner,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
  type IInstruction,
} from "@solana/kit";

import {
  deriveCredentialPda,
  deriveSchemaPda,
  deriveAttestationPda,
  deriveSchemaMintPda,
  deriveAttestationMintPda,
  deriveSasAuthorityAddress,
  getCreateCredentialInstruction,
  getCreateSchemaInstruction,
  getTokenizeSchemaInstruction,
  getCreateTokenizedAttestationInstruction,
  fetchSchema,
  serializeAttestationData,
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS,
} from "sas-lib";

import {
  TOKEN_2022_PROGRAM_ADDRESS,
  getMintSize,
  findAssociatedTokenPda,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";

import {
  getSetComputeUnitLimitInstruction,
} from "@solana-program/compute-budget";

export { SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS as SAS_PROGRAM_ID };

export interface SASClientConfig {
  rpcUrl: string;
  wssUrl: string;
  signer: KeyPairSigner;
}

export interface CredentialConfig {
  name: string;
  signers?: Address[];
}

export interface SchemaConfig {
  credentialName: string;
  name: string;
  description: string;
  layout: Uint8Array;
  fieldNames: string[];
  version?: number;
}

export class SASClient {
  private rpc: ReturnType<typeof createSolanaRpc>;
  private rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  private signer: KeyPairSigner;
  private sendAndConfirm: ReturnType<typeof sendAndConfirmTransactionFactory>;

  constructor(config: SASClientConfig) {
    this.rpc = createSolanaRpc(config.rpcUrl);
    this.rpcSubscriptions = createSolanaRpcSubscriptions(config.wssUrl);
    this.signer = config.signer;
    this.sendAndConfirm = sendAndConfirmTransactionFactory({
      rpc: this.rpc,
      rpcSubscriptions: this.rpcSubscriptions,
    });
  }

  /**
   * Get the signer's address
   */
  getAuthority(): Address {
    return this.signer.address;
  }

  /**
   * Get the RPC client
   */
  getRpc() {
    return this.rpc;
  }

  /**
   * Derive the credential PDA
   */
  async deriveCredentialAddress(name: string): Promise<Address> {
    const [pda] = await deriveCredentialPda({
      authority: this.signer.address,
      name,
    });
    return pda;
  }

  /**
   * Derive the schema PDA
   */
  async deriveSchemaAddress(credential: Address, name: string, version = 1): Promise<Address> {
    const [pda] = await deriveSchemaPda({
      credential,
      name,
      version,
    });
    return pda;
  }

  /**
   * Derive the attestation PDA
   */
  async deriveAttestationAddress(credential: Address, schema: Address, nonce: Address): Promise<Address> {
    const [pda] = await deriveAttestationPda({
      credential,
      schema,
      nonce,
    });
    return pda;
  }

  /**
   * Create a credential (authority to issue attestations)
   */
  async createCredential(config: CredentialConfig): Promise<{ signature: string; credential: Address; cuUsed: number; cuLimit: number }> {
    const credential = await this.deriveCredentialAddress(config.name);
    
    const ix = getCreateCredentialInstruction({
      payer: this.signer,
      credential,
      authority: this.signer,
      name: config.name,
      signers: config.signers || [this.signer.address],
    });

    const result = await this.sendTransaction([ix]);
    return { ...result, credential };
  }

  /**
   * Create a schema (defines attestation structure)
   */
  async createSchema(config: SchemaConfig): Promise<{ signature: string; schema: Address; cuUsed: number; cuLimit: number }> {
    const credential = await this.deriveCredentialAddress(config.credentialName);
    const schema = await this.deriveSchemaAddress(credential, config.name, config.version ?? 1);
    
    const ix = getCreateSchemaInstruction({
      payer: this.signer,
      credential,
      schema,
      authority: this.signer,
      name: config.name,
      description: config.description,
      layout: config.layout,
      fieldNames: config.fieldNames,
    });

    const result = await this.sendTransaction([ix]);
    return { ...result, schema };
  }

  /**
   * Tokenize a schema (enable NFT-backed attestations)
   */
  async tokenizeSchema(credential: Address, schema: Address): Promise<{ signature: string; mint: Address; cuUsed: number; cuLimit: number }> {
    const [mint] = await deriveSchemaMintPda({ schema });
    const sasPda = await deriveSasAuthorityAddress();
    
    // Calculate mint account space with Group extension
    const schemaMintAccountSpace = getMintSize([
      {
        __kind: "GroupPointer",
        authority: sasPda,
        groupAddress: mint,
      },
    ]);
    
    const ix = getTokenizeSchemaInstruction({
      payer: this.signer,
      credential,
      schema,
      mint,
      authority: this.signer,
      sasPda,
      maxSize: schemaMintAccountSpace,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });

    const result = await this.sendTransaction([ix]);
    return { ...result, mint };
  }

  /**
   * Create a tokenized attestation (mint proof NFT)
   */
  async createTokenizedAttestation(
    credential: Address,
    schema: Address,
    recipient: Address,
    nonce: Address,
    data: Record<string, unknown>,
    tokenName: string,
    tokenSymbol: string,
    tokenUri: string,
    expiryDays = 365,
  ): Promise<{ signature: string; attestation: Address; mint: Address; cuUsed: number; cuLimit: number }> {
    const attestation = await this.deriveAttestationAddress(credential, schema, nonce);
    const [attestationMint] = await deriveAttestationMintPda({ attestation });
    const [schemaMint] = await deriveSchemaMintPda({ schema });
    const sasPda = await deriveSasAuthorityAddress();
    
    // Fetch schema to serialize data
    const schemaAccount = await fetchSchema(this.rpc, schema);
    const serializedData = serializeAttestationData(schemaAccount.data, data);
    
    // Calculate expiry timestamp
    const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);
    
    // Find recipient's token account
    const [recipientTokenAccount] = await findAssociatedTokenPda({
      mint: attestationMint,
      owner: recipient,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });
    
    // Calculate mint account space with all extensions
    const mintAccountSpace = getMintSize([
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
        name: tokenName,
        symbol: tokenSymbol,
        uri: tokenUri,
        additionalMetadata: new Map([
          ["attestation", attestation],
          ["schema", schema],
        ]),
      },
      {
        __kind: "TokenGroupMember",
        group: schemaMint,
        mint: attestationMint,
        memberNumber: 1,
      },
    ]);
    
    const ix = await getCreateTokenizedAttestationInstruction({
      payer: this.signer,
      authority: this.signer,
      credential,
      schema,
      attestation,
      schemaMint,
      attestationMint,
      sasPda,
      recipient,
      nonce,
      expiry: expiryTimestamp,
      data: serializedData,
      name: tokenName,
      uri: tokenUri,
      symbol: tokenSymbol,
      mintAccountSpace,
      recipientTokenAccount,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });

    const result = await this.sendTransaction([ix]);
    return { ...result, attestation, mint: attestationMint };
  }

  /**
   * Check balance
   */
  async getBalance(): Promise<bigint> {
    const result = await this.rpc.getBalance(this.signer.address).send();
    return result.value;
  }

  /**
   * Airdrop SOL for testing (devnet only)
   */
  async airdrop(lamports: bigint = 1_000_000_000n): Promise<string> {
    const sig = await this.rpc.requestAirdrop(this.signer.address, lamports).send();
    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 2000));
    return sig;
  }

  /**
   * Send and confirm a transaction with CU estimation
   */
  private async sendTransaction(instructions: IInstruction[]): Promise<{ signature: string; cuUsed: number; cuLimit: number }> {
    const { value: latestBlockhash } = await this.rpc.getLatestBlockhash().send();
    
    // Build transaction for simulation (without CU limit)
    const simMessage = pipe(
      createTransactionMessage({ version: 0 }),
      tx => setTransactionMessageFeePayer(this.signer.address, tx),
      tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      tx => appendTransactionMessageInstructions(instructions, tx),
    );
    
    // Sign for simulation
    const simTx = await signTransactionMessageWithSigners(simMessage);
    
    // Simulate to get actual CU usage
    const simResult = await this.rpc.simulateTransaction(simTx, {
      commitment: "confirmed",
      replaceRecentBlockhash: true,
    }).send();
    
    // Extract CU consumed and add 10% buffer
    const cuConsumed = Number(simResult.value.unitsConsumed ?? 200_000);
    const cuLimit = Math.ceil(cuConsumed * 1.1);
    
    // Build final transaction with optimized CU limit
    const cuLimitIx = getSetComputeUnitLimitInstruction({ units: cuLimit });
    
    const finalMessage = pipe(
      createTransactionMessage({ version: 0 }),
      tx => setTransactionMessageFeePayer(this.signer.address, tx),
      tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      tx => appendTransactionMessageInstructions([cuLimitIx, ...instructions], tx),
    );

    const signedTx = await signTransactionMessageWithSigners(finalMessage);
    await this.sendAndConfirm(signedTx, { commitment: "confirmed" });
    
    return {
      signature: getSignatureFromTransaction(signedTx),
      cuUsed: cuConsumed,
      cuLimit,
    };
  }
}

/**
 * Load a keypair from a JSON file (Solana CLI format)
 */
export async function loadKeypairFromFile(path: string): Promise<KeyPairSigner> {
  const file = Bun.file(path);
  const bytes = new Uint8Array(await file.json());
  return createKeyPairSignerFromBytes(bytes);
}

/**
 * Create a new random keypair
 */
export async function createNewKeypair(): Promise<KeyPairSigner> {
  return generateKeyPairSigner();
}

/**
 * Re-export utilities
 */
export { fetchSchema, serializeAttestationData };
