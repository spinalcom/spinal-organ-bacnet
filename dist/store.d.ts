import { SpinalNode } from "spinal-env-viewer-graph-service";
declare class SpinalStore {
    private store;
    constructor(store: any);
    set(key: string, value: SpinalNode<any>): void;
    get(key: string): SpinalNode<any>;
    remove(key: string): boolean;
    clear(): void;
}
declare const spinalStore: SpinalStore;
export { spinalStore };
export default spinalStore;
