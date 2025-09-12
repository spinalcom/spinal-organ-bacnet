import { EventEmitter } from "events";
import { SpinalDisoverModel } from 'spinal-model-bacnet';
declare class Discover extends EventEmitter {
    private _discoverQueue;
    private _isProcess;
    private static instance;
    private constructor();
    static getInstance(): Discover;
    addToQueue(model: SpinalDisoverModel): void;
    private _listenEvent;
    private _discoverNext;
}
export declare const spinalDiscover: Discover;
export default spinalDiscover;
