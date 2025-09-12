import { EventEmitter } from "events";
export declare enum Events {
    FINISH = "finish",
    START = "start"
}
export declare class SpinalQueuing<Type> extends EventEmitter {
    private processed;
    private queueList;
    percent: number;
    private length;
    isProcessing: boolean;
    private _debounceStart;
    constructor();
    addToQueue(obj: Type | Type[]): number;
    setQueue(queue: Type[]): number;
    dequeue(): Type;
    refresh(): void;
    getQueue(): Type[];
    isEmpty(): boolean;
    private _begin;
    private _finish;
}
export default SpinalQueuing;
