import Image from 'next/image';
import logo from '../../public/brand/moviemovie-logo.png';

/** Original artwork, cropped to remove transparent margins without changing its pixels. */
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
      alt="moviemovie"
      className={`brand-logo ${className}`}
      sizes={sizes}
      priority={priority}
    />
  );
}
