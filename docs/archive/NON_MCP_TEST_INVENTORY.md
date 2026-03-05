# Non-MCP Test Inventory

This document catalogs non-MCP test files that were scheduled for removal as
part of the MCP Platform Consolidation. A major cleanup (~420 files removed) was
completed on 2026-02-26.

**Generated**: 2026-02-14 **Updated**: 2026-02-26 **Branch**:
feat/mcp-architecture-phase-a

## Summary (Post-Cleanup)

> **Note:** The original inventory listed 993 files for deletion. Approximately
> 420 of those files have been removed as of 2026-02-26. The total test file
> count across the entire codebase is now **398 test files** (down from ~1,034).

| Category                                      | Original | Removed | Remaining | Status                                                    |
| --------------------------------------------- | -------- | ------- | --------- | --------------------------------------------------------- |
| Component rendering tests (`src/components/`) | 260      | ~200    | ~60       | Mostly cleaned                                            |
| Page/Layout/Error/Loading tests (`src/app/`)  | 102      | ~60     | ~42       | Mostly cleaned                                            |
| App client component tests (`src/app/`)       | 38       | ~25     | ~13       | Mostly cleaned                                            |
| API route tests (`src/app/api/`)              | 158      | ~30     | ~128      | Partially cleaned                                         |
| Hook tests (`src/hooks/`)                     | 28       | ~20     | ~8        | Mostly cleaned                                            |
| Library tests, non-MCP (`src/lib/`)           | 242      | ~50     | ~192      | Partially cleaned                                         |
| Type tests (`src/types/`)                     | 1        | 1       | 0         | Done                                                      |
| Root-level src tests                          | 4        | 4       | 0         | Done                                                      |
| Workflow tests (`src/workflows/`)             | 5        | 5       | 0         | Done                                                      |
| `src/code` tests                              | 37       | 37      | 0         | Done (pkg extracted to @spike-land-ai/code)               |
| `src/testing.spike.land` tests                | 23       | 23      | 0         | Done (pkg extracted to @spike-land-ai/testing.spike.land) |
| `src/shared` tests                            | 4        | 4       | 0         | Done (pkg extracted to @spike-land-ai/shared)             |
| `src/opfs-node-adapter` tests                 | 40       | 40      | 0         | Done (pkg removed)                                        |
| `src/js.spike.land` tests                     | 1        | 1       | 0         | Done (pkg extracted to @spike-land-ai/js.spike.land)      |
| `src/video` tests                             | 1        | 1       | 0         | Done (pkg removed)                                        |
| `src/vibe-dev` tests                          | 4        | 4       | 0         | Done (pkg extracted to @spike-land-ai/vibe-dev)           |
| `apps/audio-mixer` tests                      | 11       | 0       | 0         | Relocated                                                 |
| `apps/display` tests                          | 10       | 0       | 0         | Relocated                                                 |
| `apps/tabletop-simulator` tests               | 21       | 0       | 0         | Relocated                                                 |
| `apps/music-creator` tests                    | 1        | 0       | 0         | Relocated                                                 |
| `scripts/` tests                              | 2        | 2       | 0         | Done                                                      |
| **Original Total**                            | **993**  | ~420    |           |                                                           |

### Current Test File Counts (2026-02-26)

| Category                                              | Count    | Status |
| ----------------------------------------------------- | -------- | ------ |
| MCP tool tests (`src/lib/mcp/server/tools/*.test.ts`) | 150      | Keep   |
| MCP infrastructure tests (`src/lib/mcp/*.test.ts`)    | included | Keep   |
| Non-MCP tests (remaining across codebase)             | ~248     | Mixed  |
| **Total test files**                                  | **398**  |        |

---

## Detailed Inventory

### 1. Component Rendering Tests (`src/components/`) -- 260 files

#### Admin Components (2 files)

- `src/components/admin/AdminDashboardClient.test.tsx`
- `src/components/admin/agents/AgentsDashboardClient.test.tsx`

#### Agency Landing Components (8 files)

- `src/components/agency-landing/ContactForm.test.tsx`
- `src/components/agency-landing/CTABanner.test.tsx`
- `src/components/agency-landing/faq-section.test.tsx`
- `src/components/agency-landing/pricing-section.test.tsx`
- `src/components/agency-landing/ProcessSection.test.tsx`
- `src/components/agency-landing/scroll-reveal.test.tsx`
- `src/components/agency-landing/tech-stack-section.test.tsx`
- `src/components/agency-landing/TestimonialsSection.test.tsx`

#### App Factory Components (9 files)

- `src/components/app-factory/ActivityFeed.test.tsx`
- `src/components/app-factory/AddAppModal.test.tsx`
- `src/components/app-factory/AppCard.test.tsx`
- `src/components/app-factory/BacklogPanel.test.tsx`
- `src/components/app-factory/DonePanel.test.tsx`
- `src/components/app-factory/JulesCapacityPanel.test.tsx`
- `src/components/app-factory/KanbanBoard.test.tsx`
- `src/components/app-factory/KanbanColumn.test.tsx`
- `src/components/app-factory/StatisticsPanel.test.tsx`

#### Apps Components (5 files)

- `src/components/apps/app-card.test.tsx`
- `src/components/apps/app-feature-list.test.tsx`
- `src/components/apps/app-screenshot-gallery.test.tsx`
- `src/components/apps/requirements-manager.example.test.tsx`
- `src/components/apps/requirements-manager.test.tsx`

#### Arena Components (2 files)

- `src/components/arena/PhaseSteps.test.tsx`
- `src/components/arena/TokenCounter.test.tsx`

#### Auth Components (6 files)

- `src/components/auth/auth-buttons.test.tsx`
- `src/components/auth/auth-header.test.tsx`
- `src/components/auth/session-provider.test.tsx`
- `src/components/auth/sign-in-button.test.tsx`
- `src/components/auth/sign-out-button.test.tsx`
- `src/components/auth/user-avatar.test.tsx`

#### Blog Components (8 files)

- `src/components/blog/BlogCard.test.tsx`
- `src/components/blog/BlogHeader.test.tsx`
- `src/components/blog/ImagePlaceholder.test.tsx`
- `src/components/blog/interactive/CoreComponents.test.tsx`
- `src/components/blog/interactive/DemoComponents.test.tsx`
- `src/components/blog/MDXComponents.test.tsx`
- `src/components/blog/MDXContent.test.tsx`
- `src/components/blog/Prose.test.tsx`
- `src/components/blog/ReadAloudArticle.test.tsx`
- `src/components/blog/ReadAloudButton.test.tsx`

#### Boxes Components (3 files)

- `src/components/boxes/agent-control-panel.test.tsx`
- `src/components/boxes/box-card.test.tsx`
- `src/components/boxes/create-box-form.test.tsx`

#### Brand Components (3 files)

- `src/components/brand/PdMcpLogo.test.tsx`
- `src/components/brand/PixelLogo.test.tsx`
- `src/components/brand/SpikeLandLogo.test.tsx`

#### Canvas Components (7 files)

- `src/components/canvas/BeforeAfterPeek.test.tsx`
- `src/components/canvas/CanvasSettingsForm.test.tsx`
- `src/components/canvas/FloatingHint.test.tsx`
- `src/components/canvas/GridThumbnail.test.tsx`
- `src/components/canvas/QRCodePanel.test.tsx`
- `src/components/canvas/SlideshowView.test.tsx`
- `src/components/canvas/SmartGrid.test.tsx`

#### Cookie Consent (1 file)

- `src/components/CookieConsent.test.tsx`

#### Create Components (14 files)

- `src/components/create/app-card.test.tsx`
- `src/components/create/composer-box.test.tsx`
- `src/components/create/composer-glow.test.tsx`
- `src/components/create/composer-image-strip.test.tsx`
- `src/components/create/composer-skills.test.tsx`
- `src/components/create/composer-typing-demo.test.tsx`
- `src/components/create/create-search.test.tsx`
- `src/components/create/live-app-card.test.tsx`
- `src/components/create/live-app-display.test.tsx`
- `src/components/create/live-app-preview.test.tsx`
- `src/components/create/related-apps.test.tsx`
- `src/components/create/skill-badge.test.tsx`
- `src/components/create/skills-bar.test.tsx`
- `src/components/create/streaming-app.test.tsx`
- `src/components/create/vibe-code-activator.test.tsx`
- `src/components/create/vibe-code-fab.test.tsx`
- `src/components/create/vibe-code-input.test.tsx`
- `src/components/create/vibe-code-messages.test.tsx`
- `src/components/create/vibe-code-panel.test.tsx`
- `src/components/create/vibe-code-provider.test.tsx`
- `src/components/create/vibe-code-sidebar.test.tsx`

