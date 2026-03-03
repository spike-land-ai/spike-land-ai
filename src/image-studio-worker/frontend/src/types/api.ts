export interface ImageData {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  url: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlbumData {
  id: string;
  handle: string;
  name: string;
  description?: string;
  privacy: string;
  coverImageUrl?: string;
  imageCount: number;
  createdAt: string;
}

export interface JobData {
  id: string;
  status: string;
  imageId?: string;
  tier?: string;
  credits?: number;
  resultUrl?: string;
  error?: string;
  createdAt: string;
}

export interface GenerationJobData {
  id: string;
  status: string;
  type: string;
  prompt?: string;
  resultUrl?: string;
  error?: string;
  createdAt: string;
}

export interface PipelineData {
  id: string;
  name: string;
  description?: string;
  visibility: string;
  steps: unknown[];
  usageCount: number;
  createdAt: string;
}

export interface CreditBalance {
  balance: number;
  userId: string;
}

export interface CreditEstimate {
  tier: string;
  count: number;
  costPerImage: number;
  totalCost: number;
  currentBalance: number;
  sufficient: boolean;
}
