import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'outline' | 'neutral' | 'ghost';
type Size = 'large' | 'medium' | 'small';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export default function Button({
  variant = 'primary',
  size = 'medium',
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${styles.base} ${styles[variant]} ${styles[size]} ${className}`}
      {...rest}
    />
  );
}
