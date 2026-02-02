/**
 * Transaction helpers using @solana/kit
 */

import {
  pipe,
  createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  sendAndConfirmTransactionFactory,
  TransactionSigner,
  Instruction,
  Commitment,
  MicroLamports,
  assertIsFullySignedTransaction,
  assertIsTransactionWithBlockhashLifetime,
  assertIsSendableTransaction,
  assertIsTransactionWithinSizeLimit,
  Signature,
} from "@solana/kit";
import {
  updateOrAppendSetComputeUnitLimitInstruction,
  updateOrAppendSetComputeUnitPriceInstruction,
  MAX_COMPUTE_UNIT_LIMIT,
  estimateComputeUnitLimitFactory,
} from "@solana-program/compute-budget";
import { Client } from "./client.js";

/**
 * Create a default transaction message with compute budget
 */
export async function createDefaultTransaction(
  client: Client,
  feePayer: TransactionSigner,
  computeLimit: number = MAX_COMPUTE_UNIT_LIMIT,
  feeMicroLamports: MicroLamports = 1n as MicroLamports
) {
  const { value: latestBlockhash } = await client.rpc
    .getLatestBlockhash()
    .send();

  return pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => updateOrAppendSetComputeUnitPriceInstruction(feeMicroLamports, tx),
    (tx) => updateOrAppendSetComputeUnitLimitInstruction(computeLimit, tx)
  );
}

/**
 * Send and confirm a list of instructions
 */
export async function sendAndConfirmInstructions(
  client: Client,
  payer: TransactionSigner,
  instructions: Instruction[],
  description?: string
): Promise<Signature> {
  // First, simulate to estimate compute units
  const simulationTx = await pipe(
    await createDefaultTransaction(client, payer),
    (tx) => appendTransactionMessageInstructions(instructions, tx)
  );

  const estimateCompute = estimateComputeUnitLimitFactory({ rpc: client.rpc });
  const computeUnitLimit = await estimateCompute(simulationTx);

  // Build final transaction with accurate compute limit
  const signature = await pipe(
    await createDefaultTransaction(client, payer, computeUnitLimit),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    async (tx) => {
      const signedTx = await signTransactionMessageWithSigners(tx);
      const sig = getSignatureFromTransaction(signedTx);

      assertIsFullySignedTransaction(signedTx);
      assertIsTransactionWithinSizeLimit(signedTx);
      assertIsSendableTransaction(signedTx);
      assertIsTransactionWithBlockhashLifetime(signedTx);

      await sendAndConfirmTransactionFactory(client)(signedTx, {
        commitment: "confirmed" as Commitment,
      });

      return sig;
    }
  );

  if (description) {
    console.log(`✅ ${description}`);
    console.log(`   Signature: ${signature}`);
  }

  return signature;
}
