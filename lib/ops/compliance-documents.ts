import type { StoredFile } from "./types";
import { OpsDomainError } from "./commands";

export function masterDocuments(source:{masterDocumentsJson?:string;organizationId:string}):StoredFile[] {
  const files:StoredFile[]=JSON.parse(source.masterDocumentsJson??"[]");
  return files.filter(f=>f.organizationId===source.organizationId&&f.status==="available");
}
export function masterDocumentSnapshot(files:StoredFile[],organizationId:string) {
  if(files.length>5||files.reduce((sum,f)=>sum+f.byteLength,0)>8*1024*1024||files.some(f=>f.organizationId!==organizationId||f.status!=="available"||!Number.isSafeInteger(f.byteLength)||f.byteLength<=0||!/^[a-f0-9]{64}$/.test(f.sha256)))throw new OpsDomainError("VALIDATION","Attach up to five valid instruction files, 8 MB total.");
  return JSON.stringify(files);
}
