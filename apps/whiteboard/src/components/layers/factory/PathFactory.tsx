import React, {useMemo} from 'react';
import {getStroke} from 'perfect-freehand';
import {z} from 'zod';
import {BaseLayerSchema, LayerFactory} from './LayerFactory';

/**
 * Convert a stroke to a path string with quadratic curves
 * @param stroke - A stroke as an array of [x, y, pressure] points
 */
function strokeToPath(stroke: number[][]) {
	if (!stroke.length) {
		return '';
	}

	const d = stroke.reduce(
		(acc, [x0, y0], i, arr) => {
			const [x1, y1] = arr[(i + 1) % arr.length];
			acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
			return acc;
		},
		['M', ...stroke[0], 'Q'],
	);

	return [...d, 'Z'].join(' ');
}

export const PathSchema = BaseLayerSchema.extend({
	type: z.literal('path'),
	points: z.array(z.array(z.number())).refine(value => value.length > 1, 'Path must have at least 2 points'),
	color: z.string(),
	strokeOptions: z.object({
		size: z.number(),
		thinning: z.number(),
		smoothing: z.number(),
		roundness: z.number(),
	}).partial(),
});

export class PathFactory extends LayerFactory<typeof PathSchema> {
	constructor() {
		super('path', PathSchema);
	}

	createComponent(props: z.infer<typeof PathSchema>): React.ReactElement {
		const {points, strokeOptions, color} = props;
		const path = useMemo(() => {
			const stroke = getStroke(points, strokeOptions);
			return strokeToPath(stroke);
		}, [points, strokeOptions]);
		return <path d={path} fill={color}/>;
	}
}
