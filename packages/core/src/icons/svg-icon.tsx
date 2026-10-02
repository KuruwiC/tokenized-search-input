import type { ReactNode, SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'width' | 'height'> {
  /** Width and height in pixels. Defaults to 24. */
  size?: number | string;
}

interface SvgIconProps extends IconProps {
  children: ReactNode;
}

/** Decorative icon, hidden from assistive technology. */
export function SvgIcon({ size = 24, children, ...rest }: SvgIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}
