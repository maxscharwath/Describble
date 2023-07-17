import {BaseActivity} from '~core/activities/BaseActivity';
import {type WhiteboardApp} from '~core/WhiteboardApp';
import {type Layer} from '~core/layers';
import {type PathLayer} from '~core/layers/Path';
import {deepcopy} from '~core/utils';

export class DrawActivity extends BaseActivity {
	type = 'draw' as const;
	private readonly initLayer: Layer | undefined;

	constructor(app: WhiteboardApp, private readonly layerId: string) {
		super(app);
		this.initLayer = app.document.layers.get(layerId);
	}

	abort() {
		this.app.document.layers.delete(this.layerId);
	}

	complete(): void {
		const layer = this.app.document.layers.get<PathLayer>(this.layerId);
		if (!this.initLayer || !layer) {
			return;
		}

		if (layer.path.length < 2) {
			return this.abort();
		}

		this.app.document.addCommand({
			message: 'Add path',
			before: state => {
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- delete layer
				delete state.layers[this.layerId];
			},
			after: state => {
				state.layers[this.layerId] = deepcopy(layer);
			},
		});
	}

	start(): void {
		//
	}

	update(): void {
		const layer = this.app.document.layers.get<PathLayer>(this.layerId);
		if (!this.initLayer || !layer) {
			return;
		}

		this.app.document.layers.change([
			[layer.id, (layer: PathLayer) => {
				const {x, y, pressure} = this.app.currentPoint;
				const initPoint = this.initLayer!.position;
				const point = [x - initPoint.x, y - initPoint.y, pressure];
				const lastPoint = layer.path[layer.path.length - 1];
				if (lastPoint) {
					const delta: number = Math.hypot(point[0] - lastPoint[0], point[1] - lastPoint[1]);
					if (delta < 1) {
						return;
					}
				}

				layer.path.push(point);
			}],
		], 'add-point');
	}
}
