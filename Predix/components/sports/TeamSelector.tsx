'use client';

import React, { useState } from 'react';
import { mockTeamsAPI } from '@/lib/sports/mockTeamsAPI';
import { TeamDetails, SportType } from '@/types/sports';

interface TeamSelectorProps {
  onTeamSelect: (team: TeamDetails) => void;
  selectedSport?: SportType;
}

export default function TeamSelector({ onTeamSelect, selectedSport = 'football' }: TeamSelectorProps) {
  const [currentSport, setCurrentSport] = useState<SportType>(selectedSport);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetails | null>(null);

  const teams = mockTeamsAPI.getTeamsBySport(currentSport);
  const sports: { value: SportType; label: string }[] = [
    { value: 'football', label: '足球' },
    { value: 'basketball', label: '篮球' },
    { value: 'american-football', label: '美式橄榄球' }
  ];

  const handleSportChange = (sport: SportType) => {
    setCurrentSport(sport);
    setSelectedTeam(null);
  };

  const handleTeamSelect = (team: TeamDetails) => {
    setSelectedTeam(team);
    onTeamSelect(team);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">选择球队</h2>
      
      {/* Sport Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          运动类型
        </label>
        <div className="flex gap-2">
          {sports.map((sport) => (
            <button
              key={sport.value}
              onClick={() => handleSportChange(sport.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentSport === sport.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {sport.label}
            </button>
          ))}
        </div>
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div
            key={team.id}
            onClick={() => handleTeamSelect(team)}
            className={`p-4 rounded-lg cursor-pointer bg-card text-card-foreground shadow-sm min-w-0 group transition-transform hover:shadow-lg hover:scale-[1.02] active:scale-[0.99] ${
              selectedTeam?.id === team.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-lg font-bold text-gray-600">
                  {team.shortName || team.name.substring(0, 2)}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{team.name}</h3>
                <p className="text-sm text-gray-500">{team.league}</p>
                <p className="text-xs text-gray-400">{team.city}, {team.country}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Team Info */}
      {selectedTeam && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-lg mb-2">已选择: {selectedTeam.name}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">联赛:</span> {selectedTeam.league}
            </div>
            <div>
              <span className="font-medium">主场:</span> {selectedTeam.stadium}
            </div>
            <div>
              <span className="font-medium">成立:</span> {selectedTeam.founded}
            </div>
            <div>
              <span className="font-medium">容量:</span> {selectedTeam.capacity?.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}