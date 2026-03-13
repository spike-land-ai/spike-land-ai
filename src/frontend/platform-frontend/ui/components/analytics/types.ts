export type TimeRange =
  | "1m"
  | "5m"
  | "15m"
  | "1h"
  | "6h"
  | "24h"
  | "7d"
  | "30d"
  | "3mo"
  | "6mo"
  | "1y"
  | "3y";

export interface GA4OverviewData {
  sessions: number;
  activeUsers: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  engagementRate: number;
  timeSeries: Array<{ date: string; sessions: number; users: number }>;
  isRealtime: boolean;
  // Realtime-only fields
  topPages?: Array<{
    page?: string;
    dimensionValues?: Array<{ value: string }>;
    metricValues?: Array<{ value: string }>;
  }>;
}

export interface GA4AcquisitionData {
  channels: Array<{ channel: string; sessions: number; users: number }>;
  sources: Array<{ source: string; medium: string; sessions: number; bounceRate: number }>;
  landingPages: Array<{ page: string; sessions: number }>;
}

export interface GA4ContentData {
  pages: Array<{ path: string; views: number; avgDuration: number; bounceRate: number }>;
  engagement: {
    pagesPerSession: number;
    engagementRate: number;
    avgSessionDuration: number;
  } | null;
}

export interface GA4GeoData {
  countries: Array<{ country: string; users: number; sessions: number }>;
  cities: Array<{ city: string; users: number }>;
  languages: Array<{ language: string; users: number }>;
}

export interface GA4DevicesData {
  categories: Array<{ category: string; users: number; sessions: number }>;
  browsers: Array<{ browser: string; users: number }>;
  os: Array<{ os: string; users: number }>;
}

export interface GA4RetentionData {
  newVsReturning: Array<{ type: string; users: number; sessions: number }>;
}

export interface GA4RealtimeData {
  activeUsers: number;
  topPages: Array<{ page: string; users: number }>;
  topCountries: Array<{ country: string; users: number }>;
  devices: Array<{ category: string; users: number }>;
}

export interface PlatformEvent {
  id: string;
  event_type: string;
  source: string;
  metadata: string;
  created_at: number;
}

export interface FunnelRow {
  event_type: string;
  count: number;
  unique_users: number;
}

export interface DashboardData {
  summary: {
    totalEvents: number;
    uniqueUsers: number;
    eventsByType: Array<{ event_type: string; count: number }>;
    toolUsage: Array<{ tool_name: string; count: number }>;
    blogViews?: Array<{ slug: string; count: number }>;
  };
  recentEvents: PlatformEvent[];
  funnel: FunnelRow[] | null;
  activeUsers: number | null;
  meta: {
    range: string;
    queriedAt: number;
    earliestEvent: number | null;
  };
}

/** Shape returned by /analytics/events */
export interface RawAnalyticsEvent {
  id: string;
  source: string;
  event_type: string;
  metadata: string | null;
  client_id: string;
  created_at: number;
}
