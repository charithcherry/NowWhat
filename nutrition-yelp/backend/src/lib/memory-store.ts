export interface FavoriteEntry {
  userId: string;
  restaurantId: string;
  restaurantName: string;
  categories: any[];
  location: string;
  timestamp: Date;
}

export interface ClickEntry {
  userId: string;
  restaurantId: string;
  restaurantName: string;
  action: string;
  timestamp: Date;
}

const globalStore = global as typeof globalThis & {
  _memFavorites?: FavoriteEntry[];
  _memClicks?: ClickEntry[];
};

if (!globalStore._memFavorites) globalStore._memFavorites = [];
if (!globalStore._memClicks) globalStore._memClicks = [];

export const memoryFavorites: FavoriteEntry[] = globalStore._memFavorites;
export const memoryClicks: ClickEntry[] = globalStore._memClicks;
