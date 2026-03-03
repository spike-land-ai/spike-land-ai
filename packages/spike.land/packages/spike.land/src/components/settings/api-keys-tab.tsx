"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
import { useApiKeys } from "@/hooks/useApiKeys";
import { formatDateShort, formatRelativeTime } from "@/lib/format/date";
import { Check, Copy, ExternalLink, Key, Plus, Trash2 } from "lucide-react";

export function ApiKeysTab() {
  const {
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
    handleCreateKey,
    handleRevokeKey,
    copyToClipboard,
    closeCreateDialog,
  } = useApiKeys();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <p className="text-muted-foreground">Loading API keys...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Manage your API keys for MCP server and programmatic access
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              {newlyCreatedKey
                ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>API Key Created</DialogTitle>
                      <DialogDescription>
                        Copy your API key now. For security, it will not be shown again.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Your API Key</Label>
                        <div className="flex items-center space-x-2">
                          <code className="flex-1 p-3 bg-muted rounded-md text-sm font-mono break-all">
                            {newlyCreatedKey.key}
                          </code>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(newlyCreatedKey.key, "new")}
                          >
                            {copiedKeyId === "new"
                              ? <Check className="h-4 w-4 text-green-500" />
                              : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-md bg-yellow-900/20 p-3 text-sm text-yellow-200">
                        Make sure to copy your API key now. You will not be able to see it again!
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={closeCreateDialog}>Done</Button>
                    </DialogFooter>
                  </>
                )
                : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Create New API Key</DialogTitle>
                      <DialogDescription>
                        Give your API key a name to help you remember what it is used for.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="key-name">Key Name</Label>
                        <Input
                          id="key-name"
                          placeholder="e.g., Claude Desktop, Development"
                          value={newKeyName}
                          onChange={e => setNewKeyName(e.target.value)}
                          maxLength={50}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateKey}
                        disabled={!newKeyName.trim() || isCreating}
                      >
                        {isCreating ? "Creating..." : "Create Key"}
                      </Button>
                    </DialogFooter>
                  </>
                )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {apiKeys.length === 0
          ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No API Keys</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create an API key to use the MCP server or make programmatic requests.
              </p>
            </div>
          )
          : (
            <div className="space-y-3">
              {apiKeys.map(key => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-muted rounded-md">
                      <Key className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{key.name}</span>
                        {!key.isActive && <Badge variant="secondary">Revoked</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <code className="bg-muted px-1 rounded">
                          {key.keyPrefix}
                        </code>
                        <span className="mx-2">-</span>
                        Created {formatDateShort(key.createdAt)}
                        <span className="mx-2">-</span>
                        {formatRelativeTime(key.lastUsedAt)}
                      </div>
                    </div>
                  </div>
                  {key.isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRevokeKey(key.id)}
                      disabled={revokingKeyId === key.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2">Using your API Keys</h4>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Use your API key to authenticate with the MCP server or REST API:
            </p>
            <div className="space-y-1">
              <p className="font-medium text-foreground">REST API:</p>
              <code className="block p-2 bg-muted rounded text-xs">
                curl -H &quot;Authorization: Bearer sk_live_...&quot; \
                <br />
                &nbsp;&nbsp;https://spike.land/api/mcp/generate
              </code>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">MCP Server:</p>
              <code className="block p-2 bg-muted rounded text-xs">
                SPIKE_LAND_API_KEY=sk_live_... npx @spike-land-ai/spike-cli
              </code>
            </div>
            <div className="flex items-center space-x-4 pt-2">
              <Link
                href="/apps/pixel/mcp-tools"
                className="inline-flex items-center text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Test your API keys
              </Link>
              <Link
                href="/settings/mcp-history"
                className="inline-flex items-center text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View usage history
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
