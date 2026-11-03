/**
 * Creates and applies a migration without a shadow database.
 *
 *   npm run db:migration:new -- <snake_case_name>
 *
 * `prisma migrate dev` needs a shadow database, and pointing
 * `--shadow-database-url` at a real database resets it - that once wiped the
 * dev database. Instead this diffs the dev database against
 * prisma/schema.prisma, writes the SQL as a new migration, applies it with
 * `migrate deploy`, regenerates the client and pushes the schema to the test
 * database.
 *
 * The diff is taken from the database, so on a branch that is missing
 * migrations the dev database has, it would generate SQL dropping that work.
 * The script refuses to run there.
 */
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const name = process.argv[2];
if (!name || !/^[a-z0-9_]+$/.test(name)) {
  console.error('Usage: npm run db:migration:new -- <snake_case_name>');
  process.exit(1);
}

const migrationsDir = 'prisma/migrations';
const prisma = new PrismaClient();
const applied = await prisma.$queryRaw<Array<{ migration_name: string }>>`
  SELECT migration_name FROM _prisma_migrations
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
await prisma.$disconnect();
const local = new Set(readdirSync(migrationsDir));
const missing = applied
  .map(row => row.migration_name)
  .filter(migration => !local.has(migration));
if (missing.length > 0) {
  console.error(
    `The dev database has migrations this branch lacks:\n  ${missing.join(
      '\n  ',
    )}\nRebase onto the branch that has them first.`,
  );
  process.exit(1);
}

const run = (command: string, args: string[], env = process.env) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'inherit'],
  });

const schema = 'prisma/schema.prisma';
const sql = run('npx', [
  'prisma',
  'migrate',
  'diff',
  '--from-schema-datasource',
  schema,
  '--to-schema-datamodel',
  schema,
  '--script',
]);

if (!sql.trim() || sql.includes('This is an empty migration')) {
  console.error('The dev database already matches schema.prisma.');
  process.exit(1);
}

// Same shape as Prisma's own folder names: UTC yyyymmddhhmmss.
const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const dir = path.join(migrationsDir, `${timestamp}_${name}`);
mkdirSync(dir);
writeFileSync(path.join(dir, 'migration.sql'), sql);
console.log(`Wrote ${dir}/migration.sql:\n\n${sql}`);

console.log(run('npx', ['prisma', 'migrate', 'deploy']));
run('npx', ['prisma', 'generate']);
// PrismaClient loaded .env into process.env above, and dotenv-cli won't
// override a variable that's already set, so without this the test push
// (which accepts data loss) would hit the dev database.
const { DATABASE_URL, ...testEnv } = process.env;
console.log(
  run(
    'npm',
    ['run', 'db:migrate:test'],
    // ProcessEnv is typed with DATABASE_URL required.
    testEnv as NodeJS.ProcessEnv,
  ),
);
