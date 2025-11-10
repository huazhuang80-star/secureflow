import { Buffer } from "buffer";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type { u32, i128, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}

export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDY5RKZP4NAAWVSTJEL2G4NPHD2PXOX4DHIRYBGKY7JA5KESQX7VYKIO",
  },
} as const;

export type EscrowStatus =
  | { tag: "Pending"; values: void }
  | { tag: "InProgress"; values: void }
  | { tag: "Released"; values: void }
  | { tag: "Refunded"; values: void }
  | { tag: "Disputed"; values: void }
  | { tag: "Expired"; values: void };

export type MilestoneStatus =
  | { tag: "NotStarted"; values: void }
  | { tag: "Submitted"; values: void }
  | { tag: "Approved"; values: void }
  | { tag: "Disputed"; values: void }
  | { tag: "Resolved"; values: void }
  | { tag: "Rejected"; values: void };

export interface Milestone {
  amount: i128;
  approved_at: u32;
  description: string;
  dispute_reason: Option<string>;
  disputed_at: u32;
  disputed_by: Option<string>;
  status: MilestoneStatus;
  submitted_at: u32;
}

export interface Application {
  applied_at: u32;
  cover_letter: string;
  freelancer: string;
  proposed_timeline: u32;
}

export interface EscrowData {
  arbiters: Array<string>;
  beneficiary: Option<string>;
  created_at: u32;
  deadline: u32;
  depositor: string;
  is_open_job: boolean;
  milestone_count: u32;
  paid_amount: i128;
  platform_fee: i128;
  project_description: string;
  project_title: string;
  required_confirmations: u32;
  status: EscrowStatus;
  token: Option<string>;
  total_amount: i128;
  work_started: boolean;
}

export type DataKey =
  | { tag: "Escrow"; values: readonly [u32] }
  | { tag: "Milestone"; values: readonly [u32, u32] }
  | { tag: "Application"; values: readonly [u32, u32] }
  | { tag: "UserEscrows"; values: readonly [string] }
  | { tag: "AuthorizedArbiter"; values: readonly [string] }
  | { tag: "WhitelistedToken"; values: readonly [string] }
  | { tag: "EscrowedAmount"; values: readonly [string] }
  | { tag: "TotalFeesByToken"; values: readonly [string] }
  | { tag: "Reputation"; values: readonly [string] }
  | { tag: "CompletedEscrows"; values: readonly [string] }
  | { tag: "NextEscrowId"; values: void }
  | { tag: "PlatformFeeBP"; values: void }
  | { tag: "FeeCollector"; values: void }
  | { tag: "Owner"; values: void }
  | { tag: "JobCreationPaused"; values: void };

