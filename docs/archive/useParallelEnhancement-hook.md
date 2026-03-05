# useParallelEnhancement Hook

## Overview

The `useParallelEnhancement` hook manages multiple image enhancement jobs
simultaneously. It handles SSE (Server-Sent Events) connections for real-time
job status updates and provides aggregated status tracking across all jobs.

## Location

`/Users/z/Developer/spike-land-ai/spike.land/src/hooks/useParallelEnhancement.ts`

## Features

- Start multiple enhancement jobs in parallel
- Real-time SSE status updates for each job
- Automatic reconnection with exponential backoff
- Aggregate status tracking (processing, completed, failed counts)
- Completion callbacks when all jobs finish
- Job cancellation support
- Error handling and recovery

## Interface

### Options

```typescript
interface UseParallelEnhancementOptions {
  imageId: string; // Image to enhance
  onAllComplete?: (jobs: JobStatus[]) => void; // Called when all jobs finish
  onError?: (jobId: string, error: string) => void; // Called on job errors
  onJobUpdate?: (job: JobStatus) => void; // Called on any job update
}
```

### Return Value

```typescript
interface UseParallelEnhancementReturn {
  startEnhancement: (tiers: EnhancementTier[]) => Promise<void>; // Start enhancements
  jobs: JobStatus[]; // Current job statuses
  isProcessing: boolean; // Any job processing?
  completedCount: number; // Number completed
  failedCount: number; // Number failed
  cancelAll: () => void; // Cancel all jobs
}
```

### Job Status

```typescript
interface JobStatus {
  jobId: string; // Unique job identifier
  tier: EnhancementTier; // TIER_1K | TIER_2K | TIER_4K
  status: PrismaJobStatus; // PENDING | PROCESSING | COMPLETED | FAILED | REFUNDED | CANCELLED
  enhancedUrl?: string; // URL of enhanced image (when completed)
  enhancedWidth?: number; // Width of enhanced image
  enhancedHeight?: number; // Height of enhanced image
  error?: string; // Error message (if failed)
}
```

## Usage Examples

### Basic Usage

```typescript
import { useParallelEnhancement } from "@/hooks/useParallelEnhancement";

function MyComponent() {
  const { startEnhancement, jobs, isProcessing, completedCount } =
    useParallelEnhancement({
      imageId: "image-123",
      onAllComplete: (jobs) => {
        console.log("All enhancements complete!", jobs);
      },
    });

  const handleEnhance = async () => {
    await startEnhancement(["TIER_1K", "TIER_2K", "TIER_4K"]);
  };

  return (
    <div>
      <button onClick={handleEnhance} disabled={isProcessing}>
        Enhance All Tiers
      </button>
      <p>Processing: {isProcessing ? "Yes" : "No"}</p>
      <p>Completed: {completedCount}/{jobs.length}</p>
    </div>
  );
}
```

### With Progress Tracking

```typescript
function EnhancementProgress() {
  const { startEnhancement, jobs, isProcessing, completedCount, failedCount } =
    useParallelEnhancement({
      imageId: "image-123",
      onJobUpdate: (job) => {
        console.log(`Job ${job.jobId} updated:`, job.status);
      },
      onError: (jobId, error) => {
        console.error(`Job ${jobId} failed:`, error);
      },
    });

  const progress = jobs.length > 0 ? (completedCount / jobs.length) * 100 : 0;

  return (
    <div>
      <ProgressBar value={progress} />
      {jobs.map((job) => (
        <div key={job.jobId}>
          {job.tier}: {job.status}
        </div>
      ))}
      {failedCount > 0 && <p>Failed: {failedCount}</p>}
    </div>
  );
}
```

### With Cancellation

```typescript
function CancellableEnhancement() {
  const { startEnhancement, cancelAll, isProcessing, jobs } =
    useParallelEnhancement({
      imageId: "image-123",
    });

  return (
    <div>
      <button onClick={() => startEnhancement(["TIER_1K", "TIER_2K"])}>
        Start Enhancement
      </button>
      <button onClick={cancelAll} disabled={!isProcessing}>
        Cancel All
      </button>
      <p>Status: {isProcessing ? "Processing..." : "Idle"}</p>
    </div>
  );
}
```

### Display Job Results

```typescript
function EnhancementResults() {
  const { startEnhancement, jobs, completedCount } = useParallelEnhancement({
    imageId: "image-123",
    onAllComplete: (jobs) => {
      const completed = jobs.filter((j) => j.status === "COMPLETED");
      console.log(`${completed.length} enhancements completed`);
    },
  });

  return (
    <div>
      <button
        onClick={() => startEnhancement(["TIER_1K", "TIER_2K", "TIER_4K"])}
      >
        Enhance
      </button>
      <div className="results">
        {jobs.map((job) => (
          <div key={job.jobId}>
            <h3>{job.tier}</h3>
            {job.status === "COMPLETED" && job.enhancedUrl && (
              <img
                src={job.enhancedUrl}
                alt={`Enhanced at ${job.tier}`}
                width={job.enhancedWidth}
                height={job.enhancedHeight}
              />
            )}
            {job.status === "FAILED" && <p className="error">{job.error}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Implementation Details

### SSE Connection Management

- Each job gets its own SSE connection to `/api/jobs/{jobId}/stream`
- Connections automatically reconnect on failure with exponential backoff
- Maximum 5 reconnection attempts per job
- All connections are closed when component unmounts or all jobs complete

### Status Tracking

- Jobs are tracked in a Map for efficient updates
- Status aggregation happens reactively via useMemo-like calculations
- `isProcessing` is true if any job is PENDING or PROCESSING
- `completedCount` counts jobs with status COMPLETED
- `failedCount` counts jobs with status FAILED or REFUNDED

### Completion Detection

- `onAllComplete` is called exactly once when all jobs reach terminal state
- Terminal states: COMPLETED, FAILED, REFUNDED, CANCELLED
- Uses a ref flag to prevent duplicate calls

### Error Handling

- SSE errors trigger job status update to FAILED
- API errors during `startEnhancement` are thrown to caller
- Connection errors trigger automatic reconnection
- After max reconnect attempts, job is marked FAILED

## API Integration

The hook expects a POST endpoint at `/api/images/parallel-enhance` that:

1. Accepts `{ imageId: string, tiers: EnhancementTier[] }`
2. Returns
   `{ jobs: Array<{ jobId: string, tier: EnhancementTier, status: JobStatus }> }`
3. Creates enhancement jobs in the database
4. Each job streams updates via `/api/jobs/{jobId}/stream`

## Testing

The hook has 100% test coverage with 17 test cases covering:

- Initialization
- Starting enhancements
- SSE connection handling
- Status updates from SSE messages
- Completion tracking
- Error handling
- Cancellation
- Cleanup on unmount

Run tests with:

```bash
yarn test:run src/hooks/useParallelEnhancement.test.ts
```

## Performance Considerations

- SSE connections are lightweight and efficient for real-time updates
- Using Map for job tracking provides O(1) lookups and updates
- Reconnection backoff prevents overwhelming the server
- All connections are properly cleaned up to prevent memory leaks

## Related Files

- `/Users/z/Developer/spike-land-ai/spike.land/src/hooks/useJobStream.ts` -
  Single job SSE hook
- `/Users/z/Developer/spike-land-ai/spike.land/src/hooks/useParallelEnhancement.test.ts` -
  Test suite
- `/Users/z/Developer/spike-land-ai/spike.land/prisma/schema.prisma` - Database
  schema (EnhancementTier, JobStatus enums)
