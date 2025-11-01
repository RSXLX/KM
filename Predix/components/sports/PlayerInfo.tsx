'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, MapPin, Ruler, Weight, Hash, Clock } from 'lucide-react';
import type { PlayerInfo } from '@/types/sports';

interface PlayerInfoProps {
  player: PlayerInfo;
}

export function PlayerInfo({ player }: PlayerInfoProps) {
  const renderStats = () => {
    const stats = player.stats;
    const statItems = [];

    // 通用统计
    statItems.push(
      { label: '出场次数', value: stats.gamesPlayed, icon: Clock },
      { label: '出场时间', value: `${stats.minutesPlayed}'`, icon: Clock }
    );

    // 足球统计
    if (stats.goals !== undefined) {
      statItems.push(
        { label: '进球', value: stats.goals },
        { label: '助攻', value: stats.assists || 0 },
        { label: '黄牌', value: stats.yellowCards || 0 },
        { label: '红牌', value: stats.redCards || 0 }
      );
    }

    // 篮球统计
    if (stats.points !== undefined) {
      statItems.push(
        { label: '得分', value: stats.points },
        { label: '篮板', value: stats.rebounds || 0 },
        { label: '抢断', value: stats.steals || 0 },
        { label: '盖帽', value: stats.blocks || 0 }
      );
    }

    // 美式足球统计
    if (stats.touchdowns !== undefined) {
      statItems.push(
        { label: '达阵', value: stats.touchdowns },
        { label: '码数', value: stats.yards || 0 }
      );
      
      if (stats.completions !== undefined && stats.attempts !== undefined) {
        const completionRate = stats.attempts > 0 ? ((stats.completions / stats.attempts) * 100).toFixed(1) : '0';
        statItems.push(
          { label: '传球成功率', value: `${completionRate}%` },
          { label: '传球次数', value: `${stats.completions}/${stats.attempts}` }
        );
      }
    }

    return statItems;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <img 
              src={player.photo} 
              alt={`${player.name} photo`}
              className="w-16 h-16 object-cover rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/api/placeholder/64/64';
              }}
            />
            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {player.number}
            </div>
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl font-bold text-foreground">
              {player.name}
            </CardTitle>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant="secondary">
                {player.position}
              </Badge>
              <Badge variant="outline">
                #{player.number}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 基本信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">年龄</p>
              <p className="font-medium">{player.age}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">国籍</p>
              <p className="font-medium">{player.nationality}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-sm">
            <Ruler className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">身高</p>
              <p className="font-medium">{player.height}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-sm">
            <Weight className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">体重</p>
              <p className="font-medium">{player.weight}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* 统计数据 */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">本赛季统计</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {renderStats().map((stat, index) => (
              <div key={index} className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center mb-1">
                  {stat.icon && <stat.icon className="w-4 h-4 text-muted-foreground" />}
                </div>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 效率指标 */}
        {player.stats.gamesPlayed > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">场均数据</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-lg font-bold text-foreground">
                    {(player.stats.minutesPlayed / player.stats.gamesPlayed).toFixed(1)}'
                  </p>
                  <p className="text-xs text-muted-foreground">场均时间</p>
                </div>
                
                {player.stats.goals !== undefined && (
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-foreground">
                      {(player.stats.goals / player.stats.gamesPlayed).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">场均进球</p>
                  </div>
                )}

                {player.stats.points !== undefined && (
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-foreground">
                      {(player.stats.points / player.stats.gamesPlayed).toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">场均得分</p>
                  </div>
                )}

                {player.stats.assists !== undefined && (
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-foreground">
                      {((player.stats.assists || 0) / player.stats.gamesPlayed).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">场均助攻</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}