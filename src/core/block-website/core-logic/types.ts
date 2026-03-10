export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  primer: string;
  date: string;
  author: string;
  category: string;
  tags: string[];
  featured: boolean;
  draft?: boolean;
  unlisted?: boolean;
  heroImage: string | null;
  content: string;
}
