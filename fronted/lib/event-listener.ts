import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { AnchorProvider, Program, Idl, BorshEventCoder } from '@coral-xyz/anchor';

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
  private apiBaseUrl: string;

  constructor(
    rpcUrl: string,
    programId: string,
    apiBaseUrl?: string
  ) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.programId = new PublicKey(programId);
    this.apiBaseUrl = apiBaseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';
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
    try {
      // 调用开仓API
      const { apiClient } = await import('@/lib/apiClient');
      const res = await apiClient.post('/api/positions', {
        wallet_address: eventData.user.toString(),
        market_address: eventData.market.toString(),
        selected_team: eventData.team,
        amount: eventData.amount,
        multiplier_bps: eventData.multiplierBps,
        odds_home_bps: eventData.team === 1 ? eventData.oddsBps : null,
        odds_away_bps: eventData.team === 2 ? eventData.oddsBps : null,
        transaction_signature: signature
      }, { timeoutMs: 10000, baseUrl: this.apiBaseUrl });
      if (res?.ok === false) {
        throw new Error(res?.error || 'API call failed');
      }

      console.log(`[EventListener] Processed BetPlaced event: ${signature}`);

    } catch (error) {
      console.error('[EventListener] Error handling BetPlaced event:', error);
      throw error;
    }
  }

  // 处理平仓事件
  private async handleBetClosedEvent(eventData: EventBetClosed, signature: string, slot: number) {
    try {
      // 调用后端查询用户持仓，选取该市场的OPEN持仓
      const { apiClient } = await import('@/lib/apiClient');
      const positionsResp = await apiClient.get('/api/positions', {
        baseUrl: this.apiBaseUrl,
        query: {
          wallet_address: eventData.user.toString(),
          market_address: eventData.market.toString(),
          position_type: 'OPEN',
          status: 1,
          page: 1,
          limit: 50,
        },
        timeoutMs: 10000,
      });
      const positions = (positionsResp?.positions || positionsResp?.data?.positions || []) as any[];
      const open = positions.find(p => p.market_address === eventData.market.toString() && (p.position_type === 'OPEN' || p.type === 'OPEN'));
      if (!open) {
        throw new Error('Original position not found for close event');
      }
      const positionId = open.id;

      // 调用平仓API
      const res = await apiClient.post('/api/positions/close', {
        position_id: positionId,
        wallet_address: eventData.user.toString(),
        close_price: eventData.closePrice,
        close_pnl: eventData.pnl,
        transaction_signature: signature
      }, { timeoutMs: 10000, baseUrl: this.apiBaseUrl });
      if (res?.ok === false) {
        throw new Error(res?.error || 'API call failed');
      }

      console.log(`[EventListener] Processed BetClosed event: ${signature}`);

    } catch (error) {
      console.error('[EventListener] Error handling BetClosed event:', error);
      throw error;
    }
  }

  // 处理兑付事件
  private async handleBetClaimedEvent(eventData: EventBetClaimed, signature: string, slot: number) {
    try {
      // 调用后端兑付接口（如果提供）。若未提供，先记录日志。
      const { apiClient } = await import('@/lib/apiClient');
      try {
        await apiClient.post('/compat/positions/claim', {
          wallet_address: eventData.user.toString(),
          market_address: eventData.market.toString(),
          pnl: eventData.pnl,
          payout: eventData.payout,
          transaction_signature: signature,
        }, { timeoutMs: 10000, baseUrl: this.apiBaseUrl });
      } catch (_err) {
        console.warn('[EventListener] Claim endpoint not available, skipping DB update.');
      }

      console.log(`[EventListener] Processed BetClaimed event: ${signature}`);

    } catch (error) {
      console.error('[EventListener] Error handling BetClaimed event:', error);
      throw error;
    }
  }

  // 处理市场结算事件
  private async handleMarketResolvedEvent(eventData: EventMarketResolved, signature: string, slot: number) {
    try {
      // 调用后端市场结算接口（如果提供）。当前前端 PUT 不再实现。
      const { apiClient } = await import('@/lib/apiClient');
      try {
        await apiClient.post('/compat/markets/resolve', {
          market_address: eventData.market.toString(),
          result: eventData.result,
          resolved_at: new Date().toISOString(),
        }, { timeoutMs: 10000, baseUrl: this.apiBaseUrl });
      } catch (_err) {
        console.warn('[EventListener] Resolve endpoint not available, skipping market update.');
      }

      console.log(`[EventListener] Processed MarketResolved event: ${signature}`);

    } catch (error) {
      console.error('[EventListener] Error handling MarketResolved event:', error);
      throw error;
    }
  }

  // 获取同步状态
  private async getSyncState(): Promise<SyncState> {
    try {
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
    }
  }

  // 更新同步状态
  private async updateSyncState(lastProcessedSlot: number) {
    try {
      // 可选：将同步状态推送到后端；当前仅打印日志。
      console.log('[EventListener] updateSyncState:', lastProcessedSlot);

    } catch (error) {
      console.error('[EventListener] Error updating sync state:', error);
    }
  }

  // 记录失败的事件
  private async recordFailedEvent(event: any, signature: string, slot: number, error: any) {
    try {
      // 可选：将失败事件推送到后端；当前仅打印日志。
      console.error('[EventListener] Failed event recorded:', {
        signature, slot, error: error?.message
      });

    } catch (dbError) {
      console.error('[EventListener] Error recording failed event:', dbError);
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