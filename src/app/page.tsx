import { getOverview } from '@/lib/data';
import MovieGoApp from '@/components/movie-go-app';
export const dynamic='force-dynamic';
// [PAGE:HOME] Server-seeded app shell.
export default async function HomePage(){const films=await getOverview();return <MovieGoApp initialFilms={films}/>;}
