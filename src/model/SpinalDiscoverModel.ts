import { spinalCore, Model, Ptr, Lst } from 'spinal-core-connectorjs_type';
import { STATES } from "../utilities/stateEnum";

class SpinalDisoverModel extends Model {
   constructor(graph, contextInfo, network) {
      super();

      // if (!this.graph.info.discover) {

      //    this.graph.info.add_attr({
      //       discover: new Ptr(new Lst())
      //    })
      // }

      this.add_attr({
         state: STATES.reseted,
         graph: new Ptr(graph),
         devices: new Lst(),
         context: contextInfo,
         network: network
      })
   }
}


spinalCore.register_models([SpinalDisoverModel])
export default SpinalDisoverModel;
export { SpinalDisoverModel }