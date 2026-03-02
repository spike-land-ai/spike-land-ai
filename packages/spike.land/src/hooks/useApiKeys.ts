import { useCallback, useEffect, useState } from "react";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface NewApiKey extends ApiKey {
  key: string;
}

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<NewApiKey | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    try {
      const response = await fetch("/api/settings/api-keys");
      if (!response.ok) throw new Error("Failed to fetch API keys");
      const data = await response.json();
      setApiKeys(data.apiKeys);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create API key");
      }

      const data = await response.json();
      setNewlyCreatedKey(data.apiKey);
      await fetchApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    setRevokingKeyId(keyId);
    try {
      const response = await fetch(`/api/settings/api-keys/${keyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revoke API key");
      }

      await fetchApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    } finally {
      setRevokingKeyId(null);
    }
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch (err) {
      // istanbul ignore next -- @preserve Defensive error handling for clipboard API failures
      console.error("Failed to copy to clipboard:", err);
      // istanbul ignore next
      setError("Failed to copy to clipboard. Please copy manually.");
    }
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    setNewKeyName("");
    setNewlyCreatedKey(null);
  };

  return {
    apiKeys,
    isLoading,
    error,
    createDialogOpen,
    setCreateDialogOpen,
    newKeyName,
    setNewKeyName,
    isCreating,
    newlyCreatedKey,
    copiedKeyId,
    revokingKeyId,
    fetchApiKeys,
    handleCreateKey,
    handleRevokeKey,
    copyToClipboard,
    closeCreateDialog,
  };
}
