import { type IconProps, SvgIcon } from './svg-icon';

export function ChevronLeft(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m15 18-6-6 6-6" />
    </SvgIcon>
  );
}
