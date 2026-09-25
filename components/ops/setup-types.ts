export interface SetupOption {
  value: string;
  label: string;
  description?: string;
}

export interface SetupPageContext {
  title: string;
  eyebrow: string;
  description: string;
  scopeLabel: string;
  submitAction: string;
  cancelHref: string;
  cancelLabel: string;
}

export interface CreateAssetSetupModel extends SetupPageContext {
  stores: SetupOption[];
  categories: SetupOption[];
  groupPaths: SetupOption[];
  statusOptions: SetupOption[];
  defaultStoreId?: string;
}

export interface AddComponentSetupModel extends SetupPageContext {
  assetId: string;
  assetName: string;
  assetTag: string;
  storeLabel: string;
  parents: SetupOption[];
  defaultParentId?: string;
}

export interface CreatePmSetupModel extends SetupPageContext {
  stores: SetupOption[];
  assets: SetupOption[];
  categories: SetupOption[];
  defaultStoreId?: string;
  defaultAssetId?: string;
  defaultCategoryKey?: string;
}

export interface CreatePmProgramSetupModel extends SetupPageContext {
  defaultStoreIds?: string[];
  initial?: { programId: string; name: string; categoryKey: string; storeIds: string[]; cadenceDays: number; completionWindowDays: number; firstDueAt: string; checklist: string };
  categories: SetupOption[];
  stores: Array<SetupOption & { region?: string; equipmentCounts: Record<string, number> }>;
  equipmentTypes: SetupOption[];
}

export interface PmPlanScheduleSetupModel extends SetupPageContext {
  editScheduleHref?: string;
  coverage?: { categoryKey: string; assets: Array<{ id: string; name: string; categoryKey: string; included: boolean }>; active: boolean };
  instructions?: string;
  preferredVendorId?: string;
  vendors?: SetupOption[];
  planId: string;
  planName: string;
  storeLabel: string;
  assetLabel: string;
  masterProgramName?: string;
  masterCadenceDays?: number;
  masterWindowDays?: number;
  cadenceDays: number;
  completionWindowDays: number;
  overrideReason?: string;
}