#### Enhance Components (35 files)

- `src/components/enhance/AddToAlbumModal.test.tsx`
- `src/components/enhance/AlbumBatchEnhance.test.tsx`
- `src/components/enhance/AlbumCard.test.tsx`
- `src/components/enhance/AlbumSelector.test.tsx`
- `src/components/enhance/AlbumsGrid.test.tsx`
- `src/components/enhance/AlbumsGridSkeleton.test.tsx`
- `src/components/enhance/batch-enhance.test.tsx`
- `src/components/enhance/batch-upload.test.tsx`
- `src/components/enhance/BatchEnhanceProgress.test.tsx`
- `src/components/enhance/BulkDeleteDialog.test.tsx`
- `src/components/enhance/ComparisonViewToggle.test.tsx`
- `src/components/enhance/CreateAlbumDialog.test.tsx`
- `src/components/enhance/display-type-switcher.test.tsx`
- `src/components/enhance/DragDropContext.test.tsx`
- `src/components/enhance/DraggablePhotoCard.test.tsx`
- `src/components/enhance/DragPreview.test.tsx`
- `src/components/enhance/DroppableAlbum.test.tsx`
- `src/components/enhance/DroppableEnhanceZone.test.tsx`
- `src/components/enhance/DropZoneIndicator.test.tsx`
- `src/components/enhance/EnhanceAllDialog.test.tsx`
- `src/components/enhance/EnhancedImagesList.test.tsx`
- `src/components/enhance/EnhancementHistoryGrid.test.tsx`
- `src/components/enhance/EnhancementHistoryScroll.test.tsx`
- `src/components/enhance/EnhancementSettings.test.tsx`
- `src/components/enhance/export-selector.test.tsx`
- `src/components/enhance/FileUploadItem.test.tsx`
- `src/components/enhance/ImageComparisonSlider.test.tsx`
- `src/components/enhance/ImagePlaceholder.test.tsx`
- `src/components/enhance/ImageUpload.test.tsx`
- `src/components/enhance/MultiTierEnhancement.test.tsx`
- `src/components/enhance/MultiUploadProgress.test.tsx`
- `src/components/enhance/ParallelJobsProgress.test.tsx`
- `src/components/enhance/PipelineCard.test.tsx`
- `src/components/enhance/PipelineForm.test.tsx`
- `src/components/enhance/PipelineProgress.test.tsx`
- `src/components/enhance/PipelineSelector.test.tsx`
- `src/components/enhance/ReferenceImageUpload.test.tsx`
- `src/components/enhance/ShareButton.test.tsx`
- `src/components/enhance/SideBySideComparison.test.tsx`
- `src/components/enhance/SplitPreview.test.tsx`
- `src/components/enhance/ThumbnailViewToggle.test.tsx`
- `src/components/enhance/TierSelectionCheckboxes.test.tsx`
- `src/components/enhance/version-compare-modal.test.tsx`
- `src/components/enhance/version-history.test.tsx`
- `src/components/enhance/VersionGrid.test.tsx`

#### Error Components (2 files)

- `src/components/errors/error-boundary.test.tsx`
- `src/components/errors/IframeErrorBridge.test.tsx`

#### Feature Components (7 files)

- `src/components/features/demos/ABTestingDemo.test.tsx`
- `src/components/features/demos/AICalendarDemo.test.tsx`
- `src/components/features/demos/AnalyticsDemo.test.tsx`
- `src/components/features/demos/BrandBrainDemo.test.tsx`
- `src/components/features/FeatureCTA.test.tsx`
- `src/components/features/FeatureDetails.test.tsx`
- `src/components/features/FeatureHero.test.tsx`

#### Feedback Components (1 file)

- `src/components/feedback/FeedbackButton.test.tsx`

#### Footer Components (1 file)

- `src/components/footer/Footer.test.tsx`

#### Infographic Components (4 files)

- `src/components/infographic/shared/AnimatedCounter.test.tsx`
- `src/components/infographic/shared/GlassCard.test.tsx`
- `src/components/infographic/shared/ProgressGauge.test.tsx`
- `src/components/infographic/shared/SeverityBadge.test.tsx`

#### Landing Components (19 files)

- `src/components/landing/animated-counter.test.tsx`
- `src/components/landing/AppShowcaseSection.test.tsx`
- `src/components/landing/BeforeAfterGallery.test.tsx`
- `src/components/landing/BeforeAfterGalleryClient.test.tsx`
- `src/components/landing/ComponentDemo.test.tsx`
- `src/components/landing/CreateCTASection.test.tsx`
- `src/components/landing/CreationStats.test.tsx`
- `src/components/landing/CTASection.test.tsx`
- `src/components/landing/FAQ.test.tsx`
- `src/components/landing/FeatureShowcase.test.tsx`
- `src/components/landing/gallery-fallback-data.test.ts`
- `src/components/landing/HeroComparisonSlider.test.tsx`
- `src/components/landing/HeroSection.test.tsx`
- `src/components/landing/HeroSectionWithData.test.tsx`
- `src/components/landing/LandingHero.test.tsx`
- `src/components/landing/LearnItSection.test.tsx`
- `src/components/landing/PhotoMixDemo.test.tsx`
- `src/components/landing/PixelHeader.test.tsx`
- `src/components/landing/PublicGallerySection.test.tsx`
- `src/components/landing/TemplateCards.test.tsx`

#### LearnIt Components (5 files)

- `src/components/learnit/header-search.test.tsx`
- `src/components/learnit/regenerate-button.test.tsx`
- `src/components/learnit/search.test.tsx`
- `src/components/learnit/streaming-content.test.tsx`
- `src/components/learnit/topic-card.test.tsx`

#### MCP Component Tests (1 file)

- `src/components/mcp/mcp-tool-registry.test.ts`

#### Merch Components (5 files)

- `src/components/merch/cart-icon.test.tsx`
- `src/components/merch/image-selector.test.tsx`
- `src/components/merch/order-status-badge.test.tsx`
- `src/components/merch/product-card.test.tsx`
- `src/components/merch/variant-selector.test.tsx`

#### Mix Components (5 files)

- `src/components/mix/ImageSelectorDialog.test.tsx`
- `src/components/mix/ImageSlot.test.tsx`
- `src/components/mix/MixHistory.test.tsx`
- `src/components/mix/MixResultCard.test.tsx`
- `src/components/mix/MixShareQRCode.test.tsx`

#### My-Apps Components (4 files)

- `src/components/my-apps/AgentProgressIndicator.test.tsx`
- `src/components/my-apps/BinAppCard.test.tsx`
- `src/components/my-apps/MiniPreview.test.tsx`
- `src/components/my-apps/PreviewModal.test.tsx`

#### Orbit Components (18 files)

- `src/components/orbit/AggregateDashboard.test.tsx`
- `src/components/orbit/allocator/AllocatorDashboard.test.tsx`
- `src/components/orbit/allocator/PerformanceChart.test.tsx`
- `src/components/orbit/allocator/RecommendationCard.test.tsx`
- `src/components/orbit/allocator/SpendOverviewCards.test.tsx`
- `src/components/orbit/AssetCard.test.tsx`
- `src/components/orbit/AssetUploadDialog.test.tsx`
- `src/components/orbit/constants.test.ts`
- `src/components/orbit/inbox/inbox-action-buttons.test.tsx`
- `src/components/orbit/inbox/inbox-assign-dialog.test.tsx`
- `src/components/orbit/inbox/inbox-confirm-dialog.test.tsx`
- `src/components/orbit/inbox/inbox-filters.test.tsx`
- `src/components/orbit/inbox/inbox-item.test.tsx`
- `src/components/orbit/inbox/inbox-list.test.tsx`
- `src/components/orbit/inbox/inbox-reply-panel.test.tsx`
- `src/components/orbit/notifications/notification-bell.test.tsx`
- `src/components/orbit/PermissionGate.test.tsx`
- `src/components/orbit/relay/approval-queue.test.tsx`
- `src/components/orbit/relay/draft-status-badge.test.tsx`
- `src/components/orbit/settings/approval-settings-form.test.tsx`
- `src/components/orbit/workflow-editor/index.test.tsx`
- `src/components/orbit/WorkspaceContext.test.tsx`
- `src/components/orbit/WorkspaceSwitcher.test.tsx`

