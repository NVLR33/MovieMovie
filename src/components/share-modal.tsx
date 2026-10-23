type ShareContent = {
  type: 'movie' | 'collection' | 'wrapped' | 'achievement' | 'profile';
  title: string;
  description?: string;
  url: string;
  image?: string;
};