export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the contract
   */
  initialize: (
    {
      owner,
      fee_collector,
      platform_fee_bp,
    }: { owner: string; fee_collector: string; platform_fee_bp: u32 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a create_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create an escrow with token
   * Note: Milestone amounts and descriptions are combined into tuples to reduce parameter count
   */
  create_escrow: (
    {
      depositor,
      beneficiary,
      arbiters,
      required_confirmations,
      milestones,
      token,
      total_amount,
      duration,
      project_title,
      project_description,
    }: {
      depositor: string;
      beneficiary: Option<string>;
      arbiters: Array<string>;
      required_confirmations: u32;
      milestones: Array<readonly [i128, string]>;
      token: Option<string>;
      total_amount: i128;
      duration: u32;
      project_title: string;
      project_description: string;
    },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<u32>>>;

  /**
   * Construct and simulate a start_work transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Start work on an escrow
   */
  start_work: (
    { escrow_id, beneficiary }: { escrow_id: u32; beneficiary: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a submit_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Submit a milestone
   */
  submit_milestone: (
    {
      escrow_id,
      milestone_index,
      description,
      beneficiary,
    }: {
      escrow_id: u32;
      milestone_index: u32;
      description: string;
      beneficiary: string;
    },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a approve_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Approve a milestone
   */
  approve_milestone: (
    {
      escrow_id,
      milestone_index,
      depositor,
    }: { escrow_id: u32; milestone_index: u32; depositor: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a apply_to_job transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Apply to a job
   */
  apply_to_job: (
    {
      escrow_id,
      cover_letter,
      proposed_timeline,
      freelancer,
    }: {
      escrow_id: u32;
      cover_letter: string;
      proposed_timeline: u32;
      freelancer: string;
    },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a accept_freelancer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Accept a freelancer for an open job
   */
  accept_freelancer: (
    {
      escrow_id,
      freelancer,
      depositor,
    }: { escrow_id: u32; freelancer: string; depositor: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a refund_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Refund an escrow
   */
  refund_escrow: (
    { escrow_id, depositor }: { escrow_id: u32; depositor: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a emergency_refund_after_deadline transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Emergency refund after deadline
   */
  emergency_refund_after_deadline: (
    { escrow_id, depositor }: { escrow_id: u32; depositor: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a extend_deadline transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Extend deadline
   */
  extend_deadline: (
    {
      escrow_id,
      extra_seconds,
      depositor,
    }: { escrow_id: u32; extra_seconds: u32; depositor: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrow: (
    { escrow_id }: { escrow_id: u32 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Option<EscrowData>>>;

  /**
   * Construct and simulate a get_user_escrows transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_user_escrows: (
    { user }: { user: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a get_reputation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_reputation: (
    { user }: { user: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a set_platform_fee_bp transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_platform_fee_bp: (
    { fee_bp }: { fee_bp: u32 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a set_fee_collector transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_fee_collector: (
    { fee_collector }: { fee_collector: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a whitelist_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  whitelist_token: (
    { token }: { token: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a authorize_arbiter transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  authorize_arbiter: (
    { arbiter }: { arbiter: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a pause_job_creation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pause job creation
   */
  pause_job_creation: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a unpause_job_creation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Unpause job creation
   */
  unpause_job_creation: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a is_job_creation_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if job creation is paused
   */
  is_job_creation_paused: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<boolean>>;
}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options);
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "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",
        "AAAAAAAAAB9FbWVyZ2VuY3kgcmVmdW5kIGFmdGVyIGRlYWRsaW5lAAAAAB9lbWVyZ2VuY3lfcmVmdW5kX2FmdGVyX2RlYWRsaW5lAAAAAAIAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAQAAAAAAAAACWRlcG9zaXRvcgAAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAA9FeHRlbmQgZGVhZGxpbmUAAAAAD2V4dGVuZF9kZWFkbGluZQAAAAADAAAAAAAAAAllc2Nyb3dfaWQAAAAAAAAEAAAAAAAAAA1leHRyYV9zZWNvbmRzAAAAAAAABAAAAAAAAAAJZGVwb3NpdG9yAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAKZ2V0X2VzY3JvdwAAAAAAAQAAAAAAAAAJZXNjcm93X2lkAAAAAAAABAAAAAEAAAPoAAAH0AAAAApFc2Nyb3dEYXRhAAA=",
        "AAAAAAAAAAAAAAAQZ2V0X3VzZXJfZXNjcm93cwAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAA+oAAAAE",
        "AAAAAAAAAAAAAAAOZ2V0X3JlcHV0YXRpb24AAAAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAATc2V0X3BsYXRmb3JtX2ZlZV9icAAAAAABAAAAAAAAAAZmZWVfYnAAAAAAAAQAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAARc2V0X2ZlZV9jb2xsZWN0b3IAAAAAAAABAAAAAAAAAA1mZWVfY29sbGVjdG9yAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAPd2hpdGVsaXN0X3Rva2VuAAAAAAEAAAAAAAAABXRva2VuAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAARYXV0aG9yaXplX2FyYml0ZXIAAAAAAAABAAAAAAAAAAdhcmJpdGVyAAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAABJQYXVzZSBqb2IgY3JlYXRpb24AAAAAABJwYXVzZV9qb2JfY3JlYXRpb24AAAAAAAAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAABRVbnBhdXNlIGpvYiBjcmVhdGlvbgAAABR1bnBhdXNlX2pvYl9jcmVhdGlvbgAAAAAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAB9DaGVjayBpZiBqb2IgY3JlYXRpb24gaXMgcGF1c2VkAAAAABZpc19qb2JfY3JlYXRpb25fcGF1c2VkAAAAAAAAAAAAAQAAAAE=",
      ]),
      options
    );
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<Result<void>>,
    create_escrow: this.txFromJSON<Result<u32>>,
    start_work: this.txFromJSON<Result<void>>,
    submit_milestone: this.txFromJSON<Result<void>>,
    approve_milestone: this.txFromJSON<Result<void>>,
    apply_to_job: this.txFromJSON<Result<void>>,
    accept_freelancer: this.txFromJSON<Result<void>>,
    refund_escrow: this.txFromJSON<Result<void>>,
    emergency_refund_after_deadline: this.txFromJSON<Result<void>>,
    extend_deadline: this.txFromJSON<Result<void>>,
    get_escrow: this.txFromJSON<Option<EscrowData>>,
    get_user_escrows: this.txFromJSON<Array<u32>>,
    get_reputation: this.txFromJSON<u32>,
    set_platform_fee_bp: this.txFromJSON<Result<void>>,
    set_fee_collector: this.txFromJSON<Result<void>>,
    whitelist_token: this.txFromJSON<Result<void>>,
    authorize_arbiter: this.txFromJSON<Result<void>>,
    pause_job_creation: this.txFromJSON<Result<void>>,
    unpause_job_creation: this.txFromJSON<Result<void>>,
    is_job_creation_paused: this.txFromJSON<boolean>,
  };
}