#### Orbit Landing Components (1 file)

- `src/components/orbit-landing/BlogPreviewSection.test.tsx`

#### Organic-to-Ad Components (1 file)

- `src/components/organic-to-ad/ConversionWizard.test.tsx`

#### Pixel Components (1 file)

- `src/components/pixel/library/LibraryGrid.test.tsx`

#### Platform Landing Components (5 files)

- `src/components/platform-landing/ConditionalHeader.test.tsx`
- `src/components/platform-landing/FeaturedAppCard.test.tsx`
- `src/components/platform-landing/index.test.ts`
- `src/components/platform-landing/PixelAppHeader.test.tsx`
- `src/components/platform-landing/PlatformFeatures.test.tsx`
- `src/components/platform-landing/PlatformHeader.test.tsx`
- `src/components/platform-landing/PlatformHero.test.tsx`

#### Provider Components (1 file)

- `src/components/providers/QueryProvider.test.tsx`

#### SEO Components (1 file)

- `src/components/seo/LandingPageStructuredData.test.tsx`

#### Settings Components (1 file)

- `src/components/settings/api-keys-tab.test.tsx`

#### Skeleton Components (4 files)

- `src/components/skeletons/app-card-skeleton.test.tsx`
- `src/components/skeletons/profile-skeleton.test.tsx`
- `src/components/skeletons/settings-skeleton.test.tsx`
- `src/components/skeletons/wizard-step-skeleton.test.tsx`

#### Storybook Components (3 files)

- `src/components/storybook/ColorSwatch.test.tsx`
- `src/components/storybook/ContrastCheckerDemo.test.tsx`
- `src/components/storybook/Section.test.tsx`

#### Stream Components (4 files)

- `src/components/streams/StreamEmptyState.test.tsx`
- `src/components/streams/StreamFeed.test.tsx`
- `src/components/streams/StreamFilters.test.tsx`
- `src/components/streams/StreamPostCard.test.tsx`

#### Theme Components (1 file)

- `src/components/theme/theme-provider.test.tsx`

#### Tracking Components (2 files)

- `src/components/tracking/MetaPixel.test.tsx`
- `src/components/tracking/SessionTracker.test.tsx`

#### UI Components (31 files)

- `src/components/ui/accordion.test.tsx`
- `src/components/ui/alert-dialog.test.tsx`
- `src/components/ui/alert.test.tsx`
- `src/components/ui/avatar.test.tsx`
- `src/components/ui/badge.test.tsx`
- `src/components/ui/button.test.tsx`
- `src/components/ui/card.test.tsx`
- `src/components/ui/checkbox.test.tsx`
- `src/components/ui/code.test.tsx`
- `src/components/ui/copy-button.test.tsx`
- `src/components/ui/dialog.test.tsx`
- `src/components/ui/dropdown-menu.test.tsx`
- `src/components/ui/form.test.tsx`
- `src/components/ui/input.test.tsx`
- `src/components/ui/label.test.tsx`
- `src/components/ui/link.test.tsx`
- `src/components/ui/masonry-grid.test.tsx`
- `src/components/ui/progress.test.tsx`
- `src/components/ui/radio-group.test.tsx`
- `src/components/ui/select.test.tsx`
- `src/components/ui/separator.test.tsx`
- `src/components/ui/sheet.test.tsx`
- `src/components/ui/skeleton.test.tsx`
- `src/components/ui/slider.test.tsx`
- `src/components/ui/sonner.test.tsx`
- `src/components/ui/switch.test.tsx`
- `src/components/ui/table.test.tsx`
- `src/components/ui/tabs.test.tsx`
- `src/components/ui/text-overlay.test.tsx`
- `src/components/ui/textarea.test.tsx`
- `src/components/ui/toggle-group.test.tsx`
- `src/components/ui/tooltip.test.tsx`
- `src/components/ui/zoom-slider.test.tsx`

---

### 2. Page/Layout/Error/Loading Tests (`src/app/`) -- 102 files

- `src/app/about/page.test.tsx`
- `src/app/admin/emails/page.test.tsx`
- `src/app/admin/gallery/page.test.tsx`
- `src/app/admin/layout.test.tsx`
- `src/app/admin/page.test.tsx`
- `src/app/admin/photos/page.test.tsx`
- `src/app/admin/sitemap/page.test.tsx`
- `src/app/albums/[id]/page.test.tsx`
- `src/app/albums/page.test.tsx`
- `src/app/apps/audio-mixer/layout.test.tsx`
- `src/app/apps/audio-mixer/page.test.tsx`
- `src/app/apps/display/layout.test.tsx`
- `src/app/apps/display/page.test.tsx`
- `src/app/apps/layout.test.tsx`
- `src/app/apps/page.test.tsx`
- `src/app/apps/pixel/page.test.tsx`
- `src/app/auth/error/page.test.tsx`
- `src/app/auth/signin/page.test.tsx`
- `src/app/blog/[slug]/page.test.tsx`
- `src/app/blog/page.test.tsx`
- `src/app/boxes/[id]/page.test.tsx`
- `src/app/boxes/new/page.test.tsx`
- `src/app/boxes/page.test.tsx`
- `src/app/canvas/[albumId]/page.test.tsx`
- `src/app/comic-sans/page.test.tsx`
- `src/app/cookies/page.test.tsx`
- `src/app/cv/page.test.tsx`
- `src/app/error.test.tsx`
- `src/app/features/ab-testing/page.test.tsx`
- `src/app/features/ai-calendar/page.test.tsx`
- `src/app/features/analytics/page.test.tsx`
- `src/app/features/brand-brain/page.test.tsx`
- `src/app/features/calendar/page.test.tsx`
- `src/app/features/page.test.tsx`
- `src/app/layout.test.tsx`
- `src/app/my-apps/[codeSpace]/error.test.tsx`
- `src/app/my-apps/error.test.tsx`
- `src/app/my-apps/loading.test.tsx`
- `src/app/my-apps/new/error.test.tsx`
- `src/app/my-apps/new/loading.test.tsx`
- `src/app/my-apps/new/page.test.tsx`
- `src/app/my-apps/page.test.tsx`
- `src/app/opengraph-image.test.tsx`
- `src/app/orbit-landing/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/ai-agents/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/connections/[connectionId]/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/connections/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/content-library/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/dashboard/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/layout.test.tsx`
- `src/app/orbit/[workspaceSlug]/relay/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/reminders/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/scout/benchmarks/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/scout/competitors/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/scout/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/scout/topics/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/settings/accounts/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/settings/approvals/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/settings/page.test.tsx`
- `src/app/orbit/[workspaceSlug]/streams/page.test.tsx`
- `src/app/orbit/layout.test.tsx`
- `src/app/orbit/onboarding/page.test.tsx`
- `src/app/orbit/page.test.tsx`
- `src/app/page.test.tsx`
- `src/app/personas/[slug]/page.test.tsx`
- `src/app/personas/page.test.tsx`
- `src/app/pixel/opengraph-image.test.tsx`
- `src/app/portfolio/page.test.tsx`
- `src/app/press/page.test.tsx`
- `src/app/pricing/page.test.tsx`
- `src/app/privacy/page.test.tsx`
- `src/app/profile/loading.test.tsx`
- `src/app/profile/page.test.tsx`
- `src/app/referrals/page.test.tsx`
- `src/app/services/page.test.tsx`
- `src/app/settings/error.test.tsx`
- `src/app/settings/loading.test.tsx`
- `src/app/settings/mcp-history/page.test.tsx`
- `src/app/settings/page.test.tsx`
- `src/app/settings/subscription/page.test.tsx`
- `src/app/share/[token]/opengraph-image.test.tsx`
- `src/app/share/[token]/page.test.tsx`
- `src/app/storybook/accessibility/page.test.tsx`
- `src/app/storybook/auth/page.test.tsx`
- `src/app/storybook/brand/page.test.tsx`
- `src/app/storybook/buttons/page.test.tsx`
- `src/app/storybook/colors/page.test.tsx`
- `src/app/storybook/comparison/page.test.tsx`
- `src/app/storybook/components/page.test.tsx`
- `src/app/storybook/data-display/page.test.tsx`
- `src/app/storybook/enhance/page.test.tsx`
- `src/app/storybook/errors/page.test.tsx`
- `src/app/storybook/feedback/page.test.tsx`
- `src/app/storybook/layout/page.test.tsx`
- `src/app/storybook/loading/page.test.tsx`
- `src/app/storybook/modals/page.test.tsx`
- `src/app/storybook/page.test.tsx`
- `src/app/storybook/surfaces/page.test.tsx`
- `src/app/storybook/typography/page.test.tsx`
- `src/app/terms/page.test.tsx`
- `src/app/test-enhancement/page.test.tsx`
- `src/app/tokens/page.test.tsx`

