import { toast } from "sonner";
import { useState, useCallback, useRef, useEffect } from "react";
import { Search, RefreshCw } from "lucide-react";
import { Button, Input, ImageCard, ImageGrid, Modal } from "@/components/ui";
import { useLibrary } from "@/hooks/useLibrary";
import { callTool } from "@/api/client";
import { useLightbox } from "@/contexts/LightboxContext";

export function Library() {
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { openLightbox } = useLightbox();

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useLibrary(searchQuery);

  const images = data?.pages.flat() ?? [];

  const handleSearch = useCallback(() => {
    setSearchQuery(inputValue.trim());
  }, [inputValue]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await callTool("img_delete", { image_id: deleteTarget.id });
      setDeleteTarget(null);
      refetch();
      toast.success("Image deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete image");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, refetch]);

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

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="space-y-6 pb-12 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Library</h2>
          <p className="text-gray-400 mt-1">{images.length} images loaded</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw
            className={`w-4 h-4 ${isFetchingNextPage || isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="text-red-400 text-sm">
          {error instanceof Error ? error.message : "Failed to load images"}
        </p>
      )}

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search images by name or tags..."
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
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No images yet</p>
          <p className="text-gray-500 text-sm mt-1">Upload images to get started</p>
        </div>
      ) : (
        <ImageGrid>
          {images.map((img, index) => (
            <ImageCard
              key={img.id}
              id={img.id}
              name={img.name}
              url={img.url}
              width={img.width}
              height={img.height}
              tags={img.tags}
              onClick={() => {
                const slides = images.map((i) => ({ src: i.url, alt: i.name }));
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

      {/* Intersection Observer Target */}
      <div ref={observerTarget} className="h-10 flex items-center justify-center">
        {isFetchingNextPage && (
          <div className="w-6 h-6 border-2 border-amber-neon border-t-transparent rounded-full animate-spin animate-delayed-show" />
        )}
      </div>

      {/* Delete confirmation modal */}
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
