import { SpinalOrganConfigModel } from "spinal-model-bacnet";
export declare const connectionErrorCallback: (err?: Error) => void;
export declare const CreateOrganConfigFile: (spinalConnection: any, path: string, connectorName: string) => Promise<SpinalOrganConfigModel>;
export declare const GetPm2Instance: (organName: string) => Promise<unknown>;
export declare const SpinalDiscoverCallback: (spinalDisoverModel: any, organModel: any) => Promise<void | boolean>;
export declare const SpinalBacnetValueModelCallback: (spinalBacnetValueModel: any, organModel: any) => Promise<void | boolean>;
export declare const SpinalListnerCallback: (spinalListenerModel: any, organModel: any) => Promise<void>;
export declare const SpinalPilotCallback: (spinalPilotModel: any, organModel: any) => Promise<void>;
