export interface GalleryItem {
  id: string;
  title: string;
  description: string;
  category: "portrait" | "landscape" | "product" | "architecture";
  originalUrl: string;
  enhancedUrl: string;
  width?: number;
  height?: number;
}

export const FALLBACK_GALLERY_ITEMS: GalleryItem[] = [
  {
    id: "portrait-1",
    title: "Portrait Enhancement",
    description: "Skin smoothing and detail enhancement",
    category: "portrait",
    originalUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=70",
    enhancedUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=95",
    width: 3,
    height: 4,
  },
  {
    id: "landscape-1",
    title: "Landscape Upscaling",
    description: "4K resolution with enhanced colors",
    category: "landscape",
    originalUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=70",
    enhancedUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=95",
    width: 16,
    height: 9,
  },
  {
    id: "product-1",
    title: "Product Photo",
    description: "Crisp details for e-commerce",
    category: "product",
    originalUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=70",
    enhancedUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=95",
    width: 1,
    height: 1,
  },
  {
    id: "architecture-1",
    title: "Architecture Detail",
    description: "Sharp lines and textures",
    category: "architecture",
    originalUrl: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=600&q=70",
    enhancedUrl: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1200&q=95",
    width: 16,
    height: 10,
  },
  {
    id: "portrait-2",
    title: "Low Light Portrait",
    description: "Noise reduction and clarity",
    category: "portrait",
    originalUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=70",
    enhancedUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1200&q=95",
    width: 3,
    height: 4,
  },
  {
    id: "landscape-2",
    title: "Nature Scene",
    description: "Vibrant colors and detail",
    category: "landscape",
    originalUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=70",
    enhancedUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200&q=95",
    width: 16,
    height: 9,
  },
];
