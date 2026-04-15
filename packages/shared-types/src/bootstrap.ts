import type { Category } from "./product";

export interface SiteImageSetting {
  imageUrl?: string;
}

export interface BootstrapPayload {
  hero: SiteImageSetting;
  logo: SiteImageSetting;
  categories: Category[];
}
