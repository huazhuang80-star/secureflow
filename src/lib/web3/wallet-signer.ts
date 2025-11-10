/**
 * Centralized wallet signing utility
 * Handles transaction signing with Stellar wallets
 */

import { TransactionBuilder } from "@stellar/stellar-sdk";
import { wallet } from "@/util/wallet";
import { getCurrentNetwork } from "./stellar-config";
import storage from "@/util/storage";
// import { kit } from "./wallet-kit"; // Unused

interface SignTransactionProps {
  unsignedTransaction: string | TransactionBuilder;
  address: string;
}

export const signTransaction = async ({
  unsignedTransaction,
  address,
}: SignTransactionProps): Promise<string> => {
  const network = getCurrentNetwork();

  // Convert TransactionBuilder to XDR if needed
  let txXdr: string;
  if (typeof unsignedTransaction === "string") {
    txXdr = unsignedTransaction;
  } else {
    // TransactionBuilder has toXDR() method
    txXdr = (unsignedTransaction as any).toXDR();
  }

  // Get wallet ID from storage
  const walletId = storage.getItem("walletId");
  if (!walletId) {
    throw new Error("Wallet not connected");
  }

  // Set wallet if not already set
  wallet.setWallet(walletId);

  // Sign the transaction using the wallet utility
  // The wallet utility has a signTransaction method that works with all wallets
  const signResult = await wallet.signTransaction(txXdr, {
    networkPassphrase: network.networkPassphrase,
    address,
  });

  if (!signResult || !signResult.signedTxXdr) {
    throw new Error(
      "Transaction signing failed - no signed transaction received"
    );
  }

  return signResult.signedTxXdr;
};

/**
 * Sign auth entries for contract invocations
 */
export const signAuthEntries = async (
  authEntries: any[],
  address: string
): Promise<string[]> => {
  const network = getCurrentNetwork();

  // Try to use Freighter API for auth entries if available
  try {
    const { signAuthEntry } = await import("@stellar/freighter-api");

    const signedAuthEntries = await Promise.all(
      authEntries.map(async (entry: any) => {
        const entryXdr = entry.toXDR("base64");
        const signed = await signAuthEntry(entryXdr, {
          networkPassphrase: network.networkPassphrase,
          address,
        });

        // Ensure we have a signed auth entry
        const signedEntry =
          signed.signedAuthEntry || (signed as any).signedAuthEntryXdr;
        if (!signedEntry || signedEntry === entryXdr) {
          throw new Error(
            "Auth entry signing failed - no signed entry returned"
          );
        }

        return signedEntry;
      })
    );

    return signedAuthEntries;
  } catch (error) {
    // Don't fallback - throw error if signing fails
    console.error("Auth entry signing failed:", error);
    throw new Error(
      `Failed to sign auth entries: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
