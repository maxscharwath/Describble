import {type WhiteboardApp} from '~core/WhiteboardApp';

export class PointerEventManager {
	public isPointerDown = false;

	constructor(private readonly app: WhiteboardApp) {}

	public onPointerMove = (event: React.PointerEvent, target: string) => {
		event.stopPropagation();
		this.app.updateInput(event);
		this.app.currentTool?.onPointerMove?.(event, target);
	};

	public onPointerDown = (event: React.PointerEvent, target: string) => {
		event.stopPropagation();
		this.isPointerDown = true;
		this.app.updateInput(event);
		this.app.currentTool?.onPointerDown?.(event, target);
	};

	public onPointerUp = (event: React.PointerEvent, target: string) => {
		event.stopPropagation();
		this.isPointerDown = false;
		this.app.updateInput(event);
		this.app.currentTool?.onPointerUp?.(event, target);
	};

	public onLayerDown = (event: React.PointerEvent, target: string) => {
		this.app.updateInput(event);
		this.app.currentTool?.onLayerDown?.(event, target);
	};

	public onLayerMove = (event: React.PointerEvent, target: string) => {
		this.app.updateInput(event);
		this.app.currentTool?.onLayerMove?.(event, target);
	};

	public onLayerUp = (event: React.PointerEvent, target: string) => {
		this.app.updateInput(event);
		this.app.currentTool?.onLayerUp?.(event, target);
	};

	public onCanvasDown = (event: React.PointerEvent) => {
		this.app.updateInput(event);
		this.app.currentTool?.onCanvasDown?.(event, 'canvas');
	};

	public onCanvasMove = (event: React.PointerEvent) => {
		this.app.updateInput(event);
		this.app.currentTool?.onCanvasMove?.(event, 'canvas');
	};

	public onCanvasUp = (event: React.PointerEvent) => {
		this.app.updateInput(event);
		this.app.currentTool?.onCanvasUp?.(event, 'canvas');
	};
}
