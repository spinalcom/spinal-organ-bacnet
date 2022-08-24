import { WaitModelReady } from "../utilities/Functions"
import { SpinalDiscover } from "../modules/SpinalDiscover";
import { SpinalDisoverModel, SpinalOrganConfigModel, STATES } from "spinal-model-bacnet";


process.on("message", async ({ organModel, model }: any) => {
   await WaitModelReady();

   const minute = 2 * (60 * 1000);
   const time = Date.now();
   const creation = model.creation?.get() || 0;

   if (organModel.id?.get() !== model.organ?.id?.get() || (time - creation) < minute || model.state.get() !== STATES.created) {
      model.setTimeoutMode();
      await model.remove();
      process.exit();
   }

   const spinalDiscover = new SpinalDiscover(model);
   spinalDiscover.init();

   let bindSateProcess = model.state.bind(() => {
      const state = model.state.get()

      switch (state) {
         case STATES.discovered:
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
   })


   // discover.addToQueue(model)
   // new SpinalDiscover(spinalDisoverModel);

})


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