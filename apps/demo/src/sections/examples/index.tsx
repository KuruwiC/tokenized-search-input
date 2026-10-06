import { AccessibilityExample } from './accessibility';
import { AdornmentsExample } from './adornments';
import { ClassNamesExample } from './class-names';
import { ClipboardExample } from './clipboard';
import { OperatorsExample } from './operators';
import { ThemingExample } from './theming';
import { TokenDisplayExample } from './token-display';
import { ValidationExample } from './validation';

export function FeatureExamples() {
  return (
    <div className="features__list">
      <ThemingExample />
      <ClassNamesExample />
      <ValidationExample />
      <ClipboardExample />
      <AdornmentsExample />
      <TokenDisplayExample />
      <AccessibilityExample />
      <OperatorsExample />
    </div>
  );
}
