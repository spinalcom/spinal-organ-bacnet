import { spinalCore, Model, Ptr } from 'spinal-core-connectorjs_type';
import { SpinalGraph } from 'spinal-model-graph';

class SpinalListenerModel extends Model {
   constructor(graph: SpinalGraph<any>, context: any, network: any, deviceId: string, timeInterval: number = 5000) {
      super();

      this.add_attr({
         graph: new Ptr(graph),
         listen: true,
         timeInterval: timeInterval,
         deviceId: deviceId,
         context: context,
         network: network
      })
   }
}


spinalCore.register_models([SpinalListenerModel])
export default SpinalListenerModel;
export { SpinalListenerModel }