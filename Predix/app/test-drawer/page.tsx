'use client';

import React, { useState } from 'react';
import { InPlaySidebar } from '@/components/sports/InPlaySidebar';
import { LiveMatchCard } from '@/components/sports/LiveMatchCard';
import { mockLiveMatches } from '@/lib/sports/mockLiveMatches';
import type { LiveMatch } from '@/components/sports/LiveMatchCard';

export default function TestDrawerPage() {
  const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleMatchSelect = (match: LiveMatch) => {
    setSelectedMatch(match);
    setSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
    setSelectedMatch(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">抽屉球队信息测试</h1>
          <p className="text-gray-600">点击任意比赛卡片打开抽屉，然后切换主队/客队查看不同球队的信息</p>
        </div>

        {/* Live Matches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockLiveMatches.map((match) => (
            <div key={match.id} className="cursor-pointer">
              <LiveMatchCard 
                match={match} 
                onOpen={handleMatchSelect}
              />
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="mt-12 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">测试说明</h2>
          <div className="space-y-3 text-gray-700">
            <p><strong>1. 选择比赛：</strong> 点击任意比赛卡片打开右侧抽屉</p>
            <p><strong>2. 切换球队：</strong> 在抽屉中点击"主队"或"客队"按钮</p>
            <p><strong>3. 查看信息：</strong> 观察球队信息、球员阵容、球队统计是否正确更新</p>
            <p><strong>4. 验证数据：</strong> 确认显示的数据与所选球队匹配</p>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">可用球队数据：</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-700">
              <div>
                <p className="font-medium">足球：</p>
                <ul className="list-disc list-inside">
                  <li>Manchester City</li>
                  <li>Arsenal</li>
                  <li>FC Barcelona</li>
                  <li>Real Madrid</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">篮球：</p>
                <ul className="list-disc list-inside">
                  <li>Los Angeles Lakers</li>
                  <li>Golden State Warriors</li>
                  <li>Miami Heat</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">美式橄榄球：</p>
                <ul className="list-disc list-inside">
                  <li>Kansas City Chiefs</li>
                  <li>New England Patriots</li>
                  <li>Dallas Cowboys</li>
                  <li>Green Bay Packers</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Current Selection Info */}
        {selectedMatch && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">当前选择的比赛：</h3>
            <p className="text-green-700">
              <span className="font-medium">{selectedMatch.teams.home.name}</span> vs{' '}
              <span className="font-medium">{selectedMatch.teams.away.name}</span>
              <span className="ml-2 text-sm">({selectedMatch.sport})</span>
            </p>
          </div>
        )}
      </div>

      {/* InPlay Sidebar */}
      <InPlaySidebar 
        open={sidebarOpen}
        onClose={handleCloseSidebar}
        match={selectedMatch}
      />
    </div>
  );
}