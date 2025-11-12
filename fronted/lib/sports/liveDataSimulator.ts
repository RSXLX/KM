import type { LiveMatch } from '@/components/sports/LiveMatchCard';

export interface LiveDataUpdate {
  matchId: string;
  scoreUpdate?: {
    home?: number;
    away?: number;
  };
  timeUpdate?: {
    minute?: number;
    second?: number;
    period?: number;
    phase?: string;
  };
  statusUpdate?: {
    isLive?: boolean;
    finished?: boolean;
    halftime?: boolean;
    overtime?: boolean;
    suspended?: boolean;
  };
  oddsUpdate?: {
    home?: number;
    draw?: number;
    away?: number;
    trend?: 'up' | 'down' | 'stable';
  };
}

export class LiveDataSimulator {
  private matches: Map<string, LiveMatch> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private callbacks: Map<string, (update: LiveDataUpdate) => void> = new Map();

  constructor() {}

  // 添加比赛到模拟器
  addMatch(match: LiveMatch): void {
    this.matches.set(match.id, { ...match });
  }

  // 对单场比赛执行一次“快照更新”，返回更新后的副本
  // 该方法不依赖内部定时器，便于外部以自定义频率推进（例如在 Hook 内的 setInterval）
  updateMatch(match: LiveMatch): LiveMatch {
    // 若非 Live 状态，直接返回原对象副本
    const next: LiveMatch = { 
      ...match, 
      teams: { 
        home: { ...(match.teams.home || {}) }, 
        away: { ...(match.teams.away || {}) } 
      }, 
      status: { ...(match.status || {}) }, 
      liveOdds: match.liveOdds ? { ...(match.liveOdds) } : undefined 
    };

    if (!next.status?.isLive) {
      return next;
    }

    // 1) 时间推进
    const t = this.simulateTimeProgress(next);
    if (t) {
      Object.assign(next.status, t);
    }

    // 2) 分数变化
    const s = this.simulateScoreChange(next);
    if (s) {
      if (s.home !== undefined) next.teams.home.score = s.home;
      if (s.away !== undefined) next.teams.away.score = s.away;
    }

    // 3) 赔率变化
    const o = this.simulateOddsChange(next);
    if (o && next.liveOdds) {
      Object.assign(next.liveOdds, o);
      next.liveOdds.lastUpdated = Date.now();
    }

    // 4) 状态变化
    const st = this.checkStatusChange(next);
    if (st) {
      Object.assign(next.status, st);
    }

    return next;
  }

  // 移除比赛
  removeMatch(matchId: string): void {
    this.stopSimulation(matchId);
    this.matches.delete(matchId);
    this.callbacks.delete(matchId);
  }

  // 开始模拟指定比赛
  startSimulation(matchId: string, callback: (update: LiveDataUpdate) => void): void {
    const match = this.matches.get(matchId);
    if (!match || !match.status.isLive) return;

    this.callbacks.set(matchId, callback);
    
    // 清除现有的定时器
    this.stopSimulation(matchId);

    // 根据运动类型设置不同的更新频率
    const updateInterval = this.getUpdateInterval(match.sport);
    
    const interval = setInterval(() => {
      this.simulateUpdate(matchId);
    }, updateInterval);

    this.intervals.set(matchId, interval);
  }

  // 停止模拟
  stopSimulation(matchId: string): void {
    const interval = this.intervals.get(matchId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(matchId);
    }
  }

  // 停止所有模拟
  stopAllSimulations(): void {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
  }

  // 获取更新频率（毫秒）
  private getUpdateInterval(sport: string): number {
    switch (sport.toLowerCase()) {
      case 'football':
      case 'soccer':
        return 30000; // 30秒
      case 'basketball':
        return 15000; // 15秒
      case 'american football':
      case 'nfl':
        return 20000; // 20秒
      default:
        return 25000; // 25秒
    }
  }

