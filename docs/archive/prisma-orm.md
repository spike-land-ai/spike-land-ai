# Prisma ORM Best Practices for Production Applications

A comprehensive guide covering schema design, query optimization, migrations,
connection management, type safety, and testing strategies for production Prisma
applications.

**Last Updated:** December 2025 **Prisma Version:** 6.x+ (with Rust-free support
available in v6.16.0+)

---

## Table of Contents

1. [Schema Design](#schema-design)
2. [Query Optimization](#query-optimization)
3. [Migrations](#migrations)
4. [Connection Management](#connection-management)
5. [Type Safety](#type-safety)
6. [Testing](#testing)
7. [Performance Monitoring](#performance-monitoring)
8. [Production Checklist](#production-checklist)

---

## Schema Design

### 1. Model Relationships

Defining proper relationships is fundamental to a well-structured Prisma schema.
Use explicit relation syntax to establish clear relationships between models.

#### One-to-Many Relationship

```prisma
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]  // One-to-many relation

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String
  published Boolean @default(false)

  userId    Int
  user      User    @relation(fields: [userId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Optional: Add index for foreign key if using relationMode = "prisma"
  @@index([userId])
}
```

#### Many-to-Many Relationship

```prisma
model Student {
  id    Int    @id @default(autoincrement())
  name  String

  enrollments Enrollment[] // Implicit many-to-many relation

  @@map("students")
}

model Course {
  id    Int    @id @default(autoincrement())
  name  String

  enrollments Enrollment[]

  @@map("courses")
}

// Junction/Bridge table for many-to-many
model Enrollment {
  studentId Int
  student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)

  courseId  Int
  course    Course  @relation(fields: [courseId], references: [id], onDelete: Cascade)

  enrolledAt DateTime @default(now())

  @@id([studentId, courseId]) // Composite primary key
  @@index([courseId])
}
```

#### Self-Referential Relationship

```prisma
model Category {
  id        Int      @id @default(autoincrement())
  name      String

  // Self-referential relation
  parentId  Int?
  parent    Category?  @relation("ParentChildren", fields: [parentId], references: [id])
  children  Category[] @relation("ParentChildren")

  @@index([parentId])
}
```

**Best Practices:**

- Always name relations explicitly for clarity: `@relation("RelationName")`
- Set `onDelete` and `onUpdate` strategies explicitly (`Cascade`, `SetNull`,
  `Restrict`)
- Use `@@map` and `@map` for mapping to different database names while keeping
  TypeScript names clean
- Avoid deeply nested relations; keep query paths shallow (usually max 3 levels)

### 2. Index Optimization

Strategic indexing dramatically improves query performance without impacting
schema design.

#### Single Column Index

```prisma
model User {
  id        Int     @id @default(autoincrement())
  email     String  @unique // Unique constraint includes an index
  name      String
  status    String  @default("active")

  // Regular index on frequently queried column
  @@index([status])
}
```

#### Composite (Multi-Column) Index

```prisma
model BlogPost {
  id        Int     @id @default(autoincrement())
  userId    Int
  status    String
  createdAt DateTime @default(now())

  user      User @relation(fields: [userId], references: [id])

  // Composite index for combined query patterns
  // Good for: WHERE userId = X AND status = 'published'
  @@index([userId, status])

  // Separate index for date range queries
  @@index([createdAt])
}
```

#### Index Configuration Options

```prisma
model Product {
  id          Int     @id @default(autoincrement())
  name        String
  slug        String  @unique
  description String

  // PostgreSQL: Hash index for equality-only comparisons
  // Use with queries: WHERE id = X (not range queries)
  @@index([slug], type: Hash)

  // PostgreSQL: B-tree index (default) for range and equality
  // Good for: WHERE price > X AND price < Y
  @@index([name])
}
```

#### Index Strategy by Database

**PostgreSQL Index Types:**

- **B-tree** (default): Best for equality (`=`) and range (`<`, `>`, `<=`, `>=`)
  queries
- **Hash**: Excellent for equality-only queries with O(1) lookup
- **GIN**: Ideal for full-text search and composite values
- **GiST/SP-GiST**: For geometric types and pattern matching
- **BRIN**: Space-efficient for immutable data (timestamps, auto-incrementing
  IDs)

```prisma
// PostgreSQL full-text search
model Article {
  id      Int    @id @default(autoincrement())
  title   String
  content String

  // GIN index for full-text search
  @@index([title, content], type: Gin)
}
```

**MySQL Index Options:**

- **BTREE** (default)
- **HASH**
- **FULLTEXT** (via `@@fulltext` preview feature)

**Best Practices:**

- Index columns used in `WHERE`, `ORDER BY`, and `JOIN` clauses
- Index foreign keys automatically when using
  `referentialIntegrity = "database"`
- For `relationMode = "prisma"`, explicitly add indexes on foreign key fields
- Avoid over-indexing: each index slows writes and consumes storage
- Monitor query performance with database tools before indexing aggressively
- Use composite indexes strategically for common query patterns

### 3. Enum Usage

Enums provide type safety and prevent invalid values from entering your
database.

```prisma
model Order {
  id     Int    @id @default(autoincrement())
  status OrderStatus @default(PENDING)

  items      OrderItem[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

model OrderItem {
  id       Int     @id @default(autoincrement())
  quantity Int
  priority Priority @default(NORMAL)

  orderId  Int
  order    Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
}

enum Priority {
  LOW
  NORMAL
  HIGH
  URGENT
}
```

**Database Mapping:**

- **PostgreSQL**: Native ENUM type (recommended)
- **MySQL**: Stored as VARCHAR (1.6 GB limit per column)
- **SQLite**: Stored as TEXT

```prisma
// Map enum to VARCHAR in MySQL
enum UserRole {
  ADMIN
  MODERATOR
  USER
  GUEST
}

model User {
  id   Int      @id @default(autoincrement())
  role UserRole @default(USER)
}
```

**Best Practices:**

- Use enums instead of string fields for status/type fields
- Avoid enums for frequently changing values or user-defined categories
- Document enum values clearly with comments for API consumers
- Consider database compatibility when choosing enum representation

---

## Query Optimization

### 1. N+1 Query Prevention

The N+1 problem occurs when you fetch a parent record and then loop through
results fetching related records individually.

#### The Problem

```typescript
// ❌ BAD: Creates N+1 queries
const users = await prisma.user.findMany(); // 1 query

for (const user of users) {
  const posts = await prisma.post.findMany({
    where: { userId: user.id },
  }); // N additional queries
}
```

#### Solution 1: Use `include` for Eager Loading

```typescript
// ✅ GOOD: Single query with eager loading
const users = await prisma.user.findMany({
  include: {
    posts: true, // Loads all posts for each user
  },
});

// All data available without additional queries
users.forEach((user) => {
  console.log(user.posts);
});
```

#### Solution 2: Use `select` for Specific Fields

```typescript
// ✅ GOOD: Load only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
    posts: {
      select: {
        id: true,
        title: true, // Only specific post fields
      },
    },
  },
});
```

#### Solution 3: `relationLoadStrategy` for Complex Queries

```typescript
// ✅ GOOD: Optimize relation loading strategy (PostgreSQL/MySQL 5.10+)
const users = await prisma.user.findMany({
  include: {
    posts: true,
    comments: true,
  },
  // 'join' uses LATERAL JOINs and JSON aggregation (more efficient)
  // 'query' makes separate queries (useful for very large relations)
  relationLoadStrategy: "join",
});
```

#### Solution 4: Use `in` Filter for Batch Queries

```typescript
// ✅ GOOD: Batch load related records
const userIds = [1, 2, 3, 4, 5];
const posts = await prisma.post.findMany({
  where: {
    userId: {
      in: userIds,
    },
  },
});

// Then map to users manually or use in-memory joining
const postsMap = new Map();
posts.forEach((post) => {
  if (!postsMap.has(post.userId)) {
    postsMap.set(post.userId, []);
  }
  postsMap.get(post.userId).push(post);
});
```

#### Solution 5: DataLoader Pattern for GraphQL

```typescript
import DataLoader from "dataloader";

// Batch loader for posts
const postsLoader = new DataLoader(async (userIds) => {
  const posts = await prisma.post.findMany({
    where: { userId: { in: userIds } },
  });

  // Return posts in the same order as userIds
  return userIds.map((id) => posts.filter((p) => p.userId === id));
});

// In resolver
const user = await prisma.user.findUnique({ where: { id: 1 } });
const userPosts = await postsLoader.load(user.id);
```

**Important Constraint:** Cannot use `select` and `include` at the same nesting
level. Choose one or the other:

```typescript
// ❌ ERROR: Can't mix select and include at same level
const users = await prisma.user.findMany({
  select: { email: true }, // Problem!
  include: { posts: true }, // Can't use both
});

// ✅ GOOD: Use include or select
const users = await prisma.user.findMany({
  include: {
    posts: {
      select: { title: true }, // Nested select is OK
    },
  },
});
```

### 2. `select` vs `include` Decision Tree

```
Do you need all scalar fields from the model?
├─ YES → Use include (loads all fields + relations)
│        include: { relation: true }
│
└─ NO → Use select (only specified fields)
         select: {
           id: true,
           email: true,
           posts: true
         }
```

**`include` Behavior:**

- Returns all scalar fields automatically
- Adds specified relations
- Performance: Slightly more data transfer if you don't need all fields

**`select` Behavior:**

- Returns ONLY specified fields
- More explicit and secure (password fields not accidentally leaked)
- Better for APIs and public-facing queries

```typescript
// Include: returns all user fields + posts
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: { posts: true },
});
// Returns: { id, email, name, posts: [...] }

// Select: returns only specified fields
const user = await prisma.user.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    email: true,
    posts: true,
  },
});
// Returns: { id, email, posts: [...] }
// Note: 'name' is NOT included
```

### 3. Raw SQL When Needed

For complex queries or performance-critical operations, raw SQL is appropriate.

```typescript
// Complex aggregation query
const userPostStats = await prisma.$queryRaw`
  SELECT
    u.id,
    u.email,
    COUNT(p.id) as post_count,
    AVG(CAST(p.views as FLOAT)) as avg_views
  FROM "User" u
  LEFT JOIN "Post" p ON u.id = p."userId"
  GROUP BY u.id, u.email
  HAVING COUNT(p.id) > ${minPosts}
  ORDER BY post_count DESC
  LIMIT ${limit}
`;

// Type-safe raw queries
type UserStats = {
  id: number;
  email: string;
  post_count: bigint;
  avg_views: number | null;
};

const stats = await prisma.$queryRaw<UserStats[]>`
  SELECT * FROM user_stats WHERE id > ${userId}
`;
```

**When to Use Raw SQL:**

- Complex aggregations (`GROUP BY`, `HAVING`)
- Database-specific functions
- Performance-critical queries that can't be expressed efficiently in Prisma
- Window functions and CTE (Common Table Expressions)
- Stored procedure calls (via raw SQL)

**Security Note:** Always use parameterized queries with template literals.
Never use string concatenation:

```typescript
// ✅ SAFE: Parameterized
const results = await prisma.$queryRaw`
  SELECT * FROM users WHERE id = ${userId}
`;

// ❌ UNSAFE: String concatenation (SQL injection risk)
const results = await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE id = ${userId}`,
);
```

---

## Migrations

### 1. Migration Workflow

#### Development Environment

```bash
# Create a new migration after changing schema.prisma
yarn prisma migrate dev --name add_user_roles

# This command:
# 1. Creates SQL migration in prisma/migrations/
# 2. Applies migration to dev database
# 3. Generates Prisma Client

# Reset dev database (destructive, dev only)
yarn prisma migrate reset
```

#### Production Environment

```bash
# Apply migrations without generating Prisma Client
# Use in CI/CD pipeline
yarn prisma migrate deploy

# This command:
# 1. Applies pending migrations to production
# 2. Updates _prisma_migrations table
# 3. Does NOT reset or regenerate Prisma Client
```

### 2. Production Migration Strategy

```yaml
# Example CI/CD pipeline step (GitHub Actions)
- name: Run Prisma migrations
  env:
    DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
  run: yarn prisma migrate deploy

# This must run BEFORE application deployment
```

**Best Practices:**

- Always test migrations in staging first
- Use meaningful migration names: `add_user_email_index`, not `migration123`
- Commit migration SQL files to version control
- Deploy migrations BEFORE deploying application code
- Monitor migration execution time in production
- Have a rollback plan for each migration

### 3. Rollback Procedures

#### Option 1: Use `migrate resolve` Command

For failed migrations, mark them as rolled back:

```bash
# Mark a migration as rolled back
yarn prisma migrate resolve --rolled-back "20240101120000_add_new_column"

# The migration can now be applied again with migrate deploy
```

#### Option 2: Generate Down Migration

Create reverse SQL using `migrate diff`:

```bash
# Generate a down migration to revert schema changes
yarn prisma migrate diff \
  --from-schema-datamodel schema.prisma \
  --to-schema-datasource prisma/schema.prisma \
  --script > down.sql

# Execute down migration
yarn prisma db execute --file ./down.sql

# Mark original migration as rolled back
yarn prisma migrate resolve --rolled-back "20240101120000_add_new_column"
```

#### Step-by-Step Rollback Process

```typescript
// 1. In schema.prisma, revert your changes
// For example, remove the new column you added

// 2. Generate the down migration
// yarn prisma migrate diff --from-schema-datamodel schema.prisma --to-schema-datasource prisma/schema.prisma --script > down.sql

// 3. Review down.sql carefully!
// Example:
// ALTER TABLE "User" DROP COLUMN "phone";

// 4. Execute in production (with backup!)
// yarn prisma db execute --file ./down.sql

// 5. Mark migration as rolled back
// yarn prisma migrate resolve --rolled-back "20240101120000_add_phone"

// 6. Commit the reverted schema.prisma to git
// git add prisma/schema.prisma
// git commit -m "Revert phone column addition"
```

### 4. Handling Schema Drift

Schema drift occurs when your production database schema doesn't match your
migration history.

```bash
# Check for schema drift
yarn prisma migrate status

# If drift is detected:
# Option 1: Use migrate resolve to acknowledge hotfix
yarn prisma migrate resolve --rolled-back "20240101120000_migration"

# Option 2: Mark migration as applied without re-running
yarn prisma migrate resolve --applied "20240101120000_migration"
```

### 5. Expand and Contract Pattern

For zero-downtime deployments, use expand and contract:

```
Phase 1: EXPAND (add new column without removing old)
- Add new_field column
- Update application to write to both old_field and new_field
- Migrate existing data to new_field

Phase 2: MIGRATE (move traffic to new column)
- Update application to read only from new_field
- Ensure no new writes to old_field

Phase 3: CONTRACT (remove old column)
- Remove old_field column
- Update application to remove old_field references
```

```prisma
// Phase 1: Add new_status column alongside old status column
model User {
  id          Int     @id @default(autoincrement())
  status      String  @default("active") // Keep old column
  new_status  String? // New column, nullable initially
}

// Phase 2: After data migration, update application
// to use new_status exclusively

// Phase 3: Remove old column after verification
model User {
  id         Int     @id @default(autoincrement())
  new_status String  @default("active") @rename("status") // Rename column back
}
```

---

## Connection Management

### 1. Connection Pooling Configuration

The default connection pool size is `num_cpus * 2 + 1`. Adjust based on your
workload:

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Set connection pool size via URL
// postgresql://user:password@localhost:5432/db?connection_limit=20
```

**Connection Pool Sizing:**

| Environment | Calculation | Reasoning                                            |
| ----------- | ----------- | ---------------------------------------------------- |
| Development | CPU * 2 + 1 | Single developer, limited concurrency                |
| Staging     | CPU * 3 + 2 | Moderate testing load                                |
| Production  | CPU * 4 + 5 | High concurrency, multiple replicas                  |
| Serverless  | 1-5         | Each function gets own pool; aggregate limit matters |

### 2. Singleton Pattern (Next.js/Node.js)

Prevent connection pool exhaustion from hot reloading:

```typescript
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

Then import and use:

```typescript
// app/api/users/route.ts
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany();
  return Response.json(users);
}
```

### 3. PgBouncer Integration (PostgreSQL)

For serverless environments with PostgreSQL, use PgBouncer for connection
pooling:

```typescript
// .env.production
// Connection URL for application (through PgBouncer)
DATABASE_URL =
  "postgresql://user:password@pgbouncer-host:6543/db?pgbouncer=true";

// Direct URL for Prisma CLI commands (bypass PgBouncer)
DIRECT_URL = "postgresql://user:password@postgres-host:5432/db";
```

Update `schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**PgBouncer Configuration Requirements:**

```ini
# pgbouncer.ini
[databases]
mydb = host=postgres.example.com port=5432 dbname=mydb

[pgbouncer]
pool_mode = transaction        # Required for Prisma
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 10
reserve_pool_size = 5
max_db_connections = 100
max_user_connections = 100
server_lifetime = 600

# Enable prepared statement caching
max_prepared_statements = 100
```

**Common Issues:**

- `pgbouncer=true` flag required in connection string
- Port 6543 typical for PgBouncer (not 5432)
- Pool mode MUST be `transaction` not `session`
- Prepared statements need `max_prepared_statements > 0`

### 4. Prisma Accelerate (Managed Alternative)

For globally distributed applications, use Prisma Accelerate:

```bash
# Install and configure Accelerate
npm install @prisma/accelerate

# Get an Accelerate API key from https://console.prisma.io/accelerate
```

```typescript
// .env
DATABASE_URL="prisma://..."  # Accelerate URL
```

**Benefits:**

- Global connection pooling
- Automatic failover
- Built-in query caching
- Zero-configuration for serverless
- Reduces cold start penalties

### 5. Connection Lifecycle Management

```typescript
// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    await prisma.$disconnect();
    console.log("Prisma Client disconnected");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

// Listen for termination signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Error handling
prisma.$on("beforeExit", async () => {
  console.log("Prisma exiting");
});

prisma.$on("query", (e) => {
  console.log(`Query: ${e.query}`);
  console.log(`Params: ${e.params}`);
  console.log(`Duration: ${e.duration}ms`);
});
```

---

## Type Safety

### 1. Using Generated Types

Prisma generates types automatically, providing full type safety:

```typescript
import { Post, User } from "@prisma/client";

// Function with generated types
function getUserWithPosts(userId: number): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { posts: true },
  });
}

// Type includes posts relation
type UserWithPosts = User & {
  posts: Post[];
};
```

### 2. Input Type Validation with Zod

Combine Prisma types with Zod for validation:

```typescript
import { User } from "@prisma/client";
import { z } from "zod";

// Define validation schema
const CreateUserSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name required"),
  role: z.enum(["ADMIN", "USER", "GUEST"]),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

// API endpoint with validation
export async function createUser(input: unknown): Promise<User> {
  const validatedData = CreateUserSchema.parse(input);

  return prisma.user.create({
    data: validatedData,
  });
}
```

### 3. Using zod-prisma-types Generator

Automatically generate Zod schemas from Prisma models:

```bash
npm install -D zod-prisma-types
```

Update `schema.prisma`:

```prisma
generator zod {
  provider = "zod-prisma-types"
  output   = "./lib/zod"
  createInputTypes = true
  createOutputTypes = true
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  /// @zod.string.email("Invalid email")
  name  String?
  role  UserRole @default(USER)
}

enum UserRole {
  ADMIN
  USER
}
```

Generate types:

```bash
yarn prisma generate
```

Usage:

```typescript
import { CreateUserSchema, UserSchema } from "@/lib/zod";

// Automatically generated and validated
const user = UserSchema.parse(userData);
const newUser = CreateUserSchema.parse(formInput);
```

### 4. Type-Safe Select and Include

Create reusable type-safe selections:

```typescript
// Define selector factory
const userSelect = {
  basic: { id: true, email: true, name: true },
  withPosts: {
    id: true,
    email: true,
    name: true,
    posts: {
      select: { id: true, title: true },
    },
  },
  full: true,
} as const;

type UserSelects = typeof userSelect;
type BasicUser = Prisma.UserGetPayload<{ select: UserSelects["basic"] }>;
type UserWithPosts = Prisma.UserGetPayload<
  { select: UserSelects["withPosts"] }
>;

// Use in queries
async function getUserBasic(id: number): Promise<BasicUser> {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: userSelect.basic,
  });
}

async function getUserWithPosts(id: number): Promise<UserWithPosts> {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: userSelect.withPosts,
  });
}
```

---

## Testing

### 1. Unit Testing with Mocked Prisma

Use `jest-mock-extended` or `vitest-mock-extended` for mocking:

```bash
npm install --save-dev jest-mock-extended vitest
```

**Singleton Mock Pattern:**

```typescript
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// In tests, mock this file
jest.mock("@/lib/prisma");
```

```typescript
// tests/user.service.test.ts
import { prismaMock } from "@/lib/__mocks__/prisma";
import { getUserById } from "@/services/user";

describe("getUserById", () => {
  it("returns user by id", async () => {
    const mockUser = {
      id: 1,
      email: "test@example.com",
      name: "Test User",
      role: "USER",
    };

    // Mock the query
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    const result = await getUserById(1);

    expect(result).toEqual(mockUser);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
```

Create mock file:

```typescript
// lib/__mocks__/prisma.ts
import { PrismaClient } from "@prisma/client";
import { DeepMockProxy, mockDeep, mockReset } from "jest-mock-extended";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
  mockReset(prismaMock);
});

export const prismaMock = jest.mocked(prisma) as unknown as DeepMockProxy<
  PrismaClient
>;
```

### 2. Integration Testing with Test Database

```bash
npm install --save-dev dotenv
```

Create `.env.test`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/test_db"
NODE_ENV=test
```

**Test Database Setup:**

```typescript
// tests/setup.ts
import { prisma } from "@/lib/prisma";
import { execSync } from "child_process";

beforeAll(async () => {
  // Reset database schema
  await execSync("yarn prisma migrate reset --force");
});

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  // Clean up after each test
  // Use transactional cleanup or truncate tables
  const tables = ["User", "Post", "Comment"];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
});
```

**Integration Test Example:**

```typescript
// tests/user.integration.test.ts
import { prisma } from "@/lib/prisma";

describe("User Integration Tests", () => {
  it("creates user with posts", async () => {
    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
        posts: {
          create: [
            { title: "Post 1", content: "Content 1" },
            { title: "Post 2", content: "Content 2" },
          ],
        },
      },
      include: { posts: true },
    });

    expect(user.email).toBe("test@example.com");
    expect(user.posts).toHaveLength(2);

    // Verify in database
    const retrieved = await prisma.user.findUnique({
      where: { id: user.id },
      include: { posts: true },
    });

    expect(retrieved?.posts).toHaveLength(2);
  });
});
```

### 3. Database Seeding for Tests

Create reusable seed functions:

```typescript
// tests/seeds.ts
import { prisma } from "@/lib/prisma";
import { Post, User } from "@prisma/client";

export async function seedUser(data?: Partial<User>): Promise<User> {
  return prisma.user.create({
    data: {
      email: `user-${Date.now()}@example.com`,
      name: "Test User",
      ...data,
    },
  });
}

export async function seedPost(
  userId: number,
  data?: Partial<Post>,
): Promise<Post> {
  return prisma.post.create({
    data: {
      title: "Test Post",
      content: "Test Content",
      userId,
      ...data,
    },
  });
}

export async function seedUserWithPosts(
  userCount: number,
  postsPerUser: number,
): Promise<User[]> {
  const users = [];

  for (let i = 0; i < userCount; i++) {
    const user = await seedUser();

    for (let j = 0; j < postsPerUser; j++) {
      await seedPost(user.id);
    }

    users.push(user);
  }

  return users;
}
```

Use in tests:

```typescript
// tests/post.test.ts
import { seedPost, seedUser } from "./seeds";

describe("Post queries", () => {
  it("finds all posts by user", async () => {
    const user = await seedUser();
    await seedPost(user.id);
    await seedPost(user.id);

    const posts = await prisma.post.findMany({
      where: { userId: user.id },
    });

    expect(posts).toHaveLength(2);
  });
});
```

### 4. Production Seeding

Create a seed script for production data:

```typescript
// prisma/seed.ts
import { prisma } from "@/lib/prisma";

async function main() {
  // Check if already seeded
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (existingAdmin) {
    console.log("Database already seeded");
    return;
  }

  // Seed roles
  const roles = ["ADMIN", "MODERATOR", "USER"];
  for (const role of roles) {
    await prisma.userRole.upsert({
      where: { name: role },
      update: {},
      create: { name: role },
    });
  }

  console.log("Seeding completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "node --require ts-node/register prisma/seed.ts"
  }
}
```

Run seeding:

```bash
# Seed database
yarn prisma db seed

# Or with migrate reset
yarn prisma migrate reset
```

---

## Performance Monitoring

### 1. Query Logging

```typescript
// Enable in development
const prisma = new PrismaClient({
  log: [
    {
      emit: "stdout",
      level: "query",
    },
    {
      emit: "stdout",
      level: "error",
    },
    {
      emit: "event",
      level: "query",
    },
  ],
});

// Listen to query events
prisma.$on("query", (e) => {
  console.log("Query duration:", e.duration);
  console.log("Query:", e.query);
});
```

Disable in production for performance:

```typescript
// Production: minimal logging
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production"
    ? ["error", "warn"]
    : ["query", "error", "warn", "info"],
});
```

### 2. Slow Query Analysis

```typescript
// Identify slow queries
prisma.$on("query", (e) => {
  if (e.duration > 1000) { // > 1 second
    console.warn("SLOW QUERY:", {
      query: e.query,
      duration: e.duration,
      timestamp: new Date(),
    });

    // Log to monitoring service
    sendMetric("slow_query", {
      duration: e.duration,
      query: e.query,
    });
  }
});
```

### 3. Connection Pool Monitoring

```typescript
// Monitor pool health
const interval = setInterval(() => {
  // Note: Connection pool metrics vary by database
  // PostgreSQL example:
  prisma.$queryRaw`
    SELECT datname, count(*) as connections
    FROM pg_stat_activity
    GROUP BY datname
  `.then((result) => {
    console.log("Database connections:", result);
  });
}, 30000);

