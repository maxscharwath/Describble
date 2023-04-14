import {type PointerEventHandler, type RefObject} from 'react';
import {type EventElement, useEvents} from './useEvents';

export const usePointerEvents = <TElement extends EventElement> (
	ref: RefObject<TElement>,
	events: {
		onPointerDown?: PointerEventHandler<TElement>;
		onPointerMove?: PointerEventHandler<TElement>;
		onPointerUp?: PointerEventHandler<TElement>;
	},
) => {
	useEvents(ref, {
		pointerdown: events.onPointerDown,
		pointermove: events.onPointerMove,
		pointerup: events.onPointerUp,
	});
};
