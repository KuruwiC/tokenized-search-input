import { Check } from '../icons/check';
import type { EnumValue } from '../types';
import { getEnumIcon, getEnumLabel, getEnumValue } from '../utils/enum-value';

interface ValueSuggestionItemProps {
  item: EnumValue;
  /** The value the token holds, which is marked in the list. */
  currentValue: string;
}

/** What an option of a value suggestion shows. */
export const ValueSuggestionItem: React.FC<ValueSuggestionItemProps> = ({ item, currentValue }) => {
  const displayValue = getEnumLabel(item);
  const icon = getEnumIcon(item);
  return (
    <>
      <span className="tsi-value-check">
        {getEnumValue(item) === currentValue && <Check className="tsi-value-check-icon" />}
      </span>
      <span className="tsi-value-label" title={displayValue}>
        {icon && <span className="tsi-icon-slot">{icon}</span>}
        {displayValue}
      </span>
    </>
  );
};
