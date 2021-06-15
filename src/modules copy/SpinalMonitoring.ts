export default class SpinalMonitoring {
   private monitorModel: any;
   private intervalId: any;
   private monitoringProcess: any;
   private intervalProcess: any;
   private updateFunc: Function;

   // constructor(model: any, callback: any) {
   constructor(model: any, callback: Function) {
      this.monitorModel = model;
      this.updateFunc = callback
   }

   start() {
      if (isNaN(this.monitorModel.interval.get())) {
         // console.log("isNaN")
         this.stop();
         return
      };

      this.monitoringProcess = this.monitorModel.monitoring.bind(() => {
         if (!this.monitorModel.monitoring.get()) {
            // console.log("!this.monitorModel.monitoring.get()")
            this.stop();
            return
         };

         this.intervalProcess = this.monitorModel.interval.bind(() => {
            // console.log("inside interval bind")
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => {
               const children = this.monitorModel.children.get();
               this.updateFunc(children);
            }, this.monitorModel.interval.get())
         })

      })
   }

   stop() {
      // console.log("stop")
      clearInterval(this.intervalId);
      this.monitorModel.monitoring.unbind(this.monitoringProcess);
      this.monitorModel.interval.unbind(this.intervalProcess);
   }
}