import type { SyncStatus } from '@/types/delivery';

export const colors = {
  background: '#F3F4F6',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  textMuted: '#6B7280',
  primary: '#1D4ED8',
  primaryText: '#FFFFFF',
  danger: '#B91C1C',
  online: '#15803D',
  offline: '#B45309',
  offlineBg: '#FEF3C7',
  onlineBg: '#DCFCE7',
} as const;

export const statusColors: Record<SyncStatus, { fg: string; bg: string }> = {
  queued: { fg: '#374151', bg: '#E5E7EB' },
  uploading: { fg: '#1D4ED8', bg: '#DBEAFE' },
  synced: { fg: '#15803D', bg: '#DCFCE7' },
  failed: { fg: '#B91C1C', bg: '#FEE2E2' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 6, md: 10, lg: 14 } as const;
export const font = { sm: 13, md: 15, lg: 17, xl: 22 } as const;
