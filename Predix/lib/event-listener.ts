import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { AnchorProvider, Program, Idl, BorshEventCoder } from '@coral-xyz/anchor';
import mysql from 'mysql2/promise';

// 事件类型定义
interface EventBetPlaced {
  user: PublicKey;
  market: PublicKey;
  team: number;
  amount: number;
  oddsBps: number;
  multiplierBps: number;
}

interface EventBetClosed {
  user: PublicKey;
  market: PublicKey;
  bet: PublicKey;
  closePrice: number;
  payout: number;
  pnl: number;
}

interface EventBetClaimed {
  user: PublicKey;
  market: PublicKey;
  payout: number;
  pnl: number;
}

interface EventMarketResolved {
  market: PublicKey;
  result: number;
}

interface SyncState {
  lastProcessedSlot: number;
  lastSyncTime: Date;
  pendingEvents: number;
  failedEvents: number;
}

export class EventListener {
  private connection: Connection;
  private programId: PublicKey;
  private program: Program | null = null;
  private eventCoder: BorshEventCoder | null = null;
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private mysqlConfig: any;

  constructor(
    rpcUrl: string,
    programId: string,
    mysqlUrl: string
  ) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.programId = new PublicKey(programId);
    this.mysqlConfig = this.parseMysqlUrl(mysqlUrl);
  }

  private parseMysqlUrl(url: string) {
    const u = new URL(url);
    const database = u.pathname.replace(/^\//, '') || undefined;
    const ssl = u.searchParams.get('ssl');
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port) : 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database,
      ssl: ssl === 'true' ? {} : undefined,
      connectionLimit: 5,
    };
  }

  // 初始化程序和事件编码器
  async initialize(idl: Idl) {
    try {
      // 创建一个虚拟的 provider（仅用于解析事件）
      const wallet = {
        publicKey: this.programId,
        signTransaction: async () => { throw new Error('Not implemented'); },
        signAllTransactions: async () => { throw new Error('Not implemented'); }
      };
      
      const provider = new AnchorProvider(this.connection, wallet as any, {
        commitment: 'confirmed'
      });

      this.program = new Program(idl, this.programId, provider);
      this.eventCoder = new BorshEventCoder(idl);
      
      console.log('[EventListener] Initialized successfully');
    } catch (error) {
      console.error('[EventListener] Initialization failed:', error);
      throw error;
    }
  }

  // 开始监听事件
  async start() {
    if (this.isRunning) {
      console.log('[EventListener] Already running');
      return;
    }

    if (!this.program || !this.eventCoder) {
      throw new Error('EventListener not initialized');
    }

    this.isRunning = true;
    console.log('[EventListener] Starting event listener...');

    // 获取上次同步的状态
    const syncState = await this.getSyncState();
    let lastProcessedSlot = syncState.lastProcessedSlot;

    // 开始定期同步
    this.syncInterval = setInterval(async () => {
      try {
        const currentSlot = await this.connection.getSlot('confirmed');
        
        if (currentSlot > lastProcessedSlot) {
          const processedSlot = await this.processSlotRange(
            lastProcessedSlot + 1, 
            Math.min(currentSlot, lastProcessedSlot + 100) // 每次最多处理100个slot
          );
          
          if (processedSlot > lastProcessedSlot) {
            lastProcessedSlot = processedSlot;
            await this.updateSyncState(lastProcessedSlot);
          }
        }
      } catch (error) {
        console.error('[EventListener] Sync error:', error);
      }
    }, 5000); // 每5秒同步一次

    console.log(`[EventListener] Started, last processed slot: ${lastProcessedSlot}`);
  }

  // 停止监听
  async stop() {
    this.isRunning = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    console.log('[EventListener] Stopped');
  }

  // 处理指定slot范围内的交易
  private async processSlotRange(startSlot: number, endSlot: number): Promise<number> {
    let processedSlot = startSlot - 1;

    try {
      for (let slot = startSlot; slot <= endSlot; slot++) {
        const block = await this.connection.getBlock(slot, {
          maxSupportedTransactionVersion: 0
        });

        if (!block) {
          processedSlot = slot;
          continue;
        }

        for (const tx of block.transactions) {
          if (tx.meta?.err) continue; // 跳过失败的交易

          await this.processTransaction(tx, slot);
        }

        processedSlot = slot;
      }
    } catch (error) {
      console.error(`[EventListener] Error processing slots ${startSlot}-${endSlot}:`, error);
    }

    return processedSlot;
  }

  // 处理单个交易
  private async processTransaction(tx: ParsedTransactionWithMeta, slot: number) {
    try {
      if (!tx.meta?.logMessages || !this.eventCoder) return;

      // 检查是否是我们程序的交易
      const accountKeys = tx.transaction.message.accountKeys;
      const isProgramTransaction = accountKeys.some(key => 
        key.pubkey.equals(this.programId)
      );

      if (!isProgramTransaction) return;

      // 解析事件
      const events = this.parseEventsFromLogs(tx.meta.logMessages);
      
      for (const event of events) {
        await this.handleEvent(event, tx.transaction.signatures[0], slot);
      }

    } catch (error) {
      console.error('[EventListener] Error processing transaction:', error);
    }
  }

  // 从日志中解析事件
  private parseEventsFromLogs(logs: string[]): any[] {
    const events: any[] = [];

    if (!this.eventCoder) return events;

    for (const log of logs) {
      try {
        // Anchor事件日志格式: "Program data: <base64_encoded_event_data>"
        if (log.startsWith('Program data: ')) {
          const eventData = log.slice('Program data: '.length);
          const buffer = Buffer.from(eventData, 'base64');
          
          // 尝试解码事件
          const event = this.eventCoder.decode(buffer);
          if (event) {
            events.push(event);
          }
        }
      } catch (error) {
        // 忽略解析错误，可能不是我们的事件
      }
    }

    return events;
  }

  // 处理具体的事件
  private async handleEvent(event: any, signature: string, slot: number) {
    try {
      switch (event.name) {
        case 'EventBetPlaced':
          await this.handleBetPlacedEvent(event.data, signature, slot);
          break;
        case 'EventBetClosed':
          await this.handleBetClosedEvent(event.data, signature, slot);
          break;
        case 'EventBetClaimed':
          await this.handleBetClaimedEvent(event.data, signature, slot);
          break;
        case 'EventMarketResolved':
          await this.handleMarketResolvedEvent(event.data, signature, slot);
          break;
        default:
          console.log(`[EventListener] Unknown event: ${event.name}`);
      }
    } catch (error) {
      console.error(`[EventListener] Error handling event ${event.name}:`, error);
      await this.recordFailedEvent(event, signature, slot, error);
    }
  }

  // 处理开仓事件
  private async handleBetPlacedEvent(eventData: EventBetPlaced, signature: string, slot: number) {
    const pool = await mysql.createPool(this.mysqlConfig);

    try {
      // 调用开仓API
      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: eventData.user.toString(),
          market_address: eventData.market.toString(),
          selected_team: eventData.team,
          amount: eventData.amount,
          multiplier_bps: eventData.multiplierBps,
          odds_home_bps: eventData.team === 1 ? eventData.oddsBps : null,
          odds_away_bps: eventData.team === 2 ? eventData.oddsBps : null,
          transaction_signature: signature
        })
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      console.log(`[EventListener] Processed BetPlaced event: ${signature}`);

    } catch (error) {
      console.error('[EventListener] Error handling BetPlaced event:', error);
      throw error;
    } finally {
      await pool.end();
    }
  }

  // 处理平仓事件
  private async handleBetClosedEvent(eventData: EventBetClosed, signature: string, slot: number) {
    const pool = await mysql.createPool(this.mysqlConfig);

    try {
      // 查找对应的开仓记录
      const [positionRows] = await pool.query(
        'SELECT id FROM positions WHERE wallet_address = ? AND market_address = ? AND position_type = "OPEN" AND status = 1',
        [eventData.user.toString(), eventData.market.toString()]
      );

      if ((positionRows as any[]).length === 0) {
        throw new Error('Original position not found for close event');
      }

      const positionId = (positionRows as any[])[0].id;

      // 调用平仓API
      const response = await fetch('/api/positions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position_id: positionId,
          wallet_address: eventData.user.toString(),
          close_price: eventData.closePrice,
          close_pnl: eventData.pnl,
          transaction_signature: signature
        })
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      console.log(`[EventListener] Processed BetClosed event: ${signature}`);

    } catch (error) {
      console.error('[EventListener] Error handling BetClosed event:', error);
      throw error;
    } finally {
      await pool.end();
    }
  }

  // 处理兑付事件
  private async handleBetClaimedEvent(eventData: EventBetClaimed, signature: string, slot: number) {
    const pool = await mysql.createPool(this.mysqlConfig);

    try {
      // 更新持仓状态为已兑付
      await pool.query(
        `UPDATE positions 
         SET status = CASE WHEN ? > 0 THEN 2 ELSE 3 END, 
             pnl = ?, 
             is_claimed = true,
             updated_at = NOW()
         WHERE wallet_address = ? AND market_address = ? AND position_type = 'OPEN'`,
        [eventData.pnl, eventData.pnl, eventData.user.toString(), eventData.market.toString()]
      );

      console.log(`[EventListener] Processed BetClaimed event: ${signature}`);

    } catch (error) {
      console.error('[EventListener] Error handling BetClaimed event:', error);
      throw error;
    } finally {
      await pool.end();
    }
  }

  // 处理市场结算事件
  private async handleMarketResolvedEvent(eventData: EventMarketResolved, signature: string, slot: number) {
    try {
      // 调用市场更新API
      const response = await fetch('/api/markets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_address: eventData.market.toString(),
          state: 3, // Resolved
          result: eventData.result,
          resolved_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      console.log(`[EventListener] Processed MarketResolved event: ${signature}`);

    } catch (error) {
      console.error('[EventListener] Error handling MarketResolved event:', error);
      throw error;
    }
  }

  // 获取同步状态
  private async getSyncState(): Promise<SyncState> {
    const pool = await mysql.createPool(this.mysqlConfig);

    try {
      const [rows] = await pool.query(
        'SELECT * FROM blockchain_events WHERE event_type = "sync_state" ORDER BY id DESC LIMIT 1'
      );

      if ((rows as any[]).length > 0) {
        const row = (rows as any[])[0];
        return {
          lastProcessedSlot: row.block_slot || 0,
          lastSyncTime: row.timestamp,
          pendingEvents: 0,
          failedEvents: 0
        };
      }

      // 如果没有记录，从当前slot开始
      const currentSlot = await this.connection.getSlot('confirmed');
      return {
        lastProcessedSlot: currentSlot,
        lastSyncTime: new Date(),
        pendingEvents: 0,
        failedEvents: 0
      };

    } catch (error) {
      console.error('[EventListener] Error getting sync state:', error);
      const currentSlot = await this.connection.getSlot('confirmed');
      return {
        lastProcessedSlot: currentSlot,
        lastSyncTime: new Date(),
        pendingEvents: 0,
        failedEvents: 0
      };
    } finally {
      await pool.end();
    }
  }

  // 更新同步状态
  private async updateSyncState(lastProcessedSlot: number) {
    const pool = await mysql.createPool(this.mysqlConfig);

    try {
      await pool.query(
        `INSERT INTO blockchain_events (
          event_type, block_slot, timestamp, event_data
        ) VALUES ('sync_state', ?, NOW(), ?)`,
        [lastProcessedSlot, JSON.stringify({ lastProcessedSlot })]
      );

    } catch (error) {
      console.error('[EventListener] Error updating sync state:', error);
    } finally {
      await pool.end();
    }
  }

  // 记录失败的事件
  private async recordFailedEvent(event: any, signature: string, slot: number, error: any) {
    const pool = await mysql.createPool(this.mysqlConfig);

    try {
      await pool.query(
        `INSERT INTO blockchain_events (
          event_type, transaction_signature, block_slot, timestamp, event_data, error_message
        ) VALUES ('failed_event', ?, ?, NOW(), ?, ?)`,
        [signature, slot, JSON.stringify(event), error.message]
      );

    } catch (dbError) {
      console.error('[EventListener] Error recording failed event:', dbError);
    } finally {
      await pool.end();
    }
  }

  // 获取监听状态
  getStatus() {
    return {
      isRunning: this.isRunning,
      programId: this.programId.toString(),
      connection: this.connection.rpcEndpoint
    };
  }
}