import { AsyncSection } from './sections/async';
import { FeaturesSection } from './sections/features';
import { Hero } from './sections/hero';
import { PatternsSection } from './sections/patterns';
import { QuickStartSection } from './sections/quick-start';
import { ReferenceSection } from './sections/reference';
import { SiteFooter } from './sections/site-footer';
import { SiteHeader } from './sections/site-header';
import { StylingSection } from './sections/styling';

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />

      <main id="main">
        <Hero />
        <QuickStartSection />
        <PatternsSection />
        <StylingSection />
        <AsyncSection />
        <FeaturesSection />
        <ReferenceSection />
      </main>

      <SiteFooter />
    </>
  );
}
