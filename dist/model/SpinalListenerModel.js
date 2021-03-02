"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpinalListenerModel = void 0;
const spinal_core_connectorjs_type_1 = require("spinal-core-connectorjs_type");
class SpinalListenerModel extends spinal_core_connectorjs_type_1.Model {
    constructor(graph, context, network, deviceId, timeInterval = 5000) {
        super();
        this.add_attr({
            graph: new spinal_core_connectorjs_type_1.Ptr(graph),
            listen: true,
            timeInterval: timeInterval,
            deviceId: deviceId,
            context: context,
            network: network
        });
    }
}
exports.SpinalListenerModel = SpinalListenerModel;
spinal_core_connectorjs_type_1.spinalCore.register_models([SpinalListenerModel]);
exports.default = SpinalListenerModel;
//# sourceMappingURL=SpinalListenerModel.js.map