  // 模拟数据更新
  private simulateUpdate(matchId: string): void {
    const match = this.matches.get(matchId);
    const callback = this.callbacks.get(matchId);
    
    if (!match || !callback || !match.status.isLive) return;

    const update: LiveDataUpdate = { matchId };

    // 模拟时间推进
    const timeUpdate = this.simulateTimeProgress(match);
    if (timeUpdate) {
      update.timeUpdate = timeUpdate;
      // 更新本地match数据
      Object.assign(match.status, timeUpdate);
    }

    // 模拟分数变化（低概率）
    const scoreUpdate = this.simulateScoreChange(match);
    if (scoreUpdate) {
      update.scoreUpdate = scoreUpdate;
      // 更新本地match数据
      if (scoreUpdate.home !== undefined) match.teams.home.score = scoreUpdate.home;
      if (scoreUpdate.away !== undefined) match.teams.away.score = scoreUpdate.away;
    }

    // 模拟赔率变化
    const oddsUpdate = this.simulateOddsChange(match);
    if (oddsUpdate) {
      update.oddsUpdate = oddsUpdate;
      // 更新本地match数据
      if (match.liveOdds) {
        Object.assign(match.liveOdds, oddsUpdate);
        match.liveOdds.lastUpdated = Date.now();
      }
    }

    // 检查比赛状态变化
    const statusUpdate = this.checkStatusChange(match);
    if (statusUpdate) {
      update.statusUpdate = statusUpdate;
      Object.assign(match.status, statusUpdate);
    }

    // 发送更新
    callback(update);
  }

  // 模拟时间推进
  private simulateTimeProgress(match: LiveMatch): LiveDataUpdate['timeUpdate'] | null {
    const { sport, status } = match;
    
    if (!status.isLive || status.finished || status.halftime) return null;

    const currentMinute = status.minute || 0;
    const currentSecond = status.second || 0;
    const currentPeriod = status.period || 1;

    switch (sport.toLowerCase()) {
      case 'football':
      case 'soccer':
        // 足球：每次推进1-3分钟
        const newMinute = currentMinute + Math.floor(Math.random() * 3) + 1;
        if (newMinute >= 45 && currentPeriod === 1) {
          // 上半场结束
          return {
            minute: 45,
            period: 1,
            phase: 'Half Time'
          };
        } else if (newMinute >= 90 && currentPeriod === 2) {
          // 比赛结束
          return {
            minute: 90,
            period: 2,
            phase: 'Full Time'
          };
        }
        return {
          minute: Math.min(newMinute, currentPeriod === 1 ? 45 : 90),
          period: currentPeriod,
          phase: currentPeriod === 1 ? 'First Half' : 'Second Half'
        };

      case 'basketball':
        // 篮球：每次推进30秒-2分钟
        const newSecond = currentSecond + Math.floor(Math.random() * 90) + 30;
        const newBasketMinute = currentMinute + Math.floor(newSecond / 60);
        
        if (newBasketMinute >= 12) {
          // 节结束
          const nextPeriod = currentPeriod + 1;
          if (nextPeriod > 4) {
            return {
              minute: 12,
              second: 0,
              period: 4,
              phase: 'Final'
            };
          }
          return {
            minute: 0,
            second: 0,
            period: nextPeriod,
            phase: `Q${nextPeriod}`
          };
        }
        
        return {
          minute: newBasketMinute,
          second: newSecond % 60,
          period: currentPeriod,
          phase: `Q${currentPeriod}`
        };

      case 'american football':
      case 'nfl':
        // 美式足球：每次推进1-4分钟
        const newNflMinute = Math.max(0, currentMinute - Math.floor(Math.random() * 4) - 1);
        const newNflSecond = Math.floor(Math.random() * 60);
        
        if (newNflMinute <= 0 && currentPeriod < 4) {
          const nextPeriod = currentPeriod + 1;
          return {
            minute: 15,
            second: 0,
            period: nextPeriod,
            phase: `Q${nextPeriod}`
          };
        } else if (newNflMinute <= 0 && currentPeriod >= 4) {
          return {
            minute: 0,
            second: 0,
            period: 4,
            phase: 'Final'
          };
        }
        
        return {
          minute: newNflMinute,
          second: newNflSecond,
          period: currentPeriod,
          phase: `Q${currentPeriod}`
        };

      default:
        return null;
    }
  }

