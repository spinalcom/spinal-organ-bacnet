import { SpinalOrganConfigModel } from "spinal-model-bacnet";
import * as pm2 from "pm2";
export declare function bindAllModels(organModel: SpinalOrganConfigModel): void;
export declare const GetPm2Instance: (organName: string) => Promise<pm2.ProcessDescription | undefined>;
export declare function restartProcessById(instanceId: string | number): Promise<boolean>;
export declare function loadPtrValue(ptrModel: spinal.Ptr): Promise<any>;
