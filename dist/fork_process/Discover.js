"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Functions_1 = require("../utilities/Functions");
const SpinalDiscover_1 = require("../modules/SpinalDiscover");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
process.on("message", ({ organModel, model }) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    yield Functions_1.WaitModelReady();
    const minute = 2 * (60 * 1000);
    const time = Date.now();
    const creation = ((_a = model.creation) === null || _a === void 0 ? void 0 : _a.get()) || 0;
    if (((_b = organModel.id) === null || _b === void 0 ? void 0 : _b.get()) !== ((_d = (_c = model.organ) === null || _c === void 0 ? void 0 : _c.id) === null || _d === void 0 ? void 0 : _d.get()) || (time - creation) < minute || model.state.get() !== spinal_model_bacnet_1.STATES.created) {
        model.setTimeoutMode();
        yield model.remove();
        process.exit();
    }
    const spinalDiscover = new SpinalDiscover_1.SpinalDiscover(model);
    spinalDiscover.init();
    let bindSateProcess = model.state.bind(() => {
        const state = model.state.get();
        switch (state) {
            case spinal_model_bacnet_1.STATES.discovered:
                model.state.unbind(bindSateProcess);
                process.exit();
            // case STATES.timeout:
            //    if (!timeout) {
            //       this.emit("next");
            //    }
            //    timeout = true;
            default:
                break;
        }
    });
    // discover.addToQueue(model)
    // new SpinalDiscover(spinalDisoverModel);
}));
// export const SpinalDiscoverCallback = async (spinalDisoverModel: SpinalDisoverModel, organModel: SpinalOrganConfigModel): Promise<void | boolean> => {
//    await WaitModelReady();
//    if (organModel.id?.get() === spinalDisoverModel.organ?.id?.get()) {
//       const minute = 2 * (60 * 1000)
//       const time = Date.now();
//       const creation = spinalDisoverModel.creation?.get() || 0;
//       // Check if model is not timeout.
//       if ((time - creation) >= minute || spinalDisoverModel.state.get() === STATES.created) {
//          spinalDisoverModel.setTimeoutMode();
//          return spinalDisoverModel.remove();
//       }
//       discover.addToQueue(spinalDisoverModel)
//       // new SpinalDiscover(spinalDisoverModel);
//    }
// }
//# sourceMappingURL=Discover.js.map