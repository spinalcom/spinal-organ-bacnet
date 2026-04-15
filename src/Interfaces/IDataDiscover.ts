import { NetworkService } from "spinal-model-bmsnetwork";
import { SpinalContext, SpinalGraph, SpinalNode } from "spinal-model-graph";


export interface IDataDiscover {
   // networkService: NetworkService;
   network: SpinalNode;
   graph: SpinalNode;
   organ: SpinalNode;
   context: SpinalContext;
}