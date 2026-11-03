# Coding Standards

Judgement calls for review. Anything a tool can check lives in ESLint,
`check:patterns` or the Storybook check instead, and is not repeated here.

## UI copy

### Labels are title case

Every UI label is title case: page and section headings, card titles, the main
nav, sub-nav tabs, breadcrumbs, menus, buttons, pickers, table column headers
and form labels. Small words (of, the, and, in, on, to, a, vs) stay lowercase
unless they come first or last. Member names and data are left as they are.

Running text stays sentence case: descriptions, status lines, empty states and
paragraphs.

### A heading gets a description line only when it is needed

`Section`, `PageHeader` and `GameHeader` take no `description` by default. A
grey line under a heading earns its place only when the reader cannot act on or
read the content correctly without it:

- a game's rules on its landing page
- a colour legend for a shaded chart
- instructions on an admin form
- live state that changes what you can do ("This week has locked")

A ranking basis, season status, a table legend or a comparison note does not
qualify. When in doubt, leave it out: about 35 such lines were cut site-wide in
#222, borderline ones included.

## Pages

### Profile pages keep their structure

The member profile pages (`/u/:handle` and their tabs) keep their sections,
order and content. A change may restyle them (tokens, components) but moving,
merging or dropping anything on them needs the owner's sign-off first. Other
pages, such as standings, are open to layout changes.

## Code

### Code reads like the code around it

Match the surrounding file's comment density, naming and idiom. Comments explain
why, in plain sentences. A refactor keeps the comments it moves, so the reasons
behind the code survive it.
