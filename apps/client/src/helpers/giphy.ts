const BASE = 'https://api.giphy.com/v1/gifs';

let giphyApiKey: string | undefined;

export const setGiphyApiKey = (key: string | undefined) => {
  giphyApiKey = key;
};

export type TGiphyImage = {
  url: string;
  width: string;
  height: string;
};

export type TGiphyGif = {
  id: string;
  title: string;
  images: {
    fixed_width: TGiphyImage;
    original: TGiphyImage;
  };
};

type TGiphyResponse = {
  data: TGiphyGif[];
  pagination: {
    total_count: number;
    count: number;
    offset: number;
  };
};

export const searchGifs = async (
  query: string,
  offset = 0,
  limit = 20
): Promise<TGiphyResponse> => {
  const res = await fetch(
    `${BASE}/search?api_key=${giphyApiKey}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&rating=g`
  );
  return res.json();
};

export const trendingGifs = async (
  offset = 0,
  limit = 20
): Promise<TGiphyResponse> => {
  const res = await fetch(
    `${BASE}/trending?api_key=${giphyApiKey}&limit=${limit}&offset=${offset}&rating=g`
  );
  return res.json();
};

export const isGiphyEnabled = () => !!giphyApiKey;
