/**
 * Reading public Google Sheets as CSV, for importing the seasons that were run
 * in spreadsheets before the site took them over.
 */

/**
 * A minimal RFC 4180 reader: quoted fields, doubled quotes, and commas and
 * newlines inside quotes. Enough for a Google Sheets CSV export, where a
 * manager name like "Smash, Criosphinx Sovereign" would split a naive reader.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
/** Parses a Google Sheets link and returns the spreadsheet's ID. */
function parseSheetLink(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error('That is not a link.');
  }

  const id = parsed.pathname.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (parsed.hostname !== 'docs.google.com' || !id) {
    throw new Error('That is not a link to a Google Sheet.');
  }

  return { id, parsed };
}

/**
 * Turns any link to a Google Sheet into its CSV export URL, keeping the tab
 * the link points at. A link with no tab gets the first one, which in both
 * QB streaming sheets is the "Data" tab.
 */
export function sheetCsvUrl(url: string): string {
  const { id, parsed } = parseSheetLink(url);

  const gid =
    parsed.searchParams.get('gid') ??
    parsed.hash.match(/gid=(\d+)/)?.[1] ??
    '0';

  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/**
 * The CSV URL of one tab of a sheet, found by its name rather than its gid.
 * This goes through the visualization API, which reads hidden tabs too.
 * `headers=1` stops it guessing how many rows make up the header, which it
 * otherwise sometimes gets wrong and merges the first data row into.
 */
export function sheetTabCsvUrl(url: string, tab: string): string {
  const { id } = parseSheetLink(url);

  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(
    tab,
  )}`;
}

export class SheetDownloadError extends Error {}

/** Downloads a sheet's CSV, failing with a message an admin can act on. */
export async function downloadSheetCsv(csvUrl: string): Promise<string> {
  const res = await fetch(csvUrl);
  // A private sheet redirects to a Google sign-in page rather than failing.
  const isCsv = res.headers.get('content-type')?.includes('text/csv');
  if (!res.ok || !isCsv) {
    throw new SheetDownloadError(
      `Could not download the sheet (${res.status}). Check that anyone with the link can view it.`,
    );
  }

  return res.text();
}
