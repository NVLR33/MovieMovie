import { getOverview } from '@/lib/data';
import MovieGoApp from '@/components/movie-go-app';
export const dynamic='force-dynamic';
export default async function RoutedPage(){const films=await getOverview();return <MovieGoApp initialFilms={films}/>;}
