import { type IconProps, SvgIcon } from './svg-icon';

export function ChevronRight(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m9 18 6-6-6-6" />
    </SvgIcon>
  );
}
