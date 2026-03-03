import { toast } from "sonner";
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Plus, Trash2, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Button, Input, Select, TextArea, Modal, Badge, ImagePicker } from "@/components/ui";
import { useLightbox } from "@/contexts/LightboxContext";
import { callTool, parseToolResult } from "@/api/client";
import { ALBUM_PRIVACY } from "@/constants/enums";

interface Album {
  id: string;
  handle: string;
  name: string;
  description?: string;
  privacy: string;
  imageCount?: number;
}

interface AlbumImage {
  image_id: string;
  name?: string;
  url?: string;
  sort_order: number;
}

export function Albums() {
  const queryClient = useQueryClient();
  const { openLightbox } = useLightbox();

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrivacy, setNewPrivacy] = useState("PRIVATE");
  const [creating, setCreating] = useState(false);

  // Selected album detail
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  // Add image modal
  const [showAddImage, setShowAddImage] = useState(false);
  const [addImageId, setAddImageId] = useState("");
  const [addingImage, setAddingImage] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Album | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: albumsData, isLoading: loading } = useQuery({
    queryKey: ["albums"],
    queryFn: async () => {
      const res = await callTool("img_album_list", {});
      const data = parseToolResult<{ albums: Album[] }>(res);
      return data.albums ?? [];
    },
  });
  const albums = albumsData ?? [];

  const { data: albumImagesData, isLoading: loadingImages } = useQuery({
    queryKey: ["albumImages", selectedAlbum?.handle],
    queryFn: async () => {
      if (!selectedAlbum) return [];
      const res = await callTool("img_album", {
        album_handle: selectedAlbum.handle,
        include_images: true,
      });
      const data = parseToolResult<{ images: AlbumImage[] }>(res);
      return data.images ?? [];
    },
    enabled: !!selectedAlbum,
  });
  const albumImages = albumImagesData ?? [];

  const handleCreate = async () => {
    if (!newName.trim() || !newHandle.trim()) return;
    setCreating(true);
    try {
      await callTool("img_album_create", {
        name: newName,
        handle: newHandle,
        description: newDesc || undefined,
        privacy: newPrivacy,
      });
      setShowCreate(false);
      setNewName("");
      setNewHandle("");
      setNewDesc("");
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      toast.success("Album created!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await callTool("img_album_delete", {
        album_handle: deleteTarget.handle,
      });
      setDeleteTarget(null);
      if (selectedAlbum?.handle === deleteTarget.handle) {
        setSelectedAlbum(null);
      }
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      toast.success("Album deleted!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleAddImage = async () => {
    if (!addImageId.trim() || !selectedAlbum) return;
    setAddingImage(true);
    try {
      await callTool("img_album_images", {
        album_handle: selectedAlbum.handle,
        action: "add",
        image_ids: [addImageId],
      });
      setShowAddImage(false);
      setAddImageId("");
      queryClient.invalidateQueries({ queryKey: ["albumImages", selectedAlbum.handle] });
      toast.success("Image added to album");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add image");
    } finally {
      setAddingImage(false);
    }
  };

  const handleRemoveImage = async (imageId: string) => {
    if (!selectedAlbum) return;
    try {
      await callTool("img_album_images", {
        album_handle: selectedAlbum.handle,
        action: "remove",
        image_ids: [imageId],
      });
      queryClient.invalidateQueries({ queryKey: ["albumImages", selectedAlbum.handle] });
      toast.success("Image removed from album");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    }
  };

  const selectAlbum = (album: Album) => {
    setSelectedAlbum(album);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !selectedAlbum) return;
    const newImages = Array.from(albumImages);
    const [reorderedItem] = newImages.splice(result.source.index, 1);
    newImages.splice(result.destination.index, 0, reorderedItem);

    // Update local cache optimistically
    queryClient.setQueryData(["albumImages", selectedAlbum.handle], newImages);

    // Placeholder for backend mutation if api implements it
    toast.success("Images reordered locally (not persisted)");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Albums</h2>
          <p className="text-gray-400 mt-1">{albums.length} albums</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Album
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Album list */}
        <div className="w-72 shrink-0 space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
            ))
          ) : albums.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No albums yet</p>
          ) : (
            albums.map((album) => (
              <button
                key={album.id}
                onClick={() => selectAlbum(album)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedAlbum?.id === album.id
                    ? "bg-accent-600/10 border-accent-500/30"
                    : "bg-gray-900 border-gray-800 hover:border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-200 truncate">{album.name}</span>
                  <Badge
                    variant={
                      album.privacy === "PUBLIC"
                        ? "success"
                        : album.privacy === "UNLISTED"
                          ? "warning"
                          : "default"
                    }
                  >
                    {album.privacy}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">{album.handle}</p>
              </button>
            ))
          )}
        </div>

        {/* Album detail */}
        <div className="flex-1">
          {selectedAlbum ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">{selectedAlbum.name}</h3>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowAddImage(true)}>
                    <Plus className="w-4 h-4" /> Add Image
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteTarget(selectedAlbum)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {selectedAlbum.description && (
                <p className="text-sm text-gray-400">{selectedAlbum.description}</p>
              )}

              {loadingImages ? (
                <div className="grid grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-gray-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : albumImages.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No images in this album</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="album-images" direction="horizontal">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="grid grid-cols-2 md:grid-cols-3 gap-4"
                      >
                        {albumImages.map((img, index) => (
                          <Draggable key={img.image_id} draggableId={img.image_id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col group relative"
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="absolute top-2 left-2 p-1.5 bg-black/50 rounded hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab z-10"
                                >
                                  <GripVertical className="w-4 h-4 text-white" />
                                </div>
                                {img.url && (
                                  <img
                                    src={img.url}
                                    alt={img.name ?? ""}
                                    className="w-full aspect-square object-cover rounded-lg mb-2 cursor-pointer"
                                    onClick={() => {
                                      const slides = albumImages
                                        .map((i) => ({ src: i.url || "", alt: i.name || "" }))
                                        .filter((s) => s.src);
                                      openLightbox(index, slides);
                                    }}
                                  />
                                )}
                                <div className="flex items-center justify-between mt-auto">
                                  <span className="text-xs text-gray-400 truncate">
                                    {img.name ?? img.image_id}
                                  </span>
                                  <button
                                    onClick={() => handleRemoveImage(img.image_id)}
                                    className="text-red-400 hover:text-red-300 p-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Select an album to view its contents
            </div>
          )}
        </div>
      </div>

      {/* Create Album Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Album">
        <div className="space-y-4">
          <Input
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Album name"
          />
          <Input
            label="Handle"
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            placeholder="url-friendly-handle"
          />
          <TextArea
            label="Description"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Optional"
            rows={2}
          />
          <Select
            label="Privacy"
            value={newPrivacy}
            onChange={(e) => setNewPrivacy(e.target.value)}
            options={ALBUM_PRIVACY.map((p) => ({ value: p, label: p }))}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={creating}
              disabled={!newName.trim() || !newHandle.trim()}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Image Modal */}
      <Modal open={showAddImage} onClose={() => setShowAddImage(false)} title="Add Image to Album">
        <div className="space-y-4">
          <ImagePicker
            label="Image ID"
            value={addImageId}
            onChange={setAddImageId}
            placeholder="Select image to add"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowAddImage(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddImage} loading={addingImage} disabled={!addImageId.trim()}>
              Add
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Album">
        <p className="text-gray-300">
          Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
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
