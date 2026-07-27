import { ReactNode } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: ReactNode;
}

/**
 * Renders children into `document.body`.
 *
 * Overlays opened from inside a transformed container (e.g. the POS cart drawer,
 * which animates with `transition-transform`) would otherwise resolve
 * `position: fixed` against that container instead of the viewport. Mounting on
 * `document.body` also escapes any ancestor stacking context or overflow clip.
 *
 * This app is client-only (Vite, no SSR), so `document` is always available.
 */
const Portal = ({ children }: PortalProps) => createPortal(children, document.body);

export default Portal;
