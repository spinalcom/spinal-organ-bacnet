"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpinalDisoverModel = void 0;
const spinal_core_connectorjs_type_1 = require("spinal-core-connectorjs_type");
const stateEnum_1 = require("../utilities/stateEnum");
class SpinalDisoverModel extends spinal_core_connectorjs_type_1.Model {
    constructor(graph, contextInfo, network) {
        super();
        // if (!this.graph.info.discover) {
        //    this.graph.info.add_attr({
        //       discover: new Ptr(new Lst())
        //    })
        // }
        this.add_attr({
            state: stateEnum_1.STATES.reseted,
            graph: new spinal_core_connectorjs_type_1.Ptr(graph),
            devices: new spinal_core_connectorjs_type_1.Lst(),
            context: contextInfo,
            network: network
        });
    }
}
exports.SpinalDisoverModel = SpinalDisoverModel;
spinal_core_connectorjs_type_1.spinalCore.register_models([SpinalDisoverModel]);
exports.default = SpinalDisoverModel;
//# sourceMappingURL=SpinalDiscoverModel.js.map