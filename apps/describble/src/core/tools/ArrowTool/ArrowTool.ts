import {nanoid} from 'nanoid';
import {Arrow} from '~core/layers';
import {ResizeActivity} from '~core/activities/ResizeActivity';
import {BaseTool, Status} from '../BaseTool';

export class ArrowTool extends BaseTool {
	type = 'arrow' as const;
	onPointerDown = (event: React.PointerEvent) => {
		if (this.status !== Status.Idle || event.button !== 0) {
			return;
		}

		const initPoint = this.app.getCanvasPoint({x: event.clientX, y: event.clientY});
		const layer = Arrow.create({
			id: nanoid(),
			position: initPoint,
			style: this.app.state.appState.currentStyle,
		});
		this.app.document.layers.add(layer);
		this.app.activity.startActivity(ResizeActivity, layer.id, true);
		this.setStatus(Status.Creating);
	};
}
