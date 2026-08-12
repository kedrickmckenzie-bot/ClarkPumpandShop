import type {
  IsoDateTime,
  Asset,
  AssetComponent,
  Division,
  OpsFixture,
  OpsId,
  Membership,
  PageRequest,
  ServiceRequest,
  Store,
  TaxonomyNode,
  Organization,
  Vendor,
  VisitSession,
  WorkOrder,
  WorkOrderAssignment,
  WorkOrderIssuance,
} from "./types";
import type {
  ActiveVisitView,
  AssetDetailView,
  ExceptionQueuePage,
  ExecutiveSnapshotView,
  PmOccurrencePage,
  PublicStoreGatewayView,
  RequestListPage,
  ServiceAuthorizationView,
  StoreSearchPage,
  StoreDetailView,
  StoreVisitContextView,
  TrustedStoreActiveVisitRow,
  TrustedStoreDeviceView,
  VendorDirectoryPage,
  VisitListPage,
  WorkOrderDetailView,
  WorkOrderListPage,
} from "./view-models";

export interface OrganizationScope {
  organizationId: OpsId;
  regionIds?: readonly OpsId[];
  storeIds?: readonly OpsId[];
}

export interface WorkOrderListQuery extends PageRequest {
  search?: string;
  statuses?: readonly string[];
  priorities?: readonly string[];
  vendorId?: OpsId;
  storeId?: OpsId;
  regionId?: OpsId;
  createdFrom?: IsoDateTime;
  createdTo?: IsoDateTime;
}

export interface ExceptionQueueQuery extends PageRequest {
  statuses?: readonly string[];
  kinds?: readonly string[];
  storeId?: OpsId;
  vendorId?: OpsId;
}

export interface PublicTokenLookup {
  tokenHash: string;
  purpose: string;
  now: IsoDateTime;
  vendorId?: OpsId;
}

export interface OpsStatement {
  sql: string;
  params: readonly unknown[];
}

export interface OpsRepository {
  readonly kind: "d1" | "fixture";

  // Internal record lookups used by domain commands. Organization is always
  // the first filter and is never inferred from a record id.
  getOrganization(organizationId: OpsId): Promise<Organization | null>;
  getDivision(organizationId: OpsId, divisionId: OpsId): Promise<Division | null>;
  getTaxonomyNode(organizationId: OpsId, taxonomyNodeId: OpsId): Promise<TaxonomyNode | null>;
  listTaxonomyNodes(organizationId: OpsId): Promise<TaxonomyNode[]>;
  getStore(organizationId: OpsId, storeId: OpsId): Promise<Store | null>;
  getVendor(organizationId: OpsId, vendorId: OpsId): Promise<Vendor | null>;
  getMembership(organizationId: OpsId, membershipId: OpsId): Promise<Membership | null>;
  getRequest(organizationId: OpsId, requestId: OpsId): Promise<ServiceRequest | null>;
  getWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<WorkOrder | null>;
  getAsset(organizationId: OpsId, assetId: OpsId): Promise<Asset | null>;
  getComponent(organizationId: OpsId, componentId: OpsId): Promise<AssetComponent | null>;
  getAssignment(organizationId: OpsId, assignmentId: OpsId): Promise<WorkOrderAssignment | null>;
  getIssuance(organizationId: OpsId, issuanceId: OpsId): Promise<WorkOrderIssuance | null>;
  getVisit(organizationId: OpsId, visitId: OpsId): Promise<VisitSession | null>;
  getActiveAssignment(organizationId: OpsId, workOrderId: OpsId): Promise<WorkOrderAssignment | null>;
  getLatestIssuanceForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<WorkOrderIssuance | null>;
  getLatestVendorResponse(organizationId: OpsId, assignmentId: OpsId): Promise<import("./types").VendorResponse | null>;
  findActiveVendorAssignment(organizationId: OpsId, workOrderId: OpsId, vendorId: OpsId): Promise<WorkOrderAssignment | null>;
  findActiveInternalAssignment(organizationId: OpsId, workOrderId: OpsId, membershipId: OpsId): Promise<WorkOrderAssignment | null>;
  vendorCoversStore(organizationId: OpsId, vendorId: OpsId, storeId: OpsId): Promise<boolean>;
  findActiveVisit(organizationId: OpsId, storeId: OpsId, provider: { vendorId?: OpsId; internalMembershipId?: OpsId; technicianName: string }): Promise<VisitSession | null>;
  listActiveVisitsForStore(organizationId: OpsId, storeId: OpsId): Promise<TrustedStoreActiveVisitRow[]>;
  allocateWorkOrderNumber(organizationId: OpsId, prefix: string, year: number): Promise<string>;

  // Manager-first, server-scoped read models.
  searchStores(scope: OrganizationScope, search: string, page?: PageRequest): Promise<StoreSearchPage>;
  getStoreDetail(scope: OrganizationScope, storeId: OpsId): Promise<StoreDetailView | null>;
  listRequests(scope: OrganizationScope, query?: PageRequest & { status?: string; storeId?: OpsId }): Promise<RequestListPage>;
  listWorkOrders(scope: OrganizationScope, query?: WorkOrderListQuery): Promise<WorkOrderListPage>;
  getWorkOrderDetail(scope: OrganizationScope, workOrderId: OpsId): Promise<WorkOrderDetailView | null>;
  listVendors(scope: OrganizationScope, search?: string, page?: PageRequest): Promise<VendorDirectoryPage>;
  listVisits(scope: OrganizationScope, query?: PageRequest & { status?: string; storeId?: OpsId; vendorId?: OpsId }): Promise<VisitListPage>;
  listExceptions(scope: OrganizationScope, query?: ExceptionQueueQuery): Promise<ExceptionQueuePage>;
  getAssetDetail(scope: OrganizationScope, assetId: OpsId): Promise<AssetDetailView | null>;
  listPmOccurrences(scope: OrganizationScope, query?: PageRequest & { status?: string; storeId?: OpsId }): Promise<PmOccurrencePage>;
  getExecutiveSnapshot(
    scope: OrganizationScope,
    period: { startsAt: IsoDateTime; endsAt: IsoDateTime },
  ): Promise<ExecutiveSnapshotView>;

  // Public workflows resolve an opaque token first, then return a deliberately
  // narrow projection. A public token never grants arbitrary repository reads.
  getPublicStoreGatewayByToken(input: PublicTokenLookup): Promise<PublicStoreGatewayView | null>;
  getServiceAuthorizationByToken(input: PublicTokenLookup): Promise<ServiceAuthorizationView | null>;
  getStoreVisitContextByToken(input: PublicTokenLookup): Promise<StoreVisitContextView | null>;
  getActiveVisitByToken(input: PublicTokenLookup): Promise<ActiveVisitView | null>;
  getTrustedStoreDeviceByToken(input: PublicTokenLookup): Promise<TrustedStoreDeviceView | null>;

  // D1 batch is transactional. Fixture repositories apply the same statement
  // list atomically to a cloned fixture before committing it.
  atomicWrite(statements: readonly OpsStatement[]): Promise<void>;
}

export interface MutableOpsFixtureRepository extends OpsRepository {
  readonly kind: "fixture";
  snapshot(): OpsFixture;
}
