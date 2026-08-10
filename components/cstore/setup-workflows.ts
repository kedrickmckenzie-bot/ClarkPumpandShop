import type {
  Asset,
  AssetComponent,
  MaintenanceCategory,
  PostalAddress,
  Region,
  Store,
  TaxonomyNode,
  WorkOrder,
} from "../../lib/cstore/types";

export type StoreSetupRegion = Pick<Region, "id" | "name" | "code">;

export type StoreSetupCategory = Pick<
  MaintenanceCategory,
  "id" | "key" | "label" | "description" | "color" | "sortOrder"
>;

export type StoreHoursInput =
  | {
      mode: "open_24_hours";
    }
  | {
      mode: "daily_window";
      opensAt: string;
      closesAt: string;
    };

export interface GuidedStoreSetupValue {
  storeNumber: string;
  name: string;
  address: PostalAddress;
  regionId: string;
  format: Store["format"];
  hours: StoreHoursInput;
  starterCategoryIds: string[];
}

export interface WorkClassificationValue {
  workOrderId: string;
  categoryId?: string;
  taxonomyNodeId?: string;
  assetId?: string;
  componentId?: string;
  classificationDeferred: boolean;
}

export type ClassifiableWorkOrder = Pick<
  WorkOrder,
  | "id"
  | "number"
  | "storeId"
  | "title"
  | "problemDescription"
  | "categoryId"
  | "taxonomyNodeId"
  | "assetId"
  | "componentId"
  | "classificationDeferred"
>;

export type ClassificationStore = Pick<
  Store,
  "id" | "storeNumber" | "name" | "activeCategoryIds"
>;

export type ClassificationCategory = Pick<
  MaintenanceCategory,
  "id" | "label" | "description" | "sortOrder"
>;

export type ClassificationTaxonomyNode = Pick<
  TaxonomyNode,
  "id" | "categoryId" | "parentId" | "label" | "kind" | "sortOrder"
>;

export type ClassificationAsset = Pick<
  Asset,
  | "id"
  | "storeId"
  | "categoryId"
  | "taxonomyNodeId"
  | "taxonomyPathIds"
  | "assetCode"
  | "name"
  | "locationDetail"
  | "status"
>;

export type ClassificationComponent = Pick<
  AssetComponent,
  "id" | "assetId" | "parentComponentId" | "name" | "componentCode" | "status"
>;