---

### 3. App Client Component Tests (`src/app/`) -- 38 files

- `src/app/admin/gallery/GalleryAdminClient.test.tsx`
- `src/app/admin/gallery/GalleryItemForm.test.tsx`
- `src/app/admin/gallery/ImageBrowserDialog.test.tsx`
- `src/app/admin/jobs/JobsAdminClient.test.tsx`
- `src/app/admin/sitemap/SitemapPreviewClient.test.tsx`
- `src/app/albums/[id]/AlbumDetailClient.test.tsx`
- `src/app/albums/[id]/hooks/useAlbumData.test.ts`
- `src/app/albums/[id]/hooks/useBlendDragDrop.test.ts`
- `src/app/albums/[id]/hooks/useFileDragDrop.test.ts`
- `src/app/albums/[id]/hooks/useImageReorder.test.ts`
- `src/app/albums/[id]/hooks/useImageSelection.test.ts`
- `src/app/albums/[id]/hooks/useMoveToAlbum.test.ts`
- `src/app/albums/AlbumsClient.test.tsx`
- `src/app/apps/pixel/mcp-tools/McpToolsClient.test.tsx`
- `src/app/apps/pixel/mix/[jobId]/MixDetailClient.test.tsx`
- `src/app/apps/pixel/mix/PhotoMixClient.test.tsx`
- `src/app/auth/error/actions.test.ts`
- `src/app/auth/signin/signin-content.test.tsx`
- `src/app/canvas/[albumId]/CanvasClient.test.tsx`
- `src/app/gallery/GalleryClient.test.tsx`
- `src/app/live/live-integration.test.ts`
- `src/app/my-apps/new/template-selector.test.tsx`
- `src/app/my-apps/templates/campaign-landing/metadata.test.ts`
- `src/app/my-apps/templates/contest-entry/metadata.test.ts`
- `src/app/my-apps/templates/index.test.ts`
- `src/app/my-apps/templates/interactive-poll/metadata.test.ts`
- `src/app/my-apps/templates/link-in-bio/metadata.test.ts`
- `src/app/my-apps/templates/types.test.ts`
- `src/app/not-found.test.tsx`
- `src/app/orbit/[workspaceSlug]/OrbitSidebar.test.tsx`
- `src/app/orbit/[workspaceSlug]/relay/relay-page-client.test.tsx`
- `src/app/orbit/[workspaceSlug]/scout/benchmarks/BenchmarksClient.test.tsx`
- `src/app/orbit/[workspaceSlug]/scout/competitors/CompetitorsClient.test.tsx`
- `src/app/orbit/[workspaceSlug]/scout/topics/TopicsClient.test.tsx`
- `src/app/orbit/[workspaceSlug]/streams/StreamsClient.test.tsx`
- `src/app/settings/mcp-history/McpHistoryClient.test.tsx`
- `src/app/share/[token]/SharePageClient.test.tsx`
- `src/app/sitemap.test.ts`

---

### 4. API Route Tests (`src/app/api/`) -- 158 files

#### Admin API Routes (20 files)

- `src/app/api/admin/analytics/users/route.test.ts`
- `src/app/api/admin/create-agent/metrics/route.test.ts`
- `src/app/api/admin/create-agent/notes/route.test.ts`
- `src/app/api/admin/dashboard/route.test.ts`
- `src/app/api/admin/emails/route.test.ts`
- `src/app/api/admin/errors/route.test.ts`
- `src/app/api/admin/gallery/browse/route.test.ts`
- `src/app/api/admin/gallery/reorder/route.test.ts`
- `src/app/api/admin/gallery/route.test.ts`
- `src/app/api/admin/jobs/cleanup/route.test.ts`
- `src/app/api/admin/jobs/route.test.ts`
- `src/app/api/admin/my-apps/stats/route.test.ts`
- `src/app/api/admin/photos/route.test.ts`
- `src/app/api/admin/social/anomalies/route.test.ts`
- `src/app/api/admin/storage/route.test.ts`
- `src/app/api/admin/system/health/route.test.ts`
- `src/app/api/admin/tracked-urls/route.test.ts`
- `src/app/api/admin/users/[userId]/enhancements/route.test.ts`
- `src/app/api/admin/users/password/route.test.ts`
- `src/app/api/admin/users/route.test.ts`

#### Agent API Routes (5 files)

- `src/app/api/agent/apps/[appId]/context/route.test.ts`
- `src/app/api/agent/apps/[appId]/respond/route.test.ts`
- `src/app/api/agent/messages/[messageId]/route.test.ts`
- `src/app/api/agent/queue/route.test.ts`
- `src/app/api/agent/sandbox/callback/route.test.ts`

#### Album API Routes (4 files)

- `src/app/api/albums/[id]/enhance/route.test.ts`
- `src/app/api/albums/[id]/images/route.test.ts`
- `src/app/api/albums/[id]/route.test.ts`
- `src/app/api/albums/route.test.ts`

#### Apps API Routes (6 files)

- `src/app/api/apps/[id]/bin/restore/route.test.ts`
- `src/app/api/apps/[id]/bin/route.test.ts`
- `src/app/api/apps/[id]/messages/stream/route.test.ts`
- `src/app/api/apps/[id]/permanent/route.test.ts`
- `src/app/api/apps/[id]/route.test.ts`
- `src/app/api/apps/bin/route.test.ts`
- `src/app/api/apps/route.test.ts`

#### Audio API Routes (2 files)

- `src/app/api/audio/[trackId]/route.test.ts`
- `src/app/api/audio/upload/route.test.ts`

#### Auth API Routes (3 files)

- `src/app/api/auth/[...nextauth]/route.test.ts`
- `src/app/api/auth/check-email/route.test.ts`
- `src/app/api/auth/signup/route.test.ts`

#### Blog API Routes (2 files)

- `src/app/api/blog/posts/[slug]/route.test.ts`
- `src/app/api/blog/posts/route.test.ts`

#### Boxes API Routes (1 file)

- `src/app/api/boxes/[id]/messages/route.test.ts`

#### Calendar API Routes (4 files)

- `src/app/api/calendar/posts/[id]/route.test.ts`
- `src/app/api/calendar/posts/route.test.ts`
- `src/app/api/calendar/recommendations/route.test.ts`
- `src/app/api/calendar/view/route.test.ts`

#### Codespace API Routes (1 file)

- `src/app/api/codespace/[codeSpace]/bundle/route.test.ts`

#### Create API Routes (8 files)

- `src/app/api/create/[slug]/screenshot/route.test.ts`
- `src/app/api/create/[slug]/vibe-chat/route.test.ts`
- `src/app/api/create/classify/route.test.ts`
- `src/app/api/create/generate/route.test.ts`
- `src/app/api/create/health/route.test.ts`
- `src/app/api/create/screenshot/route.test.ts`
- `src/app/api/create/search/route.test.ts`
- `src/app/api/create/stream/route.test.ts`
- `src/app/api/create/vibe-chat/route.test.ts`

#### Credits API Routes (1 file)

- `src/app/api/credits/balance/route.test.ts`

#### Cron API Routes (10 files)

- `src/app/api/cron/cleanup-bin/route.test.ts`
- `src/app/api/cron/cleanup-errors/route.test.ts`
- `src/app/api/cron/cleanup-jobs/route.test.ts`
- `src/app/api/cron/cleanup-sandboxes/route.test.ts`
- `src/app/api/cron/cleanup-tracking/route.test.ts`
- `src/app/api/cron/create-agent-alert/route.test.ts`
- `src/app/api/cron/marketing-sync/route.test.ts`
- `src/app/api/cron/publish-scheduled-posts/route.test.ts`
- `src/app/api/cron/pulse-metrics/route.test.ts`
- `src/app/api/cron/reset-workspace-credits/route.test.ts`

