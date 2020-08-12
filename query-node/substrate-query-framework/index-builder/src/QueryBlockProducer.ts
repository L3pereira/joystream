import ISubstrateQueryService from './ISubstrateQueryService';
import QueryEvent from './QueryEvent';
import QueryEventBlock from './QueryEventBlock';
import { Header, Extrinsic, EventRecord } from '@polkadot/types/interfaces';
import { EventEmitter } from 'events';
import * as assert from 'assert';
import * as BN from 'bn.js';

const DEBUG_TOPIC = 'index-builder:producer';

// start with 250ms delay before retrying to produce a block
const DEFAULT_BACKOFF_TIME_MS = 250;

// Maximal delyar between retries 
const MAX_BACKOFF_TIME_MS = 30 * 60 * 1000;

// Time between checks if the head of the chain is beyond the
// most recently produced block
const POLL_INTERVAL_MS = 100;

// There-are no timeouts for the WS fetches, so 
// we have to abort explicitly. This parameter indicates
// the period of time after which the API calls are failed by timeout.
const FETCH_TIMEOUT_MS = 5000;

var debug = require('debug')(DEBUG_TOPIC);

export default class QueryBlockProducer extends EventEmitter {
  private _started: boolean;

  private _backOffTime = DEFAULT_BACKOFF_TIME_MS;

  private _producing_blocks_blocks: boolean;

  private readonly _query_service: ISubstrateQueryService;

  private _new_heads_unsubscriber: () => void;

  private _block_to_be_produced_next: BN;

  // Index of the last processed event
  private _last_processed_event_index: BN;

  private _at_block: BN;

  private _height_of_chain: BN;

  constructor(query_service: ISubstrateQueryService) {
    super();

    this._started = false;
    this._producing_blocks_blocks = false;
    this._query_service = query_service;

    // TODO
    // need to set this up, when state is better, it
    // will be refactored
    this._new_heads_unsubscriber = () => {};

    this._block_to_be_produced_next = new BN(0);
    this._height_of_chain = new BN(0);
    this._last_processed_event_index = new BN(0);
    this._at_block = new BN(0);
  }

  // TODO: We cannot assume first block has events... we need more robust logic.
  async start(at_block?: BN, at_event?: BN) {
    if (this._started) throw Error(`Cannot start when already started.`);

    // mark as started
    this._started = true;

    // Try to get initial header right away
    this._height_of_chain = await this._query_service
      .getFinalizedHead()
      .then((hash) => {
        return this._query_service.getHeader(hash);
      })
      .then((header) => {
        return header.number.toBn();
      });

    if (at_block) {
      this._block_to_be_produced_next = at_block;
      this._at_block = at_block;

      if (at_block.gt(this._height_of_chain)) throw Error(`Provided block is ahead of chain.`);
    }

    if (at_event) {
      this._last_processed_event_index = at_event;
    }

    //
    this._new_heads_unsubscriber = await this._query_service.subscribeNewHeads((header) => {
      this._OnNewHeads(header);
    });

    debug(`Starting the block producer, next block: ${this._block_to_be_produced_next}`);
    // Start producing blocks right away
    if (!this._producing_blocks_blocks) await this._produce_blocks();
  }

  async stop() {
    if (!this._started) throw new Error(`Cannot stop when not already started.`);

    // THIS IS VERY CRUDE, NEED TO MANAGE LOTS OF STUFF HERE!

    (await this._new_heads_unsubscriber)();

    this._started = false;
  }

  private async _OnNewHeads(header: Header) {
    assert(this._started, 'Has to be started to process new heads.');

    this._height_of_chain = header.number.toBn();

    debug(`New block found at height #${this._height_of_chain}`);

    if (!this._producing_blocks_blocks) await this._produce_blocks();
  }