// Cleanup
process.on("exit", () => clearInterval(interval));
```

### 4. Performance Best Practices Checklist

- Database and application in same AWS region
- Add indexes to frequently queried columns
- Use `select` to fetch only needed fields
- Batch queries with `include` instead of loops
- Set `relationLoadStrategy: 'join'` for complex relations
- Monitor slow queries (> 1s)
- Use connection pooling for serverless
- Cache frequently accessed data (Redis)
- Regularly analyze query plans with `EXPLAIN`
- Load test before production deployment

---

## Production Checklist

### Pre-Deployment Verification

- [ ] Schema validated with `prisma validate`
- [ ] Migrations tested in staging environment
- [ ] Connection pooling configured correctly
- [ ] Environment variables (DATABASE_URL, DIRECT_URL) set
- [ ] Database backups enabled
- [ ] Query logging configured (disabled in production)
- [ ] Error handling implemented for Prisma errors
- [ ] Type safety verified with TypeScript strict mode
- [ ] Tests passing with 100% coverage
- [ ] Performance benchmarks met (query times < 1s)

### Deployment Process

```bash
# 1. Verify migrations
yarn prisma migrate status

# 2. Apply migrations (in CI/CD)
yarn prisma migrate deploy

# 3. Verify schema matches database
yarn prisma db pull  # Compare with schema.prisma

