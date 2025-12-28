/**
 * Admin Stats Dashboard
 * Shows counts and statistics for mods
 */

import React from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModMetadata } from '../../types/mod';

const StatsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: ${spacing.md};
  margin-bottom: ${spacing.xl};
`;

const StatCard = styled.div`
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: ${spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${colors.text};
`;

const StatLabel = styled.div`
  font-size: 0.75rem;
  color: ${colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatChange = styled.div<{ $positive?: boolean }>`
  font-size: 0.75rem;
  color: ${props => props.$positive ? colors.success : colors.textSecondary};
`;

export interface AdminStatsProps {
  mods: ModMetadata[];
  filteredMods: ModMetadata[];
}

export function AdminStats({ mods, filteredMods }: AdminStatsProps) {
  const stats = React.useMemo(() => {
    const statusCounts = mods.reduce((acc, mod) => {
      acc[mod.status] = (acc[mod.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const categoryCounts = mods.reduce((acc, mod) => {
      acc[mod.category] = (acc[mod.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const totalDownloads = mods.reduce((sum, mod) => sum + mod.downloadCount, 0);
    const avgDownloads = mods.length > 0 ? Math.round(totalDownloads / mods.length) : 0;
    
    return {
      total: mods.length,
      filtered: filteredMods.length,
      statusCounts,
      categoryCounts,
      totalDownloads,
      avgDownloads,
    };
  }, [mods, filteredMods]);
  
  return (
    <StatsContainer>
      <StatCard>
        <StatValue>{stats.total}</StatValue>
        <StatLabel>Total Mods</StatLabel>
      </StatCard>
      <StatCard>
        <StatValue>{stats.filtered}</StatValue>
        <StatLabel>Filtered Results</StatLabel>
      </StatCard>
      <StatCard>
        <StatValue>{stats.statusCounts.pending || 0}</StatValue>
        <StatLabel>Pending Review</StatLabel>
      </StatCard>
      <StatCard>
        <StatValue>{stats.statusCounts.published || 0}</StatValue>
        <StatLabel>Published</StatLabel>
      </StatCard>
      <StatCard>
        <StatValue>{stats.totalDownloads.toLocaleString()}</StatValue>
        <StatLabel>Total Downloads</StatLabel>
      </StatCard>
      <StatCard>
        <StatValue>{stats.avgDownloads.toLocaleString()}</StatValue>
        <StatLabel>Avg Downloads</StatLabel>
      </StatCard>
    </StatsContainer>
  );
}