  /*
   * Await for the promise or reject after a timeout
   */
  private async _withTimeout<T>(promiseFn: Promise<T>, rejectMsg?: string): Promise<T> {
    // Create a promise that rejects in <ms> milliseconds
    let timeoutPromise = new Promise((resolve, reject) => {
      let id = setTimeout(() => {
        clearTimeout(id);
        reject(`${rejectMsg || 'Execution time-out'}`);
      }, FETCH_TIMEOUT_MS)
    });

    // Returns a race between our timeout and the passed in promise
    return Promise.race([
      promiseFn,
      timeoutPromise
    ]).then(((x: any) =>  x as T));
  }

  /**
   * This sub-routing does the actual fetching and block processing.
   * It can throw errors which should be handled by the top-level code 
   * (in this case _produce_block())
   */
  private async _doBlockProduce() {
    debug(`Fetching block #${this._block_to_be_produced_next}`);

    let block_hash_of_target = await this._withTimeout(
         this._query_service.getBlockHash(this._block_to_be_produced_next.toString()),
        `Timeout: failed to fetch the block hash at height ${this._block_to_be_produced_next.toString()}`);
    
    debug(`\tHash ${block_hash_of_target.toString()}.`);

    let records = [];

    records = await this._withTimeout(
        this._query_service.eventsAt(block_hash_of_target), 
      `Timeout: failed to fetch events for block ${this._block_to_be_produced_next.toString()}`);
    
    debug(`\tRead ${records.length} events.`);

    let extrinsics_array: Extrinsic[] = [];
    let signed_block = await this._withTimeout(
      this._query_service.getBlock(block_hash_of_target),
      `Timeout: failed to fetch the block ${this._block_to_be_produced_next.toString()}`);

    debug(`\tFetched full block.`);

    extrinsics_array = signed_block.block.extrinsics.toArray();
    let query_events: QueryEvent[] = records.map(
      (record, index): QueryEvent => {
          // Extract the phase, event
        const { phase } = record;

          // Try to recover extrinsic: only possible if its right phase, and extrinsics arra is non-empty, the last constraint
          // is needed to avoid events from build config code in genesis, and possibly other cases.
        let extrinsic =
          phase.isApplyExtrinsic && extrinsics_array.length
            ? extrinsics_array[phase.asApplyExtrinsic.toBn()]
              : undefined;

        let query_event = new QueryEvent(record, this._block_to_be_produced_next, extrinsic);

          // Logging
        query_event.log(0, debug);

        return query_event;
      }
    );

      // Remove processed events from the list.
    if (this._block_to_be_produced_next.eq(this._at_block)) {
      query_events = query_events.filter((event) => event.index.gt(this._last_processed_event_index));
    }

    let query_block = new QueryEventBlock(this._block_to_be_produced_next, query_events);

    this.emit('QueryEventBlock', query_block);

    debug(`\tEmitted query event block.`);
  }

  private _resetBackOffTime() {
    this._backOffTime = DEFAULT_BACKOFF_TIME_MS;
  } 

  private _increaseBackOffTime() {
    this._backOffTime = Math.min(this._backOffTime * 2, MAX_BACKOFF_TIME_MS);
  }


  private async _produce_blocks() {
    if (!this._started) {
      throw new Error("The block producer is stopped")
    }

    assert(!this._producing_blocks_blocks, 'Cannot already be producing blocks.');
    this._producing_blocks_blocks = true;

    // Continue as long as we know there are outstanding blocks.
    while (this._block_to_be_produced_next.lte(this._height_of_chain)) {
      try {
        await this._doBlockProduce();
        // all went fine, so reset the back-off time
        this._resetBackOffTime();
        // and proceed to the next block
        this._block_to_be_produced_next = this._block_to_be_produced_next.addn(1);
      
      } catch (e) {
        console.error(e);
        debug(`An error occured while producting block ${this._block_to_be_produced_next}`);
        // waiting until the next retry
        debug(`Retrying after ${this._backOffTime} ms`);
        await new Promise((resolve)=>setTimeout(() => {
          resolve();
        }, this._backOffTime));
        this._increaseBackOffTime();
      }
    }
    this._producing_blocks_blocks = false;
     
  }
}