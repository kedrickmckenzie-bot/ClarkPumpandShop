import type { OrganizationScope } from "./repository";
export type TaskKind = "general" | "camera" | "equipment";
export type TaskAssignment = "person" | "responsible" | "local";
export type TaskResult = "done" | "attention" | "unable";
export type TaskView = "mine" | "shared" | "waiting" | "history" | "all";
export interface CameraWindow { start: string; end: string; area: string; }
export interface CameraFinding { start: string; end: string; result: "matches" | "different" | "partial" | "unavailable"; notes: string; }
export interface StoreTask {
 id:string; organizationId:string; storeId:string; title:string; instructions:string;
 kind:TaskKind; assignment:TaskAssignment; assigneeId:string|null; claimantId:string|null;
 requesterId:string; fallbackId:string; status:"open"|"review"|"closed";
 priority:"routine"|"urgent"; dueAt:string; notifyRequester:number;
 workOrderId:string|null; invoiceId:string|null; visitId:string|null; assetId:string|null;
 windowsJson:string; result:TaskResult|null; version:number; createdAt:string; updatedAt:string;
}
export interface TaskPerson { id:string; name:string; role:string; local:boolean; }
export interface TaskMessage { id:string; organizationId:string; taskId:string; actorId:string; actorName:string; kind:string; body:string; findingsJson:string; createdAt:string; }
export interface TaskParticipant { id:string; organizationId:string; taskId:string; membershipId:string; seenAt:string; }
export interface TaskAccess { membershipId:string; supervisor:boolean; local:boolean; }
export interface TaskQuery extends TaskAccess { view:TaskView; storeId?:string; sourceId?:string; search?:string; offset?:number; limit?:number; now:string; }
export interface TaskRow extends StoreTask { storeNumber:string; storeName:string; timeZone?:string; handlerName:string; requesterName:string; fallbackName:string; newReply:number; }
export interface TaskPage { items:TaskRow[]; totalCount:number; }
export interface TaskRepository {
 getStoreTask(org:string,id:string):Promise<StoreTask|null>;
 listTaskPeople(org:string,storeId:string,search:string,localOnly?:boolean):Promise<TaskPerson[]>;
 listTaskMessages(org:string,id:string,offset?:number,kind?:string):Promise<TaskMessage[]>;
 listTaskParticipants(org:string,id:string):Promise<TaskParticipant[]>;
 queryStoreTasks(scope:OrganizationScope,query:TaskQuery):Promise<TaskPage>;
}
export const taskRoles = ["executive","facilities","regional","store_manager","finance"] as const;
export const taskRoleLabels:Record<string,string>={executive:"Company leadership",facilities_admin:"Facilities manager",regional_manager:"District / regional manager",field_manager:"Field manager",store_manager:"Store manager",store_employee:"Store team",internal_technician:"Internal maintenance",finance_reviewer:"Finance"};
export const taskViewLabels:Record<TaskView,string>={mine:"My tasks",shared:"Shared tasks",waiting:"Waiting on others",history:"History",all:"All visible tasks"};
