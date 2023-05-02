import {whiteboardStore} from '../store/WhiteboardStore';
import {type EventElement, useEvent} from './useEvents';
import {type RefObject} from 'react';
import {useWhiteboard} from '../core/useWhiteboard';

export const useWheelZoom = (canvasRef: RefObject<EventElement>) => {
	const app = useWhiteboard();
	useEvent(canvasRef, 'wheel', (e: WheelEvent) => {
		const zoom = Math.max(0.1, Math.min(10, app.camera.zoom + ((e.deltaY > 0 ? -0.1 : 0.1) * app.camera.zoom)));
		const x = e.clientX - ((e.clientX - app.camera.x) * zoom / app.camera.zoom);
		const y = e.clientY - ((e.clientY - app.camera.y) * zoom / app.camera.zoom);
		app.patchState({document: {camera: {x, y, zoom}}}, 'zoom');
	});
};
