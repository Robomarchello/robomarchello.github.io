/** Projects page: the interactive physics header. Cards are static HTML. */

import { onReady } from './page.js';
import { initProjectsPhysics } from './projects-physics.js';

onReady(() => {
  initProjectsPhysics();
});