#### Error Reporting API Routes (1 file)

- `src/app/api/errors/report/route.test.ts`

#### Gallery API Routes (2 files)

- `src/app/api/gallery/public-albums/route.test.ts`
- `src/app/api/gallery/route.test.ts`

#### Health API Routes (1 file)

- `src/app/api/health/route.test.ts`

#### Images API Routes (9 files)

- `src/app/api/images/[id]/route.test.ts`
- `src/app/api/images/[id]/share/route.test.ts`
- `src/app/api/images/[id]/versions/route.test.ts`
- `src/app/api/images/batch-enhance/route.test.ts`
- `src/app/api/images/batch-upload/route.test.ts`
- `src/app/api/images/enhance/route.test.ts`
- `src/app/api/images/export/route.test.ts`
- `src/app/api/images/fetch-base64/route.test.ts`
- `src/app/api/images/move-to-album/route.test.ts`
- `src/app/api/images/parallel-enhance/route.test.ts`
- `src/app/api/images/upload/route.test.ts`

#### Jobs API Routes (5 files)

- `src/app/api/jobs/[jobId]/cancel/route.test.ts`
- `src/app/api/jobs/[jobId]/download/route.test.ts`
- `src/app/api/jobs/[jobId]/route.test.ts`
- `src/app/api/jobs/[jobId]/stream/route.test.ts`
- `src/app/api/jobs/batch-status/route.test.ts`

#### LearnIt API Routes (1 file)

- `src/app/api/learnit/regenerate/route.test.ts`

#### Logs API Routes (1 file)

- `src/app/api/logs/image-error/route.test.ts`

#### MCP API Routes (5 files)

- `src/app/api/mcp/balance/route.test.ts`
- `src/app/api/mcp/generate/route.test.ts`
- `src/app/api/mcp/history/route.test.ts`
- `src/app/api/mcp/jobs/[jobId]/route.test.ts`
- `src/app/api/mcp/modify/route.test.ts`

#### Merch API Routes (7 files)

- `src/app/api/merch/cart/[itemId]/route.test.ts`
- `src/app/api/merch/cart/route.test.ts`
- `src/app/api/merch/checkout/route.test.ts`
- `src/app/api/merch/orders/[id]/route.test.ts`
- `src/app/api/merch/orders/route.test.ts`
- `src/app/api/merch/products/route.test.ts`
- `src/app/api/merch/webhooks/prodigi/route.test.ts`

#### My-Apps API Routes (1 file)

- `src/app/api/my-apps/stats/route.test.ts`

#### Newsletter API Routes (1 file)

- `src/app/api/newsletter/subscribe/route.test.ts`

#### Orbit API Routes (20 files)

- `src/app/api/orbit/[workspaceSlug]/allocator/facebook/campaigns/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/allocator/facebook/sync/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/allocator/recommendations/apply/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/allocator/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/calendar/content-gaps/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/calendar/recommendations/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/connections/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/inbox/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/notifications/[id]/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/notifications/count/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/notifications/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/pulse/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/relay/drafts/[draftId]/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/relay/drafts/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/relay/metrics/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/relay/settings/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/scout/benchmark/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/scout/competitors/[id]/metrics/route.integration.test.ts`
- `src/app/api/orbit/[workspaceSlug]/scout/competitors/[id]/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/scout/competitors/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/scout/topics/route.test.ts`
- `src/app/api/orbit/[workspaceSlug]/scout/trigger/route.test.ts`
- `src/app/api/orbit/google-ads/campaigns/campaigns.test.ts`

#### Pipelines API Routes (4 files)

- `src/app/api/pipelines/[id]/fork/route.test.ts`
- `src/app/api/pipelines/[id]/route.test.ts`
- `src/app/api/pipelines/reference-images/route.test.ts`
- `src/app/api/pipelines/route.test.ts`

#### Reports API Routes (1 file)

- `src/app/api/reports/system/route.test.ts`

#### Settings API Routes (2 files)

- `src/app/api/settings/api-keys/[id]/route.test.ts`
- `src/app/api/settings/api-keys/route.test.ts`

#### Share API Routes (1 file)

- `src/app/api/share/[token]/download/route.test.ts`

#### Social API Routes (3 files)

- `src/app/api/social/[platform]/posts/[postId]/like/route.test.ts`
- `src/app/api/social/[platform]/posts/[postId]/reply/route.test.ts`
- `src/app/api/social/streams/route.test.ts`

#### Stripe API Routes (2 files)

- `src/app/api/stripe/checkout/route.test.ts`
- `src/app/api/stripe/webhook/route.test.ts`

#### Sync API Routes (1 file)

- `src/app/api/sync/route.test.ts`

#### Tabletop API Routes (1 file)

- `src/app/api/tabletop/rooms/[roomId]/peers/route.test.ts`

#### Test/Debug API Routes (2 files)

- `src/app/api/test-gemini/route.test.ts`
- `src/app/api/test/agent-debug/route.test.ts`

#### Tracking API Routes (3 files)

- `src/app/api/tracking/event/route.test.ts`
- `src/app/api/tracking/pageview/route.test.ts`
- `src/app/api/tracking/session/route.test.ts`

#### TTS API Routes (1 file)

- `src/app/api/tts/route.test.ts`

#### TURN Credentials API Routes (1 file)

- `src/app/api/turn-credentials/route.test.ts`

#### V1 Agent API Routes (2 files)

- `src/app/api/v1/agent/heartbeat/route.test.ts`
- `src/app/api/v1/agent/tasks/route.test.ts`

#### Workspace API Routes (5 files)

- `src/app/api/workspaces/[workspaceId]/brand-brain/rewrite/route.test.ts`
- `src/app/api/workspaces/[workspaceId]/brand-brain/score/route.test.ts`
- `src/app/api/workspaces/[workspaceId]/favorite/route.test.ts`
- `src/app/api/workspaces/aggregate/route.test.ts`
- `src/app/api/workspaces/route.test.ts`

---

### 5. Hook Tests (`src/hooks/`) -- 28 files

- `src/hooks/useAlbumBatchEnhance.test.ts`
- `src/hooks/useAuthRedirect.test.ts`
- `src/hooks/useAutoResizeTextarea.test.ts`
- `src/hooks/useBrandProfile.test.ts`
- `src/hooks/useCalendarView.test.ts`
- `src/hooks/useComposerImages.test.ts`
- `src/hooks/useCountdown.test.ts`
- `src/hooks/useDocumentVisibility.test.ts`
- `src/hooks/useDowngrade.test.ts`
- `src/hooks/useDragDropPhotos.test.ts`
- `src/hooks/useJobStream.test.ts`
- `src/hooks/useKeyboardNavigation.test.ts`
- `src/hooks/useMounted.test.ts`
- `src/hooks/useMultiFileUpload.test.ts`
- `src/hooks/useNotifications.test.ts`
- `src/hooks/useParallelEnhancement.test.ts`
- `src/hooks/usePermission.test.ts`
- `src/hooks/usePipelines.test.ts`
- `src/hooks/useReducedMotion.test.ts`
- `src/hooks/useSmartGallery.test.ts`
- `src/hooks/useStreamActions.test.tsx`
- `src/hooks/useStreamFeed.test.tsx`
- `src/hooks/useTextToSpeech.test.ts`
- `src/hooks/useThumbnailPreference.test.ts`
- `src/hooks/useTouchGestures.test.ts`
- `src/hooks/useTypewriter.test.ts`
- `src/hooks/useUserAlbums.test.ts`
- `src/hooks/useWorkspaceMembers.test.tsx`

---

### 6. Library Tests, non-MCP (`src/lib/`) -- 242 files

