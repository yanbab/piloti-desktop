export interface FlatpakAppEntry {
  appId: string;
  name: string;
  version?: string;
  origin?: string;
  installation?: string;
  description?: string;
  iconUrl?: string;
  mainCategories?: string[];
  installed: boolean;
}
