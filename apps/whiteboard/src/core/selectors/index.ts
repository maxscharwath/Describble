import {type WhiteboardState} from '~core/WhiteboardApp';

export const documentSelector = (state: WhiteboardState) => state.documents[state.appState.currentDocumentId];

export const cameraSelector = (state: WhiteboardState) => documentSelector(state).camera;

export const layersSelector = (state: WhiteboardState) => documentSelector(state).layers;

export const layerSelector = (layerId: string) => (state: WhiteboardState) => layersSelector(state)[layerId];

export const selectionSelector = (state: WhiteboardState) => state.appState.selection;
