'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Calendar, Users, Globe, Trophy } from 'lucide-react';
import type { TeamInfo } from '@/types/sports';

interface TeamInfoProps {
  team: TeamInfo;
}

export function TeamInfo({ team }: TeamInfoProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            {/* 移除logo显示 */}
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl font-bold text-foreground">
              {team.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{team.shortName}</p>
            <Badge variant="secondary" className="mt-1">
              {team.league}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 基本信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">成立年份:</span>
              <span className="font-medium">{team.founded}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">城市:</span>
              <span className="font-medium">{team.city}, {team.country}</span>
            </div>

            <div className="flex items-center space-x-2 text-sm">
              <Trophy className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">主教练:</span>
              <span className="font-medium">{team.coach}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">主场:</span>
              <span className="font-medium">{team.stadium}</span>
            </div>

            <div className="flex items-center space-x-2 text-sm">
              <span className="text-muted-foreground">容量:</span>
              <span className="font-medium">{team.capacity.toLocaleString()}</span>
            </div>

            {team.website && (
              <div className="flex items-center space-x-2 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <a 
                  href={team.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  官方网站
                </a>
              </div>
            )}
          </div>
        </div>

        {/* 队伍颜色 */}
        <div className="pt-2">
          <p className="text-sm text-muted-foreground mb-2">队伍颜色:</p>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div 
                className="w-6 h-6 rounded-full border-2 border-gray-200"
                style={{ backgroundColor: team.colors.primary }}
              />
              <span className="text-xs text-muted-foreground">主色</span>
            </div>
            <div className="flex items-center space-x-2">
              <div 
                className="w-6 h-6 rounded-full border-2 border-gray-200"
                style={{ backgroundColor: team.colors.secondary }}
              />
              <span className="text-xs text-muted-foreground">副色</span>
            </div>
          </div>
        </div>

        {team.division && (
          <div className="pt-2">
            <Badge variant="outline">
              {team.division}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}