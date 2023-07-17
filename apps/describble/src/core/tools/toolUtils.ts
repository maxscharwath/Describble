import {type BaseTool} from '~core/tools/BaseTool';

type Tools<T extends BaseTool[]> = {[K in T[number]['type']]: Extract<T[number], {type: K}>};
export const createTools = <T extends BaseTool[]> (...tools: T): Tools<T> => (
	tools.reduce<Partial<Tools<T>>>((acc, tool) => ({
		...acc,
		[tool.type]: tool,
	}), {}) as Tools<T>
);

export type ToolsKey<T extends Tools<never>> = keyof T & string;
export type ToolsValue<T extends Tools<never>> = T[ToolsKey<T>];
export type ToolsConfig<T extends Tools<never>, K extends ToolsKey<T> = ToolsKey<T>> =
	T[K] extends {onActivate: (config: infer C) => void} ? C : never;

export const makeGetTools = <T extends Tools<never>> (tools: T) => <K extends ToolsKey<T>> (tool: K): T[K] => tools[tool];
