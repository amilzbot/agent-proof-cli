/**
 * Solana client setup using @solana/kit
 */

import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  Rpc,
  RpcSubscriptions,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
} from "@solana/kit";
import { CONFIG } from "./config.js";

export interface Client {
  rpc: Rpc<SolanaRpcApi>;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
}

let _client: Client | null = null;

export function getClient(): Client {
  if (!_client) {
    _client = {
      rpc: createSolanaRpc(CONFIG.RPC_URL),
      rpcSubscriptions: createSolanaRpcSubscriptions(CONFIG.WSS_URL),
    };
  }
  return _client;
}

export function setRpcUrl(url: string, wssUrl?: string): void {
  _client = {
    rpc: createSolanaRpc(url),
    rpcSubscriptions: createSolanaRpcSubscriptions(
      wssUrl || url.replace("https://", "wss://").replace("http://", "ws://")
    ),
  };
}