- `src/lib/ab-test/significance-calculator.test.ts`
- `src/lib/ab-testing.test.ts`
- `src/lib/agents/github-issues.test.ts`
- `src/lib/agents/hypothesis-agent.test.ts`
- `src/lib/agents/jules-client.test.ts`
- `src/lib/agents/redis-client.test.ts`
- `src/lib/agents/resource-detector.test.ts`
- `src/lib/ai/aspect-ratio.test.ts`
- `src/lib/ai/gemini-client.test.ts`
- `src/lib/ai/pipeline-types.test.ts`
- `src/lib/albums/ensure-user-albums.test.ts`
- `src/lib/allocator/allocator-audit-export.test.ts`
- `src/lib/allocator/allocator-audit-logger.test.ts`
- `src/lib/allocator/allocator-service.test.ts`
- `src/lib/allocator/autopilot-service.test.ts`
- `src/lib/allocator/facebook-ads/campaign-sync.test.ts`
- `src/lib/allocator/facebook-ads/client.test.ts`
- `src/lib/allocator/google-ads/campaign-sync.test.ts`
- `src/lib/allocator/google-ads/client.test.ts`
- `src/lib/allocator/guardrail-alert-service.test.ts`
- `src/lib/analytics.test.ts`
- `src/lib/animation-variants.test.ts`
- `src/lib/anonymous-user.test.ts`
- `src/lib/api/responses.test.ts`
- `src/lib/app-factory/storage.test.ts`
- `src/lib/app-lookup.test.ts`
- `src/lib/apps/bin-cleanup.test.ts`
- `src/lib/arena/arena-generator.test.ts`
- `src/lib/arena/elo.test.ts`
- `src/lib/arena/redis.test.ts`
- `src/lib/arena/review.test.ts`
- `src/lib/audit/ai-decision-logger.test.ts`
- `src/lib/audit/audit-export.test.ts`
- `src/lib/audit/logger.test.ts`
- `src/lib/audit/retention-manager.test.ts`
- `src/lib/audit/workspace-audit-logger.test.ts`
- `src/lib/auth/admin-middleware.test.ts`
- `src/lib/auth/bootstrap-admin.test.ts`
- `src/lib/blog/get-posts.test.ts`
- `src/lib/boost-detector/detector.test.ts`
- `src/lib/boost-detector/metrics-tracker.test.ts`
- `src/lib/boxes/provisioning.test.ts`
- `src/lib/brand-brain/apply-selected-changes.test.ts`
- `src/lib/brand-brain/rewrite-cache.test.ts`
- `src/lib/brand-brain/rewrite-content.test.ts`
- `src/lib/brand-brain/score-cache.test.ts`
- `src/lib/brand-brain/score-content.test.ts`
- `src/lib/budget/ad-budget-recommender.test.ts`
- `src/lib/calendar/ai-content-service.test.ts`
- `src/lib/calendar/best-time-service.test.ts`
- `src/lib/calendar/content-gaps.test.ts`
- `src/lib/calendar/optimal-time-service.test.ts`
- `src/lib/calendar/publishing-service.test.ts`
- `src/lib/calendar/scheduled-posts.test.ts`
- `src/lib/calendar/weekly-plan-service.test.ts`
- `src/lib/canvas/animations.test.ts`
- `src/lib/canvas/url-builder.test.ts`
- `src/lib/claude-agent/prompts/vibe-code-system.test.ts`
- `src/lib/claude-agent/tools/codespace-tools.test.ts`
- `src/lib/codespace/bundle-cache.test.ts`
- `src/lib/codespace/bundle-template.test.ts`
- `src/lib/codespace/bundler.test.ts`
- `src/lib/codespace/esbuild-init.test.ts`
- `src/lib/codespace/transpile.test.ts`
- `src/lib/config/timeouts.test.ts`
- `src/lib/connections/inbox-sync.test.ts`
- `src/lib/connections/warmth-calculator.test.ts`
- `src/lib/create/agent-client-fallback.test.ts`
- `src/lib/create/agent-client.test.ts`
- `src/lib/create/agent-loop.test.ts`
- `src/lib/create/agent-memory.test.ts`
- `src/lib/create/agent-prompts.test.ts`
- `src/lib/create/circuit-breaker.test.ts`
- `src/lib/create/codespace-health.test.ts`
- `src/lib/create/codespace-service.test.ts`
- `src/lib/create/content-generator.test.ts`
- `src/lib/create/content-service.test.ts`
- `src/lib/create/cost-calculator.test.ts`
- `src/lib/create/error-parser.test.ts`
- `src/lib/create/keyword-utils.test.ts`
- `src/lib/create/link-parser.test.ts`
- `src/lib/create/match-skills.test.ts`
- `src/lib/create/prompt-builder.test.ts`
- `src/lib/create/slug-classifier.test.ts`
- `src/lib/creative-factory/__tests__/variant-generator-integration.test.ts`
- `src/lib/creative-factory/__tests__/variant-generator.test.ts`
- `src/lib/creative-factory/generators/__tests__/copy-generator.test.ts`
- `src/lib/creative-factory/generators/__tests__/image-suggester.test.ts`
- `src/lib/creative-factory/scorers/__tests__/ab-test-calculator.test.ts`
- `src/lib/creative-factory/scorers/__tests__/variant-scorer.test.ts`
- `src/lib/creative/format-adapter.test.ts`
- `src/lib/credits/costs.test.ts`
- `src/lib/credits/workspace-credit-manager.test.ts`
- `src/lib/crypto/token-encryption.test.ts`
- `src/lib/email/client.test.ts`
- `src/lib/email/templates/base.test.tsx`
- `src/lib/email/templates/image-cleanup-warning.test.tsx`
- `src/lib/email/templates/low-balance.test.tsx`
- `src/lib/email/templates/token-purchase.test.tsx`
- `src/lib/email/templates/welcome.test.tsx`
- `src/lib/errors/console-capture.client.test.ts`
- `src/lib/errors/console-capture.server.test.ts`
- `src/lib/errors/error-messages.test.ts`
- `src/lib/errors/error-reporter.test.ts`
- `src/lib/errors/retry-logic.test.ts`
- `src/lib/errors/structured-logger.test.ts`
- `src/lib/events/event-bus.test.ts`
- `src/lib/gallery/public-photos.test.ts`
- `src/lib/gallery/super-admin-photos.test.ts`
- `src/lib/health-monitor/health-alert-manager.test.ts`
- `src/lib/health-monitor/health-calculator.test.ts`
- `src/lib/health-monitor/rate-limit-tracker.test.ts`
- `src/lib/health-monitor/recovery-service.test.ts`
- `src/lib/health-monitor/sync-monitor.test.ts`
- `src/lib/images/auto-tagger.test.ts`
- `src/lib/images/blend-source-resolver.test.ts`
- `src/lib/images/browser-image-processor.test.ts`
- `src/lib/images/format-utils.test.ts`
- `src/lib/images/get-best-thumbnail.test.ts`
- `src/lib/images/image-dimensions.test.ts`
- `src/lib/inbox/base-collector.test.ts`
- `src/lib/inbox/collection-job.test.ts`
- `src/lib/inbox/collectors/facebook-collector.test.ts`
- `src/lib/inbox/collectors/instagram-collector.test.ts`
- `src/lib/inbox/collectors/twitter-collector.test.ts`
- `src/lib/inbox/inbox-manager.test.ts`
- `src/lib/jobs/cleanup.test.ts`
- `src/lib/landing/showcase-feed.test.ts`
- `src/lib/learnit/mdx-generator.test.ts`
- `src/lib/learnit/utils.test.ts`
- `src/lib/learnit/validations.test.ts`
- `src/lib/learnit/wiki-links.test.ts`
- `src/lib/marketing/campaign-sync.test.ts`
- `src/lib/marketing/facebook-client.test.ts`
- `src/lib/marketing/google-ads-client.test.ts`
- `src/lib/marketing/personas.test.ts`
- `src/lib/marketing/types.test.ts`
- `src/lib/notifications/channel-manager.test.ts`
- `src/lib/notifications/notification-service.test.ts`
- `src/lib/notifications/slack-channel.test.ts`
- `src/lib/organic-to-ad/ad-creation-service.test.ts`
- `src/lib/organic-to-ad/organic-feed-service.test.ts`
- `src/lib/permissions/permissions.test.ts`
- `src/lib/permissions/workspace-middleware.test.ts`
- `src/lib/pod/order-service.test.ts`
- `src/lib/pod/prodigi/client.test.ts`
- `src/lib/policy-checker/default-rules.test.ts`
- `src/lib/policy-checker/policy-engine.test.ts`
- `src/lib/policy-checker/rule-manager.test.ts`
- `src/lib/policy-checker/violation-manager.test.ts`
- `src/lib/prisma.test.ts`
- `src/lib/rate-limiter.test.ts`
- `src/lib/relay/approval-workflow.test.ts`
- `src/lib/relay/generate-drafts.test.ts`
- `src/lib/reports/meta-marketing-client.test.ts`
- `src/lib/reports/system-report.test.ts`
- `src/lib/reports/types.test.ts`
- `src/lib/reports/vercel-analytics-client.test.ts`
- `src/lib/routes.test.ts`
- `src/lib/sandbox/agent-sandbox.test.ts`
- `src/lib/scout/competitor-analyzer.test.ts`
- `src/lib/scout/competitor-tracker.test.ts`
- `src/lib/scout/public-api-clients/facebook.test.ts`
- `src/lib/scout/public-api-clients/instagram.test.ts`
- `src/lib/scout/public-api-clients/twitter.test.ts`
- `src/lib/scout/search-providers/twitter.test.ts`
- `src/lib/scout/suggestion-generator.test.ts`
- `src/lib/scout/suggestion-manager.test.ts`
- `src/lib/scout/topic-config.test.ts`
- `src/lib/scout/topic-monitor.test.ts`
- `src/lib/scout/workspace-metrics.test.ts`
- `src/lib/security/csp-nonce.test.ts`
- `src/lib/smart-routing/analyze-message.test.ts`
- `src/lib/smart-routing/escalation-service.test.ts`
- `src/lib/smart-routing/priority-calculator.test.ts`
- `src/lib/social/anomaly-detection.test.ts`
- `src/lib/social/clients/discord.test.ts`
- `src/lib/social/clients/linkedin.test.ts`
- `src/lib/social/clients/pinterest.test.ts`
- `src/lib/social/clients/snapchat.test.ts`
- `src/lib/social/clients/tiktok.test.ts`
- `src/lib/social/clients/youtube.test.ts`
- `src/lib/social/metrics-collector.test.ts`
- `src/lib/social/platform-api/engagement-fetcher-factory.test.ts`
- `src/lib/social/platform-api/facebook/engagement-fetcher.test.ts`
- `src/lib/social/platform-api/linkedin/engagement-fetcher.test.ts`
- `src/lib/social/platform-api/tiktok/engagement-fetcher.test.ts`
- `src/lib/social/platform-api/twitter/engagement-fetcher.test.ts`
- `src/lib/social/stream-aggregator.test.ts`
- `src/lib/social/token-refresh.test.ts`
- `src/lib/social/youtube/resumable-uploader.test.ts`
- `src/lib/social/youtube/video-processor.test.ts`
- `src/lib/storage/audio-r2-client.test.ts`
- `src/lib/storage/r2-client.test.ts`
- `src/lib/storage/upload-handler.test.ts`
- `src/lib/stripe/client.test.ts`
- `src/lib/subscription/tier-config.test.ts`
- `src/lib/subscription/workspace-subscription.test.ts`
- `src/lib/sync/create-sync-clients.test.ts`
- `src/lib/sync/sync-utils.test.ts`
- `src/lib/tracking/attribution.test.ts`
- `src/lib/tracking/consent.test.ts`
- `src/lib/tracking/identity-graph-service.test.ts`
- `src/lib/tracking/meta-pixel.test.ts`
- `src/lib/tracking/metrics-cache.test.ts`
- `src/lib/tracking/session-manager.test.ts`
- `src/lib/tracking/utm-capture.test.ts`
- `src/lib/tracking/visitor-id.test.ts`
- `src/lib/try-catch.test.ts`
- `src/lib/tts/elevenlabs-client.test.ts`
- `src/lib/tts/tts-cache.test.ts`
- `src/lib/upload/validation.test.ts`
- `src/lib/utils.test.ts`
- `src/lib/validations/agent-message.test.ts`
- `src/lib/validations/agent.test.ts`
- `src/lib/validations/app.test.ts`
- `src/lib/validations/brand-brain.test.ts`
- `src/lib/validations/brand-rewrite.test.ts`
- `src/lib/validations/brand-score.test.ts`
- `src/lib/validations/enhance-image.test.ts`
- `src/lib/validations/scout-competitor.test.ts`
- `src/lib/vibe-watcher.test.ts`
- `src/lib/white-label/domain-verification.test.ts`
- `src/lib/white-label/permissions.test.ts`
- `src/lib/white-label/theme-builder.test.ts`
- `src/lib/workflows/actions/http-request.test.ts`
- `src/lib/workflows/actions/loop.test.ts`
- `src/lib/workflows/actions/parallel-execution.test.ts`
- `src/lib/workflows/actions/transform-data.test.ts`
- `src/lib/workflows/enhancement-executor.test.ts`
- `src/lib/workflows/hypothesis-agent-actions.test.ts`
- `src/lib/workflows/triggers/event-trigger.test.ts`
- `src/lib/workflows/triggers/schedule-trigger.test.ts`
- `src/lib/workflows/triggers/webhook-trigger.test.ts`
- `src/lib/workflows/workflow-dsl.test.ts`
- `src/lib/workflows/workflow-executor.test.ts`
- `src/lib/workflows/workflow-service.test.ts`
- `src/lib/workflows/workflow-validator.test.ts`
- `src/lib/workspace.test.ts`
- `src/lib/workspace/aggregate-queries.test.ts`
- `src/lib/workspace/ensure-personal-workspace.test.ts`

