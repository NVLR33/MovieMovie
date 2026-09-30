import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
// [SEO:METADATA]
export const metadata:Metadata={title:'Movie//Go — твоя киновселенная',description:'Смотри, отмечай, оценивай. Твой личный киноархив будущего: фильмы, сериалы и аниме в одном месте.'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="ru"><body>{children}</body></html>;}
