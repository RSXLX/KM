'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TeamInfo } from './TeamInfo';
import { PlayerInfo } from './PlayerInfo';
import { TeamStats } from './TeamStats';
import { mockTeamDetails, mockBasketballPlayer, mockFootballPlayer } from '@/lib/sports/mockTeamData';
import { mockTeamsAPI } from '@/lib/sports/mockTeamsAPI';
import type { LiveMatch } from './LiveMatchCard';

interface TeamDetailsSectionProps {
  match?: LiveMatch | null;
}

export function TeamDetailsSection({ match }: TeamDetailsSectionProps) {
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
  const [teamDetails, setTeamDetails] = useState(mockTeamDetails);
  
  // 根据选择的球队获取对应的数据
  const getTeamData = () => {
    if (!match) return mockTeamDetails;
    
    const teamName = selectedTeam === 'home' ? match.teams.home.name : match.teams.away.name;
    
    // 尝试从mockTeamsAPI中找到匹配的球队
    const allTeams = mockTeamsAPI.getAllTeams();
    const foundTeam = allTeams.find(team => 
      team.name.toLowerCase().includes(teamName.toLowerCase()) ||
      teamName.toLowerCase().includes(team.name.toLowerCase()) ||
      team.shortName?.toLowerCase() === teamName.toLowerCase()
    );
    
    return foundTeam || mockTeamDetails;
  };
  
  // 当选择的球队改变时更新数据
  React.useEffect(() => {
    setTeamDetails(getTeamData());
  }, [selectedTeam, match]);
  
  // 根据运动类型选择不同的球员数据
  const getSamplePlayers = () => {
    if (match?.sport === 'Basketball') {
      return [mockBasketballPlayer, ...teamDetails.players.slice(0, 2)];
    } else if (match?.sport === 'American Football') {
      return [mockFootballPlayer, ...teamDetails.players.slice(0, 2)];
    }
    return teamDetails.players.slice(0, 4);
  };

  const samplePlayers = getSamplePlayers();

  if (!match) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* 球队选择器 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold">球队详情</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => setSelectedTeam('home')}
              className={`flex-1 p-3 rounded-lg border transition-colors ${
                selectedTeam === 'home' 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-muted hover:bg-muted/80 border-border'
              }`}
            >
              <div className="text-center">
                <p className="font-semibold">{match.teams.home.name}</p>
                <Badge variant="secondary" className="mt-1">主队</Badge>
              </div>
            </button>
            <button
              onClick={() => setSelectedTeam('away')}
              className={`flex-1 p-3 rounded-lg border transition-colors ${
                selectedTeam === 'away' 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-muted hover:bg-muted/80 border-border'
              }`}
            >
              <div className="text-center">
                <p className="font-semibold">{match.teams.away.name}</p>
                <Badge variant="secondary" className="mt-1">客队</Badge>
              </div>
            </button>
          </div>

          {/* 选中球队的详细信息 */}
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">球队信息</TabsTrigger>
              <TabsTrigger value="players">球员阵容</TabsTrigger>
              <TabsTrigger value="stats">球队统计</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-6">
              <TeamInfo team={teamDetails} />
            </TabsContent>

            <TabsContent value="players" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">主力阵容</h3>
                  <Badge variant="outline">
                    {selectedTeam === 'home' ? match.teams.home.name : match.teams.away.name}
                  </Badge>
                </div>
                <div className="grid gap-4">
                  {samplePlayers.map((player) => (
                    <PlayerInfo key={player.id} player={player} />
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="stats" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">赛季统计</h3>
                  <Badge variant="outline">
                    {teamDetails.stats.season} 赛季
                  </Badge>
                </div>
                <TeamStats stats={teamDetails.stats} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 对阵历史和预测 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold">对阵信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 最近交锋 */}
            <div>
              <h4 className="font-semibold mb-3">最近交锋</h4>
              <div className="space-y-2">
                {teamDetails.recentMatches.map((recentMatch) => (
                  <div key={recentMatch.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        recentMatch.result === 'W' ? 'bg-green-500' : 
                        recentMatch.result === 'L' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}>
                        {recentMatch.result}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          vs {recentMatch.opponent.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {recentMatch.date} · {recentMatch.competition}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm font-bold">
                      {recentMatch.score.home}-{recentMatch.score.away}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 即将到来的比赛 */}
            <div>
              <h4 className="font-semibold mb-3">即将到来</h4>
              <div className="space-y-2">
                {teamDetails.upcomingMatches.map((upcomingMatch) => (
                  <div key={upcomingMatch.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">
                        vs {upcomingMatch.opponent.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {upcomingMatch.date} · {upcomingMatch.competition}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {upcomingMatch.venue}
                      </p>
                    </div>
                    <Badge variant={upcomingMatch.isHome ? "default" : "secondary"}>
                      {upcomingMatch.isHome ? "主场" : "客场"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}