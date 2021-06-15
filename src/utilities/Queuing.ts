import * as lodash from "lodash";
import { EventEmitter } from "events";


export enum Events {
   FINISH = "finish",
   START = "start",
}

export class SpinalQueuing extends EventEmitter {



   private processed: Array<any> = [];
   private queueList: Array<any> = [];

   public percent: number = 0;
   public length: number;
   public debounceStart = lodash.debounce(this.begin, 3000);

   constructor() {
      super();
   }

   public addToQueue(obj: any): number {
      this.queueList.push(obj);
      this.length = this.queueList.length;
      this.debounceStart();
      return this.length;
   }

   public setQueue(queue: any[]): number {
      this.queueList.push(...queue);
      this.length = this.queueList.length;
      this.debounceStart();
      return this.length;
   }

   public dequeue(): any {
      const item = this.queueList.shift();

      if (typeof item === "undefined") this.finish();
      else this.processed.push(item);

      this.percent = Math.floor((100 * this.processed.length) / this.length);
      return item;
   }


   private begin() {
      this.emit(Events.START)
   }

   private finish() {
      this.emit(Events.FINISH);
   }
}

export default SpinalQueuing;