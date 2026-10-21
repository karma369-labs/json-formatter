import { useEffect, useRef } from 'react';
import { ChevronDown, LayoutGrid } from 'lucide-react';
import { CONVERTER_ROUTES, TOOL_ROUTES, navLabel, type RouteMeta } from '../routes';
import './ToolNav.css';

// Links between pages are plain <a href>, not router links. Each page is its
// own prerendered file with its own <title> and canonical, and a full load is
// what puts the right ones in place. The editor's document carries over
// through autosave (see useJsonEditor's pagehide save).

const GROUPS = [
  { heading: 'Tools', routes: TOOL_ROUTES },
  { heading: 'Converters', routes: CONVERTER_ROUTES },
];

function ToolLink({ route, currentPath }: { route: RouteMeta; currentPath: string }) {
  const current = route.path === currentPath;
  return (
    <a href={route.path} aria-current={current ? 'page' : undefined}>
      {navLabel(route)}
    </a>
  );
}

/** Header dropdown listing every page. A <details> element, so the links
 *  exist in the prerendered HTML even while the menu is closed. */
export function ToolsMenu({ currentPath }: { currentPath: string }) {
  const ref = useRef<HTMLDetailsElement>(null);

  // <details> only closes when its summary is clicked. Close it on an outside
  // click or Escape too, like any other menu.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    }
    function onKeyDown(e: KeyboardEvent) {
      const el = ref.current;
      if (e.key === 'Escape' && el?.open) {
        el.open = false;
        el.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <details className="tools-menu" ref={ref}>
      <summary className="button-tertiary" title="All tools">
        <LayoutGrid size={14} />
        <span>Tools</span>
        <ChevronDown size={12} className="tools-menu-chevron" />
      </summary>
      <nav className="tools-menu-panel" aria-label="All tools">
        {GROUPS.map((group) => (
          <div key={group.heading} className="tools-menu-group">
            <div className="tools-menu-heading">{group.heading}</div>
            {group.routes.map((route) => (
              <ToolLink key={route.path} route={route} currentPath={currentPath} />
            ))}
          </div>
        ))}
      </nav>
    </details>
  );
}

/** The full tool list below the editor, so every page links to every other. */
export function ToolDirectory({ currentPath }: { currentPath: string }) {
  return (
    <nav className="tool-directory" aria-labelledby="tool-directory-title">
      <h2 id="tool-directory-title">All JSON tools</h2>
      <div className="tool-directory-groups">
        {GROUPS.map((group) => (
          <section key={group.heading} className="tool-directory-group">
            <h3>{group.heading}</h3>
            <ul>
              {group.routes.map((route) => (
                <li key={route.path}>
                  <ToolLink route={route} currentPath={currentPath} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
