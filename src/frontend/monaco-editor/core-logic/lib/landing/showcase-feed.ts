export interface ShowcaseApp {
  id: string;
  title: string;
  description: string;
  slug: string;
  viewCount?: number;
}
export const getLatestShowcaseApps = async (_limit = 10): Promise<ShowcaseApp[]> => [];
