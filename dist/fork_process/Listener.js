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
const SpinalMonitoring_1 = require("../modules/SpinalMonitoring");
process.on("message", ({ organModel, spinalListenerModel }) => __awaiter(void 0, void 0, void 0, function* () {
    yield Functions_1.WaitModelReady();
    spinalListenerModel.organ.load((organ) => {
        var _a, _b;
        if (organ) {
            if (((_a = organ.id) === null || _a === void 0 ? void 0 : _a.get()) === ((_b = organModel.id) === null || _b === void 0 ? void 0 : _b.get())) {
                SpinalMonitoring_1.spinalMonitoring.addToMonitoringList(spinalListenerModel);
            }
        }
    });
}));
// export const SpinalPilotCallback = async (spinalPilotModel: SpinalPilotModel, organModel: SpinalOrganConfigModel): Promise<void> => {
//     await WaitModelReady();
//     if (spinalPilotModel.organ?.id.get() === organModel.id?.get()) {
//        spinalPilot.addToPilotList(spinalPilotModel);
//     }
//  }
//# sourceMappingURL=Listener.js.map