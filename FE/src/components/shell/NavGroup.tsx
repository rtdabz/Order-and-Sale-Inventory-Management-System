import type { RouteEntry } from "../../lib/navigation";
import { cn } from "../../lib/utils";
import NavItem from "./NavItem";

export type NavGroupProps = {
  label: string;
  items: readonly RouteEntry[];
  /** False in the collapsed rail: the heading is replaced by a divider. */
  showLabels: boolean;
};

/**
 * Group heading type scale (Requirement 2.5). Differs from an item label in
 * size, weight, letter-spacing *and* colour — four of the four cues the
 * criterion offers — so the hierarchy reads without a border box.
 */
const HEADING = cn(
  "px-3 pb-2 text-[10px] font-bold uppercase tracking-widest",
  "text-brand-300/70"
);

/**
 * Collapsed-state group boundary (Requirement 2.4): a visible divider rather
 * than the old `HorizontaLDots` placeholder glyph.
 */
const DIVIDER = "mx-auto my-3 h-px w-8 bg-brand-900/50";

/**
 * One labelled cluster of nav destinations.
 *
 * Grouping is expressed through spacing and the type scale only — no border
 * box, no card background (Requirement 2.6). Each group is a single `ul`, so
 * its items stay contiguous in DOM order in every rail state (Requirement 2.4),
 * and each `NavItem` anchor gets its own `li` wrapper so the list markup stays
 * valid alongside the collapsed-state separator.
 */
const NavGroup: React.FC<NavGroupProps> = ({ label, items, showLabels }) => (
  <div>
    {showLabels && <h2 className={HEADING}>{label}</h2>}
    <ul className="space-y-1">
      {!showLabels && <li role="separator" className={DIVIDER} />}
      {items.map((entry) => (
        <li key={entry.path}>
          <NavItem entry={entry} showLabel={showLabels} />
        </li>
      ))}
    </ul>
  </div>
);

export default NavGroup;
