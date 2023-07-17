import {BaseActivity} from '~core/activities/BaseActivity';
import {type WhiteboardApp} from '~core/WhiteboardApp';
import {createBounds} from '~core/utils';
import {type Point} from '~core/types';
import {QuadTree} from '~core/utils/QuadTree';
import {getLayerUtil, type Layer} from '~core/layers';

export class SelectActivity extends BaseActivity {
	type = 'select' as const;
	private initPoint?: Point;
	private readonly tree: QuadTree<Layer>;

	public constructor(protected app: WhiteboardApp) {
		super(app);
		this.tree = new QuadTree<Layer>();
		for (const layer of app.document.layers.getAll()) {
			const utils = getLayerUtil(layer);
			this.tree.insert({
				bounds: utils.getBounds(layer as never),
				data: layer,
			});
		}
	}

	abort() {
		this.app.patchState({
			appState: {
				selection: null,
			},
		});
	}

	complete() {
		return this.abort();
	}

	start(): void {
		this.initPoint = this.app.currentPoint;
	}

	update(): void {
		if (!this.initPoint) {
			return;
		}

		const selection = createBounds(this.initPoint, this.app.currentPoint);

		const selectedLayers = this.tree.query(selection).map(item => item.id);

		this.app.patchState({
			appState: {
				selectedLayers,
				selection,
			},
		});
	}
}
