/*
 * Copyright 2022 SpinalCom - www.spinalcom.com
 *
 * This file is part of SpinalCore.
 *
 * Please read all of the following terms and conditions
 * of the Free Software license Agreement ("Agreement")
 * carefully.
 *
 * This Agreement is a legally binding contract between
 * the Licensee (as defined below) and SpinalCom that
 * sets forth the terms and conditions that govern your
 * use of the Program. By installing and/or using the
 * Program, you agree to abide by all the terms and
 * conditions stated or referenced herein.
 *
 * If you do not agree to abide by these terms and
 * conditions, do not demonstrate your acceptance and do
 * not install or use the Program.
 * You should have received a copy of the license along
 * with this file. If not, see
 * <http://resources.spinalcom.com/licenses.pdf>.
 */

import { SpinalQueue, PILOT_STATES } from "spinal-connector-service";
import { IRequest, SpinalPilotModel } from "spinal-model-bacnet";

import BacnetUtilities from "../utilities/BacnetUtilities";

// the write priority is optional and not declared in IRequest
interface IPilotRequest extends IRequest {
	priority?: number | string;
}

class SpinalPilot {
	private queue: SpinalQueue<SpinalPilotModel> = new SpinalQueue();
	private isProcessing: boolean = false;
	private static instance: SpinalPilot;

	private constructor() {}

	public static getInstance(): SpinalPilot {
		if (!this.instance) {
			this.instance = new SpinalPilot();
			this.instance.init();
		}
		return this.instance;
	}

	private init() {
		this.queue.on("start", () => {
			console.log("[onCallback] start pilot...");
			this.pilot();
		});
	}

	public async addToPilotList(spinalPilotModel: SpinalPilotModel): Promise<void> {
		this.queue.addToQueue(spinalPilotModel);
	}

	private async pilot(): Promise<void> {
		if (this.isProcessing) return;

		this.isProcessing = true;

		try {
			while (!this.queue.isEmpty()) {
				const pilot = this.queue.dequeue();

				if (!pilot) {
					continue;
				}

				await this._handlePilot(pilot);
			}
		} finally {
			this.isProcessing = false;
		}
	}

	private async _handlePilot(pilot: SpinalPilotModel): Promise<void> {
		const actualState = pilot.state.get();

		// if the pilot is already treated, we remove it from the graph and exit
		if (actualState === PILOT_STATES.error || actualState === PILOT_STATES.success) {
			console.log("[_handlePilot] pilot already treated with state:", actualState);
			await pilot.removeFromGraph();
			return;
		}

		try {
			pilot.changeState(PILOT_STATES.processing);
			const requests = pilot.requests.get() as IPilotRequest[];
			if (!Array.isArray(requests) || requests.length === 0) {
				throw new Error("Pilot request list is empty");
			}

			for (const request of requests) {
				await BacnetUtilities.sendPilotRequest(request);
			}

			console.log("[_handlePilot] pilot success");

			pilot.changeState(PILOT_STATES.success);
		} catch (error: any) {
			console.error(`[_handlePilot] pilot failed due to: "${error.message}"`);
			pilot.changeState(PILOT_STATES.error);
		} finally {
			await pilot.removeFromGraph();
		}
	}
}

const spinalPilot = SpinalPilot.getInstance();

export default spinalPilot;
export { spinalPilot };
