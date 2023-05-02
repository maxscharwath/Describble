import {type EventElement, useEvents} from './useEvents';
import {type MouseEvent, type RefObject, useRef} from 'react';
import {useWhiteboard} from '../core/useWhiteboard';

export const useWheelPan = (canvasRef: RefObject<EventElement>) => {
	const initialWheelPosition = useRef<{x: number; y: number} | null>(null);
	const app = useWhiteboard();
	useEvents(canvasRef, {
		mousedown(e: MouseEvent) {
			if (e.button === 1) {
				initialWheelPosition.current = {x: e.clientX, y: e.clientY};
			}
		},
		mousemove(e: MouseEvent) {
			if (initialWheelPosition.current) {
				const deltaX = e.clientX - initialWheelPosition.current.x;
				const deltaY = e.clientY - initialWheelPosition.current.y;

				app.patchState({document: {camera: {x: app.camera.x + deltaX, y: app.camera.y + deltaY}}}, 'pan');

				initialWheelPosition.current = {x: e.clientX, y: e.clientY};
			}
		},
		mouseup(e: MouseEvent) {
			if (e.button === 1) {
				initialWheelPosition.current = null;
			}
		},
	});
};
