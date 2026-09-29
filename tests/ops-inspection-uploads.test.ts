import {beforeEach,describe,expect,it,vi} from "vitest";
const {getStore}=vi.hoisted(()=>({getStore:vi.fn()}));
vi.mock("@/components/ops-public/server-file-store",()=>({getQuoteUploadStore:getStore}));
import {uploadInspectionFiles} from "@/lib/server/inspection-uploads";
beforeEach(()=>{getStore.mockReset();});
describe("optional evidence uploads",()=>{
 it("does not initialize missing S3 configuration for an empty task upload",async()=>{
  getStore.mockImplementation(()=>{throw new Error("S3_ENDPOINT is not configured");});
  const f=new FormData();f.append("files",new File([],"",{type:"application/octet-stream"}));
  expect(await uploadInspectionFiles(f,"files","org","task",false,"store_task")).toEqual([]);
  expect(getStore).not.toHaveBeenCalled();
 });
 it("explains a real attachment failure without saving phantom files",async()=>{
  getStore.mockImplementation(()=>{throw new Error("S3_ENDPOINT is not configured");});
  const log=vi.spyOn(console,"error").mockImplementation(()=>{});
  try {const f=new FormData();f.append("files",new File(["evidence"],"note.txt",{type:"text/plain"}));await expect(uploadInspectionFiles(f,"files","org","task",false,"store_task")).rejects.toMatchObject({code:"VALIDATION",message:expect.stringContaining("remove the attachments")});}finally{log.mockRestore();}
 });
});
