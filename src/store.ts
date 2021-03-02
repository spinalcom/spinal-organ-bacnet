import { store } from "spinal-core-connectorjs";
import { SpinalNode } from "spinal-env-viewer-graph-service";


interface IStore {
   [key: string]: SpinalNode<any>
}

class SpinalStore {
   private store: IStore;

   constructor(store) {
      this.store = store;
   }

   public set(key: string, value: SpinalNode<any>): void {
      if (typeof key !== "string" || !(value instanceof SpinalNode)) {
         throw new Error("invalid type the key must be a string and value a SpinalNode");
      }

      if (!(this.store.hasOwnProperty(key))) {
         this.store[key] = value;
      }
   }

   public get(key: string): SpinalNode<any> {
      if (typeof key !== "string") throw new Error("the key must be a string");

      return this.store[key];
   }

   public remove(key: string): boolean {
      if (typeof key !== "string") throw new Error("the key must be a string");

      return delete this.store[key];
   }

   public clear() {
      this.store = {}
   }

}

const spinalStore = new SpinalStore({});

export { spinalStore }
export default spinalStore;