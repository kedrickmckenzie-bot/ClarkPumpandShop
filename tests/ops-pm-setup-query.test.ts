import { DatabaseSync,type SQLInputValue } from "node:sqlite";
import { readFileSync,readdirSync } from "node:fs";
import { expect,it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { pmSetupFromFixture,type PmSetupQuery } from "@/lib/ops/pm-setup-query";
import type { OpsSqlDriver,SqlRow } from "@/lib/ops/sql-driver";

it("pages full PM coverage without duplicate targets or turning unknown equipment rules into store-wide work",async()=>{
  const fixture=buildNorthlinePresentationFixture(),organizationId=fixture.organizations[0].id,store=fixture.stores[0],scope={organizationId,storeIds:[store.id]},base=fixture.maintenancePrograms[0];
  const plan=fixture.pmPlans.find(p=>p.storeId===store.id&&p.programId===base.id)!;
  for(let i=0;i<230;i++){
    const id=`pm-setup-density-${String(229-i).padStart(3,"0")}`;
    fixture.maintenancePrograms.push({...base,id,programKey:id,name:id});
    if(i%2===0)fixture.pmPlans.push({...plan,id:`plan-${id}`,programId:id});
  }
  const categoryProgram = { ...base, id: "pm-store-category", programKey: "pm-store-category", applicableAssetTypes: ["store_category:hvac"] };
  fixture.maintenancePrograms.push(categoryProgram);
  fixture.pmPlans.push({ ...plan, id: "pm-category-store-plan", programId: categoryProgram.id, assetId: undefined, categoryKey: "hvac", assetSelectionRule: JSON.stringify({ kind: "store_category", categoryKey: "hvac", includedAssetIds: [], excludedAssetIds: [] }) });
  const unknown={...base,id:"pm-unknown-rule",programKey:"pm-unknown-rule",name:"Unknown equipment",applicableAssetTypes:["unknown-equipment!*"]};
  const alias={...base,id:"pm-alias-rule",programKey:"pm-alias-rule",name:"Alias equipment",applicableAssetTypes:[" 5 TON!!PACKAGED ROOFTOP UNIT "]};
  fixture.maintenancePrograms.push(unknown,alias);
  const storeProgram=fixture.maintenancePrograms.find(p=>p.applicableAssetTypes.length===0)!;
  const storePlan=fixture.pmPlans.find(p=>p.programId===storeProgram.id&&p.storeId===store.id)!;
  fixture.pmPlans.push({...storePlan,id:"pm-duplicate-store-enrollment"});
  const db=new DatabaseSync(":memory:"),sizes:number[]=[];
  const driver:OpsSqlDriver={dialect:"sqlite",async query<Row extends SqlRow>(statement:{sql:string;params:readonly unknown[]}){const rows=db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[];sizes.push(rows.length);return {rows,affectedRows:0};},async atomic(){throw new Error("Read cannot mutate");}};
  const repository=createOpsSqlRepository(driver,"d1");
  try{
    db.exec("PRAGMA foreign_keys=ON");for(const file of readdirSync("drizzle").filter(file=>/^\d.*\.sql$/.test(file)).sort())db.exec(readFileSync(`drizzle/${file}`,"utf8"));
    for(const statement of buildOpsSeedStatements(fixture))db.prepare(statement.sql).run(...statement.params.map(v=>typeof v==="boolean"?Number(v):v??null) as SQLInputValue[]);
    for(const kind of ["programs","targets","plans"] as const){
      const seen:string[]=[];let offset=0,total=0;
      do{
        const query:PmSetupQuery={asOf:fixture.asOf,kind,limit:25,offset};const page=await repository.listPmSetup(scope,query);
        expect(page).toEqual(pmSetupFromFixture(fixture,scope,query));seen.push(...page.items.map(r=>r.id));total=page.totalCount;
        if(page.nextOffset===undefined)break;offset=page.nextOffset;if(offset>1000)throw new Error("Pagination did not advance");
      }while(offset<=1000);
      expect(seen).toHaveLength(total);expect(new Set(seen).size).toBe(total);
      expect((await repository.listPmSetup(scope,{asOf:fixture.asOf,kind,limit:25,offset:10000})).totalCount).toBe(total);
    }
    const query:PmSetupQuery={asOf:fixture.asOf,kind:"programs",program:unknown.id,limit:25};
    expect((await repository.listPmSetup(scope,query)).items[0]).toMatchObject({storeLevel:false,matchedTypes:0,targets:0,covered:0});
    expect((await repository.listPmSetup(scope,{...query,program:alias.id})).items[0].targets).toBeGreaterThan(0);
    expect((await repository.listPmSetup(scope,{...query,kind:"targets",program:storeProgram.id})).items[0]).toMatchObject({targets:1,covered:1,plans:2,gaps:0});
    for(const asset of ["store",plan.assetId!,"missing"]){const q:PmSetupQuery={asOf:fixture.asOf,kind:"plans",asset,limit:25};expect(await repository.listPmSetup(scope,q)).toEqual(pmSetupFromFixture(fixture,scope,q));}
    for(const denied of [{organizationId,storeIds:[]},{organizationId,regionIds:[]},{organizationId:"foreign"}])expect((await repository.listPmSetup(denied,{asOf:fixture.asOf,kind:"targets",limit:25})).totalCount).toBe(0);
    const otherAsset=fixture.assets.find(a=>a.storeId!==store.id&&!fixture.pmPlans.some(p=>p.programId===base.id&&p.assetId===a.id))!;
    db.prepare("UPDATE ops_pm_plans SET asset_id=? WHERE id=?").run(otherAsset.id,plan.id);plan.assetId=otherAsset.id;
    const damaged=await repository.listPmSetup(scope,{asOf:fixture.asOf,kind:"plans",program:base.id,limit:25});
    expect(damaged.items.find(p=>p.id===plan.id)).toMatchObject({hasAssetReference:true,assetId:undefined,assetName:undefined});
    expect((await repository.listPmSetup(scope,{asOf:fixture.asOf,kind:"targets",program:base.id,filter:"gaps",limit:25})).items).toHaveLength(1);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(25);
  }finally{db.close();}
},30000);
