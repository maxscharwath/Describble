import React from 'react';
import {deepmerge} from '~core/utils';
import {type BaseLayer, BaseLayerUtil} from '~core/layers/BaseLayerUtil';
import {type Bounds} from '~core/types';
import {defaultLayerStyle, getBaseStyle} from '~core/layers/shared';

const type = 'circle' as const;
type TLayer = CircleLayer;
type TElement = SVGEllipseElement;

export interface CircleLayer extends BaseLayer {
	type: typeof type;
	rx: number;
	ry: number;
}

export class CircleLayerUtil extends BaseLayerUtil<TLayer> {
	type = type;
	Component = BaseLayerUtil.makeComponent<TLayer, TElement>(({layer}, ref) =>
		<ellipse
			ref={ref}
			cx={layer.position.x}
			cy={layer.position.y}
			rx={layer.rx}
			ry={layer.ry}
			transform={`rotate(${layer.rotation})`}
			{...getBaseStyle(layer.style)}
		/>,
	);

	public getLayer(props: Partial<TLayer>): TLayer {
		return deepmerge<TLayer>(
			{
				id: '',
				name: '',
				type,
				visible: true,
				position: {x: 0, y: 0},
				rotation: 0,
				rx: 0,
				ry: 0,
				style: defaultLayerStyle,
			}, props);
	}

	public getBounds(layer: TLayer): Bounds {
		const {position: {x, y}, rx, ry} = layer;
		return {
			x: x - rx,
			y: y - ry,
			width: rx * 2,
			height: ry * 2,
		};
	}

	resize(layer: TLayer, bounds: Bounds): Partial<TLayer> {
		// Apply transform-origin: center center;
		const {x, y, width, height} = bounds;
		return {
			position: {
				x: x + (width / 2),
				y: y + (height / 2),
			},
			rx: Math.abs(width / 2),
			ry: Math.abs(height / 2),
		};
	}
}
