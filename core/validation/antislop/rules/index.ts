import type { Rule } from '../types';
import { purpleGradientRule } from './purple-gradient';
import { emDashOveruseRule } from './em-dash-overuse';
import { marketingBuzzwordsRule } from './marketing-buzzwords';
import { nestedCardsRule } from './nested-cards';
import { interEverywhereRule } from './inter-everywhere';
import { headlineTitleCaseOverkillRule } from './headline-titlecase-overkill';
import { bulletParallelismFakeRule } from './bullet-parallelism-fake';

export const ALL_RULES: Rule[] = [
  purpleGradientRule,
  emDashOveruseRule,
  marketingBuzzwordsRule,
  nestedCardsRule,
  interEverywhereRule,
  headlineTitleCaseOverkillRule,
  bulletParallelismFakeRule,
];
