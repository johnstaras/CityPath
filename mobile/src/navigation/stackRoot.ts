/**
 * How to return to the first screen of the stack a screen lives in.
 *
 * Screens shared by the Home and Favorites stacks (route summary) cannot
 * hardcode "HomeMain": UC-11 step 5 returns to the first screen of the tab the
 * route was started from. The stack's declared first screen is
 * `routeNames[0]`. When it already sits at the bottom of the stack a plain
 * popToTop keeps that instance (scroll position, mounted data); otherwise the
 * stack is reset to it, since popToTop would stop at whatever route is at
 * index 0.
 */
export type BackToRootPlan =
  | { type: 'popToTop' }
  | { type: 'reset'; rootName: string };

interface StackStateLike {
  routeNames: string[];
  routes: { name: string }[];
}

export function planBackToStackRoot(state: StackStateLike): BackToRootPlan {
  const rootName = state.routeNames[0];
  if (state.routes[0]?.name === rootName) {
    return { type: 'popToTop' };
  }
  return { type: 'reset', rootName };
}
