import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Upload as UploadIcon, CheckCircle } from "lucide-react";
import { Button, Input, TextArea, DropZone, Select, Badge } from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";

interface FileData {
  name: string;
  base64: string;
  contentType: string;
  width: number;
  height: number;
}

interface UploadResult {
  id: string;
  url: string;
  name: string;
  tags: string[];
  description: string;
  width: number;
  height: number;
  album_handle?: string;
}

export function Upload() {
  const [file, setFile] = useState<FileData | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [albumHandle, setAlbumHandle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [albums, setAlbums] = useState<Array<{ handle: string; name: string }>>([]);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  useEffect(() => {
    callTool("img_album_list", {})
      .then((res) => {
        const data = parseToolResult<{ albums: Array<{ handle: string; name: string }> }>(res);
        setAlbums(data.albums || []);
      })
      .catch(() => {});
  }, []);

  const handleFile = (f: FileData) => {
    setFile(f);
    setUploadResult(null);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const tagsArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await callTool("img_upload", {
        name: name || file.name,
        data_base64: file.base64,
        content_type: file.contentType,
        width: file.width,
        height: file.height,
        description,
        tags: tagsArray,
        album_handle: albumHandle || undefined,
      });

      const result = parseToolResult<UploadResult>(res);
      setUploadResult(result);
      toast.success("Image uploaded successfully!");

      setFile(null);
      setName("");
      setDescription("");
      setTags("");
      setAlbumHandle("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadAnother = () => {
    setUploadResult(null);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Upload</h2>
        <p className="text-gray-400 mt-1">Add images to your library</p>
      </div>

      {uploadResult ? (
        <div className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <CheckCircle className="w-5 h-5" />
            Upload complete
          </div>

          <div className="flex gap-4">
            <img
              src={uploadResult.url}
              alt={uploadResult.name}
              className="w-32 h-32 object-cover rounded-lg border border-gray-700 flex-shrink-0"
            />
            <div className="space-y-2 min-w-0">
              <p className="text-gray-100 font-medium truncate">{uploadResult.name}</p>
              {uploadResult.description && (
                <p className="text-gray-400 text-sm line-clamp-3">{uploadResult.description}</p>
              )}
              {uploadResult.tags && uploadResult.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {uploadResult.tags.map((tag) => (
                    <Badge
                      key={tag}
                      className="bg-purple-900/50 text-purple-300 border border-purple-700/50 text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button variant="secondary" onClick={handleUploadAnother}>
            <UploadIcon className="w-4 h-4" />
            Upload another
          </Button>
        </div>
      ) : (
        <>
          <DropZone onFile={handleFile} disabled={uploading} />

          {file && (
            <div className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Image name"
              />
              <TextArea
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
              <Input
                label="Tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Comma-separated tags"
              />
              <Select
                label="Album (optional)"
                value={albumHandle}
                onChange={(e) => setAlbumHandle(e.target.value)}
                options={[
                  { value: "", label: "None" },
                  ...albums.map((a) => ({ value: a.handle, label: a.name })),
                ]}
              />

              <div className="flex gap-3 pt-2">
                <Button onClick={handleUpload} loading={uploading}>
                  <UploadIcon className="w-4 h-4" />
                  {uploading ? "Uploading & analyzing..." : "Upload"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFile(null);
                    setName("");
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
