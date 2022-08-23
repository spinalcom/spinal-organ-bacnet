import { WaitModelReady } from "../utilities/Functions"
import { spinalMonitoring } from "../modules/SpinalMonitoring";


process.on("message",async ({organModel, spinalListenerModel}: any) => {
    await WaitModelReady();

   spinalListenerModel.organ.load((organ) => {
      if (organ) {
         if (organ.id?.get() === organModel.id?.get()) {
            spinalMonitoring.addToMonitoringList(spinalListenerModel);
         }
      }
   })
})

// export const SpinalPilotCallback = async (spinalPilotModel: SpinalPilotModel, organModel: SpinalOrganConfigModel): Promise<void> => {
//     await WaitModelReady();
//     if (spinalPilotModel.organ?.id.get() === organModel.id?.get()) {
//        spinalPilot.addToPilotList(spinalPilotModel);
//     }
//  }