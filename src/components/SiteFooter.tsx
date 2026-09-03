import './SiteFooter.css';

// Small persistent footer. Renders during prerender (it sits in App's tree,
// no browser globals) so the outbound link is in the static HTML and carries
// SEO weight.
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>JSON Studio — client-side JSON tools.</span>
      <span className="site-footer-sep">•</span>
      <span>
        Related tool:{' '}
        <a href="https://jwtdev.com" target="_blank" rel="noopener">
          JWT Decoder &amp; Debugger
        </a>
      </span>
    </footer>
  );
}
