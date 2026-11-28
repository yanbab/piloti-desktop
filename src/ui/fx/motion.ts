/**
 * piloti-fx: every curve and duration the shell animates with, in one place.
 *
 * Code takes them from here (`fxTransition`, `FX_EASE`, `FX_DURATION`); CSS
 * and Tailwind classes use the same values as `--fx-*` variables
 * (`ui/fx/fx.css`, kept equal by `tests/unit/fx-motion.test.ts`).
 *
 * Reduced motion: `globals.css` shortens every transition and animation, so
 * nothing here needs its own check, except Web Animations (`element.animate`),
 * which callers skip themselves.
 */

export const FX_EASE = {
  /** Calm deceleration: things coming to rest (drops, panels, Overview). */
  settle: "cubic-bezier(0.22, 1, 0.36, 1)",
  /** Springy overshoot: neighbours sliding aside, a ghost lifting. */
  spring: "cubic-bezier(0.34, 1.45, 0.5, 1)",
  /** Softer spring: a drag ghost flying back. */
  flyBack: "cubic-bezier(0.34, 1.35, 0.5, 1)",
  /** Accelerating away: a window scaling into the Dock. */
  minimize: "cubic-bezier(0.45, 0, 0.75, 0.6)",
  /** The genie minimize: slow start, fast funnel. */
  genie: "cubic-bezier(0.4, 0, 0.9, 0.8)",
  /** A window growing to fill the screen or back. */
  maximize: "cubic-bezier(0.25, 0.8, 0.3, 1)",
  /** The Dock tile bouncing while an app starts. */
  bounce: "cubic-bezier(0.28, 0.84, 0.42, 1)",
  /** A wrong password shaking the field. */
  shake: "cubic-bezier(0.36, 0.07, 0.19, 0.97)",
} as const;

export const FX_DURATION = {
  /** Small changes: a size, a highlight. */
  quick: 200,
  /** A folder icon opening its flap. */
  folderOpen: 220,
  /** A window flying out of its Dock tile or launcher icon. */
  open: 240,
  /** Sliding to another workspace. */
  workspaceSwitch: 260,
  /** Overview in and out, workspace moves. */
  overview: 350,
  /** Edge panels sliding in and out (`ui/fx/slide.ts`). */
  slide: 350,
  minimize: 360,
  maximize: 380,
  shake: 420,
  genie: 560,
} as const;

export type FxEase = keyof typeof FX_EASE;

/** A CSS `transition` value: each property for `duration` ms on `ease`. */
export function fxTransition(duration: number, ease: FxEase, ...properties: string[]): string {
  return (properties.length ? properties : ["transform"])
    .map((property) => `${property} ${duration}ms ${FX_EASE[ease]}`)
    .join(", ");
}

/** The `--fx-*` CSS variables, as `fx.css` declares them. */
export function fxCssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(FX_EASE)) vars[`--fx-ease-${kebab(name)}`] = value;
  for (const [name, value] of Object.entries(FX_DURATION)) vars[`--fx-duration-${kebab(name)}`] = `${value}ms`;
  return vars;
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
