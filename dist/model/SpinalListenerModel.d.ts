import { Model } from 'spinal-core-connectorjs_type';
import { SpinalGraph } from 'spinal-model-graph';
declare class SpinalListenerModel extends Model {
    constructor(graph: SpinalGraph<any>, context: any, network: any, deviceId: string, timeInterval?: number);
}
export default SpinalListenerModel;
export { SpinalListenerModel };
