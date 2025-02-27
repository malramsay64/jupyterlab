/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import { JSONObject } from '@phosphor/coreutils';

import { Widget } from '@phosphor/widgets';

import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import * as VegaModuleType from 'vega-embed';

/**
 * The CSS class to add to the Vega and Vega-Lite widget.
 */
const VEGA_COMMON_CLASS = 'jp-RenderedVegaCommon5';

/**
 * The CSS class to add to the Vega.
 */
const VEGA_CLASS = 'jp-RenderedVega5';

/**
 * The CSS class to add to the Vega-Lite.
 */
const VEGALITE_CLASS = 'jp-RenderedVegaLite3';

/**
 * The MIME type for Vega.
 *
 * #### Notes
 * The version of this follows the major version of Vega.
 */
export const VEGA_MIME_TYPE = 'application/vnd.vega.v5+json';

/**
 * The MIME type for Vega-Lite.
 *
 * #### Notes
 * The version of this follows the major version of Vega-Lite.
 */
export const VEGALITE_MIME_TYPE = 'application/vnd.vegalite.v3+json';

/**
 * A regex to test for a protocol in a URI.
 */
const protocolRegex = /^[A-Za-z]:/;

/**
 * A widget for rendering Vega or Vega-Lite data, for usage with rendermime.
 */
export class RenderedVega extends Widget implements IRenderMime.IRenderer {
  private _result: VegaModuleType.Result;

  /**
   * Create a new widget for rendering Vega/Vega-Lite.
   */
  constructor(options: IRenderMime.IRendererOptions) {
    super();
    this._mimeType = options.mimeType;
    this._resolver = options.resolver;
    this.addClass(VEGA_COMMON_CLASS);
    this.addClass(
      this._mimeType === VEGA_MIME_TYPE ? VEGA_CLASS : VEGALITE_CLASS
    );
  }

  /**
   * Render Vega/Vega-Lite into this widget's node.
   */
  async renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const spec = model.data[this._mimeType] as JSONObject;
    const metadata = model.metadata[this._mimeType] as {
      embed_options?: VegaModuleType.EmbedOptions;
    };
    const embedOptions =
      metadata && metadata.embed_options ? metadata.embed_options : {};
    const mode: VegaModuleType.Mode =
      this._mimeType === VEGA_MIME_TYPE ? 'vega' : 'vega-lite';

    const vega =
      Private.vega != null ? Private.vega : await Private.ensureVega();

    const el = document.createElement('div');

    // clear the output before attaching a chart
    this.node.textContent = '';
    this.node.appendChild(el);

    if (this._result) {
      this._result.view.finalize();
    }

    const loader = vega.vega.loader({
      http: { credentials: 'same-origin' }
    });
    const sanitize = async (uri: string, options: any) => {
      // If the uri is a path, get the download URI
      if (!protocolRegex.test(uri)) {
        uri = await this._resolver.getDownloadUrl(uri);
      }
      return loader.sanitize(uri, options);
    };

    this._result = await vega.default(el, spec, {
      actions: true,
      defaultStyle: true,
      ...embedOptions,
      mode,
      loader: { ...loader, sanitize }
    });

    if (model.data['image/png']) {
      return;
    }

    // Add png representation of vega chart to output
    const imageURL = await this._result.view.toImageURL('png');
    model.setData({
      data: { ...model.data, 'image/png': imageURL.split(',')[1] }
    });
  }

  dispose(): void {
    if (this._result) {
      this._result.view.finalize();
    }
    super.dispose();
  }

  private _mimeType: string;
  private _resolver: IRenderMime.IResolver;
}

/**
 * A mime renderer factory for vega data.
 */
export const rendererFactory: IRenderMime.IRendererFactory = {
  safe: true,
  mimeTypes: [VEGA_MIME_TYPE, VEGALITE_MIME_TYPE],
  createRenderer: options => new RenderedVega(options)
};

const extension: IRenderMime.IExtension = {
  id: '@jupyterlab/vega5-extension:factory',
  rendererFactory,
  rank: 57,
  dataType: 'json',
  documentWidgetFactoryOptions: [
    {
      name: 'Vega5',
      primaryFileType: 'vega5',
      fileTypes: ['vega5', 'json'],
      defaultFor: ['vega5']
    },
    {
      name: 'Vega-Lite3',
      primaryFileType: 'vega-lite3',
      fileTypes: ['vega-lite3', 'json'],
      defaultFor: ['vega-lite3']
    }
  ],
  fileTypes: [
    {
      mimeTypes: [VEGA_MIME_TYPE],
      name: 'vega5',
      extensions: ['.vg', '.vg.json', '.vega'],
      iconClass: 'jp-MaterialIcon jp-VegaIcon'
    },
    {
      mimeTypes: [VEGALITE_MIME_TYPE],
      name: 'vega-lite3',
      extensions: ['.vl', '.vl.json', '.vegalite'],
      iconClass: 'jp-MaterialIcon jp-VegaIcon'
    }
  ]
};

export default extension;

/**
 * A namespace for private module data.
 */
namespace Private {
  /**
   * A cached reference to the vega library.
   */
  export let vega: typeof VegaModuleType;

  /**
   * A Promise for the initial load of vega.
   */
  export let vegaReady: Promise<typeof VegaModuleType>;

  /**
   * Lazy-load and cache the vega-embed library
   */
  export function ensureVega(): Promise<typeof VegaModuleType> {
    if (vegaReady) {
      return vegaReady;
    }

    vegaReady = import('./built-vega-embed') as any;

    return vegaReady;
  }
}
