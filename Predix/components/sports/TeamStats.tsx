'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Home, Plane, Target, Shield, Trophy, Calendar } from 'lucide-react';
import type { TeamStats } from '@/types/sports';

interface TeamStatsProps {
  stats: TeamStats;
}

export function TeamStats({ stats }: TeamStatsProps) {
  const winRate = stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed * 100) : 0;
  const homeWinRate = (stats.homeRecord.wins + stats.homeRecord.draws + stats.homeRecord.losses) > 0 
    ? (stats.homeRecord.wins / (stats.homeRecord.wins + stats.homeRecord.draws + stats.homeRecord.losses) * 100) 
    : 0;
  const awayWinRate = (stats.awayRecord.wins + stats.awayRecord.draws + stats.awayRecord.losses) > 0 
    ? (stats.awayRecord.wins / (stats.awayRecord.wins + stats.awayRecord.draws + stats.awayRecord.losses) * 100) 
    : 0;

  const getFormIcon = (result: string) => {
    switch (result) {
      case 'W': return <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">W</div>;
      case 'L': return <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">L</div>;
      case 'D': return <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-white text-xs font-bold">D</div>;
      default: return null;
    }
  };

  const getPositionColor = (position: number) => {
    if (position <= 4) return 'text-green-600';
    if (position <= 10) return 'text-blue-600';
    if (position <= 15) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* 联赛排名和基本信息 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold">联赛排名</CardTitle>
            <Badge variant="secondary">{stats.season}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Trophy className={`w-6 h-6 mx-auto mb-2 ${getPositionColor(stats.position)}`} />
              <p className={`text-2xl font-bold ${getPositionColor(stats.position)}`}>#{stats.position}</p>
              <p className="text-xs text-muted-foreground">排名</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{stats.points}</p>
              <p className="text-xs text-muted-foreground">积分</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{stats.gamesPlayed}</p>
              <p className="text-xs text-muted-foreground">已赛场次</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{winRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">胜率</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 胜负记录 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold">胜负记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 总体记录 */}
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">总体记录</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">胜</span>
                  <span className="font-bold text-green-600">{stats.wins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">平</span>
                  <span className="font-bold text-yellow-600">{stats.draws}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">负</span>
                  <span className="font-bold text-red-600">{stats.losses}</span>
                </div>
              </div>
            </div>

            {/* 主场记录 */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Home className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-foreground">主场记录</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">胜</span>
                  <span className="font-bold text-green-600">{stats.homeRecord.wins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">平</span>
                  <span className="font-bold text-yellow-600">{stats.homeRecord.draws}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">负</span>
                  <span className="font-bold text-red-600">{stats.homeRecord.losses}</span>
                </div>
              </div>
              <div className="pt-2">
                <Progress value={homeWinRate} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">胜率: {homeWinRate.toFixed(1)}%</p>
              </div>
            </div>

            {/* 客场记录 */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Plane className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-foreground">客场记录</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">胜</span>
                  <span className="font-bold text-green-600">{stats.awayRecord.wins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">平</span>
                  <span className="font-bold text-yellow-600">{stats.awayRecord.draws}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">负</span>
                  <span className="font-bold text-red-600">{stats.awayRecord.losses}</span>
                </div>
              </div>
              <div className="pt-2">
                <Progress value={awayWinRate} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">胜率: {awayWinRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 进攻和防守统计 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold">进攻与防守</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Target className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold text-foreground">{stats.goalsFor}</p>
              <p className="text-xs text-muted-foreground">进球数</p>
              <p className="text-xs text-green-600 mt-1">{stats.averageGoalsPerGame.toFixed(2)}/场</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Shield className="w-6 h-6 mx-auto mb-2 text-red-600" />
              <p className="text-2xl font-bold text-foreground">{stats.goalsAgainst}</p>
              <p className="text-xs text-muted-foreground">失球数</p>
              <p className="text-xs text-red-600 mt-1">{stats.averageGoalsConcededPerGame.toFixed(2)}/场</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="w-6 h-6 mx-auto mb-2 flex items-center justify-center">
                {stats.goalDifference >= 0 ? 
                  <TrendingUp className="w-6 h-6 text-green-600" /> : 
                  <TrendingDown className="w-6 h-6 text-red-600" />
                }
              </div>
              <p className={`text-2xl font-bold ${stats.goalDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.goalDifference > 0 ? '+' : ''}{stats.goalDifference}
              </p>
              <p className="text-xs text-muted-foreground">净胜球</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Shield className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold text-foreground">{stats.cleanSheets}</p>
              <p className="text-xs text-muted-foreground">零封场次</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 近期状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold">近期状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">最近5场比赛 (最新 → 最旧)</p>
              <div className="flex items-center space-x-2">
                {stats.form.map((result, index) => (
                  <div key={index}>
                    {getFormIcon(result)}
                  </div>
                ))}
              </div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold text-foreground">{stats.failedToScore}</p>
                <p className="text-xs text-muted-foreground">未能进球场次</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold text-foreground">{stats.cleanSheets}</p>
                <p className="text-xs text-muted-foreground">零封对手场次</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}