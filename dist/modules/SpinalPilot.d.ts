import { SpinalPilotModel } from "spinal-model-bacnet";
declare class SpinalPilot {
    private queue;
    private isProcessing;
    private static instance;
    private constructor();
    static getInstance(): SpinalPilot;
    private init;
    addToPilotList(spinalPilotModel: SpinalPilotModel): Promise<void>;
    private pilot;
    private _handlePilot;
}
declare const spinalPilot: SpinalPilot;
export default spinalPilot;
export { spinalPilot };
