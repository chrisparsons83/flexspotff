import { runSideGameSyncJob } from '../../../jobs/side-game-job';
import * as sync from './sync.server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as jobRunner from '~/libs/job-runner.server';

vi.mock('~/libs/job-runner.server', () => ({ runJob: vi.fn() }));
vi.mock('./sync.server');

type JobResult = { success?: boolean; message?: string };
type JobBody = () => Promise<JobResult | void>;

/** Capture the body the helper hands to runJob, without running a worker. */
function capturedJobBody() {
  let body: JobBody | undefined;
  vi.mocked(jobRunner.runJob).mockImplementation(async (_name, job) => {
    body = job as JobBody;
  });

  runSideGameSyncJob('score-side-game-weeks');

  if (!body) throw new Error('runJob was not called with a body');
  return body;
}

function report(overrides: {
  message: string;
  warnings?: string[];
  errors?: string[];
}) {
  return {
    message: overrides.message,
    scored: [],
    opened: [],
    warnings: overrides.warnings ?? [],
    errors: overrides.errors ?? [],
  };
}

describe('runSideGameSyncJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes warnings in the message without failing the run', async () => {
    vi.mocked(sync.syncSideGameWeeks).mockResolvedValue(
      report({
        message: 'scored 1 weeks',
        warnings: [
          'DFS Survivor week 12: Player score refresh failed: Sleeper is down',
        ],
      }),
    );

    const result = await capturedJobBody()();

    expect(result).toEqual({
      message:
        'scored 1 weeks; warnings: DFS Survivor week 12: Player score refresh failed: Sleeper is down',
    });
  });

  it('fails the run only for report errors, and includes both lists', async () => {
    vi.mocked(sync.syncSideGameWeeks).mockResolvedValue(
      report({
        message: '1 errors',
        warnings: [
          'Admin alert failed for Spread Pool week 13: Missing Access',
        ],
        errors: ['Locks Challenge week 13: transaction failed'],
      }),
    );

    const result = await capturedJobBody()();

    expect(result).toEqual({
      success: false,
      message:
        '1 errors; warnings: Admin alert failed for Spread Pool week 13: Missing Access; errors: Locks Challenge week 13: transaction failed',
    });
  });
});
