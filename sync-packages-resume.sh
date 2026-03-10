#!/usr/bin/env bash

# Skip these because they either succeeded or fail due to secrets
SKIP="bazdmeg-mcp block-sdk block-tasks block-website chess-engine educational-videos esbuild-wasm esbuild-wasm-mcp google-analytics-mcp hackernews-mcp image-studio-worker mcp-auth mcp-image-studio mcp-server-base openclaw-mcp react-ts-worker shared"

# Sync all packages to their virtual git repos in spike-land-ai org
for pkg_path in packages/*; do
  if [ -d "$pkg_path" ]; then
    pkg=$(basename "$pkg_path")
    
    if [[ " $SKIP " =~ " $pkg " ]]; then
      echo "Skipping $pkg"
      continue
    fi
    
    echo "Processing $pkg..."
    
    # Ensure the repo exists on GitHub
    gh repo create "spike-land-ai/$pkg" --public -y 2>/dev/null || true
    
    # Create the subtree split branch
    branch_name="split-$pkg"
    git branch -D "$branch_name" 2>/dev/null || true
    git subtree split --prefix="$pkg_path" -b "$branch_name" || true
    
    # Push to the remote
    echo "Pushing $pkg to GitHub..."
    git push "https://github.com/spike-land-ai/$pkg.git" "$branch_name:main" --force || echo "Failed to push $pkg"
  fi
done
echo "All packages processed!"
