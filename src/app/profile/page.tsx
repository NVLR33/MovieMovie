import { getOverview } from '@/lib/data';
import MovieGoApp from '@/components/movie-go-app';
export const dynamic='force-dynamic';
// [PAGE:ROUTES] Direct links to catalog, profiles, games, and film details.
export default async function RoutedPage(){const films=await getOverview();return <MovieGoApp initialFilms={films}/>;}
