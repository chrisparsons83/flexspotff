/**
 * Runs the web server, the Discord bot and the job scheduler side by side, and
 * takes the whole container down the moment any of them exits.
 *
 * This replaces `run-p start start:bot start:scheduler`. On 2026-10-02 the
 * scheduler aborted with a core dump and run-p carried on with the other two:
 * the site kept serving, so the container never failed, Docker's on-failure
 * restart policy never fired, and live scores stopped updating for days with
 * nothing to show for it. None of these processes is meant to exit, so any
 * exit - even a clean one - is treated as a failure, and the container is left
 * for Docker to restart.
 */
import { spawn } from 'node:child_process';

const PROCESSES = [
  {
    name: 'web',
    args: ['./node_modules/.bin/remix-serve', './build/server/index.js'],
  },
  { name: 'bot', args: ['./build/bot/server.cjs'] },
  { name: 'scheduler', args: ['./build/scheduler/server.cjs'] },
];

/** How long a child gets to stop after SIGTERM before it is killed outright. */
const STOP_TIMEOUT_MS = 10_000;

let stopping = false;

const children = PROCESSES.map(({ name, args }) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  // A child that could not be started at all (e.g. the OS refused the fork)
  // emits this instead of 'exit'. Unhandled, it would crash this script and
  // leave the other two running unwatched.
  child.on('error', error => {
    if (stopping) return;
    console.error(
      `💥 ${name} could not be started, stopping the container so it restarts:`,
      error,
    );
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(
      `💥 ${name} exited (${
        signal ? `signal ${signal}` : `code ${code}`
      }), stopping the container so it restarts`,
    );
    stop(1);
  });
  return child;
});

function stop(exitCode) {
  if (stopping) return;
  stopping = true;

  // No pid means the child never started, so it will never emit 'exit'.
  const running = children.filter(
    child =>
      child.pid !== undefined &&
      child.exitCode === null &&
      child.signalCode === null,
  );
  if (running.length === 0) process.exit(exitCode);

  let remaining = running.length;
  const onChildStopped = () => {
    remaining -= 1;
    if (remaining === 0) process.exit(exitCode);
  };
  for (const child of running) {
    child.once('exit', onChildStopped);
    child.kill('SIGTERM');
  }

  setTimeout(() => {
    for (const child of running) child.kill('SIGKILL');
    process.exit(exitCode);
  }, STOP_TIMEOUT_MS);
}

// `docker stop` is a deliberate shutdown, not a failure.
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
