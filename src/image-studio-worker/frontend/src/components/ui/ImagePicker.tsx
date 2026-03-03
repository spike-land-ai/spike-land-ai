import { useState, useMemo, useEffect, useRef } from "react";
import { Image as ImageIcon, Search } from "lucide-react";
import { Modal } from "./Modal";
import { ImageGrid } from "./ImageGrid";
import { ImageCard } from "./ImageCard";
import { useLibrary } from "@/hooks/useLibrary";

interface ImagePickerProps {
  value?: string;
  onChange: (imageId: string) => void;
  label?: string;
  placeholder?: string;
}

export function ImagePicker({
  value,
  onChange,
  label = "Select Image",
  placeholder = "Choose an image...",
}: ImagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useLibrary(searchQuery);

  const images = data?.pages.flat() ?? [];

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value.length > 2 || e.target.value.length === 0) {
      setSearchQuery(e.target.value);
    }
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  const selectedImage = useMemo(() => {
    return images.find((img) => img.id === value);
  }, [images, value]);

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
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isOpen]);

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-gray-300">{label}</label>}

      <div
        onClick={() => setIsOpen(true)}
        className="w-full relative px-3 py-2 min-h-[42px] rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer flex items-center justify-between group"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {selectedImage ? (
            <>
              <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0 bg-gray-900">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-gray-100 text-sm truncate">{selectedImage.id}</span>
            </>
          ) : value ? (
            <span className="text-gray-100 text-sm truncate">{value}</span>
          ) : (
            <span className="text-gray-500 text-sm">{placeholder}</span>
          )}
        </div>
        <ImageIcon className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors flex-shrink-0" />
      </div>

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Select Image from Library"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search images..."
              value={inputValue}
              onChange={handleSearch}
              className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-accent-500"
            />
          </div>

          <div className="min-h-[300px] max-h-[50vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full min-h-[200px]">
                <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-400">
                <ImageIcon className="w-12 h-12 mb-2 opacity-20" />
                <p>No images found</p>
              </div>
            ) : (
              <>
                <ImageGrid columns={4}>
                  {images.map((image) => (
                    <ImageCard
                      key={image.id}
                      id={image.id}
                      name={image.name}
                      url={image.url}
                      width={image.width}
                      height={image.height}
                      selected={value === image.id}
                      onClick={() => handleSelect(image.id)}
                    />
                  ))}
                </ImageGrid>
                <div ref={observerTarget} className="h-10 flex items-center justify-center mt-4">
                  {isFetchingNextPage && (
                    <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
