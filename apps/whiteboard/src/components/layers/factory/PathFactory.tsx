import React from 'react';
import {getStroke} from 'perfect-freehand';
import {z} from 'zod';
import {BaseLayerSchema, createLayerComponent, LayerFactory} from './LayerFactory';
import {type Bounds} from '../../../utils/types';

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
	x: z.number(),
	y: z.number(),
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
	public component = createLayerComponent<z.infer<typeof PathSchema>>(({data, ...props}) => {
		const {points, strokeOptions, color, x, y} = data;
		const path = strokeToPath(getStroke(points, strokeOptions));
		return <path d={path} fill={color} transform={`translate(${x},${y})`} {...props}/>;
	});

	public constructor() {
		super('path', PathSchema);
	}

	public getBounds({points, x, y}: z.infer<typeof PathSchema>): Bounds {
		const {minX, maxX, minY, maxY} = points.reduce(
			(acc, [x, y]) => ({
				minX: Math.min(acc.minX, x),
				maxX: Math.max(acc.maxX, x),
				minY: Math.min(acc.minY, y),
				maxY: Math.max(acc.maxY, y),
			}),
			{
				minX: Infinity,
				maxX: -Infinity,
				minY: Infinity,
				maxY: -Infinity,
			},
		);
		return {x: x + minX, y: y + minY, width: maxX - minX, height: maxY - minY};
	}
}