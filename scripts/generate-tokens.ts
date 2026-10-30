import { renderTokensCss, TOKENS_CSS_PATH } from '../app/styles/tokens/css';
import { writeFileSync } from 'fs';

writeFileSync(TOKENS_CSS_PATH, renderTokensCss());
console.log(`Wrote ${TOKENS_CSS_PATH}`);
