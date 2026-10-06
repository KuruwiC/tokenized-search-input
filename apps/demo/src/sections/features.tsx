import { FeatureExamples } from './examples';

export function FeaturesSection() {
  return (
    <section className="section features" id="features" aria-labelledby="features-title">
      <header className="section__head">
        <h2 className="section__title" id="features-title">
          Every option, one at a time
        </h2>
        <p className="section__lede">
          Open a feature to try it with the component's default styles, switch between its variants,
          and copy the code each variant needs.
        </p>
      </header>
      <FeatureExamples />
    </section>
  );
}
