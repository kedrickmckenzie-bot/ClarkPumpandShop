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
