export type SidebarLayout = "auto" | "expanded" | "collapsed";
export const SIDEBAR_LAYOUT_KEY = "mg_sidebar_layout_v1";
export function sidebarLayout(value: unknown): SidebarLayout {
  return value === "expanded" || value === "collapsed" ? value : "auto";
}
export function sidebarIsCompact(
  layout: SidebarLayout,
  narrowDesktop: boolean,
) {
  return layout === "collapsed" || (layout === "auto" && narrowDesktop);
}