# 4. Generate updated Prisma Client
yarn prisma generate

# 5. Deploy application
npm run build
npm start
```

### Post-Deployment Monitoring

- [ ] Monitor application logs for Prisma errors
- [ ] Check database connection pool utilization
- [ ] Verify slow query logs (should be empty)
- [ ] Monitor error rates in APM tool
- [ ] Check p95/p99 query latencies
- [ ] Verify all automated backups complete
- [ ] Test rollback procedures

### Troubleshooting Common Issues

**"Too Many Connections" Error**

- Increase connection pool size
- Implement PgBouncer or Prisma Accelerate
- Check for connection leaks in application code
- Verify singleton pattern usage in Next.js

**Slow Queries**

- Add indexes to WHERE/ORDER BY columns
- Use `select` instead of `include` when possible
- Check for N+1 problems
- Analyze query plan with `EXPLAIN`

**Migration Failures**

- Test migration in staging first
- Have rollback plan ready
- Monitor migration time in production
- Use transactions for atomic changes

**Type Errors**

- Regenerate Prisma Client: `yarn prisma generate`
- Clear TypeScript cache: `rm -rf .next`
- Verify schema.prisma syntax
- Check for uncommitted migrations

---

## Resources & References

### Official Documentation

- [Prisma Documentation](https://www.prisma.io/docs)
- [Relation Queries](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries)
- [Query Optimization](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance)
- [Indexes](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes)
- [Database Connections](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections)
- [PgBouncer Configuration](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer)
- [Unit Testing](https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing)

### Community & Tools

- [zod-prisma-types GitHub](https://github.com/chrishoermann/zod-prisma-types)
- [prisma-zod-generator](https://www.npmjs.com/package/prisma-zod-generator)
- [Prisma Performance Benchmarks](https://www.prisma.io/blog/performance-benchmarks-comparing-query-latency-across-typescript-orms-and-databases)
- [Prisma Deep-Dive Handbook (2025)](https://dev.to/mihir_bhadak/prisma-deep-dive-handbook-2025-from-zero-to-expert-1761)

### Related Reading

- [Connection Management Guide](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Expanding and Contracting Pattern for Zero-Downtime Migrations](https://www.prisma.io/docs/guides/data-migration)
- [Production Troubleshooting](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)

---

## Contributing & Updates

This document reflects best practices as of December 2025. As Prisma evolves
(with Prisma 7.0.0 planned for mid-2025), best practices may change. Check the
official documentation regularly for updates.

For improvements or corrections, please submit updates to this documentation.