---

### 7. Type Tests (`src/types/`) -- 1 file

- `src/types/app-factory.test.ts`

---

### 8. Root-Level Src Tests -- 4 files

- `src/auth.config.test.ts`
- `src/auth.test.ts`
- `src/instrumentation.test.ts`
- `src/proxy.test.ts`

---

### 9. Workflow Tests (`src/workflows/`) -- 5 files

- `src/workflows/batch-enhance.direct.test.ts`
- `src/workflows/dimension-utils.test.ts`
- `src/workflows/enhance-image.direct.test.ts`
- `src/workflows/enhance-image.shared.test.ts`
- `src/workflows/pipeline-resolver.test.ts`

---

### 10. `src/code` Tests -- 37 files

- `src/code/__tests__/@/lib/make-sess.integration.spec.tsx`
- `src/code/__tests__/@/lib/make-sess.spec.ts`
- `src/code/__tests__/@/lib/render-app.spec.tsx`
- `src/code/__tests__/@/lib/text-delta.spec.tsx`
- `src/code/__tests__/ChatInterface.spec.tsx`
- `src/code/__tests__/components/AutoSaveHistory.spec.tsx`
- `src/code/__tests__/components/start-with-prompt.spec.tsx`
- `src/code/__tests__/Editor.spec.tsx`
- `src/code/__tests__/importmap-utils.spec.ts`
- `src/code/__tests__/integration/start-with-prompt-flow.spec.tsx`
- `src/code/__tests__/memfs.spec.ts`
- `src/code/__tests__/memfs/directory-operations.spec.ts`
- `src/code/__tests__/memfs/file-operations.spec.ts`
- `src/code/__tests__/memfs/index.spec.ts`
- `src/code/__tests__/memfs/misc-operations.spec.ts`
- `src/code/__tests__/memfs/utils.spec.ts`
- `src/code/__tests__/RenderService.spec.tsx`
- `src/code/__tests__/rep.spec.tsx`
- `src/code/__tests__/router.spec.tsx`
- `src/code/__tests__/serve-with-cache.spec.tsx`
- `src/code/__tests__/services/code/__tests__/CodeProcessor.spec.tsx`
- `src/code/__tests__/services/CodeSession.spec.tsx`
- `src/code/__tests__/services/message/MessageHandlerService.spec.tsx`
- `src/code/__tests__/services/screenshot/__tests__/ScreenshotService.spec.tsx`
- `src/code/__tests__/services/worker/__tests__/ServiceWorkerManager.spec.tsx`
- `src/code/__tests__/ServiceWorkerManager.spec.ts`
- `src/code/__tests__/useEditorState.spec.tsx`
- `src/code/__tests__/utils/chatUtils.spec.ts`
- `src/code/__tests__/utils/diffUtils.spec.tsx`
- `src/code/__tests__/utils/updateSearchReplace.spec.ts`
- `src/code/__tests__/utils/utils.spec.tsx`
- `src/code/__tests__/WebSocketManager.spec.tsx`
- `src/code/@/lib/__tests__/lru-cache.spec.ts`
- `src/code/@/lib/__tests__/render-messages.spec.tsx`
- `src/code/@/lib/__tests__/transferables.spec.ts`
- `src/code/@/services/__tests__/CodeProcessor.spec.ts`
- `src/code/@/workers/__tests__/ata.worker.spec.ts`

