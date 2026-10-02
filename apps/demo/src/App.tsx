import { AsyncSection } from './sections/async';
import { Hero } from './sections/hero';
import { PatternsSection } from './sections/patterns';
import { PlaygroundSection } from './sections/playground';
import { QuickStartSection } from './sections/quick-start';
import { ReferenceSection } from './sections/reference';
import { SiteFooter } from './sections/site-footer';
import { SiteHeader } from './sections/site-header';

export default function App() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />

      <main id="main-content">
        <Hero />
        <PlaygroundSection />
        <QuickStartSection />
        <PatternsSection />
        <AsyncSection />
        <ReferenceSection />
      </main>

      <SiteFooter />
    </div>
  );
}
