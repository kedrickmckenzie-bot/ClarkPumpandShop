import { cachedDateTimeFormat } from "@/lib/ops/intl-format-cache";
import {OpsDomainError} from "./errors";
import {localDateTimeToIso} from "./local-date-time";
import {operationsTimeZone} from "./local-time";
export function cameraTime(value:string):string {
 if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {localDateTimeToIso(value,"UTC");return value;}
 // Older task records used instants. Preserve them without rewriting evidence.
 if (/Z$|[+-]\d{2}:\d{2}$/.test(value)&&Number.isFinite(Date.parse(value)))return new Date(value).toISOString();
 throw new OpsDomainError("VALIDATION","Enter a valid camera date and time.");
}
export function cameraInput(value:string,timeZone?:string):string {
 if(!value)return "";
 if(value.length===16)return value;
 const parts=Object.fromEntries(cachedDateTimeFormat("en-CA",{timeZone:operationsTimeZone(timeZone),year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function formatCameraTime(value:string,timeZone?:string):string {
 const wall=cameraInput(value,timeZone);
 return cachedDateTimeFormat("en-US",{timeZone:"UTC",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(wall+":00Z"));
}
export const cameraResultLabels={matches:"Matches the request",different:"Doesn’t match",partial:"Partly confirmed",unavailable:"No footage available"};
