// Stellar Contract Client Wrapper
// This provides a compatible interface for contract interactions

import {
  Contract,
  // rpc, // Unused
  Address,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
// import { getCurrentNetwork } from "./stellar-config"; // Unused

export interface StellarContractClient {
  call(method: string, ...args: any[]): Promise<any>;
  send(method: string, ...args: any[]): Promise<string>;
}

export class StellarContract {
  private contract: Contract;
  // private rpcServer: rpc.Server; // Unused - only set in constructor but never used
  // private network: ReturnType<typeof getCurrentNetwork>; // Unused

  constructor(contractId: string) {
    // this.network = getCurrentNetwork(); // Unused
    // this.rpcServer = new rpc.Server(this.network.rpcUrl); // Unused
    this.contract = new Contract(contractId);
  }

  async call(method: string, ...args: any[]): Promise<any> {
    try {
      const methodArgs = args.map((arg) => {
        // Convert arguments to Stellar ScVal format
        if (typeof arg === "string") {
          return Address.fromString(arg).toScVal();
        } else if (typeof arg === "number") {
          return nativeToScVal(arg, { type: "i128" });
        } else if (typeof arg === "boolean") {
          return nativeToScVal(arg, { type: "bool" });
        }
        return nativeToScVal(arg);
      });

      const result = await this.contract.call(method, ...methodArgs);

      // Convert result back to native format
      if (result) {
        try {
          // Check if result is a valid ScVal before converting
          if (
            typeof result === "object" &&
            result !== null &&
            "switch" in result
          ) {
            return scValToNative(result as any);
          }
          return result;
        } catch {
          return result;
        }
      }
      return result;
    } catch (error) {
      console.error(`Error calling ${method}:`, error);
      throw error;
    }
  }

  async send(_method: string, ..._args: any[]): Promise<string> {
    // For Stellar, we need to build and sign the transaction
    // This will be handled by the wallet context
    throw new Error(
      "send() method not implemented in StellarClient - use Web3Context.send() instead"
    );
  }
}

export function createStellarContract(
  contractId: string
): StellarContractClient {
  const contract = new StellarContract(contractId);

  return {
    async call(method: string, ...args: any[]) {
      return contract.call(method, ...args);
    },
    async send(method: string, ...args: any[]) {
      return contract.send(method, ...args);
    },
  };
}