  // 模拟分数变化
  private simulateScoreChange(match: LiveMatch): LiveDataUpdate['scoreUpdate'] | null {
    // 5%的概率发生进球/得分
    if (Math.random() > 0.05) return null;

    const homeScore = match.teams.home.score || 0;
    const awayScore = match.teams.away.score || 0;
    
    // 随机选择哪个队得分
    const homeScores = Math.random() > 0.5;
    
    const scoreUpdate: LiveDataUpdate['scoreUpdate'] = {};
    
    if (homeScores) {
      scoreUpdate.home = homeScore + this.getScoreIncrement(match.sport);
    } else {
      scoreUpdate.away = awayScore + this.getScoreIncrement(match.sport);
    }
    
    return scoreUpdate;
  }

  // 获取得分增量
  private getScoreIncrement(sport: string): number {
    switch (sport.toLowerCase()) {
      case 'football':
      case 'soccer':
        return 1; // 足球每次进1球
      case 'basketball':
        // 篮球可能是2分或3分
        return Math.random() > 0.7 ? 3 : 2;
      case 'american football':
      case 'nfl':
        // 美式足球可能是3分（射门）或6分（达阵）
        return Math.random() > 0.6 ? 6 : 3;
      default:
        return 1;
    }
  }

  // 模拟赔率变化
  private simulateOddsChange(match: LiveMatch): LiveDataUpdate['oddsUpdate'] | null {
    if (!match.liveOdds) return null;

    // 30%的概率发生赔率变化
    if (Math.random() > 0.3) return null;

    const { home, draw, away } = match.liveOdds;
    const volatility = 0.05; // 5%的波动率

    const homeChange = (Math.random() - 0.5) * volatility * 2;
    const awayChange = -homeChange; // 相反方向变化

    const newHome = Math.max(1.1, Math.min(10.0, (home || 2.0) + homeChange));
    const newAway = Math.max(1.1, Math.min(10.0, (away || 2.0) + awayChange));
    
    const update: LiveDataUpdate['oddsUpdate'] = {
      home: parseFloat(newHome.toFixed(2)),
      away: parseFloat(newAway.toFixed(2)),
      trend: homeChange > 0 ? 'up' : homeChange < 0 ? 'down' : 'stable'
    };

    // 如果有平局赔率，也要更新
    if (draw) {
      const drawChange = (Math.random() - 0.5) * volatility;
      update.draw = parseFloat(Math.max(1.1, Math.min(10.0, draw + drawChange)).toFixed(2));
    }

    return update;
  }

  // 检查状态变化
  private checkStatusChange(match: LiveMatch): LiveDataUpdate['statusUpdate'] | null {
    const { status } = match;
    
    // 检查是否应该结束比赛
    if (this.shouldFinishMatch(match)) {
      return {
        isLive: false,
        finished: true
      };
    }

    // 检查是否应该进入中场休息
    if (this.shouldEnterHalftime(match)) {
      return {
        halftime: true
      };
    }

    return null;
  }

  // 判断是否应该结束比赛
  private shouldFinishMatch(match: LiveMatch): boolean {
    const { sport, status } = match;
    
    switch (sport.toLowerCase()) {
      case 'football':
      case 'soccer':
        return status.minute >= 90 && status.period === 2;
      case 'basketball':
        return status.period >= 4 && status.minute >= 12;
      case 'american football':
      case 'nfl':
        return status.period >= 4 && status.minute <= 0;
      default:
        return false;
    }
  }

  // 判断是否应该进入中场休息
  private shouldEnterHalftime(match: LiveMatch): boolean {
    const { sport, status } = match;
    
    if (sport.toLowerCase() === 'football' || sport.toLowerCase() === 'soccer') {
      return status.minute >= 45 && status.period === 1 && !status.halftime;
    }
    
    return false;
  }

  // 获取当前所有比赛状态
  getAllMatches(): LiveMatch[] {
    return Array.from(this.matches.values());
  }

  // 获取指定比赛
  getMatch(matchId: string): LiveMatch | undefined {
    return this.matches.get(matchId);
  }
}

// 全局实例
export const liveDataSimulator = new LiveDataSimulator();