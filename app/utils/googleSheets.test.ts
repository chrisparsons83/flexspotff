import { parseCsv, sheetCsvUrl, sheetTabCsvUrl } from './googleSheets';
import { describe, expect, it } from 'vitest';

describe('parseCsv', () => {
  it('handles quoted commas, doubled quotes and CRLF', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps an empty last field', () => {
    expect(parseCsv('a,b,\n')).toEqual([['a', 'b', '']]);
  });
});

describe('sheetCsvUrl', () => {
  it('keeps the tab from the hash or the query', () => {
    expect(
      sheetCsvUrl(
        'https://docs.google.com/spreadsheets/d/abc_123/edit?gid=276913576#gid=276913576',
      ),
    ).toBe(
      'https://docs.google.com/spreadsheets/d/abc_123/export?format=csv&gid=276913576',
    );
    expect(
      sheetCsvUrl('https://docs.google.com/spreadsheets/d/abc/edit#gid=42'),
    ).toBe(
      'https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=42',
    );
  });

  it('uses the first tab when the link names none', () => {
    expect(sheetCsvUrl('https://docs.google.com/spreadsheets/d/abc')).toBe(
      'https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=0',
    );
  });

  it('rejects anything that is not a Google Sheet', () => {
    expect(() => sheetCsvUrl('not a url')).toThrow('not a link');
    expect(() => sheetCsvUrl('https://example.com/spreadsheets/d/abc')).toThrow(
      'not a link to a Google Sheet',
    );
  });
});

describe('sheetTabCsvUrl', () => {
  it('asks for the tab by name, with a single header row', () => {
    expect(
      sheetTabCsvUrl(
        'https://docs.google.com/spreadsheets/d/abc_123/edit?usp=sharing',
        'Form Responses Normalized',
      ),
    ).toBe(
      'https://docs.google.com/spreadsheets/d/abc_123/gviz/tq?tqx=out:csv&headers=1&sheet=Form%20Responses%20Normalized',
    );
  });

  it('rejects anything that is not a Google Sheet', () => {
    expect(() =>
      sheetTabCsvUrl('https://example.com/spreadsheets/d/abc', 'Data'),
    ).toThrow('not a link to a Google Sheet');
  });
});
