import type { PageRequest } from "./types";
export interface ComplianceSchedule {
  masterDocumentsJson?:string;
  id:string; organizationId:string; storeId:string; name:string; instructions:string; requirementSource:string; evidenceLabel:string; assetId?:string; kind:"inspection"|"permit"; escalationDays:number; escalationTo:string;
  firstDueDate:string; intervalUnit:"once"|"days"|"months"; intervalCount:number; leadDays:number;
  handler:"internal"|"vendor"; membershipId?:string; vendorId?:string;
  evidenceRequired:number; status:"active"|"paused"; createdAt:string;
}
export interface Inspection {
  masterDocumentsJson?:string;
  id:string; organizationId:string; scheduleId:string; storeId:string; dueDate:string;
  status:"pending"|"performed"|"passed"|"action_needed"; workOrderId?:string; correctiveWorkOrderId?:string; documentExpiresOn?:string;
  completedAt?:string; resultNote?:string; version:number; createdAt:string;
}
export type InspectionView = "all"|"upcoming"|"overdue"|"pending"|"passed"|"action_needed"|"performed"|"missing_docs"|"expiring"|"due30"|"due60"|"due90"|"scheduled";
export interface InspectionQuery extends PageRequest { today:string; view?:InspectionView; storeId?:string; scheduleId?:string; }
export interface InspectionRow extends Inspection { name:string; storeNumber:string; storeName:string; handler:string; evidenceCount:number; evidenceLabel:string; lastCompleted?:string; scheduledAt?:string; assignedName:string; }
export interface InspectionPage { items:InspectionRow[]; totalCount:number; summary:Record<InspectionView,number>; }
export const inspectionViews:InspectionView[]=["all","upcoming","overdue","pending","passed","action_needed","performed","missing_docs","expiring","due30","due60","due90","scheduled"];
export function matchesInspection(row:Inspection & {evidenceCount?:number;evidenceRequired?:number;scheduledAt?:string},view:InspectionView,today:string) {
  if(view==="all")return true;
  if(view==="scheduled")return row.status==="pending"&&Boolean(row.scheduledAt);
  const days=(Date.parse(row.dueDate)-Date.parse(today))/86400000;
  if(view.startsWith("due"))return row.status!=="passed"&&days>=0&&days<=Number(view.slice(3));
  if(view==="missing_docs")return row.status==="performed"&&Boolean(row.evidenceRequired)&&!row.evidenceCount;
  if(view==="expiring")return Boolean(row.documentExpiresOn&&row.documentExpiresOn>=today&&Date.parse(row.documentExpiresOn)<=Date.parse(today)+30*86400000);
  if(view==="upcoming")return row.status==="pending" && row.dueDate>today;
  if(view==="overdue")return row.status!=="passed" && row.dueDate<today;
  return row.status===view;
}
