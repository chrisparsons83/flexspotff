import { installGlobals } from '@remix-run/node';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

installGlobals();

// Testing Library installs this itself, but only as a side effect of the first
// import of @testing-library/react. The suite runs --no-threads, so that module
// is cached after the first component test file and every later file would go
// without cleanup - leaving the previous file's DOM in place and finding two of
// everything. Registering it here runs it for each file.
afterEach(cleanup);
