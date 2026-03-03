import { toast } from "sonner";
import { useState, useCallback, useRef, useEffect } from "react";
import { Search, RefreshCw, Upload, Image as ImageIcon, Tag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, ImageCard, ImageGrid, Modal } from "@/components/ui";
import { useGallery } from "@/hooks/useGallery";
import { useEventBus } from "@/hooks/useEventBus";
import { deleteGalleryImage, uploadToGallery } from "@/api/client";
import { useLightbox } from "@/contexts/LightboxContext";

export function Gallery() {
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openLightbox } = useLightbox();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useGallery({ search: searchQuery, tag: activeTag });

  // Invalidate gallery query on remote events so the grid stays reactive
  const invalidateGallery = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["gallery"] });
  }, [queryClient]);

  useEventBus("gallery:updated", invalidateGallery);
  useEventBus("image:uploaded", invalidateGallery);
  useEventBus("image:generated", invalidateGallery);
  useEventBus("image:enhanced", invalidateGallery);

  const images = data?.images ?? [];
  const album = data?.album;

  // Collect unique tags from loaded images
  const allTags = [...new Set(images.flatMap((img) => img.tags))].slice(0, 20);

  const handleSearch = useCallback(() => {
    setSearchQuery(inputValue.trim());
  }, [inputValue]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteGalleryImage(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
      toast.success("Image deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete image");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, refetch]);

  const handleUpload = useCallback(async (files: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadToGallery(file);
      }
      toast.success(`Uploaded ${files.length} image${files.length > 1 ? "s" : ""}`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [refetch]);

  // Infinite scroll observer
  const observerTarget = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="space-y-6 pb-12 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">
            {album?.name ?? "Gallery"}
          </h2>
          <p className="text-gray-400 mt-1">
            {images.length} image{images.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
          >
            <Upload className="w-4 h-4" />
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files?.length && handleUpload(e.target.files)}
          />
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm">
          {error instanceof Error ? error.message : "Failed to load gallery"}
        </p>
      )}

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search images by name or description..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button variant="secondary" onClick={handleSearch}>
          <Search className="w-4 h-4" />
          Search
        </Button>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag(undefined)}
            className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
              !activeTag
                ? "bg-amber-neon/10 border-amber-neon/30 text-amber-neon"
                : "border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? undefined : tag)}
              className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                activeTag === tag
                  ? "bg-amber-neon/10 border-amber-neon/30 text-amber-neon"
                  : "border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20"
              }`}
            >
              <Tag className="w-3 h-3" />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Image grid */}
      {isLoading ? (
        <div className="animate-delayed-show">
          <ImageGrid columns={6}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square bg-obsidian-900 border border-white/5 rounded-[1.5rem] animate-pulse" />
            ))}
          </ImageGrid>
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 text-lg font-semibold">No images yet</p>
          <p className="text-gray-500 text-sm mt-1">Upload your first image to get started</p>
          <Button className="mt-6" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" />
            Upload Images
          </Button>
        </div>
      ) : (
        <ImageGrid columns={6}>
          {images.map((img, index) => (
            <ImageCard
              key={img.id}
              id={img.id}
              name={img.name}
              url={img.originalUrl}
              width={img.originalWidth || undefined}
              height={img.originalHeight || undefined}
              tags={img.tags}
              description={img.description ?? undefined}
              badge={
                img.isPublic ? (
                  <span className="text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Public
                  </span>
                ) : undefined
              }
              onClick={() => {
                const slides = images.map((i) => ({ src: i.originalUrl, alt: i.name }));
                openLightbox(index, slides);
              }}
              actions={[
                {
                  label: "Delete",
                  onClick: () => setDeleteTarget({ id: img.id, name: img.name }),
                  danger: true,
                },
              ]}
            />
          ))}
        </ImageGrid>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={observerTarget} className="h-10 flex items-center justify-center">
        {isFetchingNextPage && (
          <div className="w-6 h-6 border-2 border-amber-neon border-t-transparent rounded-full animate-spin animate-delayed-show" />
        )}
      </div>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Image">
        <p className="text-gray-300">
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be
          undone.
        </p>
        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
