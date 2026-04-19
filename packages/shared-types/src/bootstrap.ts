import type { Category } from "./product";

export type SiteImageSetting = {
  imageUrl?: string;
};

export type BootstrapPayload = {
  hero: SiteImageSetting;
  logo: SiteImageSetting;
  categories: Category[];
};
