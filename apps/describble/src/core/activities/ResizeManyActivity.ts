import {BaseActivity} from '~core/activities/BaseActivity';
import {getLayerUtil, type Layer} from '~core/layers';
import {type BaseLayerUtil} from '~core/layers/BaseLayerUtil';
import {type Bounds, BoundsHandle} from '~core/types';
import {type WhiteboardApp} from '~core/WhiteboardApp';
import {resizeBounds} from '~core/activities/ResizeActivity';

export class ResizeManyActivity extends BaseActivity {
	type = 'resize-many' as const;
	private readonly initLayers: Record<string, {layer: Layer; util: BaseLayerUtil<any>; bounds: Bounds}>;
	private readonly initBounds: Bounds;
	private readonly aspectRatio?: number;

	constructor(app: WhiteboardApp, private readonly layerIds: string[], private readonly create = false, private readonly resizeCorner: BoundsHandle = BoundsHandle.BOTTOM + BoundsHandle.RIGHT) {
		super(app);
		this.initLayers = {};
		layerIds.forEach(id => {
			const layer = app.document.layers.get(id);
			if (layer) {
				const util = getLayerUtil(layer);
				this.initLayers[id] = {
					layer,
					util,
					bounds: util.getBounds(layer as never),
				};
			}
		});
		this.initBounds = this.getMultiLayerBounds();
		if (this.initBounds.width && this.initBounds.height) {
			this.aspectRatio = this.initBounds.width / this.initBounds.height;
		}
	}

	public abort(): void {
		if (this.create) {
			this.app.document.layers.delete(this.layerIds, 'reset-layer');
		} else {
			this.app.document.layers.change(Object.values(this.initLayers).map(({layer, util, bounds}) => [layer.id, (l: Layer) => {
				util.resize(l, layer, bounds);
			}], 'abort-translate-layer'));
		}
	}

	public complete(): void {
		const {layers} = this.app.document.state;
		this.app.document.addCommand({
			message: 'Resize many layers',
			before: state => {
				this.layerIds.forEach(id => {
					const {layer, util, bounds} = this.initLayers[id];
					if (!layer) {
						return;
					}

					if (this.create) {
						// eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- dynamic delete is fine here
						delete state.layers[id];
						return;
					}

					util.resize(state.layers[id], layer, bounds);
					state.layers[id].timestamp = Date.now();
				});
			},
			after: state => {
				this.layerIds.forEach(id => {
					const layer = layers[id];
					if (!layer) {
						return;
					}

					if (this.create) {
						state.layers[id] = layer;
						return;
					}

					const util = getLayerUtil(layer) as BaseLayerUtil<any>;
					const bounds = util.getBounds(layer as never);
					util.resize(state.layers[id], layer, bounds);
					state.layers[id].timestamp = Date.now();
				});
			},
		});
	}

	public start(): void {
		//
	}

	public update(): void {
		// Compute new overall bounds
		const {x, y, width, height} = this.initBounds;

		let aspectRatio;
		if (this.app.keyboardEvent.event?.shiftKey) {
			aspectRatio = this.aspectRatio;
		}

		const newBounds = resizeBounds(this.initBounds, this.app.currentPoint, this.resizeCorner, aspectRatio);

		// Compute scaling and translation factors
		const scaleX = newBounds.width / width;
		const scaleY = newBounds.height / height;
		const deltaX = newBounds.x - x;
		const deltaY = newBounds.y - y;

		// Apply scaling and translation to each layer
		const newLayers: Array<[string, (layer: Layer) => void]> = [];
		for (const id of this.layerIds) {
			const {layer, util, bounds} = this.initLayers[id];
			const {x: lx, y: ly, width: lw, height: lh} = bounds;
			const resizedBounds = {
				x: x + ((lx - x) * scaleX) + deltaX,
				y: y + ((ly - y) * scaleY) + deltaY,
				width: lw * scaleX,
				height: lh * scaleY,
			};
			newLayers.push([id, (l: Layer) => {
				util.resize(l, layer, resizedBounds);
			}]);
		}

		this.app.document.layers.change(newLayers, 'resize-many');
	}

	private getMultiLayerBounds(): Bounds {
		// Compute the minimal bounding box that includes all layers' bounds.
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		Object.values(this.initLayers).forEach(({bounds}) => {
			const {x, y, width, height} = bounds;
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x + width);
			maxY = Math.max(maxY, y + height);
		});
		return {x: minX, y: minY, width: maxX - minX, height: maxY - minY};
	}
}
