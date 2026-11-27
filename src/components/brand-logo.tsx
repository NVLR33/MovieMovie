import Image from 'next/image';
import { BRAND_NAME } from '@/lib/brand';
import logo from '../../public/brand/moviemovie-logo.png';

/** Supplied artwork, navigation crop of the original letters and nearby glow. */
export default function BrandLogo({
  className = '',
  sizes = '160px',
  priority = false,
}: {
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={logo}
      alt={BRAND_NAME}
      className={`brand-logo ${className}`}
      sizes={sizes}
      priority={priority}
    />
  );
}