---

### 11. `src/testing.spike.land` Tests -- 23 files

- `src/testing.spike.land/__tests__/chat.spec.ts`
- `src/testing.spike.land/__tests__/replicateHandler.spec.ts`
- `src/testing.spike.land/apiHandler.spec.ts`
- `src/testing.spike.land/chatRoom.test.ts`
- `src/testing.spike.land/fetchHandler.spec.ts`
- `src/testing.spike.land/handlers/postHandler.messages.spec.ts`
- `src/testing.spike.land/handlers/postHandler.response.spec.ts`
- `src/testing.spike.land/handlers/postHandler.spec.ts`
- `src/testing.spike.land/handlers/postHandler.tools.spec.ts`
- `src/testing.spike.land/handlers/postHandler.validation.spec.ts`
- `src/testing.spike.land/largeValueStorage.test.ts`
- `src/testing.spike.land/Logs.spec.ts`
- `src/testing.spike.land/mainFetchHandler.spec.ts`
- `src/testing.spike.land/makeResponse.spec.ts`
- `src/testing.spike.land/mcpServer.unit.spec.ts`
- `src/testing.spike.land/r2bucket.spec.ts`
- `src/testing.spike.land/rateLimiter.spec.ts`
- `src/testing.spike.land/routeHandler.spec.ts`
- `src/testing.spike.land/utils.spec.ts`
- `src/testing.spike.land/utils/jsonSchemaToZod.spec.ts`
- `src/testing.spike.land/websocketHandler.spec.ts`
- `src/testing.spike.land/tests/index.spec.ts`
- `src/testing.spike.land/tests/minimal.test.ts`

---

### 12. `src/shared` Tests -- 4 files

- `src/shared/constants/index.test.ts`
- `src/shared/types/social-api-guards.test.ts`
- `src/shared/utils/index.test.ts`
- `src/shared/validations/index.test.ts`

---

### 13. `src/opfs-node-adapter` Tests -- 40 files

- `src/opfs-node-adapter/__tests__/directory-operations.spec.ts`
- `src/opfs-node-adapter/__tests__/file-handle.spec.ts`
- `src/opfs-node-adapter/__tests__/file-operations.spec.ts`
- `src/opfs-node-adapter/__tests__/index.spec.ts`
- `src/opfs-node-adapter/__tests__/memfs.spec.ts`
- `src/opfs-node-adapter/__tests__/misc-operations.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/access.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/cp.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/cwd.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/exists.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/glob.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/lstat.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/mkdir.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/mkdtemp.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/opendir.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/readdir.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/rm.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/rmdir.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/stat.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/statfs.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/directory/watch.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/appendFile.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/chmod.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/chown.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/copyFile.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/lchmod.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/lchown.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/link.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/lutimes.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/readFile.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/readFileSync.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/readlink.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/realpath.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/rename.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/symlink.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/truncate.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/unlink.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/utimes.spec.ts`
- `src/opfs-node-adapter/__tests__/operations/file/writeFile.spec.ts`
- `src/opfs-node-adapter/__tests__/utils.spec.ts`

---

### 14. `src/js.spike.land` Tests -- 1 file

- `src/js.spike.land/index.spec.ts`

---

### 15. `src/video` Tests -- 1 file

- `src/video/components/core/CoreComponents.test.tsx`

---

### 16. `src/vibe-dev` Tests -- 4 files

- `src/vibe-dev/__tests__/api.test.ts`
- `src/vibe-dev/__tests__/redis.test.ts`
- `src/vibe-dev/__tests__/sync.test.ts`
- `src/vibe-dev/__tests__/watcher.test.ts`

---

### 17. `apps/audio-mixer` Tests -- 11 files

- `apps/audio-mixer/components/AudioMixer.test.tsx`
- `apps/audio-mixer/components/RecordingPanel.test.tsx`
- `apps/audio-mixer/components/SortableTrackList.test.tsx`
- `apps/audio-mixer/components/TrackItem.test.tsx`
- `apps/audio-mixer/components/Waveform.test.tsx`
- `apps/audio-mixer/hooks/useAudioContext.test.ts`
- `apps/audio-mixer/hooks/useAudioRecording.test.ts`
- `apps/audio-mixer/hooks/useAudioStorage.test.ts`
- `apps/audio-mixer/hooks/useAudioTracks.test.ts`
- `apps/audio-mixer/hooks/useProjectPersistence.test.ts`
- `apps/audio-mixer/lib/audio-engine.test.ts`

---

### 18. `apps/display` Tests -- 10 files

- `apps/display/hooks/index.test.ts`
- `apps/display/hooks/useMediaStream.test.ts`
- `apps/display/hooks/usePeer.test.ts`
- `apps/display/hooks/usePeerConnection.test.ts`
- `apps/display/lib/layout-optimizer.test.ts`
- `apps/display/lib/webrtc/config.test.ts`
- `apps/display/lib/webrtc/index.test.ts`
- `apps/display/lib/webrtc/utils.test.ts`
- `apps/display/pages/ClientPage.test.tsx`
- `apps/display/pages/DisplayPage.test.tsx`

---

### 19. `apps/tabletop-simulator` Tests -- 21 files

- `apps/tabletop-simulator/__tests__/lib/crdt/game-document.test.ts`
- `apps/tabletop-simulator/__tests__/lib/game-logic/deck.test.ts`
- `apps/tabletop-simulator/__tests__/stores/useUIStore.test.tsx`
- `apps/tabletop-simulator/components/GameScene.test.tsx`
- `apps/tabletop-simulator/components/objects/Card.test.tsx`
- `apps/tabletop-simulator/components/objects/Deck.test.tsx`
- `apps/tabletop-simulator/components/objects/Dice.test.tsx`
- `apps/tabletop-simulator/components/ui/ControlsPanel.test.tsx`
- `apps/tabletop-simulator/components/ui/HandDrawer.test.tsx`
- `apps/tabletop-simulator/components/ui/VideoOverlay.test.tsx`
- `apps/tabletop-simulator/hooks/useDicePhysics.test.ts`
- `apps/tabletop-simulator/hooks/useGameRoom.test.tsx`
- `apps/tabletop-simulator/hooks/usePeer.test.ts`
- `apps/tabletop-simulator/hooks/usePeerConnection.test.ts`
- `apps/tabletop-simulator/hooks/usePeerDataChannel.test.ts`
- `apps/tabletop-simulator/hooks/usePeerDiscovery.test.ts`
- `apps/tabletop-simulator/hooks/useYjsState.test.ts`
- `apps/tabletop-simulator/lib/crdt/crdt.test.ts`
- `apps/tabletop-simulator/lib/game-logic/deck.test.ts`
- `apps/tabletop-simulator/lib/game-logic/visibility.test.ts`
- `apps/tabletop-simulator/lib/physics/deterministic-random.test.ts`

---

### 20. `apps/music-creator` Tests -- 1 file

- `apps/music-creator/pages/MusicCreatorPage.test.tsx`

---

### 21. `scripts/` Tests -- 2 files

- `scripts/__tests__/agent-poll.test.ts`
- `scripts/backup/__tests__/backup.test.ts`

---

## Deletion Strategy

These 993 test files should be deleted in batches with CI verification between
each batch:

1. **Batch 1**: UI component tests (`src/components/ui/`) -- 31 files
2. **Batch 2**: Remaining component tests (`src/components/` minus UI) -- 229
   files
3. **Batch 3**: Page/layout/error tests (`src/app/` non-API) -- 140 files
4. **Batch 4**: API route tests (`src/app/api/`) -- 158 files
5. **Batch 5**: Hook and type tests (`src/hooks/`, `src/types/`) -- 29 files
6. **Batch 6**: Library tests (`src/lib/` non-MCP) -- 242 files
7. **Batch 7**: Root src and workflow tests -- 9 files
8. **Batch 8**: All packages tests -- 110 files
9. **Batch 9**: All apps tests -- 43 files
10. **Batch 10**: Scripts tests -- 2 files
