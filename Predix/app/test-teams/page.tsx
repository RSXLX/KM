'use client';

import React, { useState } from 'react';
import TeamSelector from '@/components/sports/TeamSelector';
import TeamInfo from '@/components/sports/TeamInfo';
import { TeamDetails } from '@/types/sports';
import { mockTeamsAPI } from '@/lib/sports/mockTeamsAPI';

export default function TestTeamsPage() {
  const [selectedTeam, setSelectedTeam] = useState<TeamDetails | null>(null);
  const [randomTeam, setRandomTeam] = useState<TeamDetails | null>(null);

  const handleTeamSelect = (team: TeamDetails) => {
    setSelectedTeam(team);
  };

  const getRandomTeam = () => {
    const team = mockTeamsAPI.getRandomTeam();
    setRandomTeam(team);
  };

  const getAllTeamsCount = () => {
    const allTeams = mockTeamsAPI.getAllTeams();
    return {
      total: allTeams.length,
      football: allTeams.filter(t => t.sport === 'football').length,
      basketball: allTeams.filter(t => t.sport === 'basketball').length,
      americanFootball: allTeams.filter(t => t.sport === 'american-football').length
    };
  };

  const stats = getAllTeamsCount();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">球队数据库测试</h1>
          <div className="flex justify-center space-x-6 text-sm text-gray-600">
            <span>总计: {stats.total} 支球队</span>
            <span>足球: {stats.football}</span>
            <span>篮球: {stats.basketball}</span>
            <span>美式橄榄球: {stats.americanFootball}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Team Selector */}
          <div>
            <TeamSelector onTeamSelect={handleTeamSelect} />
            
            {/* Random Team Button */}
            <div className="mt-6 text-center">
              <button
                onClick={getRandomTeam}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                随机选择球队
              </button>
            </div>

            {/* Random Team Display */}
            {randomTeam && (
              <div className="mt-4 p-4 bg-green-50 border border-border rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">随机球队:</h3>
                <div className="text-sm text-green-700">
                  <p><span className="font-medium">球队:</span> {randomTeam.name}</p>
                  <p><span className="font-medium">运动:</span> {
                    randomTeam.sport === 'football' ? '足球' :
                    randomTeam.sport === 'basketball' ? '篮球' : '美式橄榄球'
                  }</p>
                  <p><span className="font-medium">联赛:</span> {randomTeam.league}</p>
                </div>
              </div>
            )}
          </div>

          {/* Team Details */}
          <div>
            {selectedTeam ? (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-4">球队详情</h2>
                <TeamInfo team={selectedTeam} />
                
                {/* Additional Team Stats */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-700 mb-2">球员数量</h4>
                    <p className="text-2xl font-bold text-blue-600">
                      {selectedTeam.players?.length || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-700 mb-2">近期比赛</h4>
                    <p className="text-2xl font-bold text-green-600">
                      {selectedTeam.recentMatches?.length || 0}
                    </p>
                  </div>
                </div>

                {/* Players List */}
                {selectedTeam.players && selectedTeam.players.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-700 mb-3">球员名单</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedTeam.players.map((player, index) => (
                        <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                          <span className="font-medium text-gray-900">{player.name}</span>
                          <span className="text-sm text-gray-500">#{player.number}</span>
                          <span className="text-xs text-gray-400">{player.position}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-6 text-center text-gray-500">
                <p>请选择一支球队查看详情</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